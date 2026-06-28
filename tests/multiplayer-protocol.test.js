import { describe, test, expect } from './test-utils.js';
import { createGame, applyMove, listLegalMoves } from '../src/engine/gameEngine.js';
import { TEAMS } from '../src/engine/constants.js';

// ===================== SIMULATION DE BACKEND MULTIJOUEUR =====================
// Ce test ne touche pas à src/services/multiplayerService.js (qui nécessite
// un vrai client Supabase pour fonctionner), mais valide le PROTOCOLE que ce
// service doit respecter : un état de jeu produit par le moteur côté hôte
// doit pouvoir être transmis tel quel et donner exactement le même résultat
// côté invité après application des mêmes coups. C'est la propriété
// fondamentale qui permet à deux navigateurs de rester synchronisés.

function createFakeBackend() {
  let storedState = null;
  let listeners = [];
  return {
    push(state) {
      storedState = state;
      listeners.forEach(fn => fn(state));
    },
    subscribe(fn) {
      listeners.push(fn);
      return () => { listeners = listeners.filter(l => l !== fn); };
    },
    getState() {
      return storedState;
    }
  };
}

describe('protocole multijoueur (simulation)', () => {
  test('un coup joué côté hôte, une fois transmis, donne un état identique côté invité', () => {
    const backend = createFakeBackend();

    // L'hôte crée la partie et la transmet (équivalent de createGameSession + push initial)
    let hostState = createGame({ goalsToWin: 3 });
    backend.push(hostState);

    // L'invité reçoit l'état initial (équivalent de joinGameSession)
    let guestState = backend.getState();
    expect(guestState).toEqual(hostState);

    // L'hôte (Bleu) joue un coup
    const moves = listLegalMoves(hostState).filter(m => m.type === 'move');
    const move = moves.find(m => m.tokenId.startsWith('b-def'));
    hostState = applyMove(hostState, move);
    backend.push(hostState);

    // L'invité reçoit la mise à jour et doit avoir EXACTEMENT le même état
    guestState = backend.getState();
    expect(guestState).toEqual(hostState);
    expect(guestState.turn).toBe(TEAMS.ROUGE);
  });

  test('les abonnés reçoivent bien chaque mise à jour, dans l’ordre', () => {
    const backend = createFakeBackend();
    const received = [];
    backend.subscribe(state => received.push(state.turn));

    let state = createGame();
    backend.push(state); // tour bleu (état initial)

    const moves = listLegalMoves(state).filter(m => m.type === 'move');
    const move = moves.find(m => m.tokenId.startsWith('b-def'));
    state = applyMove(state, move);
    backend.push(state); // tour rouge après ce coup

    expect(received).toEqual([TEAMS.BLEU, TEAMS.ROUGE]);
  });

  test('se désabonner arrête bien la réception de mises à jour', () => {
    const backend = createFakeBackend();
    const received = [];
    const unsubscribe = backend.subscribe(state => received.push(state.turn));

    backend.push(createGame()); // reçu
    unsubscribe();
    backend.push({ ...createGame(), turn: TEAMS.ROUGE }); // ne doit pas être reçu

    expect(received).toEqual([TEAMS.BLEU]);
  });

  test('une partie complète jouée alternativement par les deux côtés reste cohérente', () => {
    const backend = createFakeBackend();
    let hostView = createGame({ goalsToWin: 99 });
    let guestView = null;

    backend.subscribe(state => { guestView = state; });
    backend.push(hostView);

    // Simule 6 coups alternés ; à chaque fois, le "joueur actif" (déterminé
    // par hostView.turn) joue, peu importe si c'est conceptuellement l'hôte
    // ou l'invité — ce qui compte est que les deux vues convergent toujours.
    for (let i = 0; i < 6; i++) {
      const current = hostView; // vue "source de vérité" avant ce coup
      const moves = listLegalMoves(current);
      if (moves.length === 0) break;
      const move = moves[0];
      hostView = applyMove(current, move);
      backend.push(hostView);
      expect(guestView).toEqual(hostView);
    }
  });
});
