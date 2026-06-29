// ===================== MAIN APP =====================
// Orchestre le moteur de jeu pur (engine/gameEngine.js) et le rendu DOM
// (ui/boardRenderer.js). Contient l'unique mutable de l'app : `gameState`.
// Toute évolution de gameState passe par une fonction du moteur (jamais
// de mutation directe), pour garder le moteur comme seule source de vérité
// des règles.

import {
  createGame, selectToken, moveSelectedToken, passBall, passTurn,
  resetBallAfterGoal, applyMove, getMoveDestinations, PHASES
} from '../engine/gameEngine.js';
import { chooseAiMove, AI_LEVELS } from '../engine/ai.js';
import { TEAMS } from '../engine/constants.js';
import { buildBoardGrid, renderBoard } from './boardRenderer.js';
import { applyTheme, isThemeUnlocked, formatPrice, DEFAULT_THEME_ID } from './themeManager.js';
import { fetchActiveThemes, fetchMyPurchases, getCurrentUser, onAuthStateChange, signOut, signInWithEmail, signUpWithEmail } from '../services/supabaseClient.js';
import { checkoutTheme, checkoutBundle, isMockPaymentActive } from '../services/payment/paymentProvider.js';
import { createGameSession, joinGameSession, pushGameState, subscribeToGameSession } from '../services/multiplayerService.js';
import { createTutorialController } from './tutorial.js';
import { recordConsents, exportMyData, deleteMyData, CONSENT_PURPOSES } from '../services/consentService.js';
import { fetchMyCollection, fetchMyLineup, ensureStarterPack, fetchPlayerCatalog, renamePlayer, saveLineup } from '../services/playerCollectionService.js';
import { recordGameResult, fetchMyProgress, fetchTodayChallenges, fetchLeaderboard } from '../services/progressService.js';
import { resolveLineup } from './playerIdentity.js';
import { renderAvatarSvg, hashSeedToAvatar, AVATAR_COLORS, AVATAR_PATTERNS, AVATAR_ACCESSORIES } from './playerAvatar.js';
import { fetchMyCustomPlayers, createCustomPlayer, deleteCustomPlayer, CUSTOM_PLAYER_SLOT_THEME_ID } from '../services/customPlayerService.js';
import {
  sendFriendRequest, respondFriendRequest, fetchMyFriendships,
  createMercatoOffer, respondMercatoOffer, cancelMercatoOffer, fetchMyMercatoOffers, fetchFriendCollection
} from '../services/mercatoService.js';

const ACTIVE_THEME_STORAGE_KEY = 'plateau-foot:active-theme';
const ACTIVE_THEME_CONFIG_STORAGE_KEY = 'plateau-foot:active-theme-config';

function loadSavedThemeId() {
  try {
    return window.localStorage.getItem(ACTIVE_THEME_STORAGE_KEY) || DEFAULT_THEME_ID;
  } catch (err) {
    return DEFAULT_THEME_ID;
  }
}

