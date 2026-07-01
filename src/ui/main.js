// ===================== MAIN APP =====================
// Orchestre le moteur de jeu pur (engine/gameEngine.js) et le rendu DOM
// (ui/boardRenderer.js). Contient l'unique mutable de l'app : `gameState`.
// Toute évolution de gameState passe par une fonction du moteur (jamais
// de mutation directe), pour garder le moteur comme seule source de vérité
// des règles.

import {
  createGame, selectToken, moveSelectedToken, passBall, passTurn,
  resetBallAfterGoal, applyMove, getMoveDestinations, applyBallMovement, PHASES
} from '../engine/gameEngine.js';
import { chooseAiMove, AI_LEVELS } from '../engine/ai.js';
import { TEAMS } from '../engine/constants.js';
import {
  POWER_TYPES, POWER_LABELS, canActivatePower, getPowerShotDestinations, activateTirPuissant,
  getSprintDestinations, activateSprint, activateMur, activateRelais, confirmRelaisAfterPass,
  getValidRepliTargets, activateRepliAdverse, expireWallIfNeeded
} from '../engine/powers.js';
import { buildBoardGrid, renderBoard } from './boardRenderer.js';
import { applyTheme, isThemeUnlocked, formatPrice, DEFAULT_THEME_ID } from './themeManager.js';
import { initShop } from './shopUI.js';
import { initProfile, toOwnedShape } from './profileUI.js';
import { initMercato } from './mercatoUI.js';
import { getCurrentUser, onAuthStateChange, signOut, signInWithEmail, signUpWithEmail, sendPasswordResetEmail } from '../services/supabaseClient.js';
import { checkoutTheme } from '../services/payment/paymentProvider.js';
import { createGameSession, joinGameSession, pushGameState, subscribeToGameSession } from '../services/multiplayerService.js';
import { createTutorialController } from './tutorial.js';
import { recordConsents, exportMyData, deleteMyData, CONSENT_PURPOSES } from '../services/consentService.js';
import { fetchMyCollection, fetchMyLineup, ensureStarterPack, fetchPlayerCatalog, saveLineup } from '../services/playerCollectionService.js';
import { recordGameResult, fetchMyProgress, fetchTodayChallenges, fetchLeaderboard } from '../services/progressService.js';
import { resolveLineup } from './playerIdentity.js';
import { renderAvatarSvg, hashSeedToAvatar, AVATAR_COLORS } from './playerAvatar.js';
import { fetchMyCustomPlayers, createCustomPlayer, CUSTOM_PLAYER_SLOT_THEME_ID, claimLevelRewards, purchasePlayer } from '../services/customPlayerService.js';
// mercatoService importé dans mercatoUI.js

const ACTIVE_THEME_STORAGE_KEY = 'plateau-foot:active-theme';
const ACTIVE_THEME_CONFIG_STORAGE_KEY = 'plateau-foot:active-theme-config';

// Thèmes retirés du catalogue (désactivés en base ou supprimés du catalogue
// de secours hors-ligne) mais qui peuvent rester mémorisés dans le
// localStorage d'un joueur qui les avait sélectionnés avant leur retrait.
// Sans ce garde-fou, ce joueur continuerait à voir l'ancien thème appliqué
// indéfiniment au chargement, même si la boutique ne le propose plus —
// c'est exactement ce qui s'est produit avec "neige" (vert-terrain
// quasi-blanc, confondu avec un plateau vide/bug d'affichage).
const RETIRED_THEME_IDS = ['neige'];

function loadSavedThemeId() {
  try {
    const savedId = window.localStorage.getItem(ACTIVE_THEME_STORAGE_KEY);
    if (!savedId || RETIRED_THEME_IDS.includes(savedId)) return DEFAULT_THEME_ID;
    return savedId;
  } catch (err) {
    return DEFAULT_THEME_ID;
  }
}

