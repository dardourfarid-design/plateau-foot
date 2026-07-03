// ===================== INTELLIGENCE ARTIFICIELLE =====================
// Fonctions pures qui choisissent un coup pour l'équipe au tour, à partir
// d'un état de jeu. Ne mute jamais l'état ; s'appuie uniquement sur
// listLegalMoves() et applyMove() du moteur, déjà testés.
//
// Trois niveaux : 'facile', 'moyen', 'difficile'. Chacun est une fonction
// (state) => move, ce qui permet de les tester individuellement et de les
// faire varier sans toucher au moteur ni à l'UI.

import { listLegalMoves, applyMove } from './gameEngine.js';
import { GOAL_COLS, GOAL_ROW_TOP, GOAL_ROW_BOTTOM, TEAMS } from './constants.js';

export const AI_LEVELS = Object.freeze({
  FACILE: 'facile',
  MOYEN: 'moyen',
  DIFFICILE: 'difficile'
});

function targetGoalRow(team) {
  // L'équipe Bleu attaque vers la ligne 0 (cage Rouge), Rouge attaque vers
  // la dernière ligne (cage Bleu) — cohérent avec checkGoalCell dans gameEngine.js.
  return team === TEAMS.BLEU ? GOAL_ROW_TOP : GOAL_ROW_BOTTOM;
}

function ownGoalRow(team) {
  return team === TEAMS.BLEU ? GOAL_ROW_BOTTOM : GOAL_ROW_TOP;
}

function isWinningMove(state, move) {
  const team = state.turn;
  const scoreBefore = state.score[team];
  const next = applyMove(state, move);
  return next.lastGoalBy === team && next.score[team] > scoreBefore;
}

// Distance simple (Tchebychev, cohérente avec un déplacement en 8 directions)
// entre une position de ballon hypothétique et la cage adverse visée.
function distanceToGoal(row, col, team) {
  const goalRow = targetGoalRow(team);
  const goalCol = GOAL_COLS[1]; // colonne centrale de la cage
  return Math.max(Math.abs(row - goalRow), Math.abs(col - goalCol));
}

function pickRandom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

/**
 * Score heuristique simple d'un état, du point de vue de `team` : plus le
 * score est élevé, meilleur est l'état pour cette équipe. Combine l'écart
 * de buts (dominant) et la proximité du ballon à la cage adverse.
 */
function evaluateState(state, team) {
  const opponent = team === TEAMS.BLEU ? TEAMS.ROUGE : TEAMS.BLEU;
  const goalDiff = state.score[team] - state.score[opponent];
  const ballProximityScore = -distanceToGoal(state.ball.row, state.ball.col, team) * 0.1;
  return goalDiff * 100 + ballProximityScore;
}

/**
 * Niveau FACILE : coups aléatoires, avec une légère préférence pour les
 * coups qui font avancer le ballon vers la cage adverse plutôt qu'un
 * déplacement de pion sans rapport avec le ballon. Reste volontairement
 * imparfait — c'est le niveau pour découvrir le jeu sans frustration.
 */
// Distance (Tchebychev) d'une poussée de ballon, pour brider l'IA facile.
function pushDistance(state, move) {
  if (!move.passTo) return 0;
  return Math.max(
    Math.abs(move.passTo[0] - state.ball.row),
    Math.abs(move.passTo[1] - state.ball.col)
  );
}

const FACILE_MAX_PUSH = 2;

function chooseMoveFacile(state) {
  const allMoves = listLegalMoves(state);
  if (allMoves.length === 0) return null;

  // L'IA facile ne fait JAMAIS de poussée de plus de 2 cases : une IA
  // « facile » qui traversait le plateau et marquait dès son premier tour
  // punissait la moindre erreur d'un débutant (churn garanti). Si tous les
  // coups légaux dépassent la limite (cas très rare), on retombe sur la
  // liste complète pour ne jamais bloquer la partie.
  const capped = allMoves.filter(m => pushDistance(state, m) <= FACILE_MAX_PUSH);
  const moves = capped.length > 0 ? capped : allMoves;

  // 60% du temps : coup totalement aléatoire (pour rester imprévisible et battable)
  if (Math.random() < 0.6) {
    return pickRandom(moves);
  }

  // 40% du temps : préfère un coup qui touche le ballon, sinon retombe sur aléatoire
  const ballMoves = moves.filter(m => m.type !== 'move');
  return ballMoves.length > 0 ? pickRandom(ballMoves) : pickRandom(moves);
}

