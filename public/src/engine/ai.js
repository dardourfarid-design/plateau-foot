// ===================== INTELLIGENCE ARTIFICIELLE =====================
// Fonctions pures qui choisissent un coup pour l'équipe au tour, à partir
// d'un état de jeu. Ne mute jamais l'état ; s'appuie uniquement sur
// listLegalMoves() et applyMove() du moteur, déjà testés.
//
// Trois niveaux : 'facile', 'moyen', 'difficile'. Chacun est une fonction
// (state) => move, ce qui permet de les tester individuellement et de les
// faire varier sans toucher au moteur ni à l'UI.

import {
  listLegalMoves, applyMove, applyBallMovement, moveSelectedToken,
  passBall, passTurn, getPassDestinations, isAdjacent, PHASES
} from './gameEngine.js';
import {
  canActivatePower, POWER_TYPES, getPowerShotDestinations, activateTirPuissant,
  getSprintDestinations, activateSprint, activateMur, activateRelais,
  getValidRepliTargets, activateRepliAdverse
} from './powers.js';
import { GOAL_COLS, GOAL_ROW_TOP, GOAL_ROW_BOTTOM, BOARD_ROWS, TEAMS } from './constants.js';

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

// ===================== POUVOIRS CÔTÉ IA (#202) =====================
// L'IA n'utilisait jamais les pouvoirs de pion (limite connue) — asymétrie de
// règles face au joueur. On ajoute une couche de décision : à son tour, l'IA
// peut activer un pouvoir avantageux AVANT (ou à la place de) son coup normal.
// evaluateState() ne capte pas la valeur des buffs (Mur/Repli), donc chaque
// pouvoir a une heuristique de déclenchement dédiée, volontairement simple et
// lisible. L'IA Facile n'utilise jamais de pouvoir (reste douce pour débuter).
//
// Contrat : applyAiTurn() renvoie l'état après UNE action atomique (un pouvoir
// OU un coup normal). Le pilotage (confirmation Relais, expiration du Mur,
// relance tant que c'est le tour de l'IA) reste à l'appelant (main.js), qui
// boucle déjà — exactement comme pour une passe qui arme une une-deux.

function ownGoalRowFor(team) {
  return team === TEAMS.BLEU ? BOARD_ROWS - 1 : 0;
}

// Termine proprement le tour après un Sprint. activateSprint laisse le pion
// sélectionné (phase SELECT) une fois déplacé — potentiellement à côté du
// ballon. On tente alors un tir gagnant, sinon on rend la main. Indispensable :
// sans ça, le tour ne se terminerait pas et listLegalMoves renverrait [] au
// coup suivant, bloquant l'IA.
function endTurnAfterSprint(state) {
  if (state.turn == null) return state;
  const team = state.turn;
  const scoreBefore = state.score[team];
  const winning = getPassDestinations(state).find(([r, c]) => passBall(state, r, c).score[team] > scoreBefore);
  if (winning) return passBall(state, winning[0], winning[1]);
  return passTurn(state);
}

/**
 * Choisit une activation de pouvoir avantageuse pour l'équipe au tour, ou null.
 * Retourne un objet { kind, apply(state) => state } ; `apply` est pur.
 */