function loadSavedThemeConfig() {
  try {
    const savedId = window.localStorage.getItem(ACTIVE_THEME_STORAGE_KEY);
    if (savedId && RETIRED_THEME_IDS.includes(savedId)) return null; // retombe sur le défaut CSS
    const raw = window.localStorage.getItem(ACTIVE_THEME_CONFIG_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    return null;
  }
}

function saveActiveTheme(themeId, config) {
  try {
    window.localStorage.setItem(ACTIVE_THEME_STORAGE_KEY, themeId);
    window.localStorage.setItem(ACTIVE_THEME_CONFIG_STORAGE_KEY, JSON.stringify(config));
  } catch (err) {
    // Pas grave si on ne peut pas persister : l'app reste fonctionnelle,
    // juste sans mémorisation du thème entre deux visites.
  }
}

// ---------- État applicatif ----------

let gameState = null;
let undoSnapshot = null;
let currentUser = null;
let availableThemes = [];
let purchasedThemeIds = [];
let activeThemeId = loadSavedThemeId();
let gameMode = 'local'; // 'local' | 'ai' | 'online'
let aiLevel = AI_LEVELS.MOYEN;
let aiThinking = false;
const AI_TEAM = TEAMS.ROUGE; // l'IA joue toujours Rouge ; l'humain joue toujours Bleu en mode IA

// État multijoueur : myTeam est l'équipe contrôlée par CE navigateur ;
// l'autre équipe n'est jouable qu'en recevant les mises à jour de l'adversaire.
let onlineSessionId = null;

// Identité des joueurs fictifs alignés (résolue une fois par partie, pas
// par coup). null si pas de compte ou pas encore de composition choisie —
// dans ce cas l'affichage reste strictement identique à avant ce système.
let myResolvedLineup = null;

// Mode d'activation de pouvoir : quand non-null, le prochain clic sur une
// case du plateau est interprété comme la destination du pouvoir en cours
// d'activation (Tir Puissant, Sprint), plutôt qu'un déplacement normal.
let pendingPowerActivation = null; // { tokenId, power } | null
let myTeam = TEAMS.BLEU;
let unsubscribeFromSession = null;

// État tutoriel
const tutorial = createTutorialController();
let tutorialSpotlightEl = null; // élément actuellement mis en valeur, pour pouvoir retirer la classe au changement d'étape
let authMode = 'signin'; // 'signin' | 'signup'
let screenBeforeShop = 'setup';

// ---------- Références DOM ----------

const els = {};

function cacheDomRefs() {
  els.setupScreen = document.getElementById('setupScreen');
  els.configScreen = document.getElementById('configScreen');
  els.goToSetupBtn = document.getElementById('goToSetupBtn');
  els.configBackBtn = document.getElementById('configBackBtn');
  els.gameScreen = document.getElementById('gameScreen');
  els.boardGrid = document.getElementById('boardGrid');
  els.scoreBleu = document.getElementById('scoreBleu');
  els.scoreRouge = document.getElementById('scoreRouge');
  els.goalScoreFlash = document.getElementById('goalScoreFlash');
  els.endStatsRow = document.getElementById('endStatsRow');
  els.backToSetupFromEndBtn = document.getElementById('backToSetupFromEndBtn');
  els.sidebarScoreBleu = document.getElementById('sidebarScoreBleu');
  els.sidebarScoreRouge = document.getElementById('sidebarScoreRouge');
  els.sidebarTurn = document.getElementById('sidebarTurn');
  els.turnBanner = document.getElementById('turnBanner');
  els.hintBar = document.getElementById('hintBar');
  els.cancelBtn = document.getElementById('cancelBtn');
  els.endTurnBtn = document.getElementById('endTurnBtn');
  els.activatePowerBtn = document.getElementById('activatePowerBtn');
  els.powerTargetOverlay = document.getElementById('powerTargetOverlay');
  els.powerTargetList = document.getElementById('powerTargetList');
  els.cancelPowerTargetBtn = document.getElementById('cancelPowerTargetBtn');
  els.restartBtn = document.getElementById('restartBtn');
  els.startBtn = document.getElementById('startBtn');
  els.goalOptions = document.getElementById('goalOptions');
  els.modeOptions = document.getElementById('modeOptions');
  els.aiDifficultyField = document.getElementById('aiDifficultyField');
  els.aiDifficultyOptions = document.getElementById('aiDifficultyOptions');
  els.localAiBlock = document.getElementById('localAiBlock');
  els.onlineBlock = document.getElementById('onlineBlock');
  els.createOnlineBtn = document.getElementById('createOnlineBtn');
  els.joinCodeInput = document.getElementById('joinCodeInput');
  els.joinOnlineBtn = document.getElementById('joinOnlineBtn');
  els.onlineError = document.getElementById('onlineError');
  els.waitingScreen = document.getElementById('waitingScreen');
  els.inviteCodeDisplay = document.getElementById('inviteCodeDisplay');
  els.cancelWaitingBtn = document.getElementById('cancelWaitingBtn');
  els.startTutorialBtn = document.getElementById('startTutorialBtn');
  els.tutorialVeil = document.getElementById('tutorialVeil');
  els.tutorialBubble = document.getElementById('tutorialBubble');
  els.tutorialProgress = document.getElementById('tutorialProgress');
  els.tutorialText = document.getElementById('tutorialText');
  els.tutorialNextBtn = document.getElementById('tutorialNextBtn');
  els.tutorialSkipBtn = document.getElementById('tutorialSkipBtn');
  els.gameControls = document.getElementById('gameControls');
  els.goalOverlay = document.getElementById('goalOverlay');
  els.goalTitle = document.getElementById('goalTitle');
  els.goalSub = document.getElementById('goalSub');
  els.continueBtn = document.getElementById('continueBtn');
  els.endOverlay = document.getElementById('endOverlay');
  els.endTitle = document.getElementById('endTitle');
  els.endSub = document.getElementById('endSub');
  els.newGameBtn = document.getElementById('newGameBtn');
  els.shopBtn = document.getElementById('shopBtn');
  els.purchaseToast = document.getElementById('purchaseToast');
  els.purchaseToastIcon = document.getElementById('purchaseToastIcon');
  els.purchaseToastText = document.getElementById('purchaseToastText');
  els.shopScreen = document.getElementById('shopScreen');
  els.profileBtn = document.getElementById('profileBtn');
  els.profileScreen = document.getElementById('profileScreen');
  els.profileBackBtn = document.getElementById('profileBackBtn');
  els.profileTabs = document.getElementById('profileTabs');
  els.panelProgress = document.getElementById('panelProgress');
  els.panelChallenges = document.getElementById('panelChallenges');
  els.panelTeam = document.getElementById('panelTeam');
  els.panelLeaderboard = document.getElementById('panelLeaderboard');
  els.progressLevel = document.getElementById('progressLevel');
  els.progressXp = document.getElementById('progressXp');
  els.progressStreak = document.getElementById('progressStreak');
  els.progressWins = document.getElementById('progressWins');
  els.progressEmptyNote = document.getElementById('progressEmptyNote');
  els.challengesList = document.getElementById('challengesList');
  els.lineupSlots = document.getElementById('lineupSlots');
  els.collectionGrid = document.getElementById('collectionGrid');
  els.powerShopGrid = document.getElementById('powerShopGrid');
  els.saveLineupBtn = document.getElementById('saveLineupBtn');
  els.openCreatePlayerBtn = document.getElementById('openCreatePlayerBtn');
  els.createPlayerOverlay = document.getElementById('createPlayerOverlay');
  els.createPlayerError = document.getElementById('createPlayerError');
  els.createPlayerQuotaNote = document.getElementById('createPlayerQuotaNote');
  els.createPlayerPreview = document.getElementById('createPlayerPreview');
  els.newPlayerName = document.getElementById('newPlayerName');
  els.newPlayerStyleOptions = document.getElementById('newPlayerStyleOptions');
  els.newPlayerColorOptions = document.getElementById('newPlayerColorOptions');
  els.newPlayerPatternOptions = document.getElementById('newPlayerPatternOptions');
  els.newPlayerAccessoryOptions = document.getElementById('newPlayerAccessoryOptions');
  els.confirmCreatePlayerBtn = document.getElementById('confirmCreatePlayerBtn');
  els.closeCreatePlayerBtn = document.getElementById('closeCreatePlayerBtn');
  els.panelMercato = document.getElementById('panelMercato');
  els.friendPseudoInput = document.getElementById('friendPseudoInput');
  els.sendFriendRequestBtn = document.getElementById('sendFriendRequestBtn');
  els.friendRequestError = document.getElementById('friendRequestError');
  els.shareProfileBtn = document.getElementById('shareProfileBtn');
  els.shareProfileFeedback = document.getElementById('shareProfileFeedback');
  els.pendingFriendRequests = document.getElementById('pendingFriendRequests');
  els.friendsList = document.getElementById('friendsList');
  els.mercatoOffersReceived = document.getElementById('mercatoOffersReceived');
  els.mercatoOffersSent = document.getElementById('mercatoOffersSent');
  els.mercatoOfferOverlay = document.getElementById('mercatoOfferOverlay');
  els.mercatoOfferError = document.getElementById('mercatoOfferError');
  els.myPlayerSelect = document.getElementById('myPlayerSelect');
  els.friendPlayerSelect = document.getElementById('friendPlayerSelect');
  els.friendPlayerSelectLabel = document.getElementById('friendPlayerSelectLabel');
  els.confirmMercatoOfferBtn = document.getElementById('confirmMercatoOfferBtn');
  els.closeMercatoOfferBtn = document.getElementById('closeMercatoOfferBtn');
  els.leaderboardBody = document.getElementById('leaderboardBody');
  els.shopGrid = document.getElementById('shopGrid');
  els.shopBackBtn = document.getElementById('shopBackBtn');
  els.accountBtn = document.getElementById('accountBtn');
  els.accountStatus = document.getElementById('accountStatus');
  els.accountOverlay = document.getElementById('accountOverlay');
  els.accountLoggedOutView = document.getElementById('accountLoggedOutView');
  els.accountLoggedInView = document.getElementById('accountLoggedInView');
  els.authTitle = document.getElementById('authTitle');
  els.authError = document.getElementById('authError');
  els.authDisplayName = document.getElementById('authDisplayName');
  els.authEmail = document.getElementById('authEmail');
  els.authPassword = document.getElementById('authPassword');
  els.authSubmitBtn = document.getElementById('authSubmitBtn');
  els.authSwitchBtn = document.getElementById('authSwitchBtn');
  els.forgotPasswordBtn = document.getElementById('forgotPasswordBtn');
  els.forgotPasswordView = document.getElementById('forgotPasswordView');
  els.forgotPasswordError = document.getElementById('forgotPasswordError');
  els.forgotPasswordEmail = document.getElementById('forgotPasswordEmail');
  els.sendResetLinkBtn = document.getElementById('sendResetLinkBtn');
  els.backToLoginBtn = document.getElementById('backToLoginBtn');
  els.accountEmailDisplay = document.getElementById('accountEmailDisplay');
  els.signOutBtn = document.getElementById('signOutBtn');
  els.consentBlock = document.getElementById('consentBlock');
  els.consentAnalytics = document.getElementById('consentAnalytics');
  els.consentEmailMarketing = document.getElementById('consentEmailMarketing');
  els.consentDataSharing = document.getElementById('consentDataSharing');
  els.accountRequiredNote = document.getElementById('accountRequiredNote');
  els.manageConsentBtn = document.getElementById('manageConsentBtn');
  els.exportDataBtn = document.getElementById('exportDataBtn');
  els.deleteDataBtn = document.getElementById('deleteDataBtn');
  els.accountCloseBtn = document.getElementById('accountCloseBtn');
}

// ---------- Cycle de vie du jeu ----------

async function loadMyLineupForGame() {
  if (!currentUser) {
    myResolvedLineup = null;
    return;
  }
  try {
    const [lineupRow, collection, customPlayers] = await Promise.all([
      fetchMyLineup(), fetchMyCollection(), fetchMyCustomPlayers()
    ]);
    const allOwned = [...collection, ...customPlayers.map(toOwnedShape)];
    myResolvedLineup = resolveLineup(lineupRow, allOwned);
    applyPowersToGameState();
  } catch (err) {
    // Ne bloque jamais une partie si la lineup ne peut pas être chargée
    // (hors-ligne, pas encore de composition choisie, etc.) — le jeu reste
    // jouable normalement, juste sans les noms de joueurs affichés.
    console.error('Lineup non chargée :', err);
    myResolvedLineup = null;
  }
}

/**
 * Reporte les pouvoirs de la lineup résolue (équipe Bleu uniquement) sur
 * les tokens réels du gameState — ajoute `power` et `powerUsed: false` sur
 * les pions concernés. Appelé une seule fois par partie, juste après la
 * résolution de la lineup.
 */
function applyPowersToGameState() {
  if (!myResolvedLineup || !gameState) return;
  const slotKeys = ['gk', 'def0', 'def1', 'att0', 'att1', 'att2'];
  gameState = {
    ...gameState,
    tokens: gameState.tokens.map(t => {
      if (!t.id.startsWith('b-')) return t;
      const slot = t.id.slice(2);
      if (!slotKeys.includes(slot)) return t;
      const power = myResolvedLineup[slot]?.power;
      if (!power) return t;
      return { ...t, power, powerUsed: false };
    })
  };
}

function startGame(goalsToWin) {
  gameState = createGame({ goalsToWin });
  undoSnapshot = null;
  els.setupScreen.classList.add('hidden');
  els.configScreen.classList.add('hidden');
  els.gameScreen.classList.remove('hidden');
  buildBoardGrid(els.boardGrid, handleCellClick);
  loadMyLineupForGame().then(render); // rendu initial sans lineup, puis re-rendu dès qu'elle arrive
  render();
  maybeTriggerAiTurn();
}

function render() {
  const lineupsByTeam = myResolvedLineup ? { bleu: myResolvedLineup } : null;
  renderBoard(els.boardGrid, gameState, lineupsByTeam);
  // Flash d'animation sur le score qui vient de changer
  const prevBleu = parseInt(els.scoreBleu.textContent, 10);
  const prevRouge = parseInt(els.scoreRouge.textContent, 10);
  els.scoreBleu.textContent = gameState.score[TEAMS.BLEU];
  els.scoreRouge.textContent = gameState.score[TEAMS.ROUGE];
  if (gameState.score[TEAMS.BLEU] > prevBleu) {
    els.scoreBleu.classList.remove('goal-flash');
    void els.scoreBleu.offsetWidth; // force reflow pour re-déclencher l'animation
    els.scoreBleu.classList.add('goal-flash');
  }
  if (gameState.score[TEAMS.ROUGE] > prevRouge) {
    els.scoreRouge.classList.remove('goal-flash');
    void els.scoreRouge.offsetWidth;
    els.scoreRouge.classList.add('goal-flash');
  }
  els.sidebarScoreBleu.textContent = gameState.score[TEAMS.BLEU];
  els.sidebarScoreRouge.textContent = gameState.score[TEAMS.ROUGE];
  els.sidebarTurn.textContent = gameState.turn === TEAMS.BLEU ? 'Bleu' : 'Rouge';

  els.turnBanner.classList.remove('active-bleu', 'active-rouge');
  if (gameState.gameOver) {
    els.turnBanner.textContent = 'Partie terminée';
  } else {
    els.turnBanner.textContent = gameState.turn === TEAMS.BLEU ? 'Au tour de bleu' : 'Au tour de rouge';
    els.turnBanner.classList.add(gameState.turn === TEAMS.BLEU ? 'active-bleu' : 'active-rouge');
  }

  updateHint();
  updateCancelButton();
  updateEndTurnButton();
  updatePowerButton();
}

function updateHint() {
  if (gameState.gameOver) { els.hintBar.textContent = ''; return; }
  if (gameMode === 'ai' && gameState.turn === AI_TEAM) {
    els.hintBar.textContent = 'L\'ordinateur réfléchit…';
    return;
  }
  if (gameMode === 'online' && gameState.turn !== myTeam) {
    els.hintBar.textContent = 'En attente du coup de ton adversaire…';
    return;
  }
  if (gameState.phase === PHASES.SELECT) {
    els.hintBar.textContent = gameState.selectedTokenId
      ? 'Clique une case pour bouger, ou directement le ballon pour le pousser'
      : 'Touche un de tes pions pour le jouer';
  } else if (gameState.phase === PHASES.MOVED_CAN_PASS) {
    els.hintBar.textContent = 'Tu touches le ballon : pousse-le, ou clique « Terminer le tour »';
  }
}

function updateCancelButton() {
  if (gameMode === 'online') {
    els.cancelBtn.style.opacity = '0.3';
    els.cancelBtn.style.pointerEvents = 'none';
    return;
  }
  const canCancel =
    (gameState.phase === PHASES.SELECT && gameState.selectedTokenId) ||
    gameState.phase === PHASES.MOVED_CAN_PASS ||
    gameState.canUndo === true;
  els.cancelBtn.style.opacity = canCancel ? '1' : '0.45';
  els.cancelBtn.style.pointerEvents = canCancel ? 'auto' : 'none';
}

function updateEndTurnButton() {
  const shouldShow = gameState.phase === PHASES.MOVED_CAN_PASS;
  els.endTurnBtn.classList.toggle('hidden', !shouldShow);
}

/**
 * Affiche le bouton "Utiliser le pouvoir" uniquement quand le pion
 * sélectionné a un pouvoir disponible et que les conditions de contexte
 * sont remplies (Tir Puissant/Relais demandent d'être déjà adjacent au
 * ballon, comme une vraie passe).
 */
function updatePowerButton() {
  if (gameMode === 'online' && gameState.turn !== myTeam) {
    els.activatePowerBtn.classList.add('hidden');
    return;
  }
  const token = gameState.tokens.find(t => t.id === gameState.selectedTokenId);
  const canShow = token && canActivatePower(gameState, token) && !pendingPowerActivation;
  els.activatePowerBtn.classList.toggle('hidden', !canShow);
  if (canShow) {
    els.activatePowerBtn.textContent = `Utiliser : ${POWER_LABELS[token.power]}`;
  }
}

// ---------- Interactions plateau ----------

function handleCellClick(row, col) {
  if (gameState.gameOver || aiThinking) return;
  if (gameMode === 'online' && gameState.turn !== myTeam) return;

  if (pendingPowerActivation) {
    handlePowerDestinationClick(row, col);
    return;
  }

  if (gameState.phase === PHASES.SELECT) {
    const tok = gameState.tokens.find(t => t.row === row && t.col === col);

    if (tok && tok.team === gameState.turn) {
      if (!gameState.selectedTokenId) {
        undoSnapshot = gameState; // snapshot avant le premier geste de ce tour
      }
      gameState = selectToken(gameState, tok.id);
      render();
      checkTutorialProgress('select-token', { tokenId: tok.id });
      return;
    }

    if (gameState.selectedTokenId) {
      const before = gameState;
      gameState = passBall(gameState, row, col);
      if (gameState !== before) {
        handlePostActionEffects(before);
        return;
      }
      gameState = moveSelectedToken(gameState, row, col);
      if (gameState !== before) {
        handlePostActionEffects(before);
        return;
      }
      // Clic ailleurs sans coup valide -> désélection simple
      gameState = { ...gameState, selectedTokenId: null };
      render();
    }
  } else if (gameState.phase === PHASES.MOVED_CAN_PASS) {
    const before = gameState;
    gameState = passBall(gameState, row, col);
    if (gameState === before) {
      gameState = passTurn(gameState);
    }
    handlePostActionEffects(before);
  }
}

function handlePostActionEffects(previousState) {
  if (gameState.lastGoalBy && gameState.lastGoalBy !== previousState.lastGoalBy) {
    render();
    syncOnlineStateIfNeeded();

    if (tutorial.isActive()) {
      // Pendant le tutoriel, on ne montre pas l'overlay "BUT !" standard :
      // l'étape "goal" du script prend le relais avec son propre message,
      // pour ne pas superposer deux systèmes de feedback différents.
      checkTutorialProgress('goal-scored', {});
      return;
    }

    if (gameState.gameOver) {
      setTimeout(() => showEndOverlay(gameState.winner), 350);
    } else {
      showGoalOverlay(gameState.lastGoalBy);
    }
    return;
  }

  render();
  syncOnlineStateIfNeeded();

  if (tutorial.isActive()) {
    // Détecte si ce coup correspondait à l'étape "déplacement vers le ballon"
    // ou "passe" attendue par le script, sans dupliquer la logique du moteur.
    if (gameState.phase === PHASES.MOVED_CAN_PASS && previousState.phase === PHASES.SELECT) {
      checkTutorialProgress('move-to', {});
    } else if (gameState.ball.row !== previousState.ball.row || gameState.ball.col !== previousState.ball.col) {
      checkTutorialProgress('pass-ball', {});
    }
    // Le tuto est une mini-partie scriptée jouée uniquement par Bleu : on ne
    // laisse jamais le tour passer à Rouge (qui n'a ni IA ni joueur humain
    // actif ici), pour que le joueur puisse continuer à pousser le ballon
    // sur plusieurs coups d'affilée jusqu'au but, sans jamais être bloqué.
    if (gameState.turn === TEAMS.ROUGE && !gameState.gameOver) {
      gameState = { ...gameState, turn: TEAMS.BLEU };
      render();
    }
    return; // pas d'IA pendant le tutoriel
  }

  // Si une passe venait de se jouer et qu'un Relais était en attente sur le
  // pion qui a tiré, on confirme le bonus de second mouvement maintenant
  // (jamais avant un but, traité dans la branche ci-dessus séparément).
  if (gameState.relaisPendingForTeam) {
    gameState = confirmRelaisAfterPass(gameState);
    render();
  }

  // Le Mur ne protège qu'un seul tour adverse : on vérifie l'expiration à
  // chaque fin de tour, pas seulement lors de son activation.
  gameState = expireWallIfNeeded(gameState);

  maybeTriggerAiTurn();
}

/**
 * Si le mode IA est actif et que c'est au tour de l'IA, déclenche son coup
 * après un court délai (pour que l'humain voie bien son propre coup se jouer
 * avant que l'IA ne réponde — sans délai, l'enchaînement paraît instantané
 * et illisible). L'IA peut jouer plusieurs coups d'affilée si un but la
 * remet en position d'engager (cas rare mais géré par cette même fonction,
 * rappelée après chaque coup tant que c'est son tour).
 */
function maybeTriggerAiTurn() {
  if (gameMode !== 'ai') return;
  if (gameState.gameOver) return;
  if (gameState.turn !== AI_TEAM) return;

  aiThinking = true;
  els.boardGrid.classList.add('ai-thinking');
  setTimeout(() => {
    const before = gameState;
    const move = chooseAiMove(gameState, aiLevel);
    aiThinking = false;
    if (!move) {
      els.boardGrid.classList.remove('ai-thinking');
      return;
    }
    gameState = applyMove(gameState, move);
    els.boardGrid.classList.remove('ai-thinking');
    handlePostActionEffects(before);
  }, 550);
}

// ---------- Annulation ----------

function handleCancel() {
  if (aiThinking) return;
  if (gameMode === 'online') return; // pas d'undo en ligne : ça désynchroniserait l'adversaire
  if (gameState.phase === PHASES.SELECT && gameState.selectedTokenId) {
    gameState = { ...gameState, selectedTokenId: null };
    render();
    return;
  }
  if (undoSnapshot) {
    gameState = undoSnapshot;
    undoSnapshot = null;
    render();
  }
}

// ---------- Overlays ----------

function showGoalOverlay(scoringTeam) {
  els.goalTitle.className = 'overlay-title ' + scoringTeam;
  els.goalTitle.textContent = 'BUT !';
  els.goalSub.textContent = scoringTeam === TEAMS.BLEU ? "L'équipe bleue marque" : "L'équipe rouge marque";
  // Affiche le nouveau score dans l'overlay pour un retour immédiat
  if (els.goalScoreFlash) {
    els.goalScoreFlash.textContent =
      `${gameState.score[TEAMS.BLEU]} – ${gameState.score[TEAMS.ROUGE]}`;
  }
  els.goalOverlay.classList.add('show');
}

function hideGoalOverlayAndResume() {
  els.goalOverlay.classList.remove('show');
  gameState = resetBallAfterGoal(gameState);
  undoSnapshot = null;
  render();
  syncOnlineStateIfNeeded();
  maybeTriggerAiTurn();
}

function showEndOverlay(winningTeam) {
  els.endTitle.className = 'overlay-title ' + winningTeam;
  els.endTitle.textContent = winningTeam === TEAMS.BLEU ? 'BLEU GAGNE' : 'ROUGE GAGNE';
  els.endSub.textContent = `${gameState.score[TEAMS.BLEU]} – ${gameState.score[TEAMS.ROUGE]}`;

  // Colorier le trophée selon l'équipe gagnante
  const trophy = els.endOverlay.querySelector('.end-trophy');
  if (trophy) { trophy.className = 'end-trophy ' + winningTeam; }

  // Stats de fin : buts du gagnant + streak si disponible
  if (els.endStatsRow) {
    const winner = gameState.score[winningTeam];
    const loser = gameState.score[winningTeam === TEAMS.BLEU ? TEAMS.ROUGE : TEAMS.BLEU];
    els.endStatsRow.innerHTML = `
      <div class="end-stat">
        <span class="end-stat-val">${winner}</span>
        <span class="end-stat-lbl">Buts marqués</span>
      </div>
      <div class="end-stat">
        <span class="end-stat-val">${loser}</span>
        <span class="end-stat-lbl">Buts encaissés</span>
      </div>
    `;
  }

  els.endOverlay.classList.add('show');

  if (currentUser && !tutorial.isActive()) {
    const won = winningTeam === myTeam;
    const goalsScored = gameState.score[myTeam];
    recordGameResult(won, goalsScored).catch(err => {
      // N'affecte jamais l'expérience de jeu si l'enregistrement échoue
      // (hors-ligne, etc.) : la partie reste valide pour le joueur, on
      // perd juste la progression de cette partie précise côté serveur.
      console.error('Résultat de partie non enregistré :', err);
    });
  }
}

function backToSetup() {
  if (unsubscribeFromSession) {
    unsubscribeFromSession();
    unsubscribeFromSession = null;
  }
  onlineSessionId = null;
  // gameMode n'est plus réinitialisé ici : le sélecteur visuel ("2 joueurs"
  // / "Ordinateur" / "En ligne") reste affiché tel que l'utilisateur l'a
  // choisi, donc la variable réelle doit rester cohérente avec lui. La
  // remettre à 'local' systématiquement créait une partie à 2 joueurs
  // silencieuse après une partie contre l'IA, sans que rien à l'écran ne
  // le laisse deviner.
  els.gameScreen.classList.add('hidden');
  els.endOverlay.classList.remove('show');
  els.goalOverlay.classList.remove('show');
  els.configScreen.classList.remove('hidden');
}

// ---------- Écran d'accueil et configuration ----------

/**
 * Bloque l'accès au jeu si aucun compte n'est connecté : ouvre la modale
 * de compte en mode inscription plutôt que de lancer l'action demandée.
 * Centralise la règle "un compte est nécessaire pour jouer" à un seul
 * endroit, plutôt que de la dupliquer à chaque point d'entrée du jeu.
 */
// Fonction conservée mais non appelée pour l'instant : le compte obligatoire
// pour jouer a été désactivé temporairement pour faciliter les tests en
// conditions réelles. Pour réactiver le gating, remettre
// requireAccountThen(...) autour des actions startBtn/goToSetupBtn
// ci-dessous (voir l'historique du projet pour le code exact retiré).
function requireAccountThen(action) {
  if (currentUser) {
    action();
    return;
  }
  authMode = 'signup';
  renderAccountOverlayContent();
  els.accountOverlay.classList.add('show');
}

function wireSetupScreen() {
  let selectedGoals = 3;
  const options = els.goalOptions.querySelectorAll('.setup-option');
  options.forEach(opt => {
    opt.addEventListener('click', () => {
      options.forEach(o => o.classList.remove('active'));
      opt.classList.add('active');
      selectedGoals = parseInt(opt.dataset.val, 10);
    });
  });

  const modeOpts = els.modeOptions.querySelectorAll('.setup-option');
  modeOpts.forEach(opt => {
    opt.addEventListener('click', () => {
      modeOpts.forEach(o => o.classList.remove('active'));
      opt.classList.add('active');
      gameMode = opt.dataset.val;
      els.aiDifficultyField.classList.toggle('hidden', gameMode !== 'ai');
      els.onlineBlock.classList.toggle('hidden', gameMode !== 'online');
      els.localAiBlock.classList.toggle('hidden', gameMode === 'online');
      els.onlineError.textContent = '';
    });
  });

  const difficultyOpts = els.aiDifficultyOptions.querySelectorAll('.setup-option');
  difficultyOpts.forEach(opt => {
    opt.addEventListener('click', () => {
      difficultyOpts.forEach(o => o.classList.remove('active'));
      opt.classList.add('active');
      aiLevel = opt.dataset.val;
    });
  });

  els.startBtn.addEventListener('click', () => startGame(selectedGoals));

  els.goToSetupBtn.addEventListener('click', () => {
    els.setupScreen.classList.add('hidden');
    els.configScreen.classList.remove('hidden');
  });

  els.configBackBtn.addEventListener('click', () => {
    els.configScreen.classList.add('hidden');
    els.setupScreen.classList.remove('hidden');
  });
}

// ---------- Multijoueur en ligne ----------

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
    myTeam = TEAMS.BLEU; // l'hôte est toujours Bleu
    gameState = initialState;

    els.configScreen.classList.add('hidden');
    els.waitingScreen.classList.remove('hidden');
    els.inviteCodeDisplay.textContent = inviteCode;

    unsubscribeFromSession = subscribeToGameSession(id, (newState, status) => {
      const stillWaiting = !els.waitingScreen.classList.contains('hidden');
      if (status === 'active' && stillWaiting) {
        // L'adversaire vient de rejoindre : on quitte la salle d'attente
        // et on démarre vraiment l'écran de jeu avec l'état reçu.
        gameState = newState;
        els.waitingScreen.classList.add('hidden');
        els.gameScreen.classList.remove('hidden');
        buildBoardGrid(els.boardGrid, handleCellClick);
        render();
        return;
      }
      // Mise à jour normale en cours de partie (coup de l'adversaire).
      gameState = newState;
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
    els.onlineError.textContent = 'Entre le code complet de la partie.';
    return;
  }

  try {
    const { id, gameState: remoteState } = await joinGameSession(code);

    onlineSessionId = id;
    myTeam = TEAMS.ROUGE; // celui qui rejoint est toujours Rouge
    gameState = remoteState;

    els.configScreen.classList.add('hidden');
    els.gameScreen.classList.remove('hidden');
    buildBoardGrid(els.boardGrid, handleCellClick);
    render();

    unsubscribeFromSession = subscribeToGameSession(id, (newState) => {
      gameState = newState;
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
  onlineSessionId = null;
  els.waitingScreen.classList.add('hidden');
  els.configScreen.classList.remove('hidden');
}

/**
 * Pousse l'état courant vers Supabase si une partie en ligne est active.
 * Appelé après chaque coup local validé par le moteur, pour que l'adversaire
 * le reçoive via son abonnement Realtime.
 */
async function syncOnlineStateIfNeeded() {
  if (gameMode !== 'online' || !onlineSessionId) return;
  try {
    await pushGameState(onlineSessionId, gameState);
  } catch (err) {
    console.error('Échec de synchronisation multijoueur :', err);
  }
}

// ---------- Pouvoirs de pion ----------

function wirePowers() {
  els.activatePowerBtn?.addEventListener('click', handleActivatePowerClick);
  els.cancelPowerTargetBtn?.addEventListener('click', () => {
    els.powerTargetOverlay.classList.remove('show');
    pendingPowerActivation = null;
  });
}

function handleActivatePowerClick() {
  const token = gameState.tokens.find(t => t.id === gameState.selectedTokenId);
  if (!token || !canActivatePower(gameState, token)) return;

  switch (token.power) {
    case POWER_TYPES.TIR_PUISSANT:
    case POWER_TYPES.SPRINT:
      // Ces deux pouvoirs ont besoin d'une destination : on bascule en mode
      // ciblage, le prochain clic plateau sera intercepté par
      // handlePowerDestinationClick() plutôt que traité normalement.
      pendingPowerActivation = { tokenId: token.id, power: token.power };
      highlightPowerDestinations(token);
      els.hintBar.textContent = `${POWER_LABELS[token.power]} : choisis une case.`;
      break;

    case POWER_TYPES.MUR: {
      const before = gameState;
      gameState = activateMur(gameState, token.id);
      handlePostActionEffects(before);
      break;
    }

    case POWER_TYPES.RELAIS: {
      const before = gameState;
      gameState = activateRelais(gameState, token.id);
      // Pas de fin de tour ici : le joueur doit maintenant effectuer une
      // vraie passe normalement, confirmRelaisAfterPass() prendra le relais
      // au bon moment dans handlePostActionEffects.
      render();
      els.hintBar.textContent = 'Relais activé : pousse le ballon, tu pourras ensuite déplacer un second pion.';
      break;
    }

    case POWER_TYPES.REPLI_ADVERSE:
      openPowerTargetSelection(token);
      break;
  }
}

/**
 * Affiche les cases atteignables par Tir Puissant ou Sprint comme des
 * destinations spéciales (réutilise les classes CSS existantes des
 * marqueurs de déplacement/passe pour rester visuellement cohérent).
 */
function highlightPowerDestinations(token) {
  const dests = token.power === POWER_TYPES.TIR_PUISSANT
    ? getPowerShotDestinations(gameState)
    : getSprintDestinations(gameState, token);

  document.querySelectorAll('.cell').forEach(cell => {
    const r = parseInt(cell.dataset.row, 10);
    const c = parseInt(cell.dataset.col, 10);
    const isDest = dests.some(([dr, dc]) => dr === r && dc === c);
    cell.classList.toggle('dest-power', isDest);
  });
}

function handlePowerDestinationClick(row, col) {
  const { tokenId, power } = pendingPowerActivation;
  const before = gameState;

  if (power === POWER_TYPES.TIR_PUISSANT) {
    gameState = activateTirPuissant(gameState, tokenId, row, col, applyBallMovement);
  } else if (power === POWER_TYPES.SPRINT) {
    gameState = activateSprint(gameState, tokenId, row, col, moveSelectedToken);
  }

  document.querySelectorAll('.dest-power').forEach(cell => cell.classList.remove('dest-power'));
  pendingPowerActivation = null;

  if (gameState === before) {
    // Coup invalide (case hors des destinations autorisées) : on reste en
    // mode normal plutôt que de bloquer le joueur silencieusement.
    render();
    return;
  }

  handlePostActionEffects(before);
}

function openPowerTargetSelection(token) {
  const targets = getValidRepliTargets(gameState, token.team);
  els.powerTargetList.innerHTML = '';

  if (targets.length === 0) {
    els.powerTargetList.innerHTML = '<p class="profile-empty-note">Aucune cible valide.</p>';
  } else {
    targets.forEach(target => {
      const opt = document.createElement('div');
      opt.className = 'mercato-player-option';
      opt.textContent = displayNameForToken(target.id, myResolvedLineup ? { [myTeam]: myResolvedLineup } : null)
        || (target.isGK ? 'Gardien' : `Pion ${target.team}`);
      opt.addEventListener('click', () => {
        const before = gameState;
        gameState = activateRepliAdverse(gameState, token.id, target.id);
        els.powerTargetOverlay.classList.remove('show');
        pendingPowerActivation = null;
        handlePostActionEffects(before);
      });
      els.powerTargetList.appendChild(opt);
    });
  }

  els.powerTargetOverlay.classList.add('show');
}

function wireGameControls() {
  // Bouton "← Accueil" dans l'overlay de fin de partie
  els.backToSetupFromEndBtn?.addEventListener('click', backToSetup);
  els.cancelBtn.addEventListener('click', handleCancel);
  els.endTurnBtn.addEventListener('click', handleEndTurnClick);
  els.restartBtn.addEventListener('click', backToSetup);
  els.continueBtn.addEventListener('click', hideGoalOverlayAndResume);
  els.newGameBtn.addEventListener('click', backToSetup);
}

function handleEndTurnClick() {
  if (aiThinking) return;
  const before = gameState;
  gameState = passTurn(gameState);
  handlePostActionEffects(before);
}

// ---------- Boutique de thèmes ----------

// Toute la logique de la boutique (catalogue, achats, bundle Mondial) a
// été extraite vers shopUI.js (sprint dette technique) pour alléger ce
// fichier. wireShop() devient un simple pont qui fournit à shopUI les
// quelques éléments transverses dont il a besoin (compte, navigation
// d'écran), sans dupliquer aucun état.
function wireShop() {
  initShop({
    els,
    getCurrentUser: () => currentUser,
    openAccountForSignIn: () => {
      authMode = 'signin';
      renderAccountOverlayContent();
      els.accountOverlay.classList.add('show');
    },
    loadSavedThemeId,
    saveActiveTheme,
    rememberScreenContext: () => {
      if (!els.gameScreen.classList.contains('hidden')) {
        screenBeforeShop = 'game';
      } else if (!els.configScreen.classList.contains('hidden')) {
        screenBeforeShop = 'config';
      } else {
        screenBeforeShop = 'setup';
      }
    },
    restoreScreenContext: () => {
      if (screenBeforeShop === 'game') {
        els.gameScreen.classList.remove('hidden');
      } else if (screenBeforeShop === 'config') {
        els.configScreen.classList.remove('hidden');
      } else {
        els.setupScreen.classList.remove('hidden');
      }
    }
  });
}


// ---------- Compte ----------

function updateAccountUI() {
  if (!els.accountStatus) return;
  els.accountStatus.textContent = currentUser
    ? (currentUser.email || 'Connecté')
    : 'Non connecté';
}

function renderAccountOverlayContent() {
  if (currentUser) {
    els.accountLoggedOutView.classList.add('hidden');
    els.accountLoggedInView.classList.remove('hidden');
    els.accountEmailDisplay.textContent = currentUser.email;
  } else {
    els.accountLoggedInView.classList.add('hidden');
    els.accountLoggedOutView.classList.remove('hidden');
    els.forgotPasswordView.classList.add('hidden'); // toujours repartir sur le formulaire de connexion, pas la récupération
    els.authTitle.textContent = authMode === 'signin' ? 'Connexion' : 'Créer un compte';
    els.authSubmitBtn.textContent = authMode === 'signin' ? 'Se connecter' : 'Créer mon compte';
    els.authSwitchBtn.textContent = authMode === 'signin'
      ? 'Pas encore de compte ? Créer un compte'
      : 'Déjà un compte ? Se connecter';
    els.authDisplayName.style.display = authMode === 'signup' ? 'block' : 'none';
    els.consentBlock.classList.toggle('hidden', authMode !== 'signup');
    els.authError.textContent = '';
  }
}

async function handleAuthSubmit() {
  const email = els.authEmail.value.trim();
  const password = els.authPassword.value;
  els.authError.textContent = '';
  els.authError.style.color = '';

  if (!email || !password) {
    els.authError.textContent = 'Email et mot de passe requis.';
    return;
  }

  // État de chargement sur le bouton — évite les double-clics et indique
  // clairement que la requête est en cours (Supabase Auth peut prendre 1-2s).
  const originalLabel = els.authSubmitBtn.textContent;
  els.authSubmitBtn.textContent = '…';
  els.authSubmitBtn.disabled = true;

  try {
    if (authMode === 'signin') {
      const { error } = await signInWithEmail(email, password);
      if (error) throw error;
    } else {
      const displayName = els.authDisplayName.value.trim() || 'Joueur';
      const { error } = await signUpWithEmail(email, password, displayName);
      if (error) throw error;

      // Enregistre chaque consentement séparément, reflétant exactement
      // l'état des cases au moment de l'inscription (cochée ou non).
      try {
        await recordConsents({
          [CONSENT_PURPOSES.ANALYTICS]: els.consentAnalytics.checked,
          [CONSENT_PURPOSES.EMAIL_MARKETING]: els.consentEmailMarketing.checked,
          [CONSENT_PURPOSES.DATA_SHARING]: els.consentDataSharing.checked
        });
      } catch (consentErr) {
        console.error('Consentement non enregistré :', consentErr);
      }

      els.authSubmitBtn.disabled = false;
      els.authSubmitBtn.textContent = originalLabel;
      els.authError.style.color = 'var(--craie-att)';
      els.authError.textContent = 'Compte créé ! Vérifie tes emails si une confirmation est requise.';
      return;
    }
    currentUser = await getCurrentUser();
    updateAccountUI();
    renderAccountOverlayContent();
    els.accountOverlay.classList.remove('show');
  } catch (err) {
    els.authSubmitBtn.disabled = false;
    els.authSubmitBtn.textContent = originalLabel;
    // Traduire les erreurs Supabase les plus fréquentes en français
    const msg = err.message || '';
    let displayMsg = msg;
    if (msg.includes('Invalid login credentials') || msg.includes('invalid_credentials')) {
      displayMsg = 'Email ou mot de passe incorrect.';
    } else if (msg.includes('Email not confirmed')) {
      displayMsg = 'Confirme ton adresse email avant de te connecter (vérifie tes spams).';
    } else if (msg.includes('User already registered')) {
      displayMsg = 'Ce compte existe déjà. Connecte-toi plutôt.';
    } else if (msg.includes('Password should be at least')) {
      displayMsg = 'Le mot de passe doit faire au moins 6 caractères.';
    } else if (!msg) {
      displayMsg = 'Connexion impossible. Vérifie ta connexion internet.';
    }
    els.authError.textContent = displayMsg;
    console.error('[Auth]', err.message);
  }
}

function wireAccount() {
  onAuthStateChange(user => {
    currentUser = user;
    updateAccountUI();
  });
  getCurrentUser().then(user => {
    currentUser = user;
    updateAccountUI();
  });

  els.accountBtn?.addEventListener('click', () => {
    renderAccountOverlayContent();
    els.accountOverlay.classList.add('show');
  });

  els.accountCloseBtn?.addEventListener('click', () => {
    els.accountOverlay.classList.remove('show');
  });

  els.authSwitchBtn?.addEventListener('click', () => {
    authMode = authMode === 'signin' ? 'signup' : 'signin';
    renderAccountOverlayContent();
  });

  els.authSubmitBtn?.addEventListener('click', handleAuthSubmit);

  els.forgotPasswordBtn?.addEventListener('click', () => {
    els.accountLoggedOutView.classList.add('hidden');
    els.forgotPasswordView.classList.remove('hidden');
    els.forgotPasswordError.textContent = '';
    els.forgotPasswordEmail.value = els.authEmail.value || '';
  });

  els.backToLoginBtn?.addEventListener('click', () => {
    els.forgotPasswordView.classList.add('hidden');
    els.accountLoggedOutView.classList.remove('hidden');
  });

  els.sendResetLinkBtn?.addEventListener('click', async () => {
    const email = els.forgotPasswordEmail.value.trim();
    els.forgotPasswordError.textContent = '';
    if (!email) {
      els.forgotPasswordError.textContent = 'Indique ton email.';
      return;
    }
    try {
      await sendPasswordResetEmail(email);
      // Message volontairement identique que l'email existe ou non dans la
      // base : ne jamais révéler si une adresse précise a un compte ou
      // pas, pour éviter qu'un tiers puisse vérifier l'existence de
      // comptes par essais successifs (énumération d'utilisateurs).
      els.forgotPasswordError.style.color = 'var(--craie-att)';
      els.forgotPasswordError.textContent = 'Si un compte existe avec cet email, un lien de réinitialisation vient d\'être envoyé.';
    } catch (err) {
      els.forgotPasswordError.style.color = 'var(--rouge-equipe-clair)';
      els.forgotPasswordError.textContent = err.message || 'Envoi impossible pour le moment.';
    }
  });

  els.authPassword?.addEventListener('keydown', e => {
    if (e.key === 'Enter') handleAuthSubmit();
  });

  els.signOutBtn?.addEventListener('click', async () => {
    await signOut();
    currentUser = null;
    updateAccountUI();
    els.accountOverlay.classList.remove('show');
  });

  els.exportDataBtn?.addEventListener('click', async () => {
    try {
      const data = await exportMyData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'tactic-master-mes-donnees.json';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(err.message || 'Export impossible pour le moment.');
    }
  });

  els.deleteDataBtn?.addEventListener('click', async () => {
    const confirmed = confirm(
      'Supprimer définitivement ton compte et toutes tes données (achats, parties, préférences) ? Cette action est irréversible.'
    );
    if (!confirmed) return;
    try {
      await deleteMyData();
      await signOut();
      currentUser = null;
      updateAccountUI();
      els.accountOverlay.classList.remove('show');
      alert('Tes données ont été supprimées.');
    } catch (err) {
      alert(err.message || 'Suppression impossible pour le moment.');
    }
  });

  els.manageConsentBtn?.addEventListener('click', () => {
    // Réutilise le même panneau de consentement que l'inscription, en mode
    // "mise à jour" plutôt que création — les choix sont enregistrés
    // immédiatement, sans recréer de compte.
    openConsentManagementPanel();
  });
}

function openConsentManagementPanel() {
  const analytics = confirm('Acceptes-tu l\'analyse de ton usage du jeu pour améliorer le produit ?');
  const emailMarketing = confirm('Acceptes-tu de recevoir des emails sur les nouveautés et offres ?');
  const dataSharing = confirm('Acceptes-tu le partage de tes données avec des partenaires sélectionnés ?');

  recordConsents({
    [CONSENT_PURPOSES.ANALYTICS]: analytics,
    [CONSENT_PURPOSES.EMAIL_MARKETING]: emailMarketing,
    [CONSENT_PURPOSES.DATA_SHARING]: dataSharing
  }).then(() => {
    alert('Tes préférences ont été mises à jour.');
  }).catch(err => {
    alert(err.message || 'Mise à jour impossible pour le moment.');
  });
}

// ---------- Tutoriel guidé ----------

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
  gameMode = 'local';
  gameState = createGame({ goalsToWin: 1 });
  undoSnapshot = null;
  buildBoardGrid(els.boardGrid, handleCellClick);

  const firstStep = tutorial.start();
  els.tutorialVeil.classList.remove('hidden');
  els.tutorialBubble.classList.remove('hidden');
  render();
  renderTutorialStep(firstStep);
}

function renderTutorialStep(step) {
  els.tutorialProgress.textContent = tutorial.progressLabel();
  els.tutorialText.textContent = step.text;
  els.tutorialNextBtn.classList.toggle('hidden', step.advanceOn !== 'next' && step.advanceOn !== 'finish');
  els.tutorialNextBtn.textContent = step.advanceOn === 'finish' ? 'Lancer une vraie partie →' : 'Suivant →';

  applyTutorialSpotlight(step);
}

function applyTutorialSpotlight(step) {
  if (tutorialSpotlightEl) {
    tutorialSpotlightEl.classList.remove('tutorial-spotlight');
    tutorialSpotlightEl = null;
  }

  let targetEl = null;

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
  }

  if (targetEl) {
    targetEl.classList.add('tutorial-spotlight');
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
  if (tutorialSpotlightEl) {
    tutorialSpotlightEl.classList.remove('tutorial-spotlight');
    tutorialSpotlightEl = null;
  }
  els.tutorialVeil.classList.add('hidden');
  els.tutorialBubble.classList.add('hidden');
  els.gameControls.classList.remove('hidden');
  backToSetup();
}

// ---------- Écran Profil ----------

/**
 * Orchestre l'affichage des onglets et délègue le chargement de chaque
 * panneau à profileUI ou mercatoUI selon l'onglet sélectionné.
 * Reste dans main.js car c'est de l'orchestration entre deux modules,
 * pas de la logique appartenant à l'un ou l'autre domaine.
 */
function switchProfileTab(tabName, profileModule, mercatoModule) {
  els.profileTabs.querySelectorAll('.profile-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.tab === tabName);
  });
  els.panelProgress.classList.toggle('hidden', tabName !== 'progress');
  els.panelChallenges.classList.toggle('hidden', tabName !== 'challenges');
  els.panelTeam.classList.toggle('hidden', tabName !== 'team');
  els.panelMercato.classList.toggle('hidden', tabName !== 'mercato');
  els.panelLeaderboard.classList.toggle('hidden', tabName !== 'leaderboard');

  if (tabName === 'challenges') profileModule.loadChallengesPanel();
  if (tabName === 'team') profileModule.loadTeamPanel();
  if (tabName === 'mercato') mercatoModule.loadMercatoPanel();
  if (tabName === 'leaderboard') profileModule.loadLeaderboardPanel();
}

// ---------- Démarrage ----------

function init() {
  cacheDomRefs();

  // Applique immédiatement le thème mémorisé (avant tout appel réseau),
  // pour que le visiteur revoie instantanément l'ambiance qu'il a choisie,
  // même hors-ligne ou avant que Supabase ait répondu.
  const savedConfig = loadSavedThemeConfig();
  if (savedConfig) {
    applyTheme(savedConfig);
  }

  wireSetupScreen();
  wireOnlineMode();
  wireGameControls();
  wireShop();
  // Initialisation des modules profil et mercato — même pattern que initShop() :
  // chaque module reçoit ses dépendances explicitement et retourne les
  // fonctions que main.js doit orchestrer (notamment les loaders d'onglets).
  const profileModule = initProfile({
    els,
    getCurrentUser: () => currentUser,
    openAccountOverlay: () => {
      authMode = 'signin';
      renderAccountOverlayContent();
      els.accountOverlay.classList.add('show');
    },
    checkoutTheme,
    renderAvatarSvg,
    hashSeedToAvatar,
    AVATAR_COLORS,
    POWER_LABELS,
    CUSTOM_PLAYER_SLOT_THEME_ID,
    ensureStarterPack,
    fetchMyProgress,
    fetchTodayChallenges,
    claimLevelRewards,
    fetchMyCollection,
    fetchMyLineup,
    fetchMyCustomPlayers,
    saveLineup,
    createCustomPlayer,
    fetchPlayerCatalog,
    purchasePlayer,
    fetchLeaderboard
  });

  const mercatoModule = initMercato({
    els,
    sendFriendRequest,
    respondFriendRequest,
    fetchMyFriendships,
    createMercatoOffer,
    respondMercatoOffer,
    cancelMercatoOffer,
    fetchMyMercatoOffers,
    fetchFriendCollection,
    fetchMyCollection,
    fetchMyCustomPlayers,
    toOwnedShape,
    loadTeamPanel: profileModule.loadTeamPanel
  });

  // switchProfileTab reste dans main.js : c'est de l'orchestration pure
  // entre deux modules (profileUI et mercatoUI), pas de la logique d'un
  // domaine en particulier.
  els.profileTabs?.querySelectorAll('.profile-tab').forEach(tab => {
    tab.addEventListener('click', () => switchProfileTab(tab.dataset.tab, profileModule, mercatoModule));
  });
  wirePowers();
  wireAccount();
  wireTutorial();
  registerServiceWorker();
  handlePaymentReturn();
}

/**
 * Vérifie si la page vient d'être chargée après un retour de Stripe
 * Checkout (succès ou annulation), affiche un message adapté, puis
 * nettoie l'URL pour que le message ne réapparaisse pas à un futur
 * rechargement de la page par l'utilisateur.
 */
function handlePaymentReturn() {
  const params = new URLSearchParams(window.location.search);
  const checkoutResult = params.get('checkout');
  if (!checkoutResult) return;

  if (checkoutResult === 'success') {
    showPurchaseToast('🎉', 'Achat confirmé ! Ton nouveau contenu est débloqué.', false);
    // Ouvre directement la boutique avec les données fraîches, pour que
    // l'utilisateur voie immédiatement son achat débloqué sans action
    // supplémentaire de sa part.
    els.shopBtn?.click();
  } else if (checkoutResult === 'cancelled') {
    showPurchaseToast('↩️', 'Achat annulé — aucun montant n\'a été débité.', true);
  }

  // Retire le paramètre de l'URL sans recharger la page, pour qu'un
  // rafraîchissement ultérieur ne réaffiche pas le même message.
  params.delete('checkout');
  const cleanUrl = window.location.pathname + (params.toString() ? `?${params}` : '');
  window.history.replaceState({}, '', cleanUrl);
}

function showPurchaseToast(icon, text, isCancelled) {
  if (!els.purchaseToast) return;
  els.purchaseToastIcon.textContent = icon;
  els.purchaseToastText.textContent = text;
  els.purchaseToast.classList.toggle('cancelled', isCancelled);
  els.purchaseToast.classList.add('show');
  els.purchaseToast.classList.remove('hidden');

  setTimeout(() => {
    els.purchaseToast.classList.remove('show');
  }, 5000);
}

/**
 * Enregistre le service worker pour permettre l'installation PWA et un
 * fonctionnement minimal hors-ligne (écran d'accueil, jeu local/IA).
 * Échoue silencieusement si le navigateur ne supporte pas les service
 * workers, ou si le fichier est inaccessible — ne doit jamais bloquer le
 * chargement normal du jeu.
 */
function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('./sw.js').catch(err => {
    console.error('Service worker non enregistré :', err);
  });
}

document.addEventListener('DOMContentLoaded', init);