function loadSavedThemeConfig() {
  try {
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
  els.sidebarScoreBleu = document.getElementById('sidebarScoreBleu');
  els.sidebarScoreRouge = document.getElementById('sidebarScoreRouge');
  els.sidebarTurn = document.getElementById('sidebarTurn');
  els.turnBanner = document.getElementById('turnBanner');
  els.hintBar = document.getElementById('hintBar');
  els.cancelBtn = document.getElementById('cancelBtn');
  els.endTurnBtn = document.getElementById('endTurnBtn');
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
  } catch (err) {
    // Ne bloque jamais une partie si la lineup ne peut pas être chargée
    // (hors-ligne, pas encore de composition choisie, etc.) — le jeu reste
    // jouable normalement, juste sans les noms de joueurs affichés.
    console.error('Lineup non chargée :', err);
    myResolvedLineup = null;
  }
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
  els.scoreBleu.textContent = gameState.score[TEAMS.BLEU];
  els.scoreRouge.textContent = gameState.score[TEAMS.ROUGE];
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

// ---------- Interactions plateau ----------

function handleCellClick(row, col) {
  if (gameState.gameOver || aiThinking) return;
  if (gameMode === 'online' && gameState.turn !== myTeam) return;

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
  els.endSub.textContent = `Score final : ${gameState.score[TEAMS.BLEU]} – ${gameState.score[TEAMS.ROUGE]}`;
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
  gameMode = 'local';
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

function wireGameControls() {
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

// Catalogue de secours : utilisé uniquement si la requête vers Supabase échoue
// (réseau indisponible, configuration absente). Permet à la boutique de rester
// présentable plutôt que vide, même si les achats ne pourront pas être validés
// dans cet état (l'utilisateur verra l'erreur au moment d'acheter, pas avant).
const FALLBACK_THEMES = [
  { id: 'or-mondial', name: 'Or Mondial', description: 'L’or du sommet, l’instant où tout se joue.', price_cents: 199, currency: 'eur', config: { vertTerrain: '#0F2818', vertTerrainClair: '#173820', bleuEquipe: '#1C3F66', rougeEquipe: '#C9A227', accent: '#F4D35E' }, isWorldCup: true },
  { id: 'samba', name: 'Samba', description: 'Jaune et vert, la fête sur la pelouse.', price_cents: 199, currency: 'eur', config: { vertTerrain: '#0B4D2C', vertTerrainClair: '#116B3D', bleuEquipe: '#1565C0', rougeEquipe: '#F9D923', accent: '#2E9E4F' }, isWorldCup: true },
  { id: 'tricolore', name: 'Tricolore', description: 'Bleu, blanc, rouge, droit vers la cage.', price_cents: 199, currency: 'eur', config: { vertTerrain: '#13294B', vertTerrainClair: '#1B3A66', bleuEquipe: '#1B3A66', rougeEquipe: '#C8102E', accent: '#F5F2E8' }, isWorldCup: true },
  { id: 'albiceleste', name: 'Albiceleste', description: 'Le ciel et la victoire, à bandes blanches.', price_cents: 199, currency: 'eur', config: { vertTerrain: '#1B2A4A', vertTerrainClair: '#243A63', bleuEquipe: '#6CB4EE', rougeEquipe: '#F5F2E8', accent: '#FDB927' }, isWorldCup: true },
  { id: 'nuit-americaine', name: 'Nuit Américaine', description: 'Sous les étoiles, l’été du grand tournoi.', price_cents: 199, currency: 'eur', config: { vertTerrain: '#0A1A33', vertTerrainClair: '#102448', bleuEquipe: '#3B5BA5', rougeEquipe: '#B22234', accent: '#F5F2E8' }, isWorldCup: true },
  { id: 'classique', name: 'Classique', description: 'Le terrain vert historique de Tactic Master.', price_cents: 0, currency: 'eur', config: { vertTerrain: '#1F3D2B', vertTerrainClair: '#28492F', bleuEquipe: '#3A6EA5', rougeEquipe: '#C84B31', accent: '#C97B4A' } },
  { id: 'neon', name: 'Néon', description: 'Un terrain électrique pour les soirées arcade.', price_cents: 199, currency: 'eur', config: { vertTerrain: '#0D1B2A', vertTerrainClair: '#15263B', bleuEquipe: '#00E5FF', rougeEquipe: '#FF2D75', accent: '#FFD600' } },
  { id: 'neige', name: 'Neige', description: 'Le grand froid s’abat sur le terrain.', price_cents: 199, currency: 'eur', config: { vertTerrain: '#E8EEF3', vertTerrainClair: '#F4F8FB', bleuEquipe: '#2C5C8A', rougeEquipe: '#A23B3B', accent: '#6FA8D6' } },
  { id: 'terre-battue', name: 'Terre battue', description: 'Ambiance Roland-Garros, mais au foot.', price_cents: 199, currency: 'eur', config: { vertTerrain: '#A8542E', vertTerrainClair: '#BD663C', bleuEquipe: '#2B4C7E', rougeEquipe: '#7E2B2B', accent: '#F2C572' } },
  { id: 'nuit-stade', name: 'Nuit de stade', description: 'Sous les projecteurs, ambiance match en nocturne.', price_cents: 199, currency: 'eur', config: { vertTerrain: '#0B2818', vertTerrainClair: '#123420', bleuEquipe: '#4FC3F7', rougeEquipe: '#FFB74D', accent: '#FFD54F' } },
  { id: 'retro-8bit', name: 'Rétro 8-bit', description: 'L’esprit jeu vidéo des années 80, en plein écran.', price_cents: 199, currency: 'eur', config: { vertTerrain: '#1A1A2E', vertTerrainClair: '#22223B', bleuEquipe: '#4ECDC4', rougeEquipe: '#FF6B6B', accent: '#FFE66D' } },
  { id: 'jungle', name: 'Jungle', description: 'Un terrain englouti par la végétation tropicale.', price_cents: 199, currency: 'eur', config: { vertTerrain: '#1B4332', vertTerrainClair: '#2D6A4F', bleuEquipe: '#52B788', rougeEquipe: '#D4A017', accent: '#95D5B2' } },
  { id: 'crepuscule', name: 'Crépuscule', description: 'Les dernières lueurs du jour sur la pelouse.', price_cents: 199, currency: 'eur', config: { vertTerrain: '#3D2645', vertTerrainClair: '#4F3358', bleuEquipe: '#7C9EFF', rougeEquipe: '#FF7C7C', accent: '#FFA552' } }
];

async function refreshThemeData() {
  let usedFallback = false;
  try {
    availableThemes = await fetchActiveThemes();
    if (!availableThemes || availableThemes.length === 0) {
      availableThemes = FALLBACK_THEMES;
      usedFallback = true;
    }
  } catch (err) {
    console.error('Impossible de charger les thèmes depuis Supabase, catalogue de secours utilisé :', err);
    availableThemes = FALLBACK_THEMES;
    usedFallback = true;
  }
  try {
    const purchases = await fetchMyPurchases();
    purchasedThemeIds = purchases.map(p => p.theme_id);
  } catch (err) {
    purchasedThemeIds = [];
  }
  return usedFallback;
}

// IDs des thèmes événementiels "Coupe du Monde", utilisés pour afficher un
// badge promotionnel dans la boutique quel que soit l'endroit d'où vient le
// catalogue (Supabase réel ou catalogue de secours hors-ligne).
const WORLD_CUP_THEME_IDS = ['or-mondial', 'samba', 'tricolore', 'albiceleste', 'nuit-americaine'];

const WORLD_CUP_BUNDLE_PRICE_CENTS = 699; // 6,99€ au lieu de 9,95€ (5 x 1,99€) séparément

function renderWorldCupBundleCard() {
  const missingThemes = WORLD_CUP_THEME_IDS.filter(id => !purchasedThemeIds.includes(id));
  if (missingThemes.length === 0) return; // déjà tout débloqué, le bundle n'a plus d'intérêt

  const card = document.createElement('div');
  card.className = 'theme-card world-cup bundle-card';

  const badge = document.createElement('span');
  badge.className = 'world-cup-badge';
  badge.textContent = 'Économisez 3€';
  card.appendChild(badge);

  const swatch = document.createElement('div');
  swatch.className = 'theme-swatch bundle-swatch';
  ['#F4D35E', '#2E9E4F', '#C8102E', '#6CB4EE', '#3B5BA5'].forEach(color => {
    const dot = document.createElement('span');
    dot.style.background = color;
    swatch.appendChild(dot);
  });

  const name = document.createElement('div');
  name.className = 'theme-name';
  name.textContent = 'Pack Mondial complet';

  const desc = document.createElement('div');
  desc.className = 'theme-desc';
  desc.textContent = `Les 5 thèmes événementiels en un seul achat — ${formatPrice(WORLD_CUP_BUNDLE_PRICE_CENTS)} au lieu de ${formatPrice(199 * 5)}.`;

  const action = document.createElement('button');
  action.className = 'btn primary theme-action';
  action.textContent = `Tout débloquer — ${formatPrice(WORLD_CUP_BUNDLE_PRICE_CENTS)}`;
  action.addEventListener('click', () => handleBundlePurchase(missingThemes));

  card.appendChild(swatch);
  card.appendChild(name);
  card.appendChild(desc);
  card.appendChild(action);
  els.shopGrid.appendChild(card);
}

async function handleBundlePurchase(themeIds) {
  if (!currentUser) {
    authMode = 'signin';
    renderAccountOverlayContent();
    els.accountOverlay.classList.add('show');
    return;
  }
  try {
    const result = await checkoutBundle(themeIds, WORLD_CUP_BUNDLE_PRICE_CENTS, currentUser);
    if (result.immediate) {
      const usedFallback = await refreshThemeData();
      renderShop(usedFallback);
    }
  } catch (err) {
    alert(err.message || 'Achat groupé impossible pour le moment.');
  }
}

function renderShop(usedFallback = false) {
  els.shopGrid.innerHTML = '';

  if (usedFallback) {
    const banner = document.createElement('p');
    banner.className = 'shop-mock-banner shop-offline-banner';
    banner.textContent = 'Connexion à la boutique indisponible pour le moment : aperçu hors ligne, les achats ne peuvent pas être validés tant que la connexion n\'est pas rétablie.';
    els.shopGrid.appendChild(banner);
  }

  renderWorldCupBundleCard();

  if (availableThemes.length === 0) {
    els.shopGrid.innerHTML = '<p class="shop-empty">Boutique indisponible pour le moment.</p>';
    return;
  }

  availableThemes.forEach(theme => {
    const unlocked = isThemeUnlocked(theme, purchasedThemeIds);
    const isWorldCup = WORLD_CUP_THEME_IDS.includes(theme.id);
    const card = document.createElement('div');
    card.className = 'theme-card' + (theme.id === activeThemeId ? ' active' : '') + (isWorldCup ? ' world-cup' : '');

    if (isWorldCup) {
      const badge = document.createElement('span');
      badge.className = 'world-cup-badge';
      badge.textContent = 'Édition Mondial';
      card.appendChild(badge);
    }

    const swatch = document.createElement('div');
    swatch.className = 'theme-swatch';
    swatch.style.background = theme.config.vertTerrain || '#1F3D2B';
    const dot1 = document.createElement('span');
    dot1.style.background = theme.config.bleuEquipe || '#3A6EA5';
    const dot2 = document.createElement('span');
    dot2.style.background = theme.config.rougeEquipe || '#C84B31';
    swatch.appendChild(dot1);
    swatch.appendChild(dot2);

    const name = document.createElement('div');
    name.className = 'theme-name';
    name.textContent = theme.name;

    const desc = document.createElement('div');
    desc.className = 'theme-desc';
    desc.textContent = theme.description || '';

    const action = document.createElement('button');
    action.className = 'btn theme-action';
    if (unlocked) {
      action.textContent = theme.id === activeThemeId ? 'Sélectionné' : 'Utiliser';
      action.classList.toggle('primary', theme.id !== activeThemeId);
      action.addEventListener('click', () => {
        activeThemeId = theme.id;
        applyTheme(theme.config);
        saveActiveTheme(theme.id, theme.config);
        renderShop();
      });
    } else {
      action.textContent = `Acheter — ${formatPrice(theme.price_cents, theme.currency)}`;
      action.classList.add('primary');
      action.addEventListener('click', () => handlePurchase(theme));
    }

    card.appendChild(swatch);
    card.appendChild(name);
    card.appendChild(desc);
    card.appendChild(action);
    els.shopGrid.appendChild(card);
  });

  if (isMockPaymentActive && !usedFallback) {
    const banner = document.createElement('p');
    banner.className = 'shop-mock-banner';
    banner.textContent = 'Mode démo : les achats sont simulés, aucun paiement réel n\'est demandé.';
    els.shopGrid.appendChild(banner);
  }
}

async function handlePurchase(theme) {
  if (!currentUser) {
    authMode = 'signin';
    renderAccountOverlayContent();
    els.accountOverlay.classList.add('show');
    return;
  }
  try {
    const result = await checkoutTheme(theme, currentUser);
    if (result.redirectUrl) {
      window.location.href = result.redirectUrl;
      return;
    }
    if (result.immediate) {
      const usedFallback = await refreshThemeData();
      activeThemeId = theme.id;
      applyTheme(theme.config);
      saveActiveTheme(theme.id, theme.config);
      renderShop(usedFallback);
    }
  } catch (err) {
    alert(err.message || 'Achat impossible pour le moment.');
  }
}

function wireShop() {
  els.shopBtn?.addEventListener('click', async () => {
    if (!els.gameScreen.classList.contains('hidden')) {
      screenBeforeShop = 'game';
    } else if (!els.configScreen.classList.contains('hidden')) {
      screenBeforeShop = 'config';
    } else {
      screenBeforeShop = 'setup';
    }
    els.setupScreen.classList.add('hidden');
    els.configScreen.classList.add('hidden');
    els.gameScreen.classList.add('hidden');
    els.shopScreen.classList.remove('hidden');
    const usedFallback = await refreshThemeData();
    renderShop(usedFallback);
  });
  els.shopBackBtn?.addEventListener('click', () => {
    els.shopScreen.classList.add('hidden');
    if (screenBeforeShop === 'game') {
      els.gameScreen.classList.remove('hidden');
    } else if (screenBeforeShop === 'config') {
      els.configScreen.classList.remove('hidden');
    } else {
      els.setupScreen.classList.remove('hidden');
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

  if (!email || !password) {
    els.authError.textContent = 'Email et mot de passe requis.';
    return;
  }

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
        // Ne bloque pas la création de compte si l'enregistrement du
        // consentement échoue (ex: confirmation email requise avant que la
        // session soit active) — mais on le journalise pour pouvoir
        // diagnostiquer si ça arrive souvent.
        console.error('Consentement non enregistré :', consentErr);
      }

      els.authError.style.color = 'var(--craie-att)';
      els.authError.textContent = 'Compte créé. Vérifie tes emails si une confirmation est requise.';
      return;
    }
    currentUser = await getCurrentUser();
    updateAccountUI();
    renderAccountOverlayContent();
    els.accountOverlay.classList.remove('show');
  } catch (err) {
    els.authError.style.color = '';
    els.authError.textContent = err.message || 'Une erreur est survenue.';
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

let myCollectionCache = [];
let myCustomPlayersCache = [];
let myLineupCache = null;

function wireProfileScreen() {
  els.profileBtn?.addEventListener('click', openProfileScreen);
  els.profileBackBtn?.addEventListener('click', () => {
    els.profileScreen.classList.add('hidden');
    els.setupScreen.classList.remove('hidden');
  });

  els.profileTabs?.querySelectorAll('.profile-tab').forEach(tab => {
    tab.addEventListener('click', () => switchProfileTab(tab.dataset.tab));
  });

  els.saveLineupBtn?.addEventListener('click', handleSaveLineup);
}

async function openProfileScreen() {
  if (!currentUser) {
    authMode = 'signin';
    renderAccountOverlayContent();
    els.accountOverlay.classList.add('show');
    return;
  }

  els.setupScreen.classList.add('hidden');
  els.configScreen.classList.add('hidden');
  els.gameScreen.classList.add('hidden');
  els.shopScreen.classList.add('hidden');
  els.profileScreen.classList.remove('hidden');

  await loadProgressPanel();
}

function switchProfileTab(tabName) {
  els.profileTabs.querySelectorAll('.profile-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.tab === tabName);
  });
  els.panelProgress.classList.toggle('hidden', tabName !== 'progress');
  els.panelChallenges.classList.toggle('hidden', tabName !== 'challenges');
  els.panelTeam.classList.toggle('hidden', tabName !== 'team');
  els.panelMercato.classList.toggle('hidden', tabName !== 'mercato');
  els.panelLeaderboard.classList.toggle('hidden', tabName !== 'leaderboard');

  if (tabName === 'challenges') loadChallengesPanel();
  if (tabName === 'team') loadTeamPanel();
  if (tabName === 'mercato') loadMercatoPanel();
  if (tabName === 'leaderboard') loadLeaderboardPanel();
}

async function loadProgressPanel() {
  try {
    await ensureStarterPack(); // garantit un starter pack dès la première visite
    const progress = await fetchMyProgress();
    els.progressEmptyNote.classList.toggle('hidden', !!progress);
    els.progressLevel.textContent = progress?.level ?? 1;
    els.progressXp.textContent = progress?.xp ?? 0;
    els.progressStreak.textContent = progress?.current_streak_days ?? 0;
    els.progressWins.textContent = progress?.games_won ?? 0;
  } catch (err) {
    console.error('Progression non chargée :', err);
  }
}

async function loadChallengesPanel() {
  els.challengesList.innerHTML = '<p class="profile-empty-note">Chargement…</p>';
  try {
    const challenges = await fetchTodayChallenges();
    if (!challenges || challenges.length === 0) {
      els.challengesList.innerHTML = '<p class="profile-empty-note">Aucun défi disponible aujourd\'hui.</p>';
      return;
    }
    els.challengesList.innerHTML = '';
    challenges.forEach(c => {
      const card = document.createElement('div');
      card.className = 'challenge-card' + (c.completed ? ' completed' : '');

      const left = document.createElement('div');
      const desc = document.createElement('div');
      desc.className = 'challenge-desc';
      desc.textContent = c.daily_challenge_templates?.description || 'Défi du jour';
      const progress = document.createElement('div');
      progress.className = 'challenge-progress';
      const target = c.daily_challenge_templates?.target_count ?? 1;
      progress.textContent = `${Math.min(c.progress_count, target)}/${target}`;
      left.appendChild(desc);
      left.appendChild(progress);

      const check = document.createElement('div');
      check.className = 'challenge-check';
      check.textContent = c.completed ? '✓' : '';

      card.appendChild(left);
      card.appendChild(check);
      els.challengesList.appendChild(card);
    });
  } catch (err) {
    els.challengesList.innerHTML = '<p class="profile-empty-note">Défis indisponibles pour le moment.</p>';
  }
}

const LINEUP_SLOT_LABELS = {
  gk: 'Gardien', def0: 'Défenseur 1', def1: 'Défenseur 2',
  att0: 'Attaquant 1', att1: 'Attaquant 2', att2: 'Attaquant 3'
};

async function loadTeamPanel() {
  els.lineupSlots.innerHTML = '<p class="profile-empty-note">Chargement…</p>';
  els.collectionGrid.innerHTML = '';
  try {
    const [collection, lineup, customPlayers] = await Promise.all([
      fetchMyCollection(), fetchMyLineup(), fetchMyCustomPlayers()
    ]);
    myCollectionCache = collection;
    myLineupCache = lineup || {};
    myCustomPlayersCache = customPlayers;
    renderLineupSlots();
    renderCollectionGrid();
    renderCreatePlayerSection();
  } catch (err) {
    els.lineupSlots.innerHTML = '<p class="profile-empty-note">Équipe indisponible pour le moment.</p>';
  }
}

/**
 * Liste combinée de tous les joueurs possédés, catalogue + créations
 * personnalisées, dans une forme uniforme. Source de vérité unique utilisée
 * partout où on doit retrouver un joueur par son ownershipId — avant ce
 * correctif, renderLineupSlots() ne cherchait que dans myCollectionCache,
 * ce qui rendait les joueurs custom invisibles une fois assignés à un poste.
 */
function getAllOwnedPlayers() {
  return [...myCollectionCache, ...myCustomPlayersCache.map(toOwnedShape)];
}

function renderLineupSlots() {
  els.lineupSlots.innerHTML = '';
  const allOwned = getAllOwnedPlayers();
  Object.entries(LINEUP_SLOT_LABELS).forEach(([slot, label]) => {
    const ownershipId = myLineupCache?.[`slot_${slot}`];
    const owned = allOwned.find(c => c.id === ownershipId);

    const slotEl = document.createElement('div');
    slotEl.className = 'lineup-slot' + (owned ? ' filled' : '');
    slotEl.dataset.slot = slot;

    if (owned) {
      const avatarEl = document.createElement('div');
      avatarEl.className = 'lineup-slot-avatar';
      avatarEl.innerHTML = renderAvatarSvg(avatarForOwned(owned));
      slotEl.appendChild(avatarEl);
    }

    const labelEl = document.createElement('div');
    labelEl.className = 'lineup-slot-label';
    labelEl.textContent = label;
    slotEl.appendChild(labelEl);

    const nameEl = document.createElement('div');
    nameEl.className = 'lineup-slot-name';
    if (owned) {
      const baseName = owned.isCustom ? owned.name : owned.fictional_players.name;
      nameEl.textContent = owned.custom_name || baseName;
    } else {
      nameEl.textContent = 'Glisse un joueur ici';
    }
    slotEl.appendChild(nameEl);

    if (owned) {
      const clearBtn = document.createElement('button');
      clearBtn.className = 'lineup-slot-clear';
      clearBtn.textContent = '✕';
      clearBtn.title = 'Retirer ce joueur du poste';
      clearBtn.addEventListener('click', e => {
        e.stopPropagation();
        myLineupCache[`slot_${slot}`] = null;
        renderLineupSlots();
      });
      slotEl.appendChild(clearBtn);
    }

    // ---------- Cible de glisser-déposer ----------
    slotEl.addEventListener('dragover', e => {
      e.preventDefault(); // nécessaire pour autoriser le drop
      slotEl.classList.add('drop-target-active');
    });
    slotEl.addEventListener('dragleave', () => {
      slotEl.classList.remove('drop-target-active');
    });
    slotEl.addEventListener('drop', e => {
      e.preventDefault();
      slotEl.classList.remove('drop-target-active');
      const ownershipIdDropped = e.dataTransfer.getData('text/plain');
      if (!ownershipIdDropped) return;
      assignPlayerToSlot(ownershipIdDropped, slot);
    });

    els.lineupSlots.appendChild(slotEl);
  });
}

function assignPlayerToSlot(ownershipId, slot) {
  // Si ce joueur occupe déjà un autre poste, on le libère d'abord — un
  // même joueur ne peut pas être aligné à deux postes en même temps.
  Object.keys(LINEUP_SLOT_LABELS).forEach(s => {
    if (myLineupCache[`slot_${s}`] === ownershipId) {
      myLineupCache[`slot_${s}`] = null;
    }
  });
  myLineupCache[`slot_${slot}`] = ownershipId;
  renderLineupSlots();
  renderCollectionGrid(); // pour mettre à jour l'état visuel "déjà aligné" des cartes
}

/**
 * Détermine l'avatar à afficher pour un joueur possédé : un joueur custom
 * a son propre avatar choisi explicitement ; un joueur du catalogue dérive
 * le sien de façon déterministe depuis avatar_seed.
 */
function avatarForOwned(owned) {
  if (owned.isCustom) {
    return { color: owned.avatar_color, pattern: owned.avatar_pattern, accessory: owned.avatar_accessory };
  }
  return hashSeedToAvatar(owned.fictional_players.avatar_seed);
}

function renderCollectionGrid() {
  els.collectionGrid.innerHTML = '';
  const allOwned = getAllOwnedPlayers();

  if (allOwned.length === 0) {
    els.collectionGrid.innerHTML = '<p class="profile-empty-note">Aucun joueur dans ta collection pour le moment.</p>';
    return;
  }

  const assignedIds = new Set(Object.keys(LINEUP_SLOT_LABELS).map(s => myLineupCache?.[`slot_${s}`]).filter(Boolean));

  allOwned.forEach(owned => {
    const rarity = owned.isCustom ? 'custom' : owned.fictional_players.rarity;
    const card = document.createElement('div');
    card.className = `player-card rarity-${rarity}` + (assignedIds.has(owned.id) ? ' assigned' : '');
    card.draggable = true;
    card.dataset.ownershipId = owned.id;

    const avatarEl = document.createElement('div');
    avatarEl.className = 'player-card-avatar';
    avatarEl.innerHTML = renderAvatarSvg(avatarForOwned(owned));
    card.appendChild(avatarEl);

    const name = document.createElement('div');
    name.className = 'player-card-name';
    name.textContent = owned.custom_name || (owned.isCustom ? owned.name : owned.fictional_players.name);

    const style = document.createElement('div');
    style.className = 'player-card-style';
    style.textContent = owned.isCustom ? owned.style : owned.fictional_players.style;

    const rarityTag = document.createElement('span');
    rarityTag.className = 'player-card-rarity';
    rarityTag.textContent = owned.isCustom ? 'personnalisé' : owned.fictional_players.rarity;

    card.appendChild(name);
    card.appendChild(style);
    card.appendChild(rarityTag);

    if (assignedIds.has(owned.id)) {
      const badge = document.createElement('span');
      badge.className = 'player-card-assigned-badge';
      badge.textContent = 'Aligné';
      card.appendChild(badge);
    }

    // ---------- Source de glisser-déposer ----------
    card.addEventListener('dragstart', e => {
      e.dataTransfer.setData('text/plain', owned.id);
      e.dataTransfer.effectAllowed = 'move';
      card.classList.add('dragging');
    });
    card.addEventListener('dragend', () => {
      card.classList.remove('dragging');
    });

    // Solution de repli tactile/clic : assigne au premier poste vide,
    // pour les appareils où le drag&drop natif est peu pratique.
    card.addEventListener('click', () => handlePlayerCardClick(owned));

    els.collectionGrid.appendChild(card);
  });
}

/**
 * Adapte la forme d'un joueur custom pour qu'elle ressemble à celle d'un
 * player_ownership classique (avec fictional_players imbriqué), pour que
 * renderLineupSlots/renderCollectionGrid puissent traiter les deux sources
 * de façon presque uniforme malgré leur structure de données différente.
 */
function toOwnedShape(customPlayer) {
  return {
    id: customPlayer.id,
    isCustom: true,
    custom_name: null,
    name: customPlayer.name,
    style: customPlayer.style,
    avatar_color: customPlayer.avatar_color,
    avatar_pattern: customPlayer.avatar_pattern,
    avatar_accessory: customPlayer.avatar_accessory
  };
}

function handlePlayerCardClick(owned) {
  // Clic simple (repli tactile) : assigne ce joueur au premier slot vide.
  const emptySlot = Object.keys(LINEUP_SLOT_LABELS).find(slot => !myLineupCache?.[`slot_${slot}`]);
  if (!emptySlot) {
    alert('Les 6 postes sont déjà pourvus. Glisse ce joueur directement sur un poste pour remplacer son occupant, ou retire un joueur avec le ✕.');
    return;
  }
  assignPlayerToSlot(owned.id, emptySlot);
}

async function handleSaveLineup() {
  try {
    await saveLineup({
      slot_gk: myLineupCache.slot_gk || null,
      slot_def0: myLineupCache.slot_def0 || null,
      slot_def1: myLineupCache.slot_def1 || null,
      slot_att0: myLineupCache.slot_att0 || null,
      slot_att1: myLineupCache.slot_att1 || null,
      slot_att2: myLineupCache.slot_att2 || null
    });
    alert('Composition enregistrée ! Elle s\'appliquera à ta prochaine partie.');
  } catch (err) {
    alert(err.message || 'Impossible d\'enregistrer la composition pour le moment.');
  }
}

// ---------- Création de joueur personnalisé ----------

let newPlayerDraft = {
  style: 'rapide',
  color: AVATAR_COLORS[0],
  pattern: 'plain',
  accessory: 'none'
};

function wireCreatePlayer() {
  els.openCreatePlayerBtn?.addEventListener('click', openCreatePlayerModal);
  els.closeCreatePlayerBtn?.addEventListener('click', () => {
    els.createPlayerOverlay.classList.remove('show');
  });
  els.confirmCreatePlayerBtn?.addEventListener('click', handleConfirmCreatePlayer);

  els.newPlayerStyleOptions?.querySelectorAll('.setup-option').forEach(opt => {
    opt.addEventListener('click', () => {
      els.newPlayerStyleOptions.querySelectorAll('.setup-option').forEach(o => o.classList.remove('active'));
      opt.classList.add('active');
      newPlayerDraft.style = opt.dataset.style;
    });
  });

  els.newPlayerPatternOptions?.querySelectorAll('.setup-option').forEach(opt => {
    opt.addEventListener('click', () => {
      els.newPlayerPatternOptions.querySelectorAll('.setup-option').forEach(o => o.classList.remove('active'));
      opt.classList.add('active');
      newPlayerDraft.pattern = opt.dataset.pattern;
      renderCreatePlayerPreview();
    });
  });

  els.newPlayerAccessoryOptions?.querySelectorAll('.setup-option').forEach(opt => {
    opt.addEventListener('click', () => {
      els.newPlayerAccessoryOptions.querySelectorAll('.setup-option').forEach(o => o.classList.remove('active'));
      opt.classList.add('active');
      newPlayerDraft.accessory = opt.dataset.accessory;
      renderCreatePlayerPreview();
    });
  });

  // Palette de couleurs construite dynamiquement depuis AVATAR_COLORS,
  // pour rester strictement synchronisée avec ce que le rendu sait afficher.
  AVATAR_COLORS.forEach(color => {
    const swatch = document.createElement('div');
    swatch.className = 'avatar-color-swatch' + (color === newPlayerDraft.color ? ' active' : '');
    swatch.style.background = color;
    swatch.addEventListener('click', () => {
      els.newPlayerColorOptions.querySelectorAll('.avatar-color-swatch').forEach(s => s.classList.remove('active'));
      swatch.classList.add('active');
      newPlayerDraft.color = color;
      renderCreatePlayerPreview();
    });
    els.newPlayerColorOptions.appendChild(swatch);
  });
}

function renderCreatePlayerSection() {
  // Met à jour la note de quota chaque fois que l'onglet équipe est rechargé
  // (après création/suppression), pour refléter l'état réel sans recharger
  // toute la page.
  const usedSlots = myCustomPlayersCache.length;
  if (usedSlots === 0) {
    els.createPlayerQuotaNote.textContent = '1 emplacement gratuit disponible.';
  } else {
    els.createPlayerQuotaNote.textContent = `${usedSlots} joueur(s) personnalisé(s) créé(s). Au-delà du premier, chaque emplacement supplémentaire est payant.`;
  }
}

function openCreatePlayerModal() {
  els.createPlayerError.textContent = '';
  els.newPlayerName.value = '';
  newPlayerDraft = { style: 'rapide', color: AVATAR_COLORS[0], pattern: 'plain', accessory: 'none' };

  els.newPlayerStyleOptions.querySelectorAll('.setup-option').forEach((o, i) => o.classList.toggle('active', i === 0));
  els.newPlayerPatternOptions.querySelectorAll('.setup-option').forEach((o, i) => o.classList.toggle('active', i === 0));
  els.newPlayerAccessoryOptions.querySelectorAll('.setup-option').forEach((o, i) => o.classList.toggle('active', i === 0));
  els.newPlayerColorOptions.querySelectorAll('.avatar-color-swatch').forEach((s, i) => s.classList.toggle('active', i === 0));

  renderCreatePlayerPreview();
  els.createPlayerOverlay.classList.add('show');
}

function renderCreatePlayerPreview() {
  els.createPlayerPreview.innerHTML = renderAvatarSvg(newPlayerDraft);
}

async function handleConfirmCreatePlayer() {
  const name = els.newPlayerName.value.trim();
  els.createPlayerError.textContent = '';

  if (!name) {
    els.createPlayerError.textContent = 'Donne un nom à ton joueur.';
    return;
  }

  try {
    await createCustomPlayer({
      name,
      style: newPlayerDraft.style,
      avatarColor: newPlayerDraft.color,
      avatarPattern: newPlayerDraft.pattern,
      avatarAccessory: newPlayerDraft.accessory
    });
    els.createPlayerOverlay.classList.remove('show');
    await loadTeamPanel(); // recharge la collection pour afficher le nouveau joueur
  } catch (err) {
    const message = err.message || '';
    if (message.includes('Limite de joueurs personnalisés')) {
      els.createPlayerError.textContent = 'Limite gratuite atteinte. Achète un emplacement supplémentaire pour créer ce joueur.';
      offerCustomPlayerSlotPurchase();
    } else {
      els.createPlayerError.textContent = message || 'Création impossible pour le moment.';
    }
  }
}

/**
 * Propose l'achat d'un emplacement supplémentaire en réutilisant le système
 * de paiement déjà en place pour les thèmes (checkoutTheme), plutôt que de
 * dupliquer une logique de paiement spécifique aux joueurs custom.
 */
async function offerCustomPlayerSlotPurchase() {
  if (!currentUser) return;
  const confirmed = confirm('Acheter un emplacement supplémentaire pour créer un joueur personnalisé (1,49€) ?');
  if (!confirmed) return;

  try {
    const fakeThemeForSlot = { id: CUSTOM_PLAYER_SLOT_THEME_ID, price_cents: 149 };
    const result = await checkoutTheme(fakeThemeForSlot, currentUser);
    if (result.immediate) {
      alert('Emplacement débloqué ! Tu peux maintenant créer ce joueur.');
      els.createPlayerError.textContent = '';
    } else if (result.redirectUrl) {
      window.location.href = result.redirectUrl;
    }
  } catch (err) {
    alert(err.message || 'Achat impossible pour le moment.');
  }
}

// ---------- Amis & Mercato ----------

let mercatoOfferContext = null; // { friendUserId, friendOwnershipId } pendant la création d'une offre
let mercatoMySelectedOwnershipId = null;
let mercatoFriendSelectedOwnershipId = null;
let myFriendsCache = [];

function wireMercato() {
  els.sendFriendRequestBtn?.addEventListener('click', handleSendFriendRequest);
  els.friendPseudoInput?.addEventListener('keydown', e => {
    if (e.key === 'Enter') handleSendFriendRequest();
  });
  els.closeMercatoOfferBtn?.addEventListener('click', () => {
    els.mercatoOfferOverlay.classList.remove('show');
  });
  els.confirmMercatoOfferBtn?.addEventListener('click', handleConfirmMercatoOffer);
}

async function loadMercatoPanel() {
  els.friendRequestError.textContent = '';
  await Promise.all([renderFriendshipsSection(), renderMercatoOffersSection()]);
}

async function renderFriendshipsSection() {
  els.pendingFriendRequests.innerHTML = '<p class="profile-empty-note">Chargement…</p>';
  els.friendsList.innerHTML = '';
  try {
    const { friends, pendingReceived } = await fetchMyFriendships();
    myFriendsCache = friends;

    els.pendingFriendRequests.innerHTML = '';
    if (pendingReceived.length === 0) {
      els.pendingFriendRequests.innerHTML = '<p class="profile-empty-note">Aucune demande en attente.</p>';
    } else {
      pendingReceived.forEach(req => {
        const row = document.createElement('div');
        row.className = 'friend-row';
        row.innerHTML = `<span class="friend-row-name">${req.other_pseudo || 'Joueur'}</span>`;
        const actions = document.createElement('div');
        actions.className = 'friend-row-actions';
        const acceptBtn = document.createElement('button');
        acceptBtn.className = 'btn-small primary';
        acceptBtn.textContent = 'Accepter';
        acceptBtn.addEventListener('click', async () => {
          await respondFriendRequest(req.user_id, true);
          await renderFriendshipsSection();
        });
        const declineBtn = document.createElement('button');
        declineBtn.className = 'btn-small danger';
        declineBtn.textContent = 'Refuser';
        declineBtn.addEventListener('click', async () => {
          await respondFriendRequest(req.user_id, false);
          await renderFriendshipsSection();
        });
        actions.appendChild(acceptBtn);
        actions.appendChild(declineBtn);
        row.appendChild(actions);
        els.pendingFriendRequests.appendChild(row);
      });
    }

    if (friends.length === 0) {
      els.friendsList.innerHTML = '<p class="profile-empty-note">Aucun ami pour le moment. Ajoute quelqu\'un par son pseudo ci-dessus.</p>';
    } else {
      friends.forEach(friendship => {
        const row = document.createElement('div');
        row.className = 'friend-row';
        row.innerHTML = `<span class="friend-row-name">${friendship.other_pseudo || 'Joueur'}</span>`;
        const tradeBtn = document.createElement('button');
        tradeBtn.className = 'btn-small primary';
        tradeBtn.textContent = 'Proposer un échange';
        const otherUserId = friendship.direction === 'sent' ? friendship.friend_id : friendship.user_id;
        tradeBtn.addEventListener('click', () => openMercatoOfferModal(otherUserId, friendship.other_pseudo));
        row.appendChild(tradeBtn);
        els.friendsList.appendChild(row);
      });
    }
  } catch (err) {
    els.pendingFriendRequests.innerHTML = '<p class="profile-empty-note">Amis indisponibles pour le moment.</p>';
  }
}

async function handleSendFriendRequest() {
  const pseudo = els.friendPseudoInput.value.trim();
  els.friendRequestError.textContent = '';
  if (!pseudo) return;
  try {
    await sendFriendRequest(pseudo);
    els.friendPseudoInput.value = '';
    await renderFriendshipsSection();
  } catch (err) {
    els.friendRequestError.textContent = err.message || 'Demande impossible pour le moment.';
  }
}

async function renderMercatoOffersSection() {
  els.mercatoOffersReceived.innerHTML = '<p class="profile-empty-note">Chargement…</p>';
  els.mercatoOffersSent.innerHTML = '';
  try {
    const { received, sent } = await fetchMyMercatoOffers();

    els.mercatoOffersReceived.innerHTML = '';
    if (received.length === 0) {
      els.mercatoOffersReceived.innerHTML = '<p class="profile-empty-note">Aucune offre reçue.</p>';
    } else {
      received.forEach(offer => {
        const row = document.createElement('div');
        row.className = 'offer-row';
        row.innerHTML = `<span class="offer-row-desc">Échange proposé</span>`;
        const actions = document.createElement('div');
        actions.className = 'offer-row-actions';
        const acceptBtn = document.createElement('button');
        acceptBtn.className = 'btn-small primary';
        acceptBtn.textContent = 'Accepter';
        acceptBtn.addEventListener('click', async () => {
          try {
            await respondMercatoOffer(offer.id, true);
            await renderMercatoOffersSection();
          } catch (err) {
            alert(err.message || 'Échange impossible pour le moment.');
          }
        });
        const declineBtn = document.createElement('button');
        declineBtn.className = 'btn-small danger';
        declineBtn.textContent = 'Refuser';
        declineBtn.addEventListener('click', async () => {
          await respondMercatoOffer(offer.id, false);
          await renderMercatoOffersSection();
        });
        actions.appendChild(acceptBtn);
        actions.appendChild(declineBtn);
        row.appendChild(actions);
        els.mercatoOffersReceived.appendChild(row);
      });
    }

    els.mercatoOffersSent.innerHTML = '';
    if (sent.length === 0) {
      els.mercatoOffersSent.innerHTML = '<p class="profile-empty-note">Aucune offre envoyée.</p>';
    } else {
      sent.forEach(offer => {
        const row = document.createElement('div');
        row.className = 'offer-row';
        row.innerHTML = `<span class="offer-row-desc">En attente de réponse</span>`;
        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'btn-small danger';
        cancelBtn.textContent = 'Annuler';
        cancelBtn.addEventListener('click', async () => {
          await cancelMercatoOffer(offer.id);
          await renderMercatoOffersSection();
        });
        row.appendChild(cancelBtn);
        els.mercatoOffersSent.appendChild(row);
      });
    }
  } catch (err) {
    els.mercatoOffersReceived.innerHTML = '<p class="profile-empty-note">Offres indisponibles pour le moment.</p>';
  }
}

async function openMercatoOfferModal(friendUserId, friendName) {
  mercatoOfferContext = { friendUserId };
  mercatoMySelectedOwnershipId = null;
  mercatoFriendSelectedOwnershipId = null;
  els.mercatoOfferError.textContent = '';
  els.friendPlayerSelectLabel.textContent = `Tu demandes à ${friendName || 'ton ami'}`;
  els.myPlayerSelect.innerHTML = '<p class="profile-empty-note">Chargement…</p>';
  els.friendPlayerSelect.innerHTML = '<p class="profile-empty-note">Chargement…</p>';
  els.mercatoOfferOverlay.classList.add('show');

  try {
    const [myCollection, myCustom, friendCollection] = await Promise.all([
      fetchMyCollection(), fetchMyCustomPlayers(), fetchFriendCollection(friendUserId)
    ]);
    const myAllOwned = [...myCollection, ...myCustom.map(toOwnedShape)];
    renderMercatoPlayerOptions(els.myPlayerSelect, myAllOwned, ownershipId => {
      mercatoMySelectedOwnershipId = ownershipId;
    });
    renderMercatoFriendOptions(friendCollection);
  } catch (err) {
    els.mercatoOfferError.textContent = err.message || 'Collections indisponibles pour le moment.';
  }
}

function renderMercatoPlayerOptions(container, owned, onSelect) {
  container.innerHTML = '';
  if (owned.length === 0) {
    container.innerHTML = '<p class="profile-empty-note">Aucun joueur disponible.</p>';
    return;
  }
  owned.forEach(o => {
    const opt = document.createElement('div');
    opt.className = 'mercato-player-option';
    opt.textContent = o.custom_name || (o.isCustom ? o.name : o.fictional_players.name);
    opt.addEventListener('click', () => {
      container.querySelectorAll('.mercato-player-option').forEach(el => el.classList.remove('selected'));
      opt.classList.add('selected');
      onSelect(o.id);
    });
    container.appendChild(opt);
  });
}

function renderMercatoFriendOptions(friendCollection) {
  els.friendPlayerSelect.innerHTML = '';
  if (friendCollection.length === 0) {
    els.friendPlayerSelect.innerHTML = '<p class="profile-empty-note">Cet ami n\'a aucun joueur.</p>';
    return;
  }
  friendCollection.forEach(p => {
    const opt = document.createElement('div');
    opt.className = 'mercato-player-option';
    opt.textContent = p.custom_name || p.player_name;
    opt.addEventListener('click', () => {
      els.friendPlayerSelect.querySelectorAll('.mercato-player-option').forEach(el => el.classList.remove('selected'));
      opt.classList.add('selected');
      mercatoFriendSelectedOwnershipId = p.id;
    });
    els.friendPlayerSelect.appendChild(opt);
  });
}

async function handleConfirmMercatoOffer() {
  els.mercatoOfferError.textContent = '';
  if (!mercatoMySelectedOwnershipId || !mercatoFriendSelectedOwnershipId) {
    els.mercatoOfferError.textContent = 'Choisis un joueur de chaque côté.';
    return;
  }
  try {
    await createMercatoOffer(mercatoOfferContext.friendUserId, mercatoMySelectedOwnershipId, mercatoFriendSelectedOwnershipId);
    els.mercatoOfferOverlay.classList.remove('show');
    await renderMercatoOffersSection();
    alert('Offre envoyée ! Ton ami doit l\'accepter pour que l\'échange se fasse.');
  } catch (err) {
    els.mercatoOfferError.textContent = err.message || 'Offre impossible pour le moment.';
  }
}

async function loadLeaderboardPanel() {
  els.leaderboardBody.innerHTML = '<tr><td colspan="5">Chargement…</td></tr>';
  try {
    const rows = await fetchLeaderboard(20);
    if (!rows || rows.length === 0) {
      els.leaderboardBody.innerHTML = '<tr><td colspan="5">Aucun classement disponible pour le moment.</td></tr>';
      return;
    }
    els.leaderboardBody.innerHTML = '';
    rows.forEach((row, index) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${index + 1}</td>
        <td>${row.display_name}</td>
        <td>${row.level}</td>
        <td>${row.xp}</td>
        <td>${row.games_won}</td>
      `;
      els.leaderboardBody.appendChild(tr);
    });
  } catch (err) {
    els.leaderboardBody.innerHTML = '<tr><td colspan="5">Classement indisponible pour le moment.</td></tr>';
  }
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
  wireProfileScreen();
  wireCreatePlayer();
  wireMercato();
  wireAccount();
  wireTutorial();
  registerServiceWorker();
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
