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
      // v0.5 : reperes visuels des cases speciales. Ailes (colonnes de bord) =
      // "centre" ignorant la couverture ; points de penalty = tir perforant.
      if (c === 0 || c === BOARD_COLS - 1) cell.classList.add('wing-lane');
      if ((r === 2 || r === BOARD_ROWS - 3) && c === 3) cell.classList.add('penalty-spot');
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

// Icônes SVG dédiées à chaque pouvoir, dessinées au trait — identiques
// aux badges de la section 04 du preview japonais. Chaque icône est une
// métaphore visuelle du pouvoir (éclair = vitesse, bouclier = blocage…).
const POWER_ICONS = {
  tir_puissant: `<svg width="10" height="10" viewBox="0 0 10 10" fill="none">
    <path d="M7 1L3 5h2.5L3.5 9l5.5-5H6.5z" fill="#FFD87A"/>
  </svg>`,
  sprint: `<svg width="10" height="10" viewBox="0 0 10 10" fill="none">
    <path d="M8 5H2M6 2l2 3-2 3" stroke="#FFD87A" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`,
  mur: `<svg width="10" height="10" viewBox="0 0 10 10" fill="none">
    <rect x="2" y="2.5" width="6" height="5" rx="0.8" stroke="#FFD87A" stroke-width="1.3"/>
    <path d="M2 5h6" stroke="#FFD87A" stroke-width="1"/>
  </svg>`,
  relais: `<svg width="10" height="10" viewBox="0 0 10 10" fill="none">
    <path d="M2 7 C2 4 4 2 5 3 C6 2 8 4 8 7" stroke="#FFD87A" stroke-width="1.3" stroke-linecap="round"/>
    <circle cx="5" cy="7.5" r="1" fill="#FFD87A"/>
  </svg>`,
  repli_adverse: `<svg width="10" height="10" viewBox="0 0 10 10" fill="none">
    <path d="M5 2L5 8M2 5.5l3 3 3-3" stroke="#FFD87A" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`
};

// Numéros de maillot attribués de façon déterministe depuis l'id du token.
// Gardien = 1, les autres = 2-11 selon leur position dans la liste.
// Donne un repère visuel immédiat sans nécessiter de données serveur.
function jerseyNumberForToken(tok) {
  if (tok.isGK) return '1';
  // Extraire un index depuis l'id (ex: "bleu-def-0" → 0)
  const match = tok.id.match(/-(\d+)$/);
  const idx = match ? parseInt(match[1], 10) : 0;
  return String(idx + 2); // 2–11 pour les joueurs de champ
}

function renderToken(state, tok, lineupsByTeam) {
  const div = document.createElement('div');
  div.className = 'token ' + tok.team + (tok.isGK ? ' gardien' : '');
  if (tok.id === state.selectedTokenId) div.classList.add('selected');
  if (canSelectToken(state, tok)) div.classList.add('selectable');
  div.dataset.tokenId = tok.id;

  const playerName = displayNameForToken(tok.id, lineupsByTeam);

  if (playerName) {
    // Nom joueur disponible : affiché en bas du pion façon maillot
    div.title = playerName;
    const label = document.createElement('span');
    label.className = 'token-name-label';
    label.textContent = abbreviateName(playerName);
    div.appendChild(label);
  } else {
    // Pas de nom : numéro de maillot, plus lisible que rien
    const num = document.createElement('span');
    num.className = tok.isGK ? 'gk-mark' : 'jersey-number';
    num.textContent = jerseyNumberForToken(tok);
    div.appendChild(num);
  }

  if (tok.power) {
    const badge = document.createElement('span');
    badge.className = 'token-power-badge' + (tok.powerUsed ? ' used' : '');
    badge.title = tok.powerUsed ? 'Pouvoir déjà utilisé' : 'Pouvoir disponible';
    // Icône SVG du pouvoir, ou étoile par défaut si pouvoir inconnu
    badge.innerHTML = POWER_ICONS[tok.power] || '<svg width="10" height="10" viewBox="0 0 10 10"><path d="M5 1l1 3h3L7 6l1 3-3-2-3 2 1-3L1 4h3z" fill="#FFD87A"/></svg>';
    div.appendChild(badge);
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
