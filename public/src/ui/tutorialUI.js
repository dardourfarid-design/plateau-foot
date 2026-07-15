// ===================== TUTORIEL GUIDÉ (UI) =====================
// Visite guidée jouée sur le vrai moteur (mini-partie scriptée à 1 but) :
// bulle d'étapes, voile, spotlight sur l'élément attendu, et navigation
// didactique vers les vrais écrans profil/boutique. La logique de séquence
// des étapes vit dans tutorial.js (createTutorialController) ; ce module
// est la vue et le câblage DOM.
//
// Extrait de main.js (#21, lot 3). Même pattern que initShop()/initShootout() :
// initTutorial(deps) reçoit ses dépendances explicitement et retourne ce que
// main.js orchestre — isActive() (consulté par le flux de jeu) et
// checkTutorialProgress() (appelé après chaque action réelle).

import { createTutorialController } from './tutorial.js';
import { t } from './i18n.js';
import { showToast } from './dialogs.js';
import { createGame, getMoveDestinations } from '../engine/gameEngine.js';
import { TEAMS } from '../engine/constants.js';
import { buildBoardGrid } from './boardRenderer.js';
import { getMyFounderStatus } from '../services/passService.js';

/**
 * Initialise l'UI du tutoriel et branche ses boutons.
 * @param {object} deps
 * @param {object} deps.els                objet partagé de références DOM (main.js).
 * @param {() => object|null} deps.getUser utilisateur connecté ou null.
 * @param {() => object} deps.getGameState  état de jeu courant (main.js).
 * @param {(s: object) => void} deps.setGameState  remplace l'état de jeu.
 * @param {(m: string) => void} deps.setGameMode   force le mode ('local' pendant le tuto).
 * @param {() => void} deps.clearUndoSnapshot      annule le snapshot d'annulation.
 * @param {(r: number, c: number) => void} deps.handleCellClick  handler de clic plateau.
 * @param {() => void} deps.render                 re-render du plateau.
 * @param {() => void} deps.backToSetup            retour à l'écran de configuration.
 * @param {(tab: string) => boolean} deps.openRealProfileTab  affiche le VRAI onglet
 *        profil si les modules connectés sont disponibles ; retourne false sinon
 *        (le module affiche alors l'aperçu statique).
 * @returns {{ isActive: () => boolean, checkTutorialProgress: (eventType: string, payload: object) => void }}
 */
