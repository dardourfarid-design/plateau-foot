// ===================== MOTEUR DE JEU =====================
// Toutes les fonctions ici sont pures (pas d'effet de bord, pas de DOM).
// L'état du jeu est traité comme immutable : chaque action retourne un nouvel état.
// Ce module est directement testable unitairement (voir tests/engine.test.js).

import {
  BOARD_COLS, BOARD_ROWS, GOAL_COLS, GOAL_ROW_TOP, GOAL_ROW_BOTTOM,
  GK_ZONE_ROWS_TOP, GK_ZONE_ROWS_BOTTOM, TEAMS, CENTER, buildStartingFormation
} from './constants.js';

export const PHASES = Object.freeze({
  SELECT: 'select',
  MOVED_CAN_PASS: 'moved-can-pass'
});

/**
 * Crée un nouvel état de partie initial.
 * @param {{goalsToWin?: number}} options
 */
export function createGame(options = {}) {
  const goalsToWin = options.goalsToWin ?? 3;
  return Object.freeze({
    tokens: buildStartingFormation(),
    ball: { row: CENTER.row, col: CENTER.col },
    turn: TEAMS.BLEU,
    score: { [TEAMS.BLEU]: 0, [TEAMS.ROUGE]: 0 },
    goalsToWin,
    selectedTokenId: null,
    phase: PHASES.SELECT,
    movedTokenPos: null, // {row, col} du pion qui vient de se déplacer ce tour, si applicable
    canUndo: false,
    gameOver: false,
    winner: null,
    lastGoalBy: null,
    history: [] // pile d'événements pour debug / replay éventuel
  });
}

// ---------- Lecture d'état (pures, sans effet de bord) ----------

export function tokenAt(state, row, col) {
  return state.tokens.find(t => t.row === row && t.col === col) || null;
}

export function isBallAt(state, row, col) {
  return state.ball.row === row && state.ball.col === col;
}

export function inBounds(row, col) {
  return row >= 0 && row < BOARD_ROWS && col >= 0 && col < BOARD_COLS;
}

export function isAdjacent(r1, c1, r2, c2) {
  const dr = Math.abs(r1 - r2);
  const dc = Math.abs(c1 - c2);
  return dr <= 1 && dc <= 1 && !(dr === 0 && dc === 0);
}

function gkAllowedCells(team) {
  const rows = team === TEAMS.BLEU ? GK_ZONE_ROWS_BOTTOM : GK_ZONE_ROWS_TOP;
  const cells = [];
  rows.forEach(r => GOAL_COLS.forEach(c => cells.push([r, c])));
  return cells;
}

function cellInList(list, row, col) {
  return list.some(([r, c]) => r === row && c === col);
}

/**
 * Cases de déplacement valides pour un pion donné (1 case, 8 directions).
 */
export function getMoveDestinations(state, token) {
  const dests = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = token.row + dr;
      const nc = token.col + dc;
      if (!inBounds(nr, nc)) continue;
      if (tokenAt(state, nr, nc)) continue;
      if (isBallAt(state, nr, nc)) continue;
      if (token.isGK && !cellInList(gkAllowedCells(token.team), nr, nc)) continue;
      dests.push([nr, nc]);
    }
  }
  return dests;
}

/**
 * Cases atteignables par une passe depuis la position actuelle du ballon,
 * dans les 8 directions, en ligne droite, jusqu'au premier obstacle ou bord.
 * Chaque case libre du trajet est une destination valide (le joueur choisit où s'arrêter).
 */
export function getPassDestinations(state) {
  const dests = [];
  const directions = [
    [-1, 0], [1, 0], [0, -1], [0, 1],
    [-1, -1], [-1, 1], [1, -1], [1, 1]
  ];
  directions.forEach(([dr, dc]) => {
    let r = state.ball.row + dr;
    let c = state.ball.col + dc;
    while (inBounds(r, c) && !tokenAt(state, r, c)) {
      dests.push([r, c, dr, dc]);
      r += dr;
      c += dc;
    }
  });
  return dests;
}

export function canSelectToken(state, token) {
  if (state.gameOver) return false;
  if (state.phase !== PHASES.SELECT) return false;
  return token.team === state.turn;
}

