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
import { displayNameForToken } from './playerIdentity.js';

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
 * `lineupsByTeam` est optionnel : { bleu: {...}, rouge: {...} } produit par
 * resolveLineup() (voir playerIdentity.js). Si absent (pas de compte, pas de
 * composition choisie), le rendu reste strictement identique à avant ce
 * système — aucune régression pour les parties sans identité de joueurs.
 */
export function renderBoard(container, state, lineupsByTeam = null) {
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
      cell.appendChild(renderToken(state, tok, lineupsByTeam));
    }

    if (isBallAt(state, r, c)) {
      const ball = document.createElement('div');
      ball.className = 'ball';
      cell.appendChild(ball);
    }
  });

  renderDestinationMarkers(container, state);
}

function renderToken(state, tok, lineupsByTeam) {
  const div = document.createElement('div');
  div.className = 'token ' + tok.team + (tok.isGK ? ' gardien' : '');
  if (tok.id === state.selectedTokenId) div.classList.add('selected');
  if (canSelectToken(state, tok)) div.classList.add('selectable');
  div.dataset.tokenId = tok.id;

  const playerName = displayNameForToken(tok.id, lineupsByTeam);

  // Le marqueur "G" et le nom du joueur se chevauchent visuellement sur un
  // pion de cette taille — quand un nom est disponible, il devient
  // l'identifiant visuel principal (le contour blanc du gardien reste de
  // toute façon visible pour le distinguer des autres pions).
  if (tok.isGK && !playerName) {
    const mark = document.createElement('span');
    mark.className = 'gk-mark';
    mark.textContent = 'G';
    div.appendChild(mark);
  }

  if (playerName) {
    div.title = playerName; // infobulle native au survol (desktop)
    const label = document.createElement('span');
    label.className = 'token-name-label';
    label.textContent = abbreviateName(playerName);
    div.appendChild(label);
  }

  return div;
}

/**
 * Réduit un nom complet à un format court lisible sur un petit pion
 * (ex: "Aleksander Kovac" -> "A. Kovac"), à la façon d'un maillot de foot.
 */
function abbreviateName(fullName) {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  const last = parts[parts.length - 1];
  return `${parts[0][0]}. ${last}`;
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
