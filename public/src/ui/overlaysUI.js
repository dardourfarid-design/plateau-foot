// ===================== OVERLAYS BUT / FIN & NAVIGATION =====================
// Overlays « BUT ! » et « VICTOIRE » (avec stats, gain de pièces serveur et
// bouton récompense vidéo), retour à l'écran de configuration et retour à
// l'accueil. Ce module ferme/rouvre les écrans ; les décisions de flux de
// partie (IA, tutoriel, online) restent dans main.js et arrivent en
// dépendances injectées.
//
// Extrait de main.js (#21, lot 5). Même pattern que initShop()/initShootout().

import { t } from './i18n.js';
import { TEAMS } from '../engine/constants.js';
import { resetBallAfterGoal } from '../engine/gameEngine.js';
import { buildMatchSummary } from './matchSummary.js';
import * as adService from '../services/ads/adService.js';
import { recordMatchEnd } from '../services/ads/interstitialFrequency.js';
import { recordGameResult } from '../services/progressService.js';
import { getCurrencyBalance } from '../services/currencyService.js';

// v0.5 — un peu de "juice" : titres/mini-commentaires varies, et une mention
// speciale quand le but conclut une belle serie de passes (momentum).
const GOAL_TITLES = ['BUT !', 'BUUUT !', 'MAGNIFIQUE !', 'QUEL BUT !', 'GOLAZO !'];
const GOAL_LINES = ['Frappe imparable', 'Le gardien battu', 'En pleine lucarne', 'Ça fait mouche', 'Le public exulte'];

/**
 * Initialise les overlays de but/fin et la navigation de sortie de partie.
 * @param {object} deps
 * @param {object} deps.els                objet partagé de références DOM (main.js).
 * @param {() => object|null} deps.getUser utilisateur connecté ou null.
 * @param {() => object} deps.getGameState  état de jeu courant.
 * @param {(s: object) => void} deps.setGameState  remplace l'état de jeu.
 * @param {() => string} deps.getGameMode  mode courant ('local' | 'ai' | 'online').
 * @param {() => string} deps.getMyTeam    équipe contrôlée par ce navigateur.
 * @param {() => void} deps.clearUndoSnapshot  annule le snapshot d'annulation.
 * @param {() => void} deps.render         re-render du plateau.
 * @param {() => void} deps.maybeTriggerAiTurn  relance l'IA si c'est son tour.
 * @param {() => void} deps.syncOnlineState    pousse l'état si partie en ligne.
 * @param {() => void} deps.leaveOnlineSession  quitte la session en ligne côté client.
 * @param {() => boolean} deps.isTutorialActive  le tutoriel est-il en cours.
 * @param {(b: number) => void} deps.updateCoinDisplay  met à jour le solde topbar.
 * @param {(n: number) => void} deps.showCoinGain       micro-animation de gain.
 * @param {() => void} deps.maybeShowInterstitial  interstitiel de transition (plafonné).
 * @param {() => void} deps.refreshHomeBanner      re-render bannière d'accueil.
 * @returns {{ showGoalOverlay, hideGoalOverlayAndResume, showEndOverlay, backToSetup, goToLanding }}
 */
