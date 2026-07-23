// ===================== RETOUR « COUP INVALIDE » (#263) =====================
// Un clic qui ne mène à aucun coup légal était ignoré en silence : le joueur
// pouvait croire à un blocage. Ce module donne un retour immédiat et discret —
// micro-secousse de la case visée + son bref + courte vibration — sans jamais
// bloquer l'entrée.
//
// Son et vibration passent par soundService : ils sont donc AUTOMATIQUEMENT
// derrière le réglage « sons » opt-in (no-op si coupé). La secousse respecte
// prefers-reduced-motion côté CSS (.cell-invalid n'anime rien quand
// l'utilisateur a demandé moins de mouvement).

import { playSound, vibrate } from '../services/soundService.js';

/**
 * Signale un coup invalide sur la case (row, col) du plateau.
 * @param {HTMLElement|null} boardGrid  conteneur de la grille (els.boardGrid).
 * @param {number} row
 * @param {number} col
 */
export function signalInvalidMove(boardGrid, row, col) {
  playSound('error'); // no-op si le son est coupé
  vibrate(25);        // no-op si non supporté ou son coupé
  if (!boardGrid) return;
  const cell = boardGrid.querySelector(`.cell[data-row="${row}"][data-col="${col}"]`);
  if (!cell) return;
  // Redémarre l'animation même sur clics rapprochés (retrigger par reflow),
  // puis retire la classe en fin d'anim pour laisser la case rejouable.
  cell.classList.remove('cell-invalid');
  void cell.offsetWidth;
  cell.classList.add('cell-invalid');
  cell.addEventListener('animationend', () => cell.classList.remove('cell-invalid'), { once: true });
}
