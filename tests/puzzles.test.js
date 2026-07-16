import { describe, test, expect } from './test-utils.js';
import { createGame, applyMove } from '../public/src/engine/gameEngine.js';
import { PUZZLES, getDailyPuzzle, getDailyPuzzleIndex, isPuzzleSolved } from '../public/src/engine/puzzles.js';

// #210 — puzzle du jour : sélection déterministe + chaque puzzle est résoluble
// par sa solution embarquée en ≤ maxMoves coups.
describe('puzzles du jour (#210)', () => {
  // Rejoue un coup du solveur en gardant la main sur son équipe (mode puzzle :
  // pas d'adversaire, on ne laisse jamais le tour filer).
  function playSolverMove(state, move, solverTeam) {
    let next = applyMove(state, move);
    if (!next.gameOver && next.turn !== solverTeam) next = { ...next, turn: solverTeam };
    return next;
  }

  function loadPuzzle(p) {
    return { ...createGame({ goalsToWin: 1, ruleset: p.ruleset }),
      tokens: p.tokens.map(t => ({ ...t })), ball: { ...p.ball }, turn: p.turn };
  }

  test('sélection déterministe par date (même jour = même puzzle)', () => {
    expect(getDailyPuzzle('2026-07-16').id).toBe(getDailyPuzzle('2026-07-16').id);
    const idx = getDailyPuzzleIndex('2026-07-16');
    expect(idx >= 0 && idx < PUZZLES.length).toBe(true);
  });

  test('des dates différentes couvrent plusieurs puzzles', () => {
    const seen = new Set();
    for (let d = 1; d <= 31; d++) {
      seen.add(getDailyPuzzle(`2026-07-${String(d).padStart(2, '0')}`).id);
    }
    expect(seen.size).toBeGreaterThan(1);
  });

  for (const p of PUZZLES) {
    test(`« ${p.title} » est résolu par sa solution en ≤ ${p.maxMoves} coup(s)`, () => {
      expect(p.solution.length <= p.maxMoves).toBe(true);
      let state = loadPuzzle(p);
      for (const move of p.solution) {
        expect(state.gameOver).toBe(false);
        state = playSolverMove(state, move, p.turn);
      }
      expect(isPuzzleSolved(state, p)).toBe(true);
      expect(state.gameOver).toBe(true);
    });
  }

  test('isPuzzleSolved est faux tant que rien n est marqué', () => {
    const p = PUZZLES[0];
    expect(isPuzzleSolved(loadPuzzle(p), p)).toBe(false);
  });
});