export function initTutorial({
  els, getUser, getGameState, setGameState, setGameMode, clearUndoSnapshot,
  handleCellClick, render, backToSetup, openRealProfileTab
}) {

  const tutorial = createTutorialController();
  let tutorialSpotlightEl = null; // élément actuellement mis en valeur, pour pouvoir retirer le halo

  function wireTutorial() {
    els.startTutorialBtn?.addEventListener('click', startTutorial);
    els.tutorialNextBtn.addEventListener('click', () => advanceTutorialStep());
    els.tutorialSkipBtn.addEventListener('click', endTutorial);
  }

  function startTutorial() {
    // Le tuto utilise le vrai moteur, juste avec un objectif minimal (1 but)
    // pour que la mini-partie se termine vite et naturellement.
    els.setupScreen.classList.add('hidden');
    els.configScreen.classList.add('hidden');
    els.gameScreen.classList.remove('hidden');
    els.gameControls.classList.add('hidden'); // pas de sens pendant un script guidé
    els.shootoutScreen?.classList.add('hidden');
    setGameMode('local');
    // Formation scriptee simplifiee : couloir central degage pour que la regle de
    // couverture (v0.5) ne bloque pas la demonstration "pousse le ballon vers la
    // cage". Un seul defenseur rouge, sur une aile, hors du couloir de tir ; le
    // gardien rouge reste a contourner (c'est le sens de l'etape "but").
    setGameState({
      ...createGame({ goalsToWin: 1 }),
      tokens: [
        { id: 'b-gk', team: TEAMS.BLEU, row: 8, col: 3, isGK: true },
        { id: 'b-att0', team: TEAMS.BLEU, row: 6, col: 2, isGK: false },
        { id: 'b-att1', team: TEAMS.BLEU, row: 6, col: 3, isGK: false },
        { id: 'b-att2', team: TEAMS.BLEU, row: 6, col: 4, isGK: false },
        { id: 'r-gk', team: TEAMS.ROUGE, row: 0, col: 3, isGK: true },
        { id: 'r-def0', team: TEAMS.ROUGE, row: 1, col: 1, isGK: false }
      ]
    });
    clearUndoSnapshot();
    buildBoardGrid(els.boardGrid, handleCellClick);

    const firstStep = tutorial.start();
    els.tutorialVeil.classList.remove('hidden');
    els.tutorialBubble.classList.remove('hidden');
    render();
    renderTutorialStep(firstStep);
  }

  function renderTutorialStep(step) {
    els.tutorialProgress.textContent = tutorial.progressLabel().replace('Étape', t('Étape'));
    els.tutorialText.textContent = t(step.text);
    els.tutorialNextBtn.classList.toggle('hidden', step.advanceOn !== 'next' && step.advanceOn !== 'finish');
    els.tutorialNextBtn.textContent = step.advanceOn === 'finish' ? t('Lancer une vraie partie →') : t('Suivant →');

    showTutorialView(step.view);
    applyTutorialSpotlight(step);
  }

  /**
   * Navigation didactique du tutoriel : les étapes « Mon profil » et
   * « Boutique » affichent les VRAIS écrans (avec les vraies données si le
   * joueur est connecté, un aperçu de démonstration sinon), au lieu d'un
   * simple texte pointant un bouton. Le voile du tutoriel reste au-dessus :
   * l'écran est montré, pas interactif — c'est une visite guidée.
   */
  function showTutorialView(view) {
    const showProfile = typeof view === 'string' && view.startsWith('profile');
    const showShop = view === 'shop';
    const showBoard = !showProfile && !showShop;

    els.gameScreen.classList.toggle('hidden', !showBoard);
    els.profileScreen.classList.toggle('hidden', !showProfile);

    if (showShop) {
      if (els.shopScreen.classList.contains('hidden')) {
        // Passe par le vrai bouton boutique : catalogue réel (ou catalogue de
        // secours hors connexion), solde à jour — exactement ce que le joueur
        // verra ensuite.
        els.shopBtn?.click();
      }
    } else if (!els.shopScreen.classList.contains('hidden')) {
      els.shopScreen.classList.add('hidden');
    }

    if (showProfile) {
      const tab = view === 'profile-challenges' ? 'challenges'
        : view === 'profile-team' ? 'team'
        : 'progress';
      if (!openRealProfileTab(tab)) {
        _showProfilePanelStatic(tab);
      }
      refreshFounderBadge();
    }
  }

  // Badge Fondateur (#61) : affiché dans l'entête du profil si l'utilisateur
  // connecté a acheté le Pack Fondateurs (profiles.is_founder). Masqué sinon
  // (non connecté, ou non fondateur).
  function refreshFounderBadge() {
    if (!els.founderBadge) return;
    if (!getUser()) { els.founderBadge.classList.add('hidden'); return; }
    getMyFounderStatus()
      .then(isFounder => els.founderBadge.classList.toggle('hidden', !isFounder))
      .catch(() => els.founderBadge.classList.add('hidden'));
  }

  /**
   * Version « aperçu » des onglets profil pour les visiteurs non connectés
   * pendant le tutoriel : bascule les panneaux sans appels réseau et remplit
   * les défis avec des exemples représentatifs, pour montrer la mécanique
   * sans exiger un compte au milieu de l'apprentissage.
   */
  function _showProfilePanelStatic(tab) {
    els.profileTabs.querySelectorAll('.profile-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.tab === tab);
    });
    els.panelProgress.classList.toggle('hidden', tab !== 'progress');
    els.panelChallenges.classList.toggle('hidden', tab !== 'challenges');
    els.panelTeam.classList.toggle('hidden', tab !== 'team');
    els.panelMercato.classList.add('hidden');
    els.panelLeaderboard.classList.add('hidden');

    if (tab === 'challenges') {
      const demo = [
        { desc: 'Joue une partie', prog: '0/1' },
        { desc: 'Gagne une partie', prog: '0/1' },
        { desc: 'Marque au moins deux buts', prog: '0/2' }
      ];
      els.challengesList.innerHTML = demo.map(d => `
        <div class="challenge-card">
          <div>
            <div class="challenge-desc">${d.desc}</div>
            <div class="challenge-progress">${d.prog}</div>
          </div>
          <div class="challenge-check"></div>
        </div>`).join('') +
        '<p class="profile-empty-note">Aperçu — crée un compte (gratuit) pour recevoir tes 3 vrais défis chaque jour.</p>';
    } else if (tab === 'team') {
      els.lineupSlots.innerHTML =
        '<p class="profile-empty-note">Aperçu — 6 postes à pourvoir en glissant tes joueurs ici. Crée un compte (gratuit) pour recevoir ton pack de démarrage de 6 joueurs.</p>';
      els.collectionGrid.innerHTML =
        '<p class="profile-empty-note">Ta collection apparaîtra ici : joueurs communs offerts, Rares et Légendaires à pouvoir spécial à gagner ou débloquer.</p>';
    } else {
      els.progressEmptyNote.classList.remove('hidden');
      els.progressEmptyNote.textContent = t('Aperçu — crée un compte (gratuit) pour suivre ta vraie progression.');
    }
  }

  function applyTutorialSpotlight(step) {
    if (tutorialSpotlightEl) {
      tutorialSpotlightEl.classList.remove('tutorial-spotlight', 'tutorial-spotlight-rect');
      tutorialSpotlightEl = null;
    }

    let targetEl = null;
    const gameState = getGameState();

    if (step.id === 'move-pawn') {
      // Cible la vraie case de déplacement disponible la plus proche du ballon
      // (pas un calcul absolu de position, qui pourrait ne pas être une
      // destination réellement atteignable en un coup pour ce pion précis).
      const selectedTok = gameState.tokens.find(t => t.id === gameState.selectedTokenId);
      if (selectedTok) {
        const destinations = getMoveDestinations(gameState, selectedTok);
        const ball = gameState.ball;
        let best = null;
        let bestDist = Infinity;
        destinations.forEach(([r, c]) => {
          const dist = Math.max(Math.abs(r - ball.row), Math.abs(c - ball.col));
          if (dist < bestDist) {
            bestDist = dist;
            best = [r, c];
          }
        });
        if (best) {
          targetEl = document.querySelector(`.cell[data-row="${best[0]}"][data-col="${best[1]}"]`);
        }
      }
    } else if (step.id === 'goal') {
      targetEl = document.querySelector('.board-wrap');
    } else if (step.target) {
      targetEl = document.querySelector(step.target);
      // Cible invisible (ex : compteur de pièces masqué hors connexion) :
      // retomber sur la cible de secours de l'étape.
      if ((!targetEl || targetEl.offsetParent === null) && step.fallbackTarget) {
        targetEl = document.querySelector(step.fallbackTarget) || targetEl;
      }
    }

    if (targetEl) {
      targetEl.classList.add('tutorial-spotlight');
      if (step.spotlightShape === 'rect') targetEl.classList.add('tutorial-spotlight-rect');
      tutorialSpotlightEl = targetEl;
    }
  }

  /**
   * Appelée après chaque action de jeu réelle (sélection, déplacement, passe,
   * but) pendant que le tutoriel est actif, pour vérifier si le geste du
   * joueur correspond à ce qu'attendait l'étape courante. Si oui, avance.
   * N'interfère jamais avec le résultat du coup lui-même — le moteur a déjà
   * appliqué la règle normalement, on ne fait qu'observer.
   */
  function checkTutorialProgress(eventType, payload) {
    if (!tutorial.isActive()) return;
    const step = tutorial.currentStep();
    if (step.advanceOn !== eventType) return;

    if (eventType === 'select-token' && step.validTokenIds && !step.validTokenIds.includes(payload.tokenId)) {
      return; // mauvais pion : le jeu continue normalement, mais le tutoriel attend toujours
    }

    advanceTutorialStep();
  }

  function advanceTutorialStep() {
    if (tutorial.isLastStep() && tutorial.currentStep().advanceOn === 'finish') {
      endTutorial();
      return;
    }
    const next = tutorial.advance();
    renderTutorialStep(next);
  }

  function endTutorial() {
    tutorial.stop();
    showToast(t('Tutoriel terminé ! Configure ta première vraie partie.'));
    if (tutorialSpotlightEl) {
      tutorialSpotlightEl.classList.remove('tutorial-spotlight', 'tutorial-spotlight-rect');
      tutorialSpotlightEl = null;
    }
    // La visite guidée a pu laisser le profil ou la boutique affichés.
    els.profileScreen.classList.add('hidden');
    els.shopScreen.classList.add('hidden');
    els.tutorialVeil.classList.add('hidden');
    els.tutorialBubble.classList.add('hidden');
    els.gameControls.classList.remove('hidden');
    backToSetup();
  }

  wireTutorial();

  return { isActive: () => tutorial.isActive(), checkTutorialProgress };
}
