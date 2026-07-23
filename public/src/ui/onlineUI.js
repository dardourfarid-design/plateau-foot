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
  cancelGameSession, pushGameActions, clearOnlineActions, hasPendingOnlineActions
} from '../services/multiplayerService.js';
import { copyInviteCode, shareInvite } from './inviteShare.js';
import { showToast } from './dialogs.js';

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
  let currentInviteCode = null; // #264 : code de la partie créée (copier/partager)

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
    // #264 — copier / partager le code d'invitation.
    els.copyInviteCodeBtn?.addEventListener('click', handleCopyInviteCode);
    els.shareInviteCodeBtn?.addEventListener('click', handleShareInviteCode);
    installOnlineTestSeam();
  }

  // #264 — bandeau « adversaire déconnecté ». Piloté par la présence Realtime
  // (voir subscribeToGameSession) : masqué quand l'adversaire est là, montré
  // quand il disparaît. Toujours retiré en quittant/annulant la session.
  function setOpponentPresent(present) {
    els.opponentDisconnectedBanner?.classList.toggle('hidden', !!present);
  }
  function hideOpponentBanner() {
    els.opponentDisconnectedBanner?.classList.add('hidden');
  }

  async function handleCopyInviteCode() {
    if (!currentInviteCode) return;
    const r = await copyInviteCode(currentInviteCode);
    showWaitingFeedback(r === 'copied' ? t('Code copié !') : t('Impossible de copier le code.'));
  }

  async function handleShareInviteCode() {
    if (!currentInviteCode) return;
    const r = await shareInvite(currentInviteCode);
    if (r === 'shared' || r === 'cancelled') { showWaitingFeedback(''); return; }
    showWaitingFeedback(r === 'copied' ? t('Code copié !') : t('Partage indisponible.'));
  }

  function showWaitingFeedback(msg) {
    if (els.waitingFeedback) els.waitingFeedback.textContent = msg;
  }

  async function handleCreateOnlineGame() {
    els.onlineError.textContent = '';
    try {
      const initialState = createGame({ goalsToWin: 3 });
      const { id, inviteCode } = await createGameSession(initialState);

      onlineSessionId = id;
      currentInviteCode = inviteCode; // #264
      setMyTeam(TEAMS.BLEU); // l'hôte est toujours Bleu
      setGameState(initialState);

      els.configScreen.classList.add('hidden');
      els.waitingScreen.classList.remove('hidden');
      els.inviteCodeDisplay.textContent = inviteCode;
      showWaitingFeedback('');
      hideOpponentBanner();

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
        // Mise à jour normale en cours de partie (coup de l'adversaire) —
        // sauf écho de nos propres coups quand le local a déjà avancé (#260).
        if (hasPendingOnlineActions()) return;
        setGameState(newState);
        render();
      }, { selfId: TEAMS.BLEU, onPresence: setOpponentPresent }); // #264
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
      hideOpponentBanner();
      buildBoardGrid(els.boardGrid, handleCellClick);
      render();

      unsubscribeFromSession = subscribeToGameSession(id, (newState) => {
        if (hasPendingOnlineActions()) return; // écho de nos coups (#260)
        setGameState(newState);
        render();
      }, { selfId: TEAMS.ROUGE, onPresence: setOpponentPresent }); // #264
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
    currentInviteCode = null;
    hideOpponentBanner();
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
    currentInviteCode = null;
    hideOpponentBanner(); // #264 : jamais de bandeau résiduel hors partie en ligne
    clearOnlineActions(); // le journal n'a de sens que pour la session quittée
  }

  // #264 — seam de test E2E (JAMAIS actif en production) : la présence Realtime
  // exige un backend, impossible à exercer en e2e statique. Ce hook permet de
  // constater le bandeau de déconnexion et le retour du code copié/partagé sans
  // monter deux clients + Supabase. Gated par window.__TM_E2E__, comme le seam
  // principal de main.js.
  function installOnlineTestSeam() {
    if (typeof window === 'undefined' || !window.__TM_E2E__) return;
    window.__tmOnlineTest = {
      showWaitingScreen: (code) => {
        currentInviteCode = code || 'TEST42';
        if (els.inviteCodeDisplay) els.inviteCodeDisplay.textContent = currentInviteCode;
        showWaitingFeedback('');
        els.configScreen?.classList.add('hidden');
        els.waitingScreen?.classList.remove('hidden');
      },
      setOpponentPresent
    };
  }

  /**
   * Synchronise la partie en ligne après chaque coup local (#260) : envoie le
   * JOURNAL D'ACTIONS à l'Edge Function push-game-state, qui les rejoue sur
   * l'état autoritaire et retourne l'état résultant. Un coup refusé (422)
   * resynchronise le client sur l'état serveur. Tant que la fonction n'est
   * pas déployée, repli sur l'ancienne RPC (état complet, pré-migration 0039).
   * Les envois sont sérialisés : jamais deux pushs entrelacés.
   */
  let legacyPush = false;
  let syncChain = Promise.resolve();

  function syncOnlineStateIfNeeded() {
    if (getGameMode() !== 'online' || !onlineSessionId) return Promise.resolve();
    syncChain = syncChain.then(doSync, doSync);
    return syncChain;
  }

  async function doSync() {
    if (getGameMode() !== 'online' || !onlineSessionId) return;
    if (legacyPush) {
      clearOnlineActions(); // le journal ne sert à rien sur le chemin de repli
      try { await pushGameState(onlineSessionId, getGameState()); }
      catch (err) { console.error('Échec de synchronisation multijoueur :', err); }
      return;
    }
    try {
      const res = await pushGameActions(onlineSessionId);
      if (res.rejected) {
        // L'état serveur fait foi : on abandonne l'état local divergent.
        clearOnlineActions();
        if (res.state) { setGameState(res.state); render(); }
        showToast(t('Coup refusé par le serveur — partie resynchronisée.'));
        console.warn('Coup en ligne refusé :', res.reason);
        return;
      }
      // Réconciliation : n'adopte l'écho serveur que si aucune action locale
      // n'attend d'être validée (sinon on écraserait un coup plus récent).
      if (res.state && !hasPendingOnlineActions()) { setGameState(res.state); render(); }
    } catch (err) {
      if (err && err.code === 'FN_UNAVAILABLE') {
        legacyPush = true;
        console.warn('push-game-state indisponible : repli sur la RPC historique (pré-#260).');
        return doSync();
      }
      console.error('Échec de synchronisation multijoueur :', err);
    }
  }

  wireOnlineMode();

  return { syncOnlineStateIfNeeded, leaveOnlineSession };
}
