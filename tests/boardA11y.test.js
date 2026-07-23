// #345 — Libellés accessibles des cases du plateau (cellA11yLabel est pure
// vis-à-vis du DOM : les marqueurs de destination arrivent via `flags`).
import { describe, test, expect } from './test-utils.js';
import { cellA11yLabel } from '../public/src/ui/boardRenderer.js';
import { createGame, selectToken, tokenAt, isBallAt, canSelectToken } from '../public/src/engine/gameEngine.js';
import { TEAMS, CENTER, GOAL_COLS, GOAL_ROW_TOP, GOAL_ROW_BOTTOM, BOARD_ROWS, BOARD_COLS } from '../public/src/engine/constants.js';
import { setLang } from '../public/src/ui/i18n.js';
import '../public/src/ui/i18n-en.js';

function findEmptyCell(state) {
  for (let r = 0; r < BOARD_ROWS; r++) {
    for (let c = 0; c < BOARD_COLS; c++) {
      const goal = (r === GOAL_ROW_TOP || r === GOAL_ROW_BOTTOM) && GOAL_COLS.includes(c);
      if (!goal && !tokenAt(state, r, c) && !isBallAt(state, r, c)) return { r, c };
    }
  }
  return null;
}

describe('cellA11yLabel (#345)', () => {
  test('case vide : position seule', () => {
    const state = createGame();
    const { r, c } = findEmptyCell(state);
    expect(cellA11yLabel(state, r, c)).toBe(`Ligne ${r + 1}, colonne ${c + 1}`);
  });

  test('la case du ballon contient « ballon »', () => {
    const state = createGame();
    const label = cellA11yLabel(state, CENTER.row, CENTER.col);
    expect(label.includes('ballon')).toBe(true);
  });

  test('un pion du joueur actif est décrit et « sélectionnable »', () => {
    const state = createGame();
    const tok = state.tokens.find(tk => tk.team === TEAMS.BLEU && canSelectToken(state, tk));
    const label = cellA11yLabel(state, tok.row, tok.col);
    expect(label.includes('pion bleu')).toBe(true);
    expect(label.includes('sélectionnable')).toBe(true);
  });

  test('un pion sélectionné est annoncé « sélectionné » (pas « sélectionnable »)', () => {
    const base = createGame();
    const tok = base.tokens.find(tk => tk.team === TEAMS.BLEU && canSelectToken(base, tk));
    const state = selectToken(base, tok.id);
    const label = cellA11yLabel(state, tok.row, tok.col);
    expect(label.includes('sélectionné')).toBe(true);
    expect(label.includes('sélectionnable')).toBe(false);
  });

  test('le gardien est signalé', () => {
    const state = createGame();
    const gk = state.tokens.find(tk => tk.isGK && tk.team === TEAMS.ROUGE);
    const label = cellA11yLabel(state, gk.row, gk.col);
    expect(label.includes('pion rouge')).toBe(true);
    expect(label.includes('(gardien)')).toBe(true);
  });

  test('les flags de phase ajoutent les affordances', () => {
    const state = createGame();
    const { r, c } = findEmptyCell(state);
    const label = cellA11yLabel(state, r, c, { move: true, pass: true, covered: true });
    expect(label.includes('déplacement possible')).toBe(true);
    expect(label.includes('passe possible')).toBe(true);
    expect(label.includes('case couverte')).toBe(true);
  });

  test('les zones de but sont nommées', () => {
    const state = createGame();
    const top = cellA11yLabel(state, GOAL_ROW_TOP, GOAL_COLS[0]);
    const bottom = cellA11yLabel(state, GOAL_ROW_BOTTOM, GOAL_COLS[0]);
    expect(top.includes('cage rouge')).toBe(true);
    expect(bottom.includes('cage bleue')).toBe(true);
  });

  test('les libellés suivent la langue (EN via i18n)', () => {
    const state = createGame();
    const { r, c } = findEmptyCell(state);
    setLang('en');
    const en = cellA11yLabel(state, r, c);
    setLang('fr');
    expect(en).toBe(`Row ${r + 1}, column ${c + 1}`);
  });
});
