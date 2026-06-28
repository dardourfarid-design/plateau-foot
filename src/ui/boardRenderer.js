// ===================== BOARD RENDERER =====================
// Traduit un état du moteur de jeu (objet pur, voir gameEngine.js) en DOM.
// Ce module ne modifie jamais l'état lui-même : il lit et affiche.
// Toute interaction utilisateur ressort sous forme de callback vers l'appelant
// (main.js), qui décide quelle action du moteur appeler.

import {
  BOARD_COLS, BOARD_ROWS, GOAL_COLS, GOAL_ROW_TOP, GOAL_ROW_BOTTOM
} from '../engine/constants.js';
import {
  getMoveDestinations, getPassDestinations, tokenAt, isBallAt,
  isAdjacent, canSelectToken, PHASES
} from '../engine/gameEngine.js';

/**
 * Construit la grille de cellules vide une seule fois (structure statique).
 * Les pions/ballon sont injectés/retirés à chaque render(), pas la grille elle-même.
 */
export function buildBoardGrid(container, onCellClick) {
  container.innerHTML = '';
  for (let r = 0; r < BOARD_ROWS; r++) {
    for (let c = 0; c < BOARD_COLS; c++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.row = r;
      cell.dataset.col = c;
      if (r === GOAL_ROW_TOP && GOAL_COLS.includes(c)) cell.classList.add('goal-zone-rouge');
      if (r === GOAL_ROW_BOTTOM && GOAL_COLS.includes(c)) cell.classList.add('goal-zone-bleu');
      cell.addEventListener('click', () => onCellClick(r, c));
      container.appendChild(cell);
    }
  }
}

/**
 * Rend l'état complet du jeu dans la grille déjà construite par buildBoardGrid().
 */
export function renderBoard(container, state) {
  const cells = container.querySelectorAll('.cell');

  cells.forEach(cell => {
    cell.classList.remove('dest-move', 'dest-pass');
    cell.innerHTML = '';
  });

  cells.forEach(cell => {
    const r = parseInt(cell.dataset.row, 10);
    const c = parseInt(cell.dataset.col, 10);

    const tok = tokenAt(state, r, c);
    if (tok) {
      cell.appendChild(renderToken(state, tok));
    }

    if (isBallAt(state, r, c)) {
      const ball = document.createElement('div');
      ball.className = 'ball';
      cell.appendChild(ball);
    }
  });

  renderDestinationMarkers(container, state);
}

function renderToken(state, tok) {
  const div = document.createElement('div');
  div.className = 'token ' + tok.team + (tok.isGK ? ' gardien' : '');
  if (tok.id === state.selectedTokenId) div.classList.add('selected');
  if (canSelectToken(state, tok)) div.classList.add('selectable');
  if (tok.isGK) {
    const mark = document.createElement('span');
    mark.className = 'gk-mark';
    mark.textContent = 'G';
    div.appendChild(mark);
  }
  div.dataset.tokenId = tok.id;
  return div;
}

function markCell(container, r, c, type) {
  const cell = container.querySelector(`.cell[data-row="${r}"][data-col="${c}"]`);
  if (!cell) return;
  cell.classList.add(type === 'move' ? 'dest-move' : 'dest-pass');
  const marker = document.createElement('div');
  marker.className = type === 'move' ? 'move-dot' : 'pass-ring';
  cell.appendChild(marker);
}

function renderDestinationMarkers(container, state) {
  if (state.phase === PHASES.SELECT && state.selectedTokenId) {
    const tok = state.tokens.find(t => t.id === state.selectedTokenId);
    if (!tok) return;

    getMoveDestinations(state, tok).forEach(([r, c]) => markCell(container, r, c, 'move'));

    if (isAdjacent(tok.row, tok.col, state.ball.row, state.ball.col)) {
      getPassDestinations(state).forEach(([r, c]) => markCell(container, r, c, 'pass'));
    }
  }

  if (state.phase === PHASES.MOVED_CAN_PASS) {
    getPassDestinations(state).forEach(([r, c]) => markCell(container, r, c, 'pass'));
  }
}
