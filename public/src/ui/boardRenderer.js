// ===================== BOARD RENDERER =====================
// Traduit un état du moteur de jeu (objet pur, voir gameEngine.js) en DOM.
// Ce module ne modifie jamais l'état lui-même : il lit et affiche.
// Toute interaction utilisateur ressort sous forme de callback vers l'appelant
// (main.js), qui décide quelle action du moteur appeler.

import {
  BOARD_COLS, BOARD_ROWS, GOAL_COLS, GOAL_ROW_TOP, GOAL_ROW_BOTTOM, TEAMS
} from '../engine/constants.js';
import {
  getMoveDestinations, getPassDestinations, isBallAt,
  isAdjacent, canSelectToken, PHASES, isCellCoveredBy, tokenAt
} from '../engine/gameEngine.js';
import { displayNameForToken } from './playerIdentity.js';
import { t } from './i18n.js';
import { TEAMS as TEAMS_A11Y } from '../engine/constants.js';

/**
 * Construit la grille de cellules vide une seule fois (structure statique).
 * Les pions/ballon sont injectés/retirés à chaque render(), pas la grille elle-même.
 */
export function buildBoardGrid(container, onCellClick) {
  container.innerHTML = '';
  // #345 (F3) : plateau opérable au clavier/lecteur d'écran. Le conteneur est
  // un groupe nommé ; chaque case est un bouton nommé (aria-label posé à
  // chaque render). Roving tabindex : UN seul tab-stop pour tout le plateau.
  container.setAttribute('role', 'group');
  container.setAttribute('aria-label', t('Plateau de jeu'));
  for (let r = 0; r < BOARD_ROWS; r++) {
    for (let c = 0; c < BOARD_COLS; c++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.row = r;
      cell.dataset.col = c;
      cell.setAttribute('role', 'button');
      cell.tabIndex = (r === 0 && c === 0) ? 0 : -1;
      if (r === GOAL_ROW_TOP && GOAL_COLS.includes(c)) cell.classList.add('goal-zone-rouge');
      if (r === GOAL_ROW_BOTTOM && GOAL_COLS.includes(c)) cell.classList.add('goal-zone-bleu');
      // #201 : les reperes des cases speciales (ailes / points de penalty) ne
      // sont plus statiques — ils dependent du palier de regles actif et sont
      // poses/retires par renderBoard() (voir applySpecialCellMarkers).
      cell.addEventListener('click', () => onCellClick(r, c));
      container.appendChild(cell);
    }
  }
  attachBoardKeyboardNav(container);
}

/**
 * #345 — Navigation clavier du plateau (délégation sur le conteneur) :
 * flèches = déplacer le focus de case en case (roving tabindex : l'ancienne
 * case repasse à -1, la nouvelle à 0), Entrée/Espace = jouer la case
 * (même chemin que le clic), Début/Fin = extrémités de la ligne.
 * Un seul listener pour les 63 cases — rien à nettoyer au re-render.
 */
function attachBoardKeyboardNav(container) {
  container.addEventListener('keydown', (e) => {
    const cell = e.target && e.target.closest ? e.target.closest('.cell') : null;
    if (!cell) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      cell.click();
      return;
    }
    let r = parseInt(cell.dataset.row, 10);
    let c = parseInt(cell.dataset.col, 10);
    if (e.key === 'ArrowUp') r--;
    else if (e.key === 'ArrowDown') r++;
    else if (e.key === 'ArrowLeft') c--;
    else if (e.key === 'ArrowRight') c++;
    else if (e.key === 'Home') c = 0;
    else if (e.key === 'End') c = BOARD_COLS - 1;
    else return;
    e.preventDefault();
    r = Math.max(0, Math.min(BOARD_ROWS - 1, r));
    c = Math.max(0, Math.min(BOARD_COLS - 1, c));
    const next = container.querySelector(`.cell[data-row="${r}"][data-col="${c}"]`);
    if (next && next !== cell) {
      cell.tabIndex = -1;
      next.tabIndex = 0;
      next.focus();
    }
  });
}

/**
 * #345 — Libellé accessible d'une case : position, contenu (pion/ballon/cage)
 * et affordances de la phase en cours (sélectionnable, déplacement/passe
 * possible, case couverte). Fonction PURE vis-à-vis du DOM (les marqueurs de
 * destination arrivent via `flags`) pour rester testable en Node.
 */
