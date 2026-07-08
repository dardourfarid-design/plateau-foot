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
import { createShootout, playerShoot, cpuShoot, shootoutWinner, isShootoutOver, isSuddenDeath, readKeeperZone, randomSweet } from '../engine/penaltyShootoutV2.js';
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
import { getCurrentUser, onAuthStateChange, signOut, signInWithEmail, signUpWithEmail, sendPasswordResetEmail, fetchMyPurchases } from '../services/supabaseClient.js';
import { checkoutTheme } from '../services/payment/paymentProvider.js';
import { createGameSession, joinGameSession, pushGameState, subscribeToGameSession, cancelGameSession } from '../services/multiplayerService.js';
import { createTutorialController } from './tutorial.js';
import { initLang, t, applyTranslations, onLangChange, mountLangToggle, startAutoTranslate } from './i18n.js';
import './i18n-en.js'; // effet de bord : peuple le dictionnaire anglais
import { showToast, showAlert, showConfirm, showConsentDialog } from './dialogs.js';
import { recordConsents, exportMyData, deleteMyData, CONSENT_PURPOSES } from '../services/consentService.js';
import { setAdvertisingConsent, hasAdvertisingConsent } from '../services/advertisingConsentService.js';
import * as adService from '../services/ads/adService.js';
import { recordMatchEnd, shouldShowInterstitial, markInterstitialShown } from '../services/ads/interstitialFrequency.js';
import { fetchMyCollection, fetchMyLineup, ensureStarterPack, fetchPlayerCatalog, saveLineup } from '../services/playerCollectionService.js';
import { recordGameResult, fetchMyProgress, fetchTodayChallenges, fetchLeaderboard } from '../services/progressService.js';
import { resolveLineup } from './playerIdentity.js';
import { renderAvatarSvg, hashSeedToAvatar, AVATAR_COLORS } from './playerAvatar.js';
import { fetchMyCustomPlayers, createCustomPlayer, CUSTOM_PLAYER_SLOT_THEME_ID, claimLevelRewards, purchasePlayer } from '../services/customPlayerService.js';
import { getCurrencyBalance } from '../services/currencyService.js';
import { getMyActivePass } from '../services/passService.js';
import {
  sendFriendRequest, respondFriendRequest, cancelFriendRequest, fetchMyFriendships,
  createMercatoOffer, respondMercatoOffer, cancelMercatoOffer, fetchMyMercatoOffers, fetchFriendCollection
} from '../services/mercatoService.js';

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
let selectedVariant = 'standard'; // 'standard' (6 pions) | 'tactique' (8 pions)
let freePowersOn = true;          // pouvoir bonus tire au sort par equipe/match
let selectedFormat = 'score';     // 'score' (premier a N buts) | 'manche' (limite de tours, departage TAB)
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
let tutorialSpotlightEl = null;
// Références des modules profil/mercato pour la navigation didactique du
// tutoriel (renseignées dans init(), utilisées par showTutorialView).
let profileModuleRef = null;
let mercatoModuleRef = null; // élément actuellement mis en valeur, pour pouvoir retirer la classe au changement d'étape
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
  els.variantOptions = document.getElementById('variantOptions');
  els.powersOptions = document.getElementById('powersOptions');
  els.formatOptions = document.getElementById('formatOptions');
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
  els.profileNotifBadge = document.getElementById('profileNotifBadge');
  els.dailyHint = document.getElementById('dailyHint');
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
  els.progressStreakLabel = document.getElementById('progressStreakLabel');
  els.progressWinsLabel = document.getElementById('progressWinsLabel');
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
  els.pendingFriendRequestsSent = document.getElementById('pendingFriendRequestsSent');
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
  els.consentAdvertising = document.getElementById('consentAdvertising');
  els.accountRequiredNote = document.getElementById('accountRequiredNote');
  els.manageConsentBtn = document.getElementById('manageConsentBtn');
  els.exportDataBtn = document.getElementById('exportDataBtn');
  els.deleteDataBtn = document.getElementById('deleteDataBtn');
  els.accountCloseBtn = document.getElementById('accountCloseBtn');
  els.coinDisplay   = document.getElementById('coinDisplay');
  els.coinAmount    = document.getElementById('coinAmount');
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
  gameState = createGame({ goalsToWin, variant: selectedVariant, freePowers: freePowersOn, turnLimit: selectedFormat === 'manche' ? 40 : null });
  undoSnapshot = null;
  els.shootoutScreen?.classList.add('hidden');
  // En local ou vs IA, l'humain principal joue toujours Bleu. Sans cette
  // remise à zéro, un joueur ayant rejoint une partie en ligne (myTeam =
  // Rouge) gardait ce camp en mémoire pour ses parties solo suivantes.
  if (gameMode !== 'online') myTeam = TEAMS.BLEU;
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
  els.sidebarTurn.textContent = gameState.gameOver
    ? t('Partie terminée')
    : (gameState.turn === TEAMS.BLEU ? t('Bleu') : t('Rouge'));

  els.turnBanner.classList.remove('active-bleu', 'active-rouge');
  if (gameState.gameOver) {
    els.turnBanner.textContent = t('Partie terminée');
  } else {
    els.turnBanner.textContent = gameState.gameOver
      ? t('Partie terminée')
      : (gameState.turn === TEAMS.BLEU ? t('Au tour de bleu') : t('Au tour de rouge'));
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
    els.hintBar.textContent = t('L\'ordinateur réfléchit…');
    return;
  }
  if (gameMode === 'online' && gameState.turn !== myTeam) {
    els.hintBar.textContent = t('En attente du coup de ton adversaire…');
    return;
  }
  if (gameState.phase === PHASES.SELECT) {
    els.hintBar.textContent = gameState.selectedTokenId
      ? t('Clique une case pour bouger, ou directement le ballon pour le pousser')
      : t('Touche un de tes pions pour le jouer');
  } else if (gameState.phase === PHASES.MOVED_CAN_PASS) {
    els.hintBar.textContent = t('Tu touches le ballon : pousse-le, ou clique « Terminer le tour »');
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
    els.activatePowerBtn.textContent = t('Utiliser : {power}', { power: t(POWER_LABELS[token.power]) });
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

  // Fin de manche courte : si egalite -> departage aux tirs au but, sinon fin
  // de partie classique. (Le cas gameOver APRES un but est traite plus haut.)
  if (gameState.gameOver) {
    if (gameState.isDraw) {
      setTimeout(() => startShootoutDepartage(), 450);
    } else {
      setTimeout(() => showEndOverlay(gameState.winner), 350);
    }
    return;
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

// v0.5 — un peu de "juice" : titres/mini-commentaires varies, et une mention
// speciale quand le but conclut une belle serie de passes (momentum).
const GOAL_TITLES = ['BUT !', 'BUUUT !', 'MAGNIFIQUE !', 'QUEL BUT !', 'GOLAZO !'];
const GOAL_LINES = ['Frappe imparable', 'Le gardien battu', 'En pleine lucarne', 'Ça fait mouche', 'Le public exulte'];
function pickRandom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function showGoalOverlay(scoringTeam) {
  els.goalTitle.className = 'overlay-title ' + scoringTeam;
  const streak = gameState.lastGoalPassStreak || 0;
  els.goalTitle.textContent = t(streak >= 3 ? pickRandom(GOAL_TITLES.slice(1)) : pickRandom(GOAL_TITLES));
  const who = scoringTeam === TEAMS.BLEU ? t("L'équipe bleue marque") : t("L'équipe rouge marque");
  els.goalSub.textContent = streak >= 3 ? t('{who} — action à {n} passes !', { who, n: streak }) : `${who} · ${t(pickRandom(GOAL_LINES))}`;
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
  // Garde anti "overlay fantôme" : si le joueur a déjà quitté l'écran de
  // jeu (retour accueil pendant le délai de 350 ms ou pendant le timer de
  // l'IA), ne pas réafficher l'écran de fin par-dessus un autre écran.
  if (els.gameScreen.classList.contains('hidden')) return;
  els.endTitle.className = 'overlay-title ' + winningTeam;
  els.endTitle.textContent = winningTeam === TEAMS.BLEU ? t('BLEU GAGNE') : t('ROUGE GAGNE');
  els.endSub.textContent = `${gameState.score[TEAMS.BLEU]} – ${gameState.score[TEAMS.ROUGE]}`;

  // Colorier le trophée selon l'équipe gagnante
  const trophy = els.endOverlay.querySelector('.end-trophy');
  if (trophy) { trophy.className = 'end-trophy ' + winningTeam; }

  // Stats de fin : buts du gagnant + streak si disponible
  if (els.endStatsRow) {
    // Contre l'IA ou en ligne, les stats sont montrées du point de vue du
    // JOUEUR (myTeam), pas du vainqueur : afficher « 1 but marqué » à un
    // joueur qui vient de perdre 0-1 était trompeur. En local 2 joueurs
    // (écran partagé), on garde le point de vue du vainqueur.
    const povTeam = (gameMode === 'local') ? winningTeam : myTeam;
    const winner = gameState.score[povTeam];
    const loser = gameState.score[povTeam === TEAMS.BLEU ? TEAMS.ROUGE : TEAMS.BLEU];
    els.endStatsRow.innerHTML = `
      <div class="end-stat">
        <span class="end-stat-val">${winner}</span>
        <span class="end-stat-lbl">${t('Buts marqués')}</span>
      </div>
      <div class="end-stat">
        <span class="end-stat-val">${loser}</span>
        <span class="end-stat-lbl">${t('Buts encaissés')}</span>
      </div>
    `;
  }

  els.endOverlay.classList.add('show');

  // Compte ce match pour le plafond de fréquence des interstitiels (hors
  // tutoriel, qui n'est pas une vraie partie). N'AFFICHE rien ici : la pub
  // n'apparaît qu'à la transition suivante (backToSetup), jamais sur l'écran
  // de victoire.
  if (!tutorial.isActive()) recordMatchEnd();

  if (currentUser && !tutorial.isActive()) {
    const won = winningTeam === myTeam;
    const goalsScored = gameState.score[myTeam];
    // XP, streak, défis ET pièces sont attribués côté serveur en un seul
    // appel (record_game_result, migration 0026) : +10 victoire, +3 défaite,
    // +15 par défi complété. On relit ensuite le solde et on affiche le
    // gain réel (différence), qui peut inclure un bonus de défi.
    const previousBalance = parseInt(els.coinAmount?.textContent, 10) || 0;
    recordGameResult(won, goalsScored)
      .then(() => getCurrencyBalance())
      .then(newBalance => {
        _updateCoinDisplay(newBalance);
        if (newBalance > previousBalance) _showCoinGain(newBalance - previousBalance);
      })
      .catch(err => {
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
  if (unsubscribeFromSession) { unsubscribeFromSession(); unsubscribeFromSession = null; }
  onlineSessionId = null;
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

// ---------- Publicité (bannière hors-jeu, épic pub PR C) ----------

// Remplit (ou vide) l'emplacement bannière de l'accueil. Tout le gating
// (kill switch + consentement + non-payant + format activé) est fait dans
// adService : ici on ne fait qu'appeler, et vider le slot si non autorisé.
const AD_SLOT_HOME = 'adBannerHome';
function refreshHomeBanner() {
  if (adService.isFormatAllowed('banner')) {
    adService.showBanner(AD_SLOT_HOME).catch(() => {});
  } else {
    adService.hideBanner(AD_SLOT_HOME);
  }
}

// Recalcule le droit « sans pub » (pass actif) puis rafraîchit la bannière.
// Appelé quand la session change : les droits payants en dépendent.
function refreshAdsForSession() {
  adService.refreshAdFreeStatus().then(refreshHomeBanner).catch(() => {});
}

// Interstitiel entre deux matchs : n'affiche que si (1) le format est autorisé
// (3 verrous), ET (2) le plafond de fréquence le permet. Jamais pendant une
// partie — appelé uniquement à la transition de fin (backToSetup).
async function maybeShowInterstitial() {
  if (!adService.isFormatAllowed('interstitial')) return;
  if (!shouldShowInterstitial()) return;
  try {
    const { shown } = await adService.showInterstitial();
    if (shown) markInterstitialShown();
  } catch { /* jamais bloquer le retour au menu à cause de la pub */ }
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

  // v0.5 — style de jeu (variante) + pouvoirs bonus
  const variantOpts = els.variantOptions ? els.variantOptions.querySelectorAll('.setup-option') : [];
  variantOpts.forEach(opt => {
    opt.addEventListener('click', () => {
      variantOpts.forEach(o => o.classList.remove('active'));
      opt.classList.add('active');
      selectedVariant = opt.dataset.val;
    });
  });

  const powersOpts = els.powersOptions ? els.powersOptions.querySelectorAll('.setup-option') : [];
  powersOpts.forEach(opt => {
    opt.addEventListener('click', () => {
      powersOpts.forEach(o => o.classList.remove('active'));
      opt.classList.add('active');
      freePowersOn = opt.dataset.val === 'on';
    });
  });

  const formatOpts = els.formatOptions ? els.formatOptions.querySelectorAll('.setup-option') : [];
  formatOpts.forEach(opt => {
    opt.addEventListener('click', () => {
      formatOpts.forEach(o => o.classList.remove('active'));
      opt.classList.add('active');
      selectedFormat = opt.dataset.val;
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
    els.onlineError.textContent = t('Entre le code complet de la partie.');
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
      els.hintBar.textContent = t('{power} : choisis une case.', { power: t(POWER_LABELS[token.power]) });
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
      els.hintBar.textContent = t('Relais activé : pousse le ballon, tu pourras ensuite déplacer un second pion.');
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
    updateCoinDisplay: balance => _updateCoinDisplay(balance),
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

  // Rafraîchir le solde de pièces dans la topbar quand l'état du compte change
  if (currentUser) {
    getCurrencyBalance().then(balance => _updateCoinDisplay(balance)).catch(() => {});
  } else {
    _updateCoinDisplay(0);
  }
  _refreshNotifications();
}

/**
 * Badge de notifications sur « Mon profil » (demandes d'ami + offres de
 * mercato en attente) et rappel des défis du jour sur l'accueil. Best
 * effort : toute erreur réseau est silencieuse, l'UI reste utilisable.
 */
async function _refreshNotifications() {
  if (!currentUser) {
    if (els.profileNotifBadge) els.profileNotifBadge.style.display = 'none';
    if (els.dailyHint) els.dailyHint.classList.add('hidden');
    return;
  }
  try {
    const [friendships, offers, challenges] = await Promise.all([
      fetchMyFriendships().catch(() => ({ pendingReceived: [] })),
      fetchMyMercatoOffers().catch(() => ({ received: [] })),
      fetchTodayChallenges().catch(() => [])
    ]);
    const notifCount = (friendships.pendingReceived?.length || 0) + (offers.received?.length || 0);
    if (els.profileNotifBadge) {
      els.profileNotifBadge.textContent = notifCount;
      els.profileNotifBadge.style.display = notifCount > 0 ? 'inline-flex' : 'none';
    }
    if (els.dailyHint) {
      const remaining = (challenges || []).filter(c => !c.completed).length;
      if (remaining > 0) {
        els.dailyHint.textContent = t(remaining > 1 ? '🎯 {n} défis du jour à relever (+15 pièces chacun)' : '🎯 {n} défi du jour à relever (+15 pièces chacun)', { n: remaining });
        els.dailyHint.classList.remove('hidden');
      } else {
        els.dailyHint.classList.add('hidden');
      }
    }
  } catch (err) {
    /* silencieux : purement décoratif */
  }
}

function _updateCoinDisplay(balance) {
  if (els.coinAmount) els.coinAmount.textContent = balance;
  if (els.coinDisplay) {
    els.coinDisplay.style.display = balance > 0 || currentUser ? 'flex' : 'none';
  }
}

/**
 * Après un retour de Stripe Checkout, la livraison passe par le webhook :
 * elle peut atterrir quelques secondes APRÈS la redirection du navigateur.
 * La boutique s'ouvre donc parfois sur un solde/contenu encore anciens.
 * On relit le solde à intervalles espacés : dès qu'il bouge, topbar mise à
 * jour + badge de gain + un rafraîchissement silencieux de la boutique si
 * elle est toujours affichée. Un rafraîchissement de sécurité à 3 s couvre
 * aussi les achats sans pièces (kits, packs, crédits).
 */
function _refreshAfterCheckout() {
  const initialBalance = parseInt(els.coinAmount?.textContent, 10) || 0;
  let settled = false;

  // Rafraîchissement de sécurité unique (kits/packs livrés par webhook)
  setTimeout(() => {
    if (!settled && els.shopScreen && !els.shopScreen.classList.contains('hidden')) {
      els.shopBtn?.click();
    }
  }, 3000);

  [1500, 4000, 8000, 15000].forEach(ms => {
    setTimeout(() => {
      if (settled) return;
      getCurrencyBalance().then(balance => {
        if (settled || balance === initialBalance) return;
        settled = true;
        _updateCoinDisplay(balance);
        if (balance > initialBalance) _showCoinGain(balance - initialBalance);
        if (els.shopScreen && !els.shopScreen.classList.contains('hidden')) {
          els.shopBtn?.click(); // recharge la boutique avec le nouveau solde
        }
      }).catch(() => {/* silencieux : le prochain essai retentera */});
    }, ms);
  });
}

/** Micro-animation de gain de pièces affichée sur la topbar */
function _showCoinGain(amount) {
  const badge = document.createElement('div');
  badge.className = 'coin-gain-badge';
  badge.textContent = '+' + amount + ' ⬤';
  badge.setAttribute('aria-live', 'polite');
  document.body.appendChild(badge);
  setTimeout(() => badge.classList.add('coin-gain-badge-show'), 10);
  setTimeout(() => {
    badge.classList.remove('coin-gain-badge-show');
    setTimeout(() => badge.remove(), 400);
  }, 2200);
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
    els.authError.textContent = t('Email et mot de passe requis.');
    return;
  }

  // État de chargement sur le bouton — évite les double-clics et indique
  // clairement que la requête est en cours (Supabase Auth peut prendre 1-2s).
  const originalLabel = els.authSubmitBtn.textContent;
  els.authSubmitBtn.textContent = '…';
  els.authSubmitBtn.disabled = true;

  try {
    if (authMode === 'signin') {
      console.log('[auth] appel signInWithEmail...');
      const { data: signInData, error } = await signInWithEmail(email, password);
      console.log('[auth] signInWithEmail retour:', error ? ('ERREUR: ' + error.message) : 'succès');
      if (error) throw error;
      // Utiliser data.user directement : évite un second appel getUser()
      // qui peut échouer avec 500 même après un sign-in réussi.
      currentUser = signInData?.user ?? null;
    } else {
      const displayName = els.authDisplayName.value.trim() || 'Joueur';
      const { data: signUpData, error } = await signUpWithEmail(email, password, displayName);
      if (error) throw error;

      // Cas particulier Supabase : si l'email correspond a un compte deja
      // existant, signUp ne renvoie PAS d'erreur (anti-enumeration) mais un
      // user sans identities. Sans ce test, on afficherait "Compte cree !"
      // a quelqu'un qui a deja un compte — parcours trompeur.
      if (signUpData?.user && Array.isArray(signUpData.user.identities) && signUpData.user.identities.length === 0) {
        throw new Error('User already registered');
      }

      // Enregistre chaque consentement séparément, reflétant exactement
      // l'état des cases au moment de l'inscription (cochée ou non).
      try {
        await recordConsents({
          [CONSENT_PURPOSES.ANALYTICS]: els.consentAnalytics.checked,
          [CONSENT_PURPOSES.EMAIL_MARKETING]: els.consentEmailMarketing.checked,
          [CONSENT_PURPOSES.DATA_SHARING]: els.consentDataSharing.checked,
          [CONSENT_PURPOSES.ADVERTISING]: els.consentAdvertising.checked
        });
      } catch (consentErr) {
        console.error('Consentement non enregistré :', consentErr);
      }

      // Le consentement pub a aussi un signal local (gating des SDK pub, y
      // compris hors connexion). On l'aligne sur la case cochée.
      await setAdvertisingConsent(els.consentAdvertising.checked);
      refreshHomeBanner();

      els.authSubmitBtn.disabled = false;
      els.authSubmitBtn.textContent = originalLabel;

      if (signUpData?.session) {
        // Confirmation email desactivee cote Supabase : la session est
        // active immediatement. On connecte l'utilisateur directement au
        // lieu de le laisser devant un message ambigu lui demandant de
        // verifier ses emails alors qu'aucun email ne partira.
        currentUser = signUpData.session.user;
        updateAccountUI();
        renderAccountOverlayContent();
        els.accountOverlay.classList.remove('show');
        return;
      }

      els.authError.style.color = 'var(--craie-att)';
      els.authError.textContent = t('Compte créé ! Un email de confirmation t\'a été envoyé — clique sur le lien qu\'il contient puis connecte-toi (pense aux spams).');
      // Bascule le formulaire en mode connexion pour que l'etape suivante
      // soit evidente une fois l'email confirme.
      authMode = 'signin';
      els.authTitle.textContent = 'Connexion';
      els.authSubmitBtn.textContent = 'Se connecter';
      els.authSwitchBtn.textContent = 'Pas encore de compte ? Créer un compte';
      els.authDisplayName.style.display = 'none';
      els.consentBlock.classList.add('hidden');
      return;
    }
    // currentUser déjà alimenté par data.user (signin) ou restera null (signup)
    updateAccountUI();
    renderAccountOverlayContent();
    els.accountOverlay.classList.remove('show');
  } catch (err) {
    els.authSubmitBtn.disabled = false;
    els.authSubmitBtn.textContent = originalLabel;
    console.error('[Auth]', err.message);

    // Si currentUser est déjà défini (sign-in réussi mais erreur post-signin),
    // on ferme quand même l'overlay — l'utilisateur est connecté.
    if (currentUser) {
      updateAccountUI();
      renderAccountOverlayContent();
      els.accountOverlay.classList.remove('show');
      return;
    }

    // Sinon afficher l'erreur en clair
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
  }
}

function wireAccount() {
  onAuthStateChange(user => {
    currentUser = user;
    updateAccountUI();
    refreshAdsForSession(); // le statut « sans pub » dépend du pass de la session
  });
  getCurrentUser().then(user => {
    currentUser = user;
    updateAccountUI();
    refreshAdsForSession();
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
      els.forgotPasswordError.textContent = t('Indique ton email.');
      return;
    }
    try {
      await sendPasswordResetEmail(email);
      // Message volontairement identique que l'email existe ou non dans la
      // base : ne jamais révéler si une adresse précise a un compte ou
      // pas, pour éviter qu'un tiers puisse vérifier l'existence de
      // comptes par essais successifs (énumération d'utilisateurs).
      els.forgotPasswordError.style.color = 'var(--craie-att)';
      els.forgotPasswordError.textContent = t('Si un compte existe avec cet email, un lien de réinitialisation vient d\'être envoyé.');
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
      showAlert(err.message || t('Export impossible pour le moment.'));
    }
  });

  els.deleteDataBtn?.addEventListener('click', async () => {
    const confirmed = await showConfirm(
      t('Supprimer définitivement ton compte et toutes tes données (achats, parties, préférences) ? Cette action est irréversible.'),
      { title: t('Supprimer mon compte'), okLabel: t('Supprimer définitivement') }
    );
    if (!confirmed) return;
    try {
      await deleteMyData();
      await signOut();
      currentUser = null;
      updateAccountUI();
      els.accountOverlay.classList.remove('show');
      showAlert(t('Tes données ont été supprimées.'));
    } catch (err) {
      showAlert(err.message || t('Suppression impossible pour le moment.'));
    }
  });

  els.manageConsentBtn?.addEventListener('click', () => {
    // Réutilise le même panneau de consentement que l'inscription, en mode
    // "mise à jour" plutôt que création — les choix sont enregistrés
    // immédiatement, sans recréer de compte.
    openConsentManagementPanel();
  });
}

async function openConsentManagementPanel() {
  // Pré-coche la case pub selon le signal local courant (le retrait doit être
  // aussi simple que l'octroi — exigence CNIL).
  const choices = await showConsentDialog({ advertising: hasAdvertisingConsent() });
  if (!choices) return; // annulé : aucun changement enregistré

  // Le signal pub local est mis à jour immédiatement (gating), indépendamment
  // de la synchro serveur ci-dessous.
  setAdvertisingConsent(choices.advertising);
  refreshHomeBanner(); // reflète tout de suite l'octroi/retrait à l'écran

  recordConsents({
    [CONSENT_PURPOSES.ANALYTICS]: choices.analytics,
    [CONSENT_PURPOSES.EMAIL_MARKETING]: choices.emailMarketing,
    [CONSENT_PURPOSES.DATA_SHARING]: choices.dataSharing,
    [CONSENT_PURPOSES.ADVERTISING]: choices.advertising
  }).then(() => {
    showToast(t('Tes préférences ont été mises à jour.'));
  }).catch(err => {
    showAlert(err.message || t('Mise à jour impossible pour le moment.'));
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
  els.shootoutScreen?.classList.add('hidden');
  gameMode = 'local';
  gameState = createGame({ goalsToWin: 1 });
  // Formation scriptee simplifiee : couloir central degage pour que la regle de
  // couverture (v0.5) ne bloque pas la demonstration "pousse le ballon vers la
  // cage". Un seul defenseur rouge, sur une aile, hors du couloir de tir ; le
  // gardien rouge reste a contourner (c'est le sens de l'etape "but").
  gameState = {
    ...gameState,
    tokens: [
      { id: 'b-gk', team: TEAMS.BLEU, row: 8, col: 3, isGK: true },
      { id: 'b-att0', team: TEAMS.BLEU, row: 6, col: 2, isGK: false },
      { id: 'b-att1', team: TEAMS.BLEU, row: 6, col: 3, isGK: false },
      { id: 'b-att2', team: TEAMS.BLEU, row: 6, col: 4, isGK: false },
      { id: 'r-gk', team: TEAMS.ROUGE, row: 0, col: 3, isGK: true },
      { id: 'r-def0', team: TEAMS.ROUGE, row: 1, col: 1, isGK: false }
    ]
  };
  undoSnapshot = null;
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
    if (currentUser && profileModuleRef && mercatoModuleRef) {
      switchProfileTab(tab, profileModuleRef, mercatoModuleRef);
    } else {
      _showProfilePanelStatic(tab);
    }
  }
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

  // i18n : langue memorisee (fr par defaut), toggle FR|EN en haut a droite,
  // traduction initiale du DOM statique. Le contenu dynamique se re-render via
  // onLanguageChanged() a chaque changement.
  initLang();
  const langHost = document.querySelector('.topbar-right');
  if (langHost) {
    const toggle = mountLangToggle(langHost, null);
    if (toggle) langHost.insertBefore(toggle, langHost.firstChild);
  }
  onLangChange(onLanguageChanged);
  applyTranslations(document);
  startAutoTranslate();

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
    cancelFriendRequest,
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

  profileModuleRef = profileModule;
  mercatoModuleRef = mercatoModule;

  // switchProfileTab reste dans main.js : c'est de l'orchestration pure
  // entre deux modules (profileUI et mercatoUI), pas de la logique d'un
  // domaine en particulier.
  els.profileTabs?.querySelectorAll('.profile-tab').forEach(tab => {
    tab.addEventListener('click', () => switchProfileTab(tab.dataset.tab, profileModule, mercatoModule));
  });
  wirePowers();
  wireAccount();
  wireTutorial();
  wireShootout();
  const homeLogo = document.getElementById('homeLogoBtn');
  homeLogo?.addEventListener('click', goToLanding);
  homeLogo?.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); goToLanding(); } });
  // La seance de tirs est un ecran plein : toute navigation vers un autre ecran
  // doit la masquer (sinon elle "resterait" affichee par-dessous).
  document.getElementById('shopBtn')?.addEventListener('click', () => els.shootoutScreen?.classList.add('hidden'));
  document.getElementById('profileBtn')?.addEventListener('click', () => els.shootoutScreen?.classList.add('hidden'));
  registerServiceWorker();
  handlePaymentReturn();

  // Pub : premier affichage de la bannière d'accueil (le gating décide s'il y
  // a réellement quelque chose à montrer). L'état « sans pub » sera affiné dès
  // que la session sera résolue (voir refreshAdsForSession dans wireAccount).
  refreshHomeBanner();
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
    showPurchaseToast('🎉', t('Achat confirmé ! Ton nouveau contenu est débloqué.'), false);
    // Ouvre directement la boutique avec les données fraîches, pour que
    // l'utilisateur voie immédiatement son achat débloqué sans action
    // supplémentaire de sa part.
    els.shopBtn?.click();
    _refreshAfterCheckout();
  } else if (checkoutResult === 'pass_success') {
    // Retour d'un abonnement Pass Saison (URL dédiée côté Edge Function).
    // L'activation passe par le webhook Stripe : elle peut prendre quelques
    // secondes — le message le dit pour éviter un rechargement paniqué.
    showPurchaseToast('🎫', t('Pass Saison activé ! (quelques secondes de délai possibles)'), false);
    els.shopBtn?.click();
    _refreshAfterCheckout();
  } else if (checkoutResult === 'cancelled') {
    showPurchaseToast('↩️', t('Achat annulé — aucun montant n\'a été débité.'), true);
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
 * Re-render du contenu dynamique apres un changement de langue. Le DOM statique
 * (attributs data-i18n) est deja pris en charge par applyTranslations() dans
 * setLang(). Ici on rejoue les rendus qui construisent leur texte via t().
 */
function onLanguageChanged() {
  try { if (gameState) render(); } catch (_) { /* pas de partie en cours */ }
  try {
    // Rafraichit la boutique / le profil s'ils sont ouverts.
    if (els.shopScreen && !els.shopScreen.classList.contains('hidden')) els.shopBtn?.click();
  } catch (_) { /* ignore */ }
  try { applyTranslations(document); } catch (_) { /* ignore */ }
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


// ===================== SÉANCE DE TIRS AU BUT (UI v2) =====================
// Écran plein, branché sur le moteur penaltyShootoutV2 (6 zones + jauge de
// puissance/timing). Le joueur est toujours Bleu et TIRE ; l'IA (Rouge) tire
// seule (résultat résolu par le moteur, annoncé par un toast).
// Machine à états : ready → aim → power → shooting → result → (cpu) → over.

const SO_DIFFICULTY = 55;
const PK_ZONES = [
  { id: 'tl', x: 25, y: 30 }, { id: 'tc', x: 50, y: 26 }, { id: 'tr', x: 75, y: 30 },
  { id: 'bl', x: 25, y: 47 }, { id: 'bc', x: 50, y: 50 }, { id: 'br', x: 75, y: 47 },
];
const PK_BALL_REST = { x: 50, y: 79 };
const PK_KEEPER_REST = { x: 50, y: 40 };
const PK_CROWD_COLORS = ['#4f8cff', '#ff5b5b', '#9fb0cf'];

// Thèmes visuels de la séance. Stade est gratuit/défaut ; Néon/Cartoon/Manga
// seront verrouillés puis monétisés en PR D (déverrouillage par possession).
const PK_THEMES = ['stade', 'neon', 'cartoon', 'manga'];
const PK_THEME_KEY = 'tm-pk-theme';

function getStoredPkTheme() {
  try { const v = localStorage.getItem(PK_THEME_KEY); return PK_THEMES.includes(v) ? v : 'stade'; }
  catch (e) { return 'stade'; }
}

function applyPkTheme(id) {
  if (!PK_THEMES.includes(id)) id = 'stade';
  els.shootoutScreen?.setAttribute('data-pk-theme', id);
  try { localStorage.setItem(PK_THEME_KEY, id); } catch (e) { /* stockage indisponible : sans effet */ }
  els.pkSwitcher?.querySelectorAll('.pk-theme-btn')
    .forEach(b => b.classList.toggle('active', b.dataset.theme === id));
  // Avatars recolorisés par thème (Stade = PNG d'origine ; les autres sont des
  // variantes teintées vers l'accent du thème, voir public/img/shootout/).
  const suffix = id === 'stade' ? '' : '-' + id;
  const kImg = els.pkKeeper?.querySelector('img');
  const sImg = els.pkShooter?.querySelector('img');
  if (kImg) kImg.setAttribute('src', 'img/shootout/keeper' + suffix + '.png');
  if (sImg) sImg.setAttribute('src', 'img/shootout/shooter' + suffix + '.png');
}

// ---------- Monétisation des thèmes (Néon/Cartoon/Manga payants) ----------
// Chaque thème payant correspond au produit `themes` d'id 'shootout-<thème>'
// (migration 0034). La POSSESSION vient d'une ligne purchases 'completed',
// exactement comme un thème de plateau. Stade est toujours débloqué.
const PK_PAID_THEMES = ['neon', 'cartoon', 'manga'];
const PK_SKIN_PRICE_CENTS = 199;
let ownedPkSkins = new Set();

function isPkThemeUnlocked(id) {
  return id === 'stade' || ownedPkSkins.has(id);
}

function renderPkLocks() {
  const price = (PK_SKIN_PRICE_CENTS / 100).toFixed(2).replace('.', ',') + ' €';
  els.pkSwitcher?.querySelectorAll('.pk-theme-btn').forEach(b => {
    const locked = !isPkThemeUnlocked(b.dataset.theme);
    b.classList.toggle('locked', locked);
    if (locked) b.dataset.price = price;   // affiché via ::after (cadenas + prix)
    else delete b.dataset.price;
  });
}

// Recharge la liste des skins possédés (à l'ouverture de la séance). Si le
// thème mémorisé n'est plus débloqué (autre appareil, déconnexion), on retombe
// proprement sur Stade.
async function refreshPkOwnership() {
  try {
    const purchases = await fetchMyPurchases();
    ownedPkSkins = new Set(
      (purchases || [])
        .map(p => p.theme_id)
        .filter(id => typeof id === 'string' && id.startsWith('shootout-'))
        .map(id => id.slice('shootout-'.length))
    );
  } catch (e) {
    ownedPkSkins = new Set();
  }
  renderPkLocks();
  if (!isPkThemeUnlocked(getStoredPkTheme())) applyPkTheme('stade');
}

// Clic sur un bouton de thème : applique si débloqué, sinon lance l'achat.
function selectPkTheme(id) {
  if (isPkThemeUnlocked(id)) applyPkTheme(id);
  else purchasePkTheme(id);
}

async function purchasePkTheme(id) {
  if (!currentUser) {
    showToast(t('Connecte-toi pour débloquer ce thème.'));
    authMode = 'signin';
    renderAccountOverlayContent();
    els.accountOverlay.classList.add('show');
    return;
  }
  try {
    const result = await checkoutTheme({ id: 'shootout-' + id }, currentUser);
    if (result.redirectUrl) { window.location.href = result.redirectUrl; return; }
    if (result.immediate) { ownedPkSkins.add(id); applyPkTheme(id); renderPkLocks(); }
  } catch (err) {
    showAlert(err.message || t('Achat impossible pour le moment.'));
  }
}

let so = null;              // { phase, mode, engine, selectedZone, sweet, powerPct, dir, raf }
let soCrowdBuilt = false;

function soPick(a) { return a[Math.floor(Math.random() * a.length)]; }

function buildPkCrowd() {
  if (soCrowdBuilt || !els.pkCrowd) return;
  let html = '';
  const cols = 30, rows = 5;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = ((c + 0.5) / cols) * 100 + (Math.random() - 0.5) * (60 / cols);
      const y = 14 + r * 18 + (Math.random() - 0.5) * 5;
      const col = PK_CROWD_COLORS[Math.floor(Math.random() * PK_CROWD_COLORS.length)];
      const d = (Math.random() * 2).toFixed(2);
      html += '<span class="pk-fan" style="left:' + x.toFixed(1) + '%;top:' + y.toFixed(1)
            + '%;background:' + col + ';animation-delay:' + d + 's"></span>';
    }
  }
  els.pkCrowd.innerHTML = html;
  soCrowdBuilt = true;
}

function buildPkZones() {
  if (!els.pkZones) return;
  els.pkZones.innerHTML = '';
  PK_ZONES.forEach(z => {
    const zone = document.createElement('div');
    zone.className = 'pk-zone';
    zone.style.left = z.x + '%';
    zone.style.top = z.y + '%';
    zone.dataset.zone = z.id;
    zone.innerHTML = '<div class="pk-zone-ring"><span class="pk-zone-dot"></span></div>';
    zone.addEventListener('click', () => pkPickZone(z.id));
    els.pkZones.appendChild(zone);
  });
}

function wireShootout() {
  els.shootoutScreen     = document.getElementById('shootoutScreen');
  els.shootoutTitle      = document.getElementById('shootoutTitle');
  els.shootoutScoreBleu  = document.getElementById('shootoutScoreBleu');
  els.shootoutScoreRouge = document.getElementById('shootoutScoreRouge');
  els.shootoutDotsBleu   = document.getElementById('shootoutDotsBleu');
  els.shootoutDotsRouge  = document.getElementById('shootoutDotsRouge');
  els.shootoutRound      = document.getElementById('shootoutRound');
  els.shootoutEndRow     = document.getElementById('shootoutEndRow');
  els.pkStage    = document.getElementById('pkStage');
  els.pkCrowd    = document.getElementById('pkCrowd');
  els.pkKeeper   = document.getElementById('pkKeeper');
  els.pkShooter  = document.getElementById('pkShooter');
  els.pkBall     = document.getElementById('pkBall');
  els.pkZones    = document.getElementById('pkZones');
  els.pkResult   = document.getElementById('pkResult');
  els.pkResultMain = document.getElementById('pkResultMain');
  els.pkResultSub  = document.getElementById('pkResultSub');
  els.pkToast    = document.getElementById('pkToast');
  els.pkFlash    = document.getElementById('pkFlash');
  els.pkControls = document.getElementById('pkControls');
  els.pkHint     = document.getElementById('pkHint');
  els.pkPowerWrap   = document.getElementById('pkPowerWrap');
  els.pkPowerSweet  = document.getElementById('pkPowerSweet');
  els.pkPowerMarker = document.getElementById('pkPowerMarker');
  els.pkCta      = document.getElementById('pkCta');
  els.pkSwitcher = document.getElementById('pkSwitcher');

  buildPkZones();

  els.pkSwitcher?.querySelectorAll('.pk-theme-btn')
    .forEach(b => b.addEventListener('click', () => selectPkTheme(b.dataset.theme)));

  document.getElementById('launchShootoutBtn')?.addEventListener('click', openShootout);
  els.pkCta?.addEventListener('click', pkOnCta);
  document.getElementById('shootoutReplayBtn')?.addEventListener('click', () => {
    if (so && so.mode === 'departage') { leaveShootout(); els.configScreen.classList.remove('hidden'); }
    else openShootout();
  });
  document.getElementById('shootoutBackBtn')?.addEventListener('click', () => {
    const departage = so && so.mode === 'departage';
    leaveShootout();
    (departage ? els.setupScreen : els.configScreen).classList.remove('hidden');
  });
}

function hideAllScreensForShootout() {
  ['setupScreen', 'configScreen', 'waitingScreen', 'gameScreen', 'shopScreen', 'profileScreen']
    .forEach(k => els[k] && els[k].classList.add('hidden'));
  els.endOverlay?.classList.remove('show');
  els.goalOverlay?.classList.remove('show');
}

function openShootout() { launchShootout('standalone', 'Séance de tirs au but'); }
function startShootoutDepartage() { launchShootout('departage', 'Départage aux tirs au but'); }

function launchShootout(mode, title) {
  so = {
    phase: 'ready', mode, engine: createShootout({ difficulty: SO_DIFFICULTY }),
    selectedZone: null, sweet: 50, powerPct: 0, dir: 1, raf: null
  };
  if (els.shootoutTitle) els.shootoutTitle.textContent = t(title);
  hideAllScreensForShootout();
  els.shootoutScreen.classList.remove('hidden');
  applyPkTheme(getStoredPkTheme());
  refreshPkOwnership();   // met à jour les verrous (et retombe sur Stade si le thème mémorisé n'est pas possédé)
  buildPkCrowd();
  pkResetScene();
  renderShootout();
}

function leaveShootout() {
  if (so && so.raf) { cancelAnimationFrame(so.raf); so.raf = null; }
  els.shootoutScreen?.classList.add('hidden');
}

function pkResetScene() {
  pkSetKeeper(PK_KEEPER_REST.x, PK_KEEPER_REST.y, 0);
  pkSetBall(PK_BALL_REST.x, PK_BALL_REST.y, 1);
  els.pkResult?.classList.remove('show');
  els.pkToast?.classList.remove('show');
  els.pkShooter?.classList.remove('kick');
}

function pkSetKeeper(x, y, rot) {
  if (!els.pkKeeper) return;
  els.pkKeeper.style.left = x + '%';
  els.pkKeeper.style.top = y + '%';
  els.pkKeeper.style.transform = 'translate(-50%,-50%) rotate(' + rot + 'deg)';
}
function pkSetBall(x, y, scale) {
  if (!els.pkBall) return;
  els.pkBall.style.left = x + '%';
  els.pkBall.style.top = y + '%';
  els.pkBall.style.transform = 'translate(-50%,-50%) scale(' + scale + ')';
}

function pkOnCta() {
  if (!so) return;
  if (so.phase === 'ready' || so.phase === 'over') pkStartRound();
  else if (so.phase === 'power') pkLockPower();
}

function pkStartRound() {
  if (so.phase === 'over') return; // "Rejouer" passe par le bouton dédié
  so.phase = 'aim';
  so.selectedZone = null;
  pkResetScene();
  renderShootout();
}

function pkPickZone(id) {
  if (!so || so.phase !== 'aim') return;
  so.selectedZone = id;
  so.sweet = randomSweet();
  so.powerPct = 0; so.dir = 1;
  so.phase = 'power';
  renderShootout();
  pkStartPower();
}

function pkStartPower() {
  let last = performance.now();
  const speed = 118;
  const loop = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    so.powerPct += so.dir * speed * dt;
    if (so.powerPct >= 100) { so.powerPct = 100; so.dir = -1; }
    if (so.powerPct <= 0) { so.powerPct = 0; so.dir = 1; }
    if (els.pkPowerMarker) els.pkPowerMarker.style.left = so.powerPct + '%';
    so.raf = requestAnimationFrame(loop);
  };
  so.raf = requestAnimationFrame(loop);
}

function pkLockPower() {
  if (!so || so.phase !== 'power') return;
  if (so.raf) { cancelAnimationFrame(so.raf); so.raf = null; }
  so.phase = 'shooting';

  const zone = PK_ZONES.find(z => z.id === so.selectedZone) || PK_ZONES[4];
  const keeperId = readKeeperZone(zone.id, SO_DIFFICULTY);
  const kz = PK_ZONES.find(z => z.id === keeperId) || PK_ZONES[4];
  so.engine = playerShoot(so.engine, { zone: zone.id, power: so.powerPct, sweet: so.sweet, keeperZone: keeperId });
  const outcome = so.engine.history[so.engine.history.length - 1].outcome;
  const wide = outcome === 'miss';

  renderShootout();
  els.pkShooter?.classList.add('kick');

  const ky = 40 + (kz.y < 38 ? -11 : 8);
  const krot = kz.x < 50 ? -44 : (kz.x > 50 ? 44 : 0);
  pkSetKeeper(kz.x, ky, krot);

  let bx = zone.x, by = zone.y;
  if (wide) { if (zone.x === 50) { by = 14; } else { bx = zone.x < 50 ? -8 : 108; by = zone.y - 3; } }
  pkSetBall(bx, by, wide ? 0.8 : 0.55);

  setTimeout(() => pkShowResult(outcome), 660);
}

function pkShowResult(outcome) {
  so.phase = 'result';
  const goal = outcome === 'goal';
  const main = goal ? t('BUT !') : (outcome === 'save' ? t('ARRÊT !') : t('RATÉ !'));
  const sub = goal
    ? soPick([t('Imparable !'), t('Quel sang-froid !'), t('En pleine lucarne !')])
    : (outcome === 'save'
      ? soPick([t('Le gardien dit non !'), t('Détente parfaite !')])
      : soPick([t('À côté !'), t('Au-dessus !'), t('Trop de puissance !')]));
  if (els.pkResultMain) els.pkResultMain.textContent = main;
  if (els.pkResultSub) els.pkResultSub.textContent = sub;
  if (els.pkResult) {
    els.pkResult.className = 'pk-result ' + outcome;
    void els.pkResult.offsetWidth;   // retrigger animation
    els.pkResult.classList.add('show');
  }
  if (goal) {
    pkSpawnConfetti();
    if (els.pkFlash) { els.pkFlash.classList.remove('on'); void els.pkFlash.offsetWidth; els.pkFlash.classList.add('on'); }
    els.pkStage?.classList.add('shake'); setTimeout(() => els.pkStage?.classList.remove('shake'), 440);
    els.pkCrowd?.classList.add('roar'); setTimeout(() => els.pkCrowd?.classList.remove('roar'), 700);
  }
  renderShootout();
  setTimeout(() => {
    els.pkResult?.classList.remove('show');
    pkAfterPlayer();
  }, 1600);
}

function pkAfterPlayer() {
  if (isShootoutOver(so.engine)) { pkEnd(); return; }
  pkResetScene();
  renderShootout();
  setTimeout(pkCpuTurn, 450);
}

function pkCpuTurn() {
  so.engine = cpuShoot(so.engine);
  const outcome = so.engine.history[so.engine.history.length - 1].outcome;
  const scored = outcome === 'goal';
  if (els.pkToast) {
    els.pkToast.textContent = scored ? t('⚽ Rouge marque') : t('✕ Rouge manque');
    els.pkToast.className = 'pk-toast ' + (scored ? 'goal' : 'miss') + ' show';
  }
  renderShootout();
  setTimeout(() => els.pkToast?.classList.remove('show'), 1150);
  setTimeout(() => {
    if (isShootoutOver(so.engine)) { pkEnd(); return; }
    pkStartRound();
  }, 1250);
}

function pkEnd() {
  so.phase = 'over';
  renderShootout();
}

function pkSpawnConfetti() {
  const stage = els.pkStage;
  if (!stage) return;
  const cols = ['#f5c542', '#4f8cff', '#ffffff', '#ff5b5b', '#4dffa1'];
  for (let i = 0; i < 26; i++) {
    const p = document.createElement('span');
    p.className = 'pk-confetti';
    const ang = Math.random() * Math.PI * 2;
    const d = 40 + Math.random() * 150;
    p.style.background = cols[i % cols.length];
    p.style.setProperty('--tx', (Math.cos(ang) * d) + 'px');
    p.style.setProperty('--ty', (Math.sin(ang) * d - 30) + 'px');
    p.style.setProperty('--rot', (Math.random() * 720 - 360) + 'deg');
    p.style.width = (6 + Math.random() * 8) + 'px';
    p.style.height = (6 + Math.random() * 10) + 'px';
    stage.appendChild(p);
    setTimeout(() => p.remove(), 1000);
  }
}

function renderShootoutDots() {
  const s = so.engine;
  const build = (shots, el) => {
    if (!el) return;
    el.innerHTML = '';
    const n = Math.max(s.bestOf, shots.length);
    for (let i = 0; i < n; i++) {
      const dot = document.createElement('span');
      dot.className = 'shootout-dot';
      const o = shots[i];
      if (o === 'goal') dot.classList.add('scored');
      else if (o === 'save' || o === 'miss') dot.classList.add('missed');
      el.appendChild(dot);
    }
  };
  build(s.shots[TEAMS.BLEU], els.shootoutDotsBleu);
  build(s.shots[TEAMS.ROUGE], els.shootoutDotsRouge);
}

function pkHintText(phase, s) {
  if (phase === 'over') {
    const w = shootoutWinner(s);
    if (so.mode === 'departage') return w === TEAMS.BLEU ? t('Bleu remporte le match !') : t('Rouge remporte le match !');
    return w === TEAMS.BLEU ? t('Tu gagnes la séance !') : t('Séance perdue…');
  }
  if (phase === 'ready') return t('Prêt ? Choisis un coin et marque !');
  if (phase === 'aim') return t('À toi ! Touche un coin du but');
  if (phase === 'power') return t('Stoppe la jauge dans la zone verte');
  return '';
}

function renderShootout() {
  const s = so.engine;
  if (els.shootoutScoreBleu) els.shootoutScoreBleu.textContent = s.score[TEAMS.BLEU];
  if (els.shootoutScoreRouge) els.shootoutScoreRouge.textContent = s.score[TEAMS.ROUGE];
  renderShootoutDots();
  if (els.shootoutRound) els.shootoutRound.textContent = isSuddenDeath(s) ? t('MORT SUBITE') : t('MEILLEUR DES 5');

  const phase = so.phase;
  const over = phase === 'over';
  els.shootoutEndRow?.classList.toggle('hidden', !over);
  els.pkControls?.classList.toggle('hidden', over);
  els.pkPowerWrap?.classList.toggle('hidden', phase !== 'power');

  if (els.pkCta) {
    const showCta = phase === 'ready' || phase === 'power';
    els.pkCta.classList.toggle('hidden', !showCta);
    els.pkCta.textContent = phase === 'power' ? t('TIRER !') : t('JOUER');
  }
  if (phase === 'power' && els.pkPowerSweet) els.pkPowerSweet.style.left = (so.sweet - 9) + '%';

  els.pkZones?.classList.toggle('aim', phase === 'aim');
  els.pkZones?.querySelectorAll('.pk-zone').forEach(z =>
    z.classList.toggle('selected', z.dataset.zone === so.selectedZone));

  if (els.pkHint) els.pkHint.textContent = pkHintText(phase, s);
}

document.addEventListener('DOMContentLoaded', () => {
  init();
});