/**
 * Niveau MOYEN : priorise un tir gagnant immédiat s'il existe, sinon
 * priorise les coups qui rapprochent le ballon de la cage adverse,
 * avec un peu d'aléatoire pour ne pas être parfaitement prévisible.
 */
function chooseMoveMoyen(state) {
  const moves = listLegalMoves(state);
  if (moves.length === 0) return null;

  // 1. Un coup gagnant immédiat ? Le jouer sans hésiter.
  const winning = moves.find(m => isWinningMove(state, m));
  if (winning) return winning;

  // 2. Sinon, évaluer chaque coup par la position du ballon qu'il produit.
  const scored = moves.map(move => {
    const next = applyMove(state, move);
    return { move, score: evaluateState(next, state.turn) };
  });

  scored.sort((a, b) => b.score - a.score);

  // Garde les meilleurs 30% des coups et en tire un au hasard parmi eux,
  // pour rester fort sans être totalement déterministe.
  const topCount = Math.max(1, Math.ceil(scored.length * 0.3));
  const topMoves = scored.slice(0, topCount);
  return pickRandom(topMoves).move;
}

/**
 * Niveau DIFFICILE : recherche sur 2 tours (le coup de l'IA, puis le
 * meilleur coup adverse en réponse), façon mini-minimax simplifié.
 * Priorise systématiquement un but immédiat ; sinon choisit le coup qui
 * maximise sa position après la meilleure réplique adverse plausible.
 */
function chooseMoveDifficile(state) {
  const moves = listLegalMoves(state);
  if (moves.length === 0) return null;

  const winning = moves.find(m => isWinningMove(state, m));
  if (winning) return winning;

  const team = state.turn;
  let bestMove = null;
  let bestScore = -Infinity;

  // Pour limiter le coût de calcul (pas de souci de performance navigateur),
  // on ne regarde l'opposition que sur un sous-ensemble large mais borné
  // des coups les plus prometteurs en surface, puis on creuse un niveau de plus.
  const surfaceScored = moves.map(move => ({
    move,
    next: applyMove(state, move)
  }));

  surfaceScored.forEach(({ move, next }) => {
    let worstReply = evaluateState(next, team);

    if (!next.gameOver) {
      const replyMoves = listLegalMoves(next);
      // Limite à 12 réponses explorées pour rester rapide ; un échantillon
      // suffisamment large pour capter les répliques les plus dangereuses
      // sans énumérer exhaustivement un plateau à forte branche.
      const sampled = replyMoves.length > 12
        ? replyMoves.sort(() => Math.random() - 0.5).slice(0, 12)
        : replyMoves;

      sampled.forEach(replyMove => {
        const afterReply = applyMove(next, replyMove);
        const scoreForUs = evaluateState(afterReply, team);
        if (scoreForUs < worstReply) worstReply = scoreForUs;
      });
    }

    if (worstReply > bestScore) {
      bestScore = worstReply;
      bestMove = move;
    }
  });

  return bestMove || pickRandom(moves);
}

const STRATEGIES = {
  [AI_LEVELS.FACILE]: chooseMoveFacile,
  [AI_LEVELS.MOYEN]: chooseMoveMoyen,
  [AI_LEVELS.DIFFICILE]: chooseMoveDifficile
};

/**
 * Point d'entrée public : choisit un coup pour l'équipe au tour dans `state`,
 * selon le niveau demandé. Retourne null si aucun coup n'est possible
 * (ne devrait arriver qu'en fin de partie).
 */
export function chooseAiMove(state, level = AI_LEVELS.MOYEN) {
  const strategy = STRATEGIES[level] || chooseMoveMoyen;
  return strategy(state);
}
