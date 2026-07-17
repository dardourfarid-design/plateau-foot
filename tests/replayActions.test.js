import { describe, test, expect } from './test-utils.js';
import { createGame, listLegalMoves, PHASES } from '../public/src/engine/gameEngine.js';
import { TEAMS } from '../public/src/engine/constants.js';
import { replayActions, MAX_ACTIONS_PER_PUSH } from '../public/src/engine/replayActions.js';

// ===================== VALIDATION SERVEUR DES COUPS (#260) =====================
// Mêmes cas que les tests Deno de l'Edge Function push-game-state : le rejeu
// n'accepte que des journaux d'actions légaux, tout le reste est rejeté avec
// une erreur explicite (jamais d'état corrompu persisté).

// Partie en ligne type : mêmes options que onlineUI.handleCreateOnlineGame().
const start = () => createGame({ goalsToWin: 3 });

// Premier déplacement simple légal de l'équipe au trait, en journal d'actions.
function firstLegalMoveActions(state) {
  const move = listLegalMoves(state).find(m => m.type === 'move');
  return [
    { fn: 'selectToken', args: [move.tokenId] },
    { fn: 'moveSelectedToken', args: [move.to[0], move.to[1]] }
  ];
}

describe('replayActions — journaux légaux', () => {
  test('un déplacement légal est rejoué et produit un nouvel état', () => {
    const s0 = start();
    const res = replayActions(s0, firstLegalMoveActions(s0), TEAMS.BLEU);
    expect(res.error).toBe(undefined);
    expect(res.state === s0).toBe(false);
    // Le tour a été résolu par le moteur : soit passé à Rouge, soit passe possible.
    const turnHandled = res.state.turn === TEAMS.ROUGE || res.state.phase === PHASES.MOVED_CAN_PASS;
    expect(turnHandled).toBe(true);
  });

  test('une désélection (no-op bénin) est tolérée dans un journal', () => {
    const s0 = start();
    const move = listLegalMoves(s0).find(m => m.type === 'move');
    const res = replayActions(s0, [
      { fn: 'selectToken', args: [move.tokenId] },
      { fn: 'deselect', args: [] },
      { fn: 'selectToken', args: [move.tokenId] },
      { fn: 'moveSelectedToken', args: [move.to[0], move.to[1]] }
    ], TEAMS.BLEU);
    expect(res.error).toBe(undefined);
  });
});

describe('replayActions — rejets', () => {
  test('téléportation (destination hors liste des coups légaux) rejetée', () => {
    const s0 = start();
    const move = listLegalMoves(s0).find(m => m.type === 'move');
    const res = replayActions(s0, [
      { fn: 'selectToken', args: [move.tokenId] },
      { fn: 'moveSelectedToken', args: [0, 3] } // cage adverse : jamais à 1 case
    ], TEAMS.BLEU);
    expect(res.error).toBe('coup illégal : moveSelectedToken');
  });

  test('jouer hors de son tour est rejeté', () => {
    const s0 = start(); // au trait : Bleu
    const res = replayActions(s0, firstLegalMoveActions(s0), TEAMS.ROUGE);
    expect(res.error).toBe('ce n’est pas ton tour');
  });

  test('action inconnue (hors liste blanche) rejetée', () => {
    const res = replayActions(start(), [{ fn: 'setScore', args: ['bleu'] }], TEAMS.BLEU);
    expect(res.error).toBe('action inconnue : setScore');
  });

  test('arguments non scalaires rejetés', () => {
    const res = replayActions(start(), [{ fn: 'selectToken', args: [{ id: 'b1' }] }], TEAMS.BLEU);
    expect(res.error).toBe('arguments invalides pour selectToken');
  });

  test('journal vide ou trop long rejeté', () => {
    expect(replayActions(start(), [], TEAMS.BLEU).error).toBe('journal d’actions vide');
    const flood = Array.from({ length: MAX_ACTIONS_PER_PUSH + 1 }, () => ({ fn: 'deselect', args: [] }));
    expect(replayActions(start(), flood, TEAMS.BLEU).error).toBe('journal d’actions trop long');
  });

  test('aucune action acceptée sur une partie terminée', () => {
    const over = { ...start(), gameOver: true };
    const res = replayActions(over, [{ fn: 'deselect', args: [] }], TEAMS.BLEU);
    expect(res.error).toBe('la partie est terminée');
  });
});
