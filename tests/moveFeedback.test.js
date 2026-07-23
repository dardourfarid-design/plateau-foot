import { describe, test, expect } from './test-utils.js';
import { signalInvalidMove } from '../public/src/ui/moveFeedback.js';

// #263 — retour « coup invalide ». La fonction touche le DOM (querySelector,
// classList) : on lui passe un stub minimal, sans navigateur. Le son/vibration
// sont derrière le réglage sons opt-in (désactivé par défaut) : ici ils sont
// simplement no-op, ce qui prouve aussi que l'appel ne jette pas sans AudioContext.

function fakeCell() {
  const classes = new Set();
  return {
    _classes: classes,
    offsetWidth: 0,
    classList: {
      add: c => classes.add(c),
      remove: c => classes.delete(c),
      contains: c => classes.has(c)
    },
    addEventListener: () => {} // animationend : ignoré dans ce stub
  };
}

function fakeBoard(cell) {
  return { _last: null, querySelector: function (sel) { this._last = sel; return cell; } };
}

describe('signalInvalidMove (#263)', () => {
  test('sans plateau : ne jette pas (son/vibration no-op hors navigateur)', () => {
    signalInvalidMove(null, 2, 3);
    expect(true).toBe(true);
  });

  test('pose la classe de secousse sur la case ciblée', () => {
    const cell = fakeCell();
    signalInvalidMove(fakeBoard(cell), 4, 5);
    expect(cell.classList.contains('cell-invalid')).toBe(true);
  });

  test('cible la bonne case par data-row / data-col', () => {
    const cell = fakeCell();
    const board = fakeBoard(cell);
    signalInvalidMove(board, 1, 6);
    expect(board._last).toBe('.cell[data-row="1"][data-col="6"]');
  });

  test('case absente : pas de plantage', () => {
    const board = { querySelector: () => null };
    signalInvalidMove(board, 0, 0);
    expect(true).toBe(true);
  });
});
