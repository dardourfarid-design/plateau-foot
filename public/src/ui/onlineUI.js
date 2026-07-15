// ===================== MULTIJOUEUR EN LIGNE (UI) =====================
// Création/rejointe de partie par code d'invitation, salle d'attente, et
// synchronisation temps réel de l'état de jeu via Supabase Realtime
// (multiplayerService). L'hôte est toujours Bleu, celui qui rejoint Rouge.
//
// Extrait de main.js (#21, lot 4). Même pattern que initShop()/initShootout() :
// initOnline(deps) reçoit ses dépendances explicitement et retourne ce que
// main.js orchestre. Le cycle de vie de la session (id + désabonnement
// Realtime) est la propriété de CE module ; l'état de partie et myTeam
// restent la propriété de main.js (le flux de jeu les lit à chaque coup),
// mis à jour via les setters injectés.

import { t } from './i18n.js';
import { createGame } from '../engine/gameEngine.js';
import { TEAMS } from '../engine/constants.js';
import { buildBoardGrid } from './boardRenderer.js';
import {
  createGameSession, joinGameSession, pushGameState, subscribeToGameSession,
  cancelGameSession
} from '../services/multiplayerService.js';

/**
 * Initialise le mode en ligne et branche ses boutons.
 * @param {object} deps
 * @param {object} deps.els               objet partagé de références DOM (main.js).
 * @param {() => string} deps.getGameMode mode courant ('local' | 'ai' | 'online').
 * @param {() => object} deps.getGameState  état de jeu courant.
 * @param {(s: object) => void} deps.setGameState  remplace l'état de jeu.
 * @param {(team: string) => void} deps.setMyTeam  équipe contrôlée par ce navigateur.
 * @param {(r: number, c: number) => void} deps.handleCellClick  handler de clic plateau.
 * @param {() => void} deps.render        re-render du plateau.
 * @returns {{ syncOnlineStateIfNeeded: () => Promise<void>, leaveOnlineSession: () => void }}
 */
export function initOnline({ els, getGameMode, getGameState, setGameState, setMyTeam, handleCellClick, render }) {

  let onlineSessionId = null;
  let unsubscribeFromSession = null;

  function wireOnlineMode() {
    els.createOnlineBtn.addEventListener('click', handleCreateOnlineGame);
    els.joinOnlineBtn.addEventListener('click', handleJoinOnlineGame);
    els.joinCodeInput.addEventListener('input', () => {
      els.joinCodeInput.value = els.joinCodeInput.value.toUpperCase();
    });
    els.joinCodeInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') handleJoinOnlineGame();
    });
    els.cancelWaitingBtn.addEventListener('click', cancelOnlineWaiting);
  }

  async function handleCreateOnlineGame() {
    els.onlineError.textContent = '';
    try {
      const initialState = createGame({ goalsToWin: 3 });
      const { id, inviteCode } = await createGameSession(initialState);

      onlineSessionId = id;
      setMyTeam(TEAMS.BLEU); // l'hôte est toujours Bleu
      setGameState(initialState);

      els.configScreen.classList.add('hidden');
      els.waitingScreen.classList.remove('hidden');
      els.inviteCodeDisplay.textContent = inviteCode;

      unsubscribeFromSession = subscribeToGameSession(id, (newState, status) => {
        const stillWaiting = !els.waitingScreen.classList.contains('hidden');
        if (status === 'active' && stillWaiting) {
          // L'adversaire vient de rejoindre : on quitte la salle d'attente
          // et on démarre vraiment l'écran de jeu avec l'état reçu.
          setGameState(newState);
          els.waitingScreen.classList.add('hidden');
          els.gameScreen.classList.remove('hidden');
          buildBoardGrid(els.boardGrid, handleCellClick);
          render();
          return;
        }
        // Mise à jour normale en cours de partie (coup de l'adversaire).
        setGameState(newState);
        render();
      });
    } catch (err) {
      els.onlineError.textContent = err.message || 'Impossible de créer la partie.';
    }
  }

  async function handleJoinOnlineGame() {
    els.onlineError.textContent = '';
    const code = els.joinCodeInput.value.trim();
    if (code.length < 4) {
      els.onlineError.textContent = t('Entre le code complet de la partie.');
      return;
    }

    try {
      const { id, gameState: remoteState } = await joinGameSession(code);

      onlineSessionId = id;
      setMyTeam(TEAMS.ROUGE); // celui qui rejoint est toujours Rouge
      setGameState(remoteState);

      els.configScreen.classList.add('hidden');
      els.gameScreen.classList.remove('hidden');
      buildBoardGrid(els.boardGrid, handleCellClick);
      render();

      unsubscribeFromSession = subscribeToGameSession(id, (newState) => {
        setGameState(newState);
        render();
      });
    } catch (err) {
      els.onlineError.textContent = err.message || 'Code invalide ou partie déjà commencée.';
    }
  }

  function cancelOnlineWaiting() {
    if (unsubscribeFromSession) {
      unsubscribeFromSession();
      unsubscribeFromSession = null;
    }
    // Clôture la session côté serveur : sans ça, elle restait « waiting »
    // pour toujours et son code d'invitation restait joignable.
    if (onlineSessionId) {
      cancelGameSession(onlineSessionId).catch(() => {/* best effort */});
    }
    onlineSessionId = null;
    els.waitingScreen.classList.add('hidden');
    els.configScreen.classList.remove('hidden');
  }

  /**
   * Quitte la session en ligne côté client : désabonnement Realtime + oubli
   * de l'id. N'annule PAS la session côté serveur (contrairement à
   * cancelOnlineWaiting) — comportement historique de backToSetup/goToLanding,
   * conservé à l'identique.
   */
  function leaveOnlineSession() {
    if (unsubscribeFromSession) {
      unsubscribeFromSession();
      unsubscribeFromSession = null;
    }
    onlineSessionId = null;
  }

  /**
   * Pousse l'état courant vers Supabase si une partie en ligne est active.
   * Appelé après chaque coup local validé par le moteur, pour que l'adversaire
   * le reçoive via son abonnement Realtime.
   */
  async function syncOnlineStateIfNeeded() {
    if (getGameMode() !== 'online' || !onlineSessionId) return;
    try {
      await pushGameState(onlineSessionId, getGameState());
    } catch (err) {
      console.error('Échec de synchronisation multijoueur :', err);
    }
  }

  wireOnlineMode();

  return { syncOnlineStateIfNeeded, leaveOnlineSession };
}