function checkGoalCell(row, col) {
  if (row === GOAL_ROW_TOP && GOAL_COLS.includes(col)) return TEAMS.BLEU; // Bleu attaque vers le haut
  if (row === GOAL_ROW_BOTTOM && GOAL_COLS.includes(col)) return TEAMS.ROUGE; // Rouge attaque vers le bas
  return null;
}

// ---------- Actions (retournent un nouvel état, jamais de mutation) ----------

/**
 * Sélectionne un pion pour le joueur actif.
 */
export function selectToken(state, tokenId) {
  const token = state.tokens.find(t => t.id === tokenId);
  if (!token || !canSelectToken(state, token)) return state;

  return Object.freeze({
    ...state,
    selectedTokenId: tokenId,
    canUndo: false // un nouveau coup commence : on verrouille l'annulation du tour précédent
  });
}

/**
 * Déplace le pion sélectionné vers (row, col), si la case est une destination valide.
 * Si le pion arrive adjacent au ballon, la phase passe en MOVED_CAN_PASS (passe optionnelle).
 * Sinon, le tour se termine immédiatement.
 */
export function moveSelectedToken(state, row, col) {
  if (state.phase !== PHASES.SELECT || !state.selectedTokenId) return state;
  const token = state.tokens.find(t => t.id === state.selectedTokenId);
  if (!token) return state;

  const validMoves = getMoveDestinations(state, token);
  if (!cellInList(validMoves, row, col)) return state;

  const newTokens = state.tokens.map(t =>
    t.id === token.id ? { ...t, row, col } : t
  );

  const nextState = { ...state, tokens: newTokens };

  if (isAdjacent(row, col, state.ball.row, state.ball.col)) {
    return Object.freeze({
      ...nextState,
      phase: PHASES.MOVED_CAN_PASS,
      movedTokenPos: { row, col },
      selectedTokenId: null
    });
  }

  return endTurn(nextState);
}

/**
 * Pousse le ballon vers (row, col) si c'est une destination de passe valide
 * depuis l'état courant. Gère but / fin de tour ensuite.
 */
export function passBall(state, row, col) {
  const inSelectPhaseAdjacent =
    state.phase === PHASES.SELECT &&
    state.selectedTokenId &&
    (() => {
      const tok = state.tokens.find(t => t.id === state.selectedTokenId);
      return tok && isAdjacent(tok.row, tok.col, state.ball.row, state.ball.col);
    })();

  const inMovedCanPassPhase = state.phase === PHASES.MOVED_CAN_PASS;

  if (!inSelectPhaseAdjacent && !inMovedCanPassPhase) return state;

  const validPasses = getPassDestinations(state);
  if (!cellInList(validPasses.map(p => [p[0], p[1]]), row, col)) return state;

  const newState = {
    ...state,
    ball: { row, col },
    selectedTokenId: null,
    movedTokenPos: null
  };

  const scoringTeam = checkGoalCell(row, col);
  if (scoringTeam) {
    return registerGoal(newState, scoringTeam);
  }

  return endTurn(newState);
}

/**
 * Termine le tour sans action supplémentaire (utilisé quand un joueur, en phase
 * MOVED_CAN_PASS, décide de ne pas faire de passe).
 */
export function passTurn(state) {
  if (state.phase !== PHASES.MOVED_CAN_PASS && !(state.phase === PHASES.SELECT && state.selectedTokenId)) {
    return state;
  }
  return endTurn({ ...state, selectedTokenId: null, movedTokenPos: null });
}

function endTurn(state) {
  return Object.freeze({
    ...state,
    selectedTokenId: null,
    phase: PHASES.SELECT,
    movedTokenPos: null,
    turn: state.turn === TEAMS.BLEU ? TEAMS.ROUGE : TEAMS.BLEU,
    canUndo: true
  });
}

function registerGoal(state, scoringTeam) {
  const newScore = { ...state.score, [scoringTeam]: state.score[scoringTeam] + 1 };
  const isGameOver = newScore[scoringTeam] >= state.goalsToWin;

  return Object.freeze({
    ...state,
    score: newScore,
    selectedTokenId: null,
    phase: PHASES.SELECT,
    movedTokenPos: null,
    canUndo: false,
    lastGoalBy: scoringTeam,
    // L'équipe qui encaisse engage le ballon
    turn: scoringTeam === TEAMS.BLEU ? TEAMS.ROUGE : TEAMS.BLEU,
    gameOver: isGameOver,
    winner: isGameOver ? scoringTeam : null
  });
}