export function cellA11yLabel(state, r, c, flags = {}, lineupsByTeam = null) {
  const parts = [t('Ligne {r}, colonne {c}', { r: r + 1, c: c + 1 })];
  if (r === GOAL_ROW_TOP && GOAL_COLS.includes(c)) parts.push(t('cage rouge'));
  if (r === GOAL_ROW_BOTTOM && GOAL_COLS.includes(c)) parts.push(t('cage bleue'));
  const tok = tokenAt(state, r, c);
  if (tok) {
    let desc = tok.team === TEAMS_A11Y.BLEU ? t('pion bleu') : t('pion rouge');
    if (tok.isGK) desc += ' ' + t('(gardien)');
    const name = displayNameForToken(tok.id, lineupsByTeam);
    if (name) desc += ', ' + name;
    parts.push(desc);
    if (tok.id === state.selectedTokenId) parts.push(t('sélectionné'));
    else if (canSelectToken(state, tok)) parts.push(t('sélectionnable'));
  }
  if (isBallAt(state, r, c)) parts.push(t('ballon'));
  if (flags.move) parts.push(t('déplacement possible'));
  if (flags.pass) parts.push(t('passe possible'));
  if (flags.covered) parts.push(t('case couverte'));
  return parts.join(', ');
}

/** #345 — Pose l'aria-label de chaque case après un render complet. */
function applyCellA11y(container, state, lineupsByTeam) {
  container.querySelectorAll('.cell').forEach(cell => {
    const r = parseInt(cell.dataset.row, 10);
    const c = parseInt(cell.dataset.col, 10);
    const flags = {
      move: cell.classList.contains('dest-move'),
      pass: cell.classList.contains('dest-pass'),
      covered: cell.classList.contains('covered-cell')
    };
    cell.setAttribute('aria-label', cellA11yLabel(state, r, c, flags, lineupsByTeam));
  });
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

  // Index case -> pion construit une fois par render : évite un
  // state.tokens.find() linéaire pour chacune des 63 cellules.
  const tokensByCell = new Map();
  state.tokens.forEach(tok => tokensByCell.set(tok.row + ',' + tok.col, tok));

  const rules = state.rules || {};

  cells.forEach(cell => {
    cell.classList.remove('dest-move', 'dest-pass', 'covered-cell', 'wing-lane', 'penalty-spot');
    cell.innerHTML = '';

    const r = parseInt(cell.dataset.row, 10);
    const c = parseInt(cell.dataset.col, 10);

    // #201 : reperes des cases speciales conditionnes au palier actif — on ne
    // montre l'aile / le point de penalty que si la regle correspondante joue.
    if (rules.wings && (c === 0 || c === BOARD_COLS - 1)) cell.classList.add('wing-lane');
    if (rules.penaltySpot && (r === 2 || r === BOARD_ROWS - 3) && c === 3) cell.classList.add('penalty-spot');

    const tok = tokensByCell.get(r + ',' + c);
    if (tok) {
      cell.appendChild(renderToken(state, tok, lineupsByTeam));
    }

    if (isBallAt(state, r, c)) {
      const ball = document.createElement('div');
      ball.className = 'ball';
      cell.appendChild(ball);
    }
  });

  renderCoverageMarkers(container, state);
  renderDestinationMarkers(container, state);
  // #345 : après la pose des marqueurs (dest-move/dest-pass/covered-cell),
  // pour que les libellés reflètent les affordances de la phase en cours.
  applyCellA11y(container, state, lineupsByTeam);
}

/**
 * #201 — Teinte les cases « coupées » par la couverture adverse quand un
 * passeur potentiel est prêt à jouer le ballon. Rend visible la mécanique
 * d'interception (jusque-là invisible : une passe s'arrêtait sans explication).
 * N'affiche rien si le palier désactive la couverture (Découverte).
 */
function renderCoverageMarkers(container, state) {
  const rules = state.rules || {};
  if (!rules.coverage) return;

  // Ne montrer les « murs » défensifs que dans les moments de passe : soit un
  // pion adjacent au ballon est sélectionné, soit on est en phase MOVED_CAN_PASS.
  const passContext =
    state.phase === PHASES.MOVED_CAN_PASS ||
    (state.phase === PHASES.SELECT && state.selectedTokenId && (() => {
      const tok = state.tokens.find(t => t.id === state.selectedTokenId);
      return tok && isAdjacent(tok.row, tok.col, state.ball.row, state.ball.col);
    })());
  if (!passContext) return;

  const opponent = state.turn === TEAMS.BLEU ? TEAMS.ROUGE : TEAMS.BLEU;
  for (let r = 0; r < BOARD_ROWS; r++) {
    for (let c = 0; c < BOARD_COLS; c++) {
      if (tokenAt(state, r, c)) continue;        // uniquement les cases vides
      if (isBallAt(state, r, c)) continue;
      if (!isCellCoveredBy(state, r, c, opponent)) continue;
      const cell = container.querySelector(`.cell[data-row="${r}"][data-col="${c}"]`);
      if (cell) cell.classList.add('covered-cell');
    }
  }
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
