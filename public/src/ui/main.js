// ===================== MAIN APP =====================
// Orchestre le moteur de jeu pur (engine/gameEngine.js) et le rendu DOM
// (ui/boardRenderer.js). Contient l'unique mutable de l'app : `gameState`.
// Toute évolution de gameState passe par une fonction du moteur (jamais
// de mutation directe), pour garder le moteur comme seule source de vérité
// des règles.

import {
  createGame, selectToken, moveSelectedToken, passBall, passTurn,
  resetBallAfterGoal, PHASES
} from '../engine/gameEngine.js';
import { TEAMS } from '../engine/constants.js';
import { buildBoardGrid, renderBoard } from './boardRenderer.js';
import { applyTheme, isThemeUnlocked, formatPrice, DEFAULT_THEME_ID } from './themeManager.js';
import { fetchActiveThemes, fetchMyPurchases, getCurrentUser, onAuthStateChange, signOut, signInWithEmail, signUpWithEmail } from '../services/supabaseClient.js';
import { checkoutTheme, isMockPaymentActive } from '../services/payment/paymentProvider.js';

// ---------- État applicatif ----------

let gameState = null;
let undoSnapshot = null;
let currentUser = null;
let availableThemes = [];
let purchasedThemeIds = [];
let activeThemeId = DEFAULT_THEME_ID;
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
  els.restartBtn = document.getElementById('restartBtn');
  els.startBtn = document.getElementById('startBtn');
  els.goalOptions = document.getElementById('goalOptions');
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
  els.gameScreen.classList.remove('hidden');
  buildBoardGrid(els.boardGrid, handleCellClick);
  render();
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
}

function updateHint() {
  if (gameState.gameOver) { els.hintBar.textContent = ''; return; }
  if (gameState.phase === PHASES.SELECT) {
    els.hintBar.textContent = gameState.selectedTokenId
      ? 'Choisis une case pour te déplacer, ou une passe si tu es au contact du ballon'
      : 'Choisis un de tes pions à déplacer';
  } else if (gameState.phase === PHASES.MOVED_CAN_PASS) {
    els.hintBar.textContent = 'Tu es au contact du ballon : fais une passe, ou termine ton tour';
  }
}

function updateCancelButton() {
  const canCancel =
    (gameState.phase === PHASES.SELECT && gameState.selectedTokenId) ||
    gameState.phase === PHASES.MOVED_CAN_PASS ||
    gameState.canUndo === true;
  els.cancelBtn.style.opacity = canCancel ? '1' : '0.45';
  els.cancelBtn.style.pointerEvents = canCancel ? 'auto' : 'none';
}

// ---------- Interactions plateau ----------

function handleCellClick(row, col) {
  if (gameState.gameOver) return;

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
    if (gameState.gameOver) {
      setTimeout(() => showEndOverlay(gameState.winner), 350);
    } else {
      showGoalOverlay(gameState.lastGoalBy);
    }
    return;
  }
  render();
}

// ---------- Annulation ----------

function handleCancel() {
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
}

function showEndOverlay(winningTeam) {
  els.endTitle.className = 'overlay-title ' + winningTeam;
  els.endTitle.textContent = winningTeam === TEAMS.BLEU ? 'BLEU GAGNE' : 'ROUGE GAGNE';
  els.endSub.textContent = `Score final : ${gameState.score[TEAMS.BLEU]} – ${gameState.score[TEAMS.ROUGE]}`;
  els.endOverlay.classList.add('show');
}

function backToSetup() {
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

function wireGameControls() {
  els.cancelBtn.addEventListener('click', handleCancel);
  els.restartBtn.addEventListener('click', backToSetup);
  els.continueBtn.addEventListener('click', hideGoalOverlayAndResume);
  els.newGameBtn.addEventListener('click', backToSetup);
}

// ---------- Boutique de thèmes ----------

// Catalogue de secours : utilisé uniquement si la requête vers Supabase échoue
// (réseau indisponible, configuration absente). Permet à la boutique de rester
// présentable plutôt que vide, même si les achats ne pourront pas être validés
// dans cet état (l'utilisateur verra l'erreur au moment d'acheter, pas avant).
const FALLBACK_THEMES = [
  { id: 'classique', name: 'Classique', description: 'Le terrain vert historique de Plateau Foot.', price_cents: 0, currency: 'eur', config: { vertTerrain: '#1F3D2B', bleuEquipe: '#3A6EA5', rougeEquipe: '#C84B31' } },
  { id: 'neon', name: 'Néon', description: 'Un terrain électrique pour les soirées arcade.', price_cents: 199, currency: 'eur', config: { vertTerrain: '#0D1B2A', bleuEquipe: '#00E5FF', rougeEquipe: '#FF2D75' } },
  { id: 'neige', name: 'Neige', description: 'Le grand froid s’abat sur le terrain.', price_cents: 199, currency: 'eur', config: { vertTerrain: '#E8EEF3', bleuEquipe: '#2C5C8A', rougeEquipe: '#A23B3B' } },
  { id: 'terre-battue', name: 'Terre battue', description: 'Ambiance Roland-Garros, mais au foot.', price_cents: 199, currency: 'eur', config: { vertTerrain: '#A8542E', bleuEquipe: '#2B4C7E', rougeEquipe: '#7E2B2B' } }
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

function renderShop(usedFallback = false) {
  els.shopGrid.innerHTML = '';

  if (usedFallback) {
    const banner = document.createElement('p');
    banner.className = 'shop-mock-banner shop-offline-banner';
    banner.textContent = 'Connexion à la boutique indisponible pour le moment : aperçu hors ligne, les achats ne peuvent pas être validés tant que la connexion n\'est pas rétablie.';
    els.shopGrid.appendChild(banner);
  }

  if (availableThemes.length === 0) {
    els.shopGrid.innerHTML = '<p class="shop-empty">Boutique indisponible pour le moment.</p>';
    return;
  }

  availableThemes.forEach(theme => {
    const unlocked = isThemeUnlocked(theme, purchasedThemeIds);
    const card = document.createElement('div');
    card.className = 'theme-card' + (theme.id === activeThemeId ? ' active' : '');

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
  wireSetupScreen();
  wireGameControls();
  wireShop();
  wireAccount();
}

document.addEventListener('DOMContentLoaded', init);