/**
 * Remet le ballon au centre ET tous les pions à leur formation de départ
 * après confirmation visuelle d'un but (appelé par l'UI une fois l'overlay
 * "BUT !" fermé). Comme au coup d'envoi : on ne garde que le score et le
 * tour (déjà mis à jour par registerGoal), tout le reste de la disposition
 * de jeu redémarre à zéro pour que chaque reprise reste claire et lisible.
 */
export function resetBallAfterGoal(state) {
  if (state.gameOver) return state;
  return Object.freeze({
    ...state,
    ball: { row: CENTER.row, col: CENTER.col },
    tokens: buildStartingFormation()
  });
}

export function deselect(state) {
  if (state.phase !== PHASES.SELECT) return state;
  return Object.freeze({ ...state, selectedTokenId: null });
}

/**
 * Énumère tous les coups légaux pour l'équipe au tour, dans l'état donné.
 * Un coup est soit un déplacement simple { type: 'move', tokenId, to: [r,c] },
 * soit un déplacement suivi d'une passe { type: 'move_and_pass', tokenId, to, passTo },
 * soit une passe directe sans déplacement { type: 'pass', tokenId, passTo }.
 *
 * Cette fonction ne s'appuie que sur l'état et les règles déjà testées du moteur
 * (getMoveDestinations, getPassDestinations) — elle ne fait qu'énumérer, jamais
 * elle ne mute quoi que ce soit. Utilisée par le module IA (voir ai.js) pour
 * choisir un coup, mais reste indépendante de toute notion de "joueur artificiel" :
 * elle décrit simplement l'espace des coups légaux, ce qui est une propriété du jeu.
 */
export function listLegalMoves(state) {
  if (state.gameOver || state.phase !== PHASES.SELECT) return [];

  const moves = [];
  const myTokens = state.tokens.filter(t => t.team === state.turn);

  for (const token of myTokens) {
    // Cas 1 : le pion est déjà adjacent au ballon sans bouger -> passe directe possible
    if (isAdjacent(token.row, token.col, state.ball.row, state.ball.col)) {
      const passes = getPassDestinations(state);
      passes.forEach(([pr, pc]) => {
        moves.push({ type: 'pass', tokenId: token.id, passTo: [pr, pc] });
      });
    }

    // Cas 2 : déplacements simples, certains menant à une passe possible ensuite
    const destinations = getMoveDestinations(state, token);
    destinations.forEach(([dr, dc]) => {
      moves.push({ type: 'move', tokenId: token.id, to: [dr, dc] });

      if (isAdjacent(dr, dc, state.ball.row, state.ball.col)) {
        // Simuler l'état juste après ce déplacement pour énumérer les passes
        // réellement disponibles depuis cette nouvelle position du pion.
        const simulatedTokens = state.tokens.map(t =>
          t.id === token.id ? { ...t, row: dr, col: dc } : t
        );
        const simulatedState = { ...state, tokens: simulatedTokens };
        const passesAfterMove = getPassDestinations(simulatedState);
        passesAfterMove.forEach(([pr, pc]) => {
          moves.push({ type: 'move_and_pass', tokenId: token.id, to: [dr, dc], passTo: [pr, pc] });
        });
      }
    });
  }

  return moves;
}

/**
 * Applique un coup décrit par listLegalMoves() à un état, et retourne le nouvel
 * état résultant. Centralise la logique d'exécution pour que l'IA n'ait jamais
 * à connaître les détails de selectToken/moveSelectedToken/passBall/passTurn.
 */
export function applyMove(state, move) {
  let next = selectToken(state, move.tokenId);

  if (move.type === 'pass') {
    return passBall(next, move.passTo[0], move.passTo[1]);
  }

  if (move.type === 'move') {
    next = moveSelectedToken(next, move.to[0], move.to[1]);
    // Le déplacement seul peut amener en phase MOVED_CAN_PASS si adjacent au
    // ballon ; comme ce coup ne prévoit pas de passe, on termine le tour.
    if (next.phase === PHASES.MOVED_CAN_PASS) {
      next = passTurn(next);
    }
    return next;
  }

  if (move.type === 'move_and_pass') {
    next = moveSelectedToken(next, move.to[0], move.to[1]);
    return passBall(next, move.passTo[0], move.passTo[1]);
  }

  return state;
}