export function chooseAiPowerPlay(state) {
  const team = state.turn;
  const powerToks = state.tokens.filter(t => t.team === team && canActivatePower(state, t));
  if (powerToks.length === 0) return null;

  const ball = state.ball;
  const iAmAdjacentToBall = state.tokens.some(
    t => t.team === team && isAdjacent(t.row, t.col, ball.row, ball.col)
  );
  const ballDist = distanceToGoal(ball.row, ball.col, team);

  for (const tok of powerToks) {
    const adjBall = isAdjacent(tok.row, tok.col, ball.row, ball.col);

    // 1) TIR PUISSANT — si un tir perforant marque, le jouer sans hésiter.
    if (tok.power === POWER_TYPES.TIR_PUISSANT && adjBall) {
      const shot = getPowerShotDestinations(state).find(([r, c]) => {
        const s = activateTirPuissant(state, tok.id, r, c, applyBallMovement);
        return s !== state && s.lastGoalBy === team;
      });
      if (shot) {
        return { kind: 'tir_puissant', apply: s => activateTirPuissant(s, tok.id, shot[0], shot[1], applyBallMovement) };
      }
    }

    // 2) RELAIS — si l'IA peut faire une passe qui rapproche le ballon de la
    // cage, l'accompagner d'un Relais pour gagner un déplacement bonus.
    if (tok.power === POWER_TYPES.RELAIS && adjBall) {
      const passes = getPassDestinations(state);
      let best = null;
      passes.forEach(([r, c]) => {
        const d = distanceToGoal(r, c, team);
        if (!best || d < best.d) best = { r, c, d };
      });
      if (best && best.d < ballDist) {
        return {
          kind: 'relais',
          // La passe passe par applyMove (select + passBall) : passBall exige un
          // pion sélectionné adjacent au ballon, qu'activateRelais ne pose pas.
          apply: s => applyMove(activateRelais(s, tok.id), { type: 'pass', tokenId: tok.id, passTo: [best.r, best.c] })
        };
      }
    }

    // 3) REPLI ADVERSE — repousser un pion adverse qui conteste le ballon
    // (orthogonalement/diagonalement adjacent au ballon), pour libérer le jeu.
    if (tok.power === POWER_TYPES.REPLI_ADVERSE) {
      const contesting = getValidRepliTargets(state, team)
        .filter(tg => isAdjacent(tg.row, tg.col, ball.row, ball.col));
      for (const tg of contesting) {
        const s = activateRepliAdverse(state, tok.id, tg.id);
        if (s !== state) {
          return { kind: 'repli_adverse', apply: st => activateRepliAdverse(st, tok.id, tg.id) };
        }
      }
    }

    // 4) SPRINT — si aucun de mes pions n'est encore à côté du ballon, foncer
    // pour prendre possession en un seul tour.
    if (tok.power === POWER_TYPES.SPRINT && !iAmAdjacentToBall) {
      const dest = getSprintDestinations(state, tok)
        .find(([r, c]) => isAdjacent(r, c, ball.row, ball.col));
      if (dest) {
        return {
          kind: 'sprint',
          apply: s => endTurnAfterSprint(activateSprint(s, tok.id, dest[0], dest[1], moveSelectedToken))
        };
      }
    }

    // 5) MUR — défensif : si le ballon est dans ma moitié (menace adverse),
    // ériger le mur pour gêner les passes diagonales de l'adversaire.
    if (tok.power === POWER_TYPES.MUR) {
      const ownRow = ownGoalRowFor(team);
      const oppRow = ownGoalRowFor(team === TEAMS.BLEU ? TEAMS.ROUGE : TEAMS.BLEU);
      const defensiveZone = Math.abs(ball.row - ownRow) < Math.abs(ball.row - oppRow);
      if (defensiveZone) {
        const s = activateMur(state, tok.id);
        if (s !== state) {
          return { kind: 'mur', apply: st => activateMur(st, tok.id) };
        }
      }
    }
  }

  return null;
}

/**
 * Joue UNE action atomique pour l'IA et retourne le nouvel état :
 * un pouvoir avantageux si disponible (sauf niveau Facile), sinon un coup
 * normal. Renvoie l'état inchangé (même référence) s'il n'y a rien à jouer,
 * pour que l'appelant puisse détecter l'absence d'action et ne pas boucler.
 */
export function applyAiTurn(state, level = AI_LEVELS.MOYEN) {
  if (state.gameOver) return state;

  // Pas de pouvoir pendant un mouvement bonus (une-deux / Relais) ni hors de la
  // phase de sélection : on laisse d'abord le coup normal résoudre ces cas.
  const inBonus = state.comboMoveAvailable || state.relaisBonusMoveAvailable;
  if (level !== AI_LEVELS.FACILE && state.phase === PHASES.SELECT && !inBonus) {
    const play = chooseAiPowerPlay(state);
    if (play) {
      const next = play.apply(state);
      if (next !== state) return next;
    }
  }

  const move = chooseAiMove(state, level);
  if (!move) return state;
  return applyMove(state, move);
}
