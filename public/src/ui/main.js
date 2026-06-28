// ===================== MAIN APP =====================
// Orchestre le moteur de jeu pur (engine/gameEngine.js) et le rendu DOM
// (ui/boardRenderer.js). Contient l'unique mutable de l'app : `gameState`.
// Toute évolution de gameState passe par une fonction du moteur (jamais
// de mutation directe), pour garder le moteur comme seule source de vérité
// des règles.

import {
  createGame, selectToken, moveSelectedToken, passBall, passTurn,
  resetBallAfterGoal, applyMove, PHASES
} from '../engine/gameEngine.js';
import { chooseAiMove, AI_LEVELS } from '../engine/ai.js';
import { TEAMS } from '../engine/constants.js';
import { buildBoardGrid, renderBoard } from './boardRenderer.js';
import { applyTheme, isThemeUnlocked, formatPrice, DEFAULT_THEME_ID } from './themeManager.js';
import { fetchActiveThemes, fetchMyPurchases, getCurrentUser, onAuthStateChange, signOut, signInWithEmail, signUpWithEmail } from '../services/supabaseClient.js';
import { checkoutTheme, checkoutBundle, isMockPaymentActive } from '../services/payment/paymentProvider.js';
import { createGameSession, joinGameSession, pushGameState, subscribeToGameSession } from '../services/multiplayerService.js';

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
let myTeam = TEAMS.BLEU;
let unsubscribeFromSession = null;
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
  els.accountCloseBtn = document.getElementById('accountCloseBtn');
}

// ---------- Cycle de vie du jeu ----------

function startGame(goalsToWin) {
  gameState = createGame({ goalsToWin });
  undoSnapshot = null;
  els.setupScreen.classList.add('hidden');
  els.configScreen.classList.add('hidden');
  els.gameScreen.classList.remove('hidden');
  buildBoardGrid(els.boardGrid, handleCellClick);
  render();
  maybeTriggerAiTurn();
}

function render() {
  renderBoard(els.boardGrid, gameState);
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
    if (gameState.gameOver) {
      setTimeout(() => showEndOverlay(gameState.winner), 350);
    } else {
      showGoalOverlay(gameState.lastGoalBy);
    }
    return;
  }
  render();
  syncOnlineStateIfNeeded();
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
  wireAccount();
}

document.addEventListener('DOMContentLoaded', init);