export function initOverlays({
  els, getUser, getGameState, setGameState, getGameMode, getMyTeam,
  clearUndoSnapshot, render, maybeTriggerAiTurn, syncOnlineState,
  leaveOnlineSession, isTutorialActive, updateCoinDisplay, showCoinGain,
  maybeShowInterstitial, refreshHomeBanner
}) {

  function pickRandom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  function showGoalOverlay(scoringTeam) {
    const gameState = getGameState();
    els.goalTitle.className = 'overlay-title ' + scoringTeam;
    const streak = gameState.lastGoalPassStreak || 0;
    els.goalTitle.textContent = t(streak >= 3 ? pickRandom(GOAL_TITLES.slice(1)) : pickRandom(GOAL_TITLES));
    const who = scoringTeam === TEAMS.BLEU ? t("L'équipe bleue marque") : t("L'équipe rouge marque");
    els.goalSub.textContent = streak >= 3 ? t('{who} — action à {n} passes, bonus momentum !', { who, n: streak }) : `${who} · ${t(pickRandom(GOAL_LINES))}`;
    // Affiche le nouveau score dans l'overlay pour un retour immédiat
    if (els.goalScoreFlash) {
      els.goalScoreFlash.textContent =
        `${gameState.score[TEAMS.BLEU]} – ${gameState.score[TEAMS.ROUGE]}`;
    }
    els.goalOverlay.classList.add('show');
  }

  function hideGoalOverlayAndResume() {
    els.goalOverlay.classList.remove('show');
    setGameState(resetBallAfterGoal(getGameState()));
    clearUndoSnapshot();
    render();
    syncOnlineState();
    maybeTriggerAiTurn();
  }

  function showEndOverlay(winningTeam) {
    // Garde anti "overlay fantôme" : si le joueur a déjà quitté l'écran de
    // jeu (retour accueil pendant le délai de 350 ms ou pendant le timer de
    // l'IA), ne pas réafficher l'écran de fin par-dessus un autre écran.
    if (els.gameScreen.classList.contains('hidden')) return;
    const gameState = getGameState();
    const currentUser = getUser();
    const myTeam = getMyTeam();
    els.endTitle.className = 'overlay-title ' + winningTeam;
    els.endTitle.textContent = winningTeam === TEAMS.BLEU ? t('BLEU GAGNE') : t('ROUGE GAGNE');
    els.endSub.textContent = `${gameState.score[TEAMS.BLEU]} – ${gameState.score[TEAMS.ROUGE]}`;

    // Colorier le trophée selon l'équipe gagnante
    const trophy = els.endOverlay.querySelector('.end-trophy');
    if (trophy) { trophy.className = 'end-trophy ' + winningTeam; }

    // Carte-bilan de fin (#211) : buts + meilleure action (momentum) + pouvoirs.
    // Contre l'IA ou en ligne, du point de vue du JOUEUR (myTeam) ; en local
    // 2 joueurs (écran partagé), du point de vue du vainqueur.
    if (els.endStatsRow) {
      const povTeam = (getGameMode() === 'local') ? winningTeam : myTeam;
      const summary = buildMatchSummary(gameState, povTeam);
      const stats = [
        `<div class="end-stat"><span class="end-stat-val">${summary.myGoals}</span><span class="end-stat-lbl">${t('Buts marqués')}</span></div>`,
        `<div class="end-stat"><span class="end-stat-val">${summary.oppGoals}</span><span class="end-stat-lbl">${t('Buts encaissés')}</span></div>`
      ];
      if (summary.bestMomentum >= 2) {
        stats.push(`<div class="end-stat"><span class="end-stat-val">${summary.bestMomentum}</span><span class="end-stat-lbl">${t('Meilleure action (passes)')}</span></div>`);
      }
      if (summary.powersUsed > 0) {
        stats.push(`<div class="end-stat"><span class="end-stat-val">${summary.powersUsed}</span><span class="end-stat-lbl">${t('Pouvoirs utilisés')}</span></div>`);
      }
      els.endStatsRow.innerHTML = stats.join('');
    }

    els.endOverlay.classList.add('show');

    // Récompense vidéo (opt-in) : proposée seulement si autorisée (3 verrous +
    // flag rewarded) et si un compte est connecté (le crédit SSV cible un
    // user_id). Masquée sinon.
    if (els.watchRewardedBtn) {
      const canReward = !!currentUser && adService.isFormatAllowed('rewarded');
      els.watchRewardedBtn.classList.toggle('hidden', !canReward);
      els.watchRewardedBtn.disabled = false;
    }

    // Compte ce match pour le plafond de fréquence des interstitiels (hors
    // tutoriel, qui n'est pas une vraie partie). N'AFFICHE rien ici : la pub
    // n'apparaît qu'à la transition suivante (backToSetup), jamais sur l'écran
    // de victoire.
    if (!isTutorialActive()) recordMatchEnd();

    if (currentUser && !isTutorialActive()) {
      const won = winningTeam === myTeam;
      const goalsScored = gameState.score[myTeam];
      // XP, streak, défis ET pièces sont attribués côté serveur en un seul
      // appel (record_game_result, migration 0026) : +10 victoire, +3 défaite,
      // +15 par défi complété. On relit ensuite le solde et on affiche le
      // gain réel (différence), qui peut inclure un bonus de défi.
      const previousBalance = parseInt(els.coinAmount?.textContent, 10) || 0;
      // #203 : meilleur momentum d'un but marqué par mon équipe sur la partie
      // (>= 3 passes => bonus XP/pièces décidé côté serveur).
      const bestMomentum = gameState.bestPassStreak?.[myTeam] || 0;
      recordGameResult(won, goalsScored, bestMomentum)
        .then(() => getCurrencyBalance())
        .then(newBalance => {
          updateCoinDisplay(newBalance);
          if (newBalance > previousBalance) showCoinGain(newBalance - previousBalance);
        })
        .catch(err => {
          console.error('Résultat de partie non enregistré :', err);
        });
    }
  }

  function backToSetup() {
    leaveOnlineSession();
    // gameMode n'est plus réinitialisé ici : le sélecteur visuel ("2 joueurs"
    // / "Ordinateur" / "En ligne") reste affiché tel que l'utilisateur l'a
    // choisi, donc la variable réelle doit rester cohérente avec lui. La
    // remettre à 'local' systématiquement créait une partie à 2 joueurs
    // silencieuse après une partie contre l'IA, sans que rien à l'écran ne
    // le laisse deviner.
    els.gameScreen.classList.add('hidden');
    els.shootoutScreen?.classList.add('hidden');
    els.endOverlay.classList.remove('show');
    els.goalOverlay.classList.remove('show');
    els.configScreen.classList.remove('hidden');

    // Transition entre deux matchs : moment autorisé pour un interstitiel
    // (plafonné). Fire-and-forget : ne bloque pas le retour à la configuration.
    maybeShowInterstitial();
  }

  // Retour a la page d'accueil (landing / hero) — declenche par un clic sur le
  // logo TM en haut a gauche. Ferme tous les ecrans/overlays et reaffiche l'accueil.
  function goToLanding() {
    leaveOnlineSession();
    els.gameScreen?.classList.add('hidden');
    els.configScreen?.classList.add('hidden');
    els.waitingScreen?.classList.add('hidden');
    els.shopScreen?.classList.add('hidden');
    els.profileScreen?.classList.add('hidden');
    els.shootoutScreen?.classList.add('hidden');
    els.endOverlay?.classList.remove('show');
    els.goalOverlay?.classList.remove('show');
    els.accountOverlay?.classList.remove('show');
    els.setupScreen?.classList.remove('hidden');
    refreshHomeBanner();
  }

  return { showGoalOverlay, hideGoalOverlayAndResume, showEndOverlay, backToSetup, goToLanding };
}
