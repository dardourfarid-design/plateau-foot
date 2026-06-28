import { describe, test, expect } from './test-utils.js';
import { createGame, listLegalMoves, applyMove } from '../src/engine/gameEngine.js';
import { chooseAiMove, AI_LEVELS } from '../src/engine/ai.js';
import { TEAMS } from '../src/engine/constants.js';

function isMoveInList(move, list) {
  return list.some(m => JSON.stringify(m) === JSON.stringify(move));
}

describe('chooseAiMove - niveau facile', () => {
  test('retourne toujours un coup parmi les coups légaux', () => {
    const state = createGame();
    const legal = listLegalMoves(state);
    for (let i = 0; i < 15; i++) {
      const move = chooseAiMove(state, AI_LEVELS.FACILE);
      expect(isMoveInList(move, legal)).toBe(true);
    }
  });

  test('le coup choisi s’applique sans erreur', () => {
    const state = createGame();
    const move = chooseAiMove(state, AI_LEVELS.FACILE);
    let threw = false;
    try { applyMove(state, move); } catch (e) { threw = true; }
    expect(threw).toBe(false);
  });
});

describe('chooseAiMove - niveau moyen', () => {
  test('retourne toujours un coup parmi les coups légaux', () => {
    const state = createGame();
    const legal = listLegalMoves(state);
    for (let i = 0; i < 10; i++) {
      const move = chooseAiMove(state, AI_LEVELS.MOYEN);
      expect(isMoveInList(move, legal)).toBe(true);
    }
  });

  test('joue un coup gagnant immédiat s’il existe, plutôt qu’autre chose', () => {
    let state = createGame({ goalsToWin: 99 });
    // Ballon juste devant une case de cage libre, pion bleu juste derrière
    state = { ...state, ball: { row: 1, col: 3 } };
    const tokens = state.tokens.map(t =>
      t.id === 'b-att1' ? { ...t, row: 2, col: 3 } : t
    );
    state = { ...state, tokens };

    const move = chooseAiMove(state, AI_LEVELS.MOYEN);
    const next = applyMove(state, move);
    expect(next.score[TEAMS.BLEU]).toBe(1);
  });
});

describe('chooseAiMove - niveau difficile', () => {
  test('retourne toujours un coup parmi les coups légaux', () => {
    const state = createGame();
    const legal = listLegalMoves(state);
    const move = chooseAiMove(state, AI_LEVELS.DIFFICILE);
    expect(isMoveInList(move, legal)).toBe(true);
  });

  test('joue un coup gagnant immédiat s’il existe', () => {
    let state = createGame({ goalsToWin: 99 });
    state = { ...state, ball: { row: 1, col: 3 } };
    const tokens = state.tokens.map(t =>
      t.id === 'b-att1' ? { ...t, row: 2, col: 3 } : t
    );
    state = { ...state, tokens };

    const move = chooseAiMove(state, AI_LEVELS.DIFFICILE);
    const next = applyMove(state, move);
    expect(next.score[TEAMS.BLEU]).toBe(1);
  });

  test('ne plante pas même proche de la fin de partie (peu de pions/options)', () => {
    let state = createGame({ goalsToWin: 99 });
    // Ne garder qu'un gardien et un attaquant par équipe pour réduire l'espace de coups
    state = {
      ...state,
      tokens: state.tokens.filter(t => t.isGK || t.id === 'b-att1' || t.id === 'r-att1')
    };
    let threw = false;
    try {
      const move = chooseAiMove(state, AI_LEVELS.DIFFICILE);
      applyMove(state, move);
    } catch (e) {
      threw = true;
    }
    expect(threw).toBe(false);
  });
});

describe('chooseAiMove - cas limites', () => {
  test('retourne null si aucun coup n’est possible (partie terminée)', () => {
    let state = createGame({ goalsToWin: 1 });
    state = { ...state, gameOver: true, winner: TEAMS.BLEU };
    const move = chooseAiMove(state, AI_LEVELS.MOYEN);
    expect(move).toBeNull();
  });

  test('un niveau inconnu retombe sur le comportement moyen sans planter', () => {
    const state = createGame();
    const legal = listLegalMoves(state);
    const move = chooseAiMove(state, 'niveau-inexistant');
    expect(isMoveInList(move, legal)).toBe(true);
  });
});
