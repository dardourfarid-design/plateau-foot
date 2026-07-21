// ===================== MAIN APP =====================
// Orchestre le moteur de jeu pur (engine/gameEngine.js) et le rendu DOM
// (ui/boardRenderer.js). Contient l'unique mutable de l'app : `gameState`.
// Toute évolution de gameState passe par une fonction du moteur (jamais
// de mutation directe), pour garder le moteur comme seule source de vérité
// des règles.

import {
  createGame, selectToken, moveSelectedToken, passBall, passTurn,
  applyMove, PHASES
} from '../engine/gameEngine.js';
import { applyAiTurn, AI_LEVELS } from '../engine/ai.js';
import { setSoundEnabled, playSound, vibrate } from '../services/soundService.js';
import { TEAMS, RULESET_DEFAULTS } from '../engine/constants.js';
import {
  POWER_LABELS, canActivatePower, confirmRelaisAfterPass, expireWallIfNeeded
} from '../engine/powers.js';
import { initPowers } from './powersUI.js';
import { buildBoardGrid, renderBoard } from './boardRenderer.js';
import { applyTheme, isThemeUnlocked, formatPrice, DEFAULT_THEME_ID } from './themeManager.js';
import { initAccount } from './accountUI.js';
import { initOnline } from './onlineUI.js';
import { recordOnlineAction } from '../services/multiplayerService.js';
import { initOverlays } from './overlaysUI.js';
import { initFaq } from './faqUI.js';
import { initLang, getLang, t, applyTranslations, onLangChange, mountLangToggle, startAutoTranslate } from './i18n.js';

// Dictionnaire anglais chargé à la demande (#158) : les joueurs FR (langue par
// défaut) ne téléchargent plus les 24 Ko de i18n-en.js. L'import dynamique est
// déclenché au boot si la langue mémorisée est l'anglais, ou au premier
// basculement FR→EN. Une fois le dictionnaire chargé, onLanguageChanged()
// ré-applique les traductions — couvre le cas d'un clic sur EN avant la fin
// du téléchargement.
let _enDictPromise = null;
function ensureEnglishDict() {
  if (!_enDictPromise) {
    _enDictPromise = import('./i18n-en.js')
      .then(() => { if (getLang() === 'en') onLanguageChanged(); })
      .catch(err => {
        _enDictPromise = null; // permet de retenter au prochain basculement
        console.error('Dictionnaire anglais non chargé :', err);
      });
  }
  return _enDictPromise;
}

// Écrans chargés à la demande (#324) : le mécanisme et son pourquoi sont dans
// lazyScreen.js. Ici on ne fait que déclarer QUELS écrans sont différés.
// Les loaders sont mémorisés pour que le seam E2E puisse tous les forcer
// (voir installE2ETestSeam) : plusieurs specs s'appuient sur des hooks posés
// par ces modules, et les tenir à jour à la main serait une dette garantie.
const _lazyLoaders = [];
function lazy(btn, load) {
  _lazyLoaders.push(load);
  return lazyScreen(btn, load, err => {
    console.error('Écran non chargé :', err);
    showToast(t('Chargement impossible. Vérifie ta connexion et réessaie.'));
  });
}

// Séance de tirs au but. Contrairement à la boutique et au profil, elle a deux
// points d'entrée qui ne sont PAS un clic : la fin d'un match nul (départage)
// et la route #tirs-au-but. D'où un ensure() explicite, réutilisable.
let _shootoutPromise = null;
function ensureShootout() {
  if (!_shootoutPromise) {
    _shootoutPromise = import('./shootoutUI.js')
      .then(m => {
        shootoutModule = m.initShootout({
          els,
          getCurrentUser: () => currentUser,
          promptSignIn: () => accountModule?.openAccountOverlay('signin')
        });
        return shootoutModule;
      })
      .catch(err => {
        _shootoutPromise = null; // permet de retenter
        console.error('Séance de tirs au but non chargée :', err);
        return null;
      });
  }
  return _shootoutPromise;
}

import { showToast, showAlert, showConfirm } from './dialogs.js';
import { getAdvertisingConsent } from '../services/advertisingConsentService.js';
import * as adService from '../services/ads/adService.js';
import { trackRewardedOptIn, trackRewardedCompleted } from '../services/ads/adAnalytics.js';
import { loadConsentMessaging } from '../services/ads/googleCmp.js';
import { shouldShowInterstitial, markInterstitialShown } from '../services/ads/interstitialFrequency.js';
import { fetchMyCollection, fetchMyLineup, ensureStarterPack, fetchPlayerCatalog, saveLineup } from '../services/playerCollectionService.js';
import { fetchMyProgress, fetchTodayChallenges, fetchLeaderboard } from '../services/progressService.js';
import { getMyFounderStatus } from '../services/passService.js';
import { resolveLineup } from './playerIdentity.js';
import { fetchMyCustomPlayers, createCustomPlayer, CUSTOM_PLAYER_SLOT_THEME_ID, claimLevelRewards, purchasePlayer } from '../services/customPlayerService.js';
import { getCurrencyBalance } from '../services/currencyService.js';
import {
  sendFriendRequest, respondFriendRequest, cancelFriendRequest, fetchMyFriendships,
  createMercatoOffer, respondMercatoOffer, cancelMercatoOffer, fetchMyMercatoOffers, fetchFriendCollection
} from '../services/mercatoService.js';
import { initRouter } from './router.js';
import { lazyScreen } from './lazyScreen.js';
import { loadSavedThemeId, loadSavedThemeConfig, saveActiveTheme } from './themeStorage.js';
import { cacheDomRefs } from './domRefs.js';
import { initSettings } from './settingsUI.js';

// #310 — routeur par hash. Déclaré ici et démarré en fin d'initialisation :
// c'est lui qui rend le bouton Retour du navigateur utilisable.
let router = null;

/** Écrit la route courante sans rien afficher (l'UI a déjà changé d'écran). */
function markRoute(screen) { router?.go(screen); }

// ---------- État applicatif ----------

let gameState = null;
let undoSnapshot = null;
let currentUser = null;
let availableThemes = [];
let purchasedThemeIds = [];
let activeThemeId = loadSavedThemeId();
let gameMode = 'local'; // 'local' | 'ai' | 'online'
let aiLevel = AI_LEVELS.MOYEN;
let selectedRuleset = 'classique'; // palier de regles (#206) : decouverte | classique | expert
let selectedVariant = 'standard'; // 'standard' (6 pions) | 'tactique' (8 pions)
let freePowersOn = true;          // pouvoir bonus tire au sort par equipe/match
let selectedFormat = 'score';     // 'score' (premier a N buts) | 'manche' (limite de tours, departage TAB)
let selectedGoals = 3;            // buts pour gagner (#204 : promu au scope module pour "Jouer en 1 clic")
let hintsOn = true;               // #207 : conseils contextuels en jeu (desactivables)
let soundOn = false;              // #209 : sons & vibrations (opt-in, off par defaut)
let aiThinking = false;
// #210 — mode « puzzle du jour ». L'état vit dans dailyPuzzleUI.js (#311) ;
// on l'interroge via puzzleModule.isPuzzleActive(), qui court-circuite l'IA et
// le passage de tour à l'adversaire.
const AI_TEAM = TEAMS.ROUGE; // l'IA joue toujours Rouge ; l'humain joue toujours Bleu en mode IA

// État multijoueur : myTeam est l'équipe contrôlée par CE navigateur ;
// l'autre équipe n'est jouable qu'en recevant les mises à jour de l'adversaire.
// La session en ligne (id + abonnement Realtime) vit dans onlineUI.js.
let onlineModule = null;     // { syncOnlineStateIfNeeded, leaveOnlineSession } — voir onlineUI.js
let settingsModule = null;   // { saveLastConfig, restoreLastConfig, applyConfigToUI } — voir settingsUI.js
let puzzleModule = null;     // { startPuzzle, handlePuzzleProgress, updatePuzzleHint, isPuzzleActive, exitPuzzle } — voir dailyPuzzleUI.js
let overlaysModule = null;   // { showGoalOverlay, hideGoalOverlayAndResume, showEndOverlay, backToSetup, goToLanding } — voir overlaysUI.js

// Identité des joueurs fictifs alignés (résolue une fois par partie, pas
// par coup). null si pas de compte ou pas encore de composition choisie —
// dans ce cas l'affichage reste strictement identique à avant ce système.
let myResolvedLineup = null;

// Le mode ciblage des pouvoirs (Tir Puissant, Sprint) vit dans powersUI.js ;
// le routeur de clics le consulte via powersModule.isTargeting().
let powersModule = null;     // { isTargeting, handlePowerDestinationClick } — voir powersUI.js
let myTeam = TEAMS.BLEU;

// État tutoriel
let tutorialModule = null;   // { isActive, checkTutorialProgress } — voir tutorialUI.js
// Références des modules profil/mercato pour la navigation didactique du
// tutoriel (renseignées dans init(), utilisées via openRealProfileTab).
let profileModuleRef = null;
let shootoutModule = null;   // { openShootout, startShootoutDepartage } — voir shootoutUI.js
let accountModule = null;    // { openAccountOverlay, updateAccountUI, updateCoinDisplay, showCoinGain, refreshAfterCheckout } — voir accountUI.js
let mercatoModuleRef = null; // élément actuellement mis en valeur, pour pouvoir retirer la classe au changement d'étape
let screenBeforeShop = 'setup';

// ---------- Références DOM ----------

const els = {};

// Références DOM : extraites dans domRefs.js (#311).

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

// ---------- #208 : Juice (trajectoire de passe, flash de but) ----------

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// Fait « filer » une pastille lumineuse le long de la ligne de passe, case par
// case. Purement visuel et non bloquant (les classes s'auto-nettoient).
function animateBallTravel(from, to) {
  if (!from || !to || prefersReducedMotion()) return;
  const dr = Math.sign(to.row - from.row);
  const dc = Math.sign(to.col - from.col);
  if (dr === 0 && dc === 0) return;
  let r = from.row, c = from.col;
  const path = [];
  while (!(r === to.row && c === to.col) && path.length < 20) {
    r += dr; c += dc;
    path.push([r, c]);
  }
  path.forEach(([pr, pc], i) => {
    setTimeout(() => {
      const cell = els.boardGrid?.querySelector(`.cell[data-row="${pr}"][data-col="${pc}"]`);
      if (!cell) return;
      cell.classList.add('pass-trail');
      setTimeout(() => cell.classList.remove('pass-trail'), 350);
    }, i * 45);
  });
}

function flashGoalBoard() {
  if (prefersReducedMotion()) return;
  const wrap = document.querySelector('.board-wrap');
  if (!wrap) return;
  wrap.classList.remove('goal-flash-board');
  void wrap.offsetWidth; // reflow pour re-déclencher l'animation
  wrap.classList.add('goal-flash-board');
  setTimeout(() => wrap.classList.remove('goal-flash-board'), 700);
}

// ---------- #210 : Puzzle du jour ----------
// Extrait dans dailyPuzzleUI.js (#311) — y compris son état (puzzleActive,
// currentPuzzle, puzzleMoves), qui n'intéressait aucun autre module.

function startGame(goalsToWin) {
  puzzleModule?.exitPuzzle(); // sortie de tout mode puzzle en cours
  selectedGoals = goalsToWin;
  settingsModule.saveLastConfig(); // #204 : mémorise les réglages pour le prochain « Jouer »
  gameState = createGame({ goalsToWin, ruleset: selectedRuleset, variant: selectedVariant, freePowers: freePowersOn, turnLimit: selectedFormat === 'manche' ? 40 : null });
  undoSnapshot = null;
  els.shootoutScreen?.classList.add('hidden');
  // En local ou vs IA, l'humain principal joue toujours Bleu. Sans cette
  // remise à zéro, un joueur ayant rejoint une partie en ligne (myTeam =
  // Rouge) gardait ce camp en mémoire pour ses parties solo suivantes.
  if (gameMode !== 'online') myTeam = TEAMS.BLEU;
  els.setupScreen.classList.add('hidden');
  els.configScreen.classList.add('hidden');
  els.gameScreen.classList.remove('hidden');
  markRoute('partie');
  buildBoardGrid(els.boardGrid, handleCellClick);
  loadMyLineupForGame().then(render); // rendu initial sans lineup, puis re-rendu dès qu'elle arrive
  render();
  maybeTriggerAiTurn();
}

// #199 — Aide en jeu filtrée par palier : le rappel des règles de la feuille
// de match liste les règles de base PLUS les règles avancées réellement
// actives dans la partie en cours. Mémoïsé (les règles ne changent pas en
// cours de partie) pour ne rien reconstruire à chaque frame.
let _rulesSig = null;
function updateRulesReminder(state) {
  const ul = els.sidebarRules;
  if (!ul) return;
  const rules = state.rules || {};
  const hasPowers = state.tokens.some(t => t.power);
  const sig = [rules.coverage, rules.oneTwo, rules.wings, rules.penaltySpot, hasPowers].join(',');
  if (sig === _rulesSig) return;
  _rulesSig = sig;

  const base = [
    "Déplace un pion d'une case, dans n'importe quelle direction.",
    "Adjacent au ballon ? Pousse-le en ligne droite aussi loin que tu veux.",
    "Le gardien glisse uniquement sur sa ligne de cage.",
    "Premier arrivé au nombre de buts fixé gagne la partie."
  ];
  const extra = [];
  if (rules.coverage) extra.push("Un défenseur adverse coupe les cases voisines : une passe ne les traverse pas (hachures rouges).");
  if (rules.oneTwo) extra.push("Une passe qui tombe à côté d'un coéquipier t'offre un déplacement bonus (une‑deux).");
  if (rules.wings) extra.push("Une passe partant d'une aile (colonne de bord) ignore la couverture adverse.");
  if (rules.penaltySpot) extra.push("Depuis le point de penalty, ton tir transperce un défenseur (jamais le gardien).");
  if (hasPowers) extra.push("Un pion marqué ★ porte un pouvoir à usage unique.");

  ul.innerHTML = '';
  base.concat(extra).forEach((txt, i) => {
    const li = document.createElement('li');
    li.textContent = txt;
    if (i >= base.length) li.classList.add('rule-advanced');
    ul.appendChild(li);
  });

  if (els.rulesPalierBadge) {
    els.rulesPalierBadge.textContent = !rules.coverage
      ? 'Découverte'
      : (rules.wings || rules.penaltySpot ? 'Expert' : 'Classique');
  }
}

function render() {
  const lineupsByTeam = myResolvedLineup ? { bleu: myResolvedLineup } : null;
  renderBoard(els.boardGrid, gameState, lineupsByTeam);
  updateRulesReminder(gameState);
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
  // #210 : en mode puzzle, l'indice affiche l'objectif et les coups restants.
  if (puzzleModule?.isPuzzleActive()) { puzzleModule.updatePuzzleHint(); return; }
  // #207 : conseils désactivables pour les habitués.
  if (!hintsOn) { els.hintBar.textContent = ''; return; }
  if (gameState.gameOver) { els.hintBar.textContent = ''; return; }
  if (gameMode === 'ai' && gameState.turn === AI_TEAM) {
    els.hintBar.textContent = t('L\'ordinateur réfléchit…');
    return;
  }
  if (gameMode === 'online' && gameState.turn !== myTeam) {
    els.hintBar.textContent = t('En attente du coup de ton adversaire…');
    return;
  }
  // #207 : mouvements bonus (une-deux / Relais) — l'indice explique le bonus,
  // sinon le joueur ne comprend pas pourquoi c'est encore à lui de jouer.
  if (gameState.comboMoveAvailable) {
    els.hintBar.textContent = t('Une‑deux ! Déplace un pion pour ton mouvement bonus');
    return;
  }
  if (gameState.relaisBonusMoveAvailable) {
    els.hintBar.textContent = t('Relais ! Déplace un second pion');
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
  const canShow = token && canActivatePower(gameState, token) && !powersModule?.isTargeting();
  els.activatePowerBtn.classList.toggle('hidden', !canShow);
  if (canShow) {
    els.activatePowerBtn.textContent = t('Utiliser : {power}', { power: t(POWER_LABELS[token.power]) });
  }
}

// ---------- Interactions plateau ----------

// #260 — journalise une action moteur pour validation serveur (parties en
// ligne uniquement). Le journal est rejoué par l'Edge Function push-game-state
// sur l'état autoritaire ; voir multiplayerService.recordOnlineAction.
function recordIfOnline(fn, args = []) {
  if (gameMode === 'online') recordOnlineAction(fn, args);
}

function handleCellClick(row, col) {
  if (gameState.gameOver || aiThinking) return;
  if (gameMode === 'online' && gameState.turn !== myTeam) return;

  if (powersModule?.isTargeting()) {
    powersModule.handlePowerDestinationClick(row, col);
    return;
  }

  if (gameState.phase === PHASES.SELECT) {
    const tok = gameState.tokens.find(t => t.row === row && t.col === col);

    if (tok && tok.team === gameState.turn) {
      if (!gameState.selectedTokenId) {
        undoSnapshot = gameState; // snapshot avant le premier geste de ce tour
      }
      gameState = selectToken(gameState, tok.id);
      recordIfOnline('selectToken', [tok.id]);
      render();
      playSound('select'); // #209
      tutorialModule?.checkTutorialProgress('select-token', { tokenId: tok.id });
      return;
    }

    if (gameState.selectedTokenId) {
      const before = gameState;
      gameState = passBall(gameState, row, col);
      if (gameState !== before) {
        recordIfOnline('passBall', [row, col]);
        handlePostActionEffects(before);
        return;
      }
      gameState = moveSelectedToken(gameState, row, col);
      if (gameState !== before) {
        recordIfOnline('moveSelectedToken', [row, col]);
        handlePostActionEffects(before);
        return;
      }
      // Clic ailleurs sans coup valide -> désélection simple
      gameState = { ...gameState, selectedTokenId: null };
      recordIfOnline('deselect');
      render();
    }
  } else if (gameState.phase === PHASES.MOVED_CAN_PASS) {
    const before = gameState;
    gameState = passBall(gameState, row, col);
    if (gameState !== before) {
      recordIfOnline('passBall', [row, col]);
    } else {
      gameState = passTurn(gameState);
      recordIfOnline('passTurn');
    }
    handlePostActionEffects(before);
  }
}

function handlePostActionEffects(previousState) {
  // #208/#209 — le ballon a-t-il bougé (passe) ? Trajectoire animée + son, et
  // but différencié. Placé avant le reste pour couvrir tous les modes (y c. puzzle).
  const ballMoved = gameState.ball.row !== previousState.ball.row || gameState.ball.col !== previousState.ball.col;
  const scored = gameState.lastGoalBy && gameState.lastGoalBy !== previousState.lastGoalBy;
  if (ballMoved) {
    animateBallTravel(previousState.ball, gameState.ball);
    if (scored) {
      flashGoalBoard();
      playSound('goal');
      vibrate([40, 60, 120]);
    } else {
      playSound('pass');
    }
  }

  // #210 — le mode puzzle a sa propre boucle (pas d'IA, pas de but adverse,
  // décompte des coups, réussite/échec) et court-circuite le flux normal.
  if (puzzleModule?.isPuzzleActive()) { puzzleModule.handlePuzzleProgress(previousState); return; }

  if (gameState.lastGoalBy && gameState.lastGoalBy !== previousState.lastGoalBy) {
    render();
    onlineModule?.syncOnlineStateIfNeeded();

    if (tutorialModule?.isActive()) {
      // Pendant le tutoriel, on ne montre pas l'overlay "BUT !" standard :
      // l'étape "goal" du script prend le relais avec son propre message,
      // pour ne pas superposer deux systèmes de feedback différents.
      tutorialModule.checkTutorialProgress('goal-scored', {});
      return;
    }

    if (gameState.gameOver) {
      setTimeout(() => overlaysModule.showEndOverlay(gameState.winner), 350);
    } else {
      overlaysModule.showGoalOverlay(gameState.lastGoalBy);
    }
    return;
  }

  render();
  onlineModule?.syncOnlineStateIfNeeded();

  if (tutorialModule?.isActive()) {
    // Détecte si ce coup correspondait à l'étape "déplacement vers le ballon"
    // ou "passe" attendue par le script, sans dupliquer la logique du moteur.
    if (gameState.phase === PHASES.MOVED_CAN_PASS && previousState.phase === PHASES.SELECT) {
      tutorialModule.checkTutorialProgress('move-to', {});
    } else if (gameState.ball.row !== previousState.ball.row || gameState.ball.col !== previousState.ball.col) {
      tutorialModule.checkTutorialProgress('pass-ball', {});
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
  // NB : seul le format « Manche courte » (turnLimit) peut finir a egalite ; au
  // format « Au score », le premier a N buts gagne, aucun nul n'est possible.
  if (gameState.gameOver) {
    if (gameState.isDraw) {
      // #221 : on ANNONCE le departage, sinon la seance surgit sans explication.
      showToast(t('Égalité — départage aux tirs au but'));
      // Départage : second point d'entrée de la séance, sans clic — d'où le
      // ensureShootout() explicite (#324). Le chargement démarre tout de suite,
      // la temporisation de 450 ms le couvre presque toujours.
      setTimeout(() => { ensureShootout().then(m => m?.startShootoutDepartage()); }, 450);
    } else {
      setTimeout(() => overlaysModule.showEndOverlay(gameState.winner), 350);
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
    // #202 : applyAiTurn joue une action atomique — un pouvoir avantageux si
    // disponible (sauf niveau Facile), sinon un coup normal. Retourne l'état
    // inchangé s'il n'y a rien à jouer (on s'arrête alors sans reboucler).
    const next = applyAiTurn(gameState, aiLevel);
    aiThinking = false;
    if (next === before) {
      els.boardGrid.classList.remove('ai-thinking');
      return;
    }
    gameState = next;
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

// ---------- Publicité (bannière hors-jeu, épic pub PR C) ----------

// Initialise la pub TÔT (indépendamment du rendu d'une bannière) pour que le
// message de consentement Google apparaisse en EEE dès le chargement. Deux
// canaux, car le message peut être servi par l'un OU l'autre selon la config
// Google :
//   1. le script Funding Choices dédié (fundingchoicesmessages.google.com) ;
//   2. le TAG AdSense lui-même (adsbygoogle.js?client=…), qui sert le message
//      « Confidentialité et messages » d'AdSense.
// Le RENDU de la bannière reste différé (perf) ; ici on ne fait que charger les
// scripts. Rien si pub coupée, CMP non configuré, ou refus explicite. #26.
function initAdsEarly() {
  const ads = window.__PLATEAU_FOOT_CONFIG__?.ads || {};
  if (ads.enabled !== true) return;
  if (getAdvertisingConsent() === 'denied') return; // opt-out dur : rien
  if (ads.cmp?.enabled && ads.cmp?.publisherId) loadConsentMessaging(ads.cmp.publisherId);
  // Charge le tag AdSense au plus tôt (respecte le gating payant/consentement
  // en interne). Le message AdSense a besoin de ce tag présent sur la page.
  adService.initAds().catch(() => {});
}

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
  accountModule?.openAccountOverlay('signup');
}

function wireSetupScreen() {
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

  // #206 — palier de regles (Decouverte / Classique / Expert). Choisir un palier
  // applique aussi la variante et les pouvoirs RECOMMANDES (l'utilisateur peut
  // ensuite les ajuster librement dans les Options avancees).
  const setActive = (opts, val) => opts.forEach(o =>
    o.classList.toggle('active', o.dataset.val === val));
  const RULESET_HINTS = {
    decouverte: 'Découverte : règles minimales — déplacer, pousser le ballon, marquer. Idéal pour une première partie.',
    classique: 'Classique : couverture défensive et une‑deux. L’équilibre recommandé.',
    expert: 'Expert : ajoute les ailes, le point de penalty, les pouvoirs et la formation Tactique à 8 pions.'
  };
  const rulesetOpts = els.rulesetOptions ? els.rulesetOptions.querySelectorAll('.setup-option') : [];
  rulesetOpts.forEach(opt => {
    opt.addEventListener('click', () => {
      rulesetOpts.forEach(o => o.classList.remove('active'));
      opt.classList.add('active');
      selectedRuleset = opt.dataset.val;
      if (els.rulesetHint && RULESET_HINTS[selectedRuleset]) {
        els.rulesetHint.textContent = RULESET_HINTS[selectedRuleset];
      }
      const reco = RULESET_DEFAULTS[selectedRuleset];
      if (reco) {
        selectedVariant = reco.variant;
        freePowersOn = reco.powers;
        setActive(variantOpts, reco.variant);
        setActive(powersOpts, reco.powers ? 'on' : 'off');
      }
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

  // #207 — conseils contextuels en jeu (activés/désactivés), mémorisé.
  const hintsOpts = els.hintsOptions ? els.hintsOptions.querySelectorAll('.setup-option') : [];
  hintsOpts.forEach(opt => {
    opt.addEventListener('click', () => {
      hintsOpts.forEach(o => o.classList.remove('active'));
      opt.classList.add('active');
      hintsOn = opt.dataset.val === 'on';
    });
  });

  // #209 — sons & vibrations (opt-in). Le clic « Activés » est le geste qui
  // débloque l'AudioContext ; on joue un son de confirmation immédiat.
  const soundOpts = els.soundOptions ? els.soundOptions.querySelectorAll('.setup-option') : [];
  soundOpts.forEach(opt => {
    opt.addEventListener('click', () => {
      soundOpts.forEach(o => o.classList.remove('active'));
      opt.classList.add('active');
      soundOn = opt.dataset.val === 'on';
      setSoundEnabled(soundOn);
      if (soundOn) playSound('select');
    });
  });

  // #205 — mémorise l'état plié/déplié des Options avancées.
  els.advancedOptions?.addEventListener('toggle', () => {
    try { localStorage.setItem('tm_advancedOpen', els.advancedOptions.open ? '1' : '0'); } catch { /* stockage indispo */ }
  });

  els.startBtn.addEventListener('click', () => startGame(selectedGoals));

  // #204 — « Jouer » : démarre immédiatement avec les derniers réglages (ou des
  // défauts sains). L'online exige un code, donc on retombe sur vs IA.
  els.quickPlayBtn?.addEventListener('click', () => {
    if (!localStorage.getItem('tm_lastConfig')) gameMode = 'ai'; // 1re fois : solo vs IA
    if (gameMode === 'online') gameMode = 'ai';
    startGame(selectedGoals);
  });

  els.goToSetupBtn.addEventListener('click', () => {
    els.setupScreen.classList.add('hidden');
    els.configScreen.classList.remove('hidden');
    markRoute('jouer');
  });

  // #210 — Puzzle du jour, démarrage direct depuis l'accueil. Le bouton est
  // câblé dans le chargement paresseux (#324, lot 2), pas ici : contrairement
  // aux autres écrans, dailyPuzzleUI ne câble pas son propre bouton, donc c'est
  // à l'amorçage de poser l'écouteur avant de rejouer le clic.

  els.configBackBtn.addEventListener('click', () => {
    els.configScreen.classList.add('hidden');
    els.setupScreen.classList.remove('hidden');
    markRoute('accueil');
  });

  // Réglages : module extrait (#311). L'état reste dans main.js, le module ne
  // fait que le sérialiser et le refléter à l'écran.
  settingsModule = initSettings({
    els,
    setSoundEnabled,
    getSettings: () => ({
      gameMode, aiLevel, selectedRuleset, selectedVariant,
      freePowersOn, selectedFormat, selectedGoals, hintsOn, soundOn
    }),
    applySettings: p => {
      if (p.gameMode !== undefined) gameMode = p.gameMode;
      if (p.aiLevel !== undefined) aiLevel = p.aiLevel;
      if (p.selectedRuleset !== undefined) selectedRuleset = p.selectedRuleset;
      if (p.selectedVariant !== undefined) selectedVariant = p.selectedVariant;
      if (p.freePowersOn !== undefined) freePowersOn = p.freePowersOn;
      if (p.selectedFormat !== undefined) selectedFormat = p.selectedFormat;
      if (p.selectedGoals !== undefined) selectedGoals = p.selectedGoals;
      if (p.hintsOn !== undefined) hintsOn = p.hintsOn;
      if (p.soundOn !== undefined) soundOn = p.soundOn;
    }
  });

  // Restaure les derniers réglages et les reflète dans l'écran de config.
  settingsModule.restoreLastConfig();
  settingsModule.applyConfigToUI();
}

// #259 — garde-fou anti mis-clic : une partie en cours ne meurt jamais sans
// confirmation. Pas de dialogue si la partie est absente ou finie, pendant le
// tutoriel (le quitter est déjà un acte volontaire guidé) ou en puzzle (le
// recommencer fait partie du jeu). En ligne, quitter vaut forfait : le message
// le dit explicitement avant l'appel à leaveOnlineSession().
async function confirmAbandonThen(proceed) {
  const playing = !!gameState && !gameState.winner
    && !els.gameScreen.classList.contains('hidden')
    && !(tutorialModule?.isActive()) && !puzzleModule?.isPuzzleActive();
  if (!playing) { proceed(); return; }
  const ok = await showConfirm(
    gameMode === 'online'
      ? t('Partie en ligne en cours : si tu quittes, ton adversaire gagne par forfait.')
      : t('Une partie est en cours. Elle sera perdue si tu quittes.'),
    { title: t('Abandonner la partie ?'), okLabel: t('Abandonner'), cancelLabel: t('Continuer la partie') }
  );
  if (ok) proceed();
}

// Réglages de partie : persistance et reflet dans l'UI extraits dans
// settingsUI.js (#311). L'état lui-même reste ici (lu dans ~30 endroits).

function wireGameControls() {
  // Bouton "← Accueil" dans l'overlay de fin de partie
  els.backToSetupFromEndBtn?.addEventListener('click', () => overlaysModule.backToSetup());
  els.cancelBtn.addEventListener('click', handleCancel);
  els.endTurnBtn.addEventListener('click', handleEndTurnClick);
  els.restartBtn.addEventListener('click', () => confirmAbandonThen(() => overlaysModule.backToSetup()));
  els.continueBtn.addEventListener('click', () => overlaysModule.hideGoalOverlayAndResume());
  els.newGameBtn.addEventListener('click', () => overlaysModule.backToSetup());
  els.watchRewardedBtn?.addEventListener('click', handleWatchRewarded);
}

// Récompense vidéo opt-in. IMPORTANT : le client ne crédite RIEN. Il affiche
// la vidéo (via adService), en passant son user_id comme custom_data ; c'est
// Google qui, après vérification, appellera l'Edge Function rewarded-ssv, seule
// habilitée à créditer (migration 0036). Ici, après la vue, on se contente de
// re-lire le solde — qui aura été mis à jour côté serveur par le SSV.
async function handleWatchRewarded() {
  if (!currentUser) return;
  const btn = els.watchRewardedBtn;
  if (btn) { btn.disabled = true; }
  trackRewardedOptIn(); // KPI : taux d'opt-in (gated analytics)
  try {
    const { completed } = await adService.showRewarded({ userId: currentUser.id });
    trackRewardedCompleted(completed); // KPI : taux de complétion
    if (completed) {
      // Laisse le temps au SSV de créditer côté serveur, puis rafraîchit.
      const balance = await getCurrencyBalance();
      accountModule?.updateCoinDisplay(balance);
      showToast(t('Récompense en cours de validation…'));
      if (btn) btn.classList.add('hidden'); // une seule récompense par écran de fin
    } else if (btn) {
      btn.disabled = false;
    }
  } catch {
    if (btn) btn.disabled = false;
  }
}

function handleEndTurnClick() {
  if (aiThinking) return;
  const before = gameState;
  gameState = passTurn(gameState);
  if (gameState !== before) recordIfOnline('passTurn');
  handlePostActionEffects(before);
}

// ---------- Boutique de thèmes ----------

// Toute la logique de la boutique (catalogue, achats, bundle Mondial) a
// été extraite vers shopUI.js (sprint dette technique) pour alléger ce
// fichier. wireShop() devient un simple pont qui fournit à shopUI les
// quelques éléments transverses dont il a besoin (compte, navigation
// d'écran), sans dupliquer aucun état.
function wireShop() {
  lazy(els.shopBtn, () => import('./shopUI.js').then(m => m.initShop({
    els,
    getCurrentUser: () => currentUser,
    updateCoinDisplay: balance => accountModule?.updateCoinDisplay(balance),
    openAccountForSignIn: () => accountModule?.openAccountOverlay('signin'),
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
  })));
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
  cacheDomRefs(els);
  initAdsEarly();

  // i18n : langue memorisee (fr par defaut), toggle FR|EN en haut a droite,
  // traduction initiale du DOM statique. Le contenu dynamique se re-render via
  // onLanguageChanged() a chaque changement.
  initLang();
  if (getLang() === 'en') ensureEnglishDict();
  const langHost = document.querySelector('.topbar-right');
  if (langHost) {
    const toggle = mountLangToggle(langHost, null);
    if (toggle) langHost.insertBefore(toggle, langHost.firstChild);
  }
  onLangChange(lang => {
    if (lang === 'en') ensureEnglishDict();
    onLanguageChanged();
  });
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
  // Overlays but/fin + navigation : module extrait (#21, lot 5). Toutes les
  // dépendances vers les autres modules sont des fermetures paresseuses :
  // l'ordre de création des modules dans init() n'a pas d'importance.
  overlaysModule = initOverlays({
    els,
    getUser: () => currentUser,
    getGameState: () => gameState,
    setGameState: s => { gameState = s; },
    getGameMode: () => gameMode,
    getMyTeam: () => myTeam,
    clearUndoSnapshot: () => { undoSnapshot = null; },
    render,
    maybeTriggerAiTurn,
    syncOnlineState: () => onlineModule?.syncOnlineStateIfNeeded(),
    leaveOnlineSession: () => onlineModule?.leaveOnlineSession(),
    recordOnlineAction: (fn, args) => recordIfOnline(fn, args),
    isTutorialActive: () => tutorialModule?.isActive() ?? false,
    updateCoinDisplay: b => accountModule?.updateCoinDisplay(b),
    showCoinGain: n => accountModule?.showCoinGain(n),
    maybeShowInterstitial,
    refreshHomeBanner
  });

  // Puzzle du jour : chargé au premier clic (#324, lot 2). Il possède son
  // propre état ; main.js ne fait que lui fournir les leviers qui touchent à
  // la partie en cours. `puzzleModule?.isPuzzleActive()` est déjà en chaînage
  // optionnel côté flux de jeu, et son no-op est correct avant chargement.
  lazy(els.dailyPuzzleBtn, () => import('./dailyPuzzleUI.js').then(m => {
  puzzleModule = m.initDailyPuzzle({
    els,
    getGameState: () => gameState,
    setGameState: s => { gameState = s; },
    setGameMode: m => { gameMode = m; },
    setMyTeam: team => { myTeam = team; },
    clearUndoSnapshot: () => { undoSnapshot = null; },
    clearLineup: () => { myResolvedLineup = null; },
    buildBoard: () => buildBoardGrid(els.boardGrid, handleCellClick),
    render,
    goToLanding: () => overlaysModule.goToLanding()
  });
  els.dailyPuzzleBtn.addEventListener('click', () => puzzleModule.startPuzzle());
  }));

  // Multijoueur en ligne : module extrait (#21, lot 4). La session Realtime
  // est la propriété du module ; gameState et myTeam restent dans main.js.
  onlineModule = initOnline({
    els,
    getGameMode: () => gameMode,
    getGameState: () => gameState,
    setGameState: s => { gameState = s; },
    setMyTeam: team => { myTeam = team; },
    handleCellClick,
    render
  });
  wireGameControls();
  wireShop();
  // Profil + mercato + avatars : chargés au premier clic sur « Mon profil »
  // (#324). Les trois partent ensemble parce qu'ils ne servent qu'à cet écran
  // et sont interdépendants — le mercato est un onglet du profil et reçoit
  // profileModule.loadTeamPanel, profileUI dessine les avatars.
  lazy(els.profileBtn, async () => {
  // paymentProvider part avec eux : `checkoutTheme` n'était importé
  // statiquement que pour être injecté ici, et aucun autre module du graphe de
  // boot ne l'importe (shopUI et shootoutUI sont eux-mêmes différés). Il entraîne
  // stripePaymentProvider hors du chemin critique.
  const [profileMod, mercatoMod, avatarMod, paiementMod] = await Promise.all([
    import('./profileUI.js'), import('./mercatoUI.js'), import('./playerAvatar.js'),
    import('../services/payment/paymentProvider.js')
  ]);
  const { initProfile, toOwnedShape } = profileMod;
  const { initMercato } = mercatoMod;
  const { renderAvatarSvg, hashSeedToAvatar, AVATAR_COLORS } = avatarMod;
  const { checkoutTheme } = paiementMod;

  const profileModule = initProfile({
    els,
    getCurrentUser: () => currentUser,
    openAccountOverlay: () => accountModule?.openAccountOverlay('signin'),
    checkoutTheme,
    renderAvatarSvg,
    hashSeedToAvatar,
    AVATAR_COLORS,
    POWER_LABELS,
    CUSTOM_PLAYER_SLOT_THEME_ID,
    ensureStarterPack,
    fetchMyProgress,
    getMyFounderStatus,
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
  // domaine en particulier. Le câblage des onglets se fait ici, donc APRÈS le
  // chargement — les onglets ne sont de toute façon atteignables qu'une fois
  // l'écran profil ouvert, ce qui suppose les deux modules chargés.
  els.profileTabs?.querySelectorAll('.profile-tab').forEach(tab => {
    tab.addEventListener('click', () => switchProfileTab(tab.dataset.tab, profileModule, mercatoModule));
  });
  });
  // Pouvoirs de pion : module extrait (#21, lot 6). Le mode ciblage lui
  // appartient ; l'état de partie reste dans main.js (get/set injectés).
  powersModule = initPowers({
    els,
    getGameState: () => gameState,
    setGameState: s => { gameState = s; },
    handlePostActionEffects,
    render,
    getMyTeam: () => myTeam,
    getMyResolvedLineup: () => myResolvedLineup
  });
  // Compte/auth/consentement : module extrait (#21, lot 2). currentUser reste
  // la propriété de main.js, le module y accède via getUser/setUser.
  accountModule = initAccount({
    els,
    getUser: () => currentUser,
    setUser: u => { currentUser = u; },
    refreshAdsForSession,
    refreshHomeBanner
  });
  // Tutoriel guidé : chargé au premier clic sur « Lancer le tutoriel guidé »
  // (#324, lot 2). Le module câble lui-même startTutorialBtn dans son init(),
  // donc l'amorçage rejoue le clic — même motif que la boutique.
  //
  // Le flux de jeu le consulte via `tutorialModule?.isActive()` et
  // `?.checkTutorialProgress(...)`. Ces appels sont DÉJÀ en chaînage optionnel,
  // et leur no-op est la bonne réponse tant que le module n'est pas chargé :
  // un tutoriel jamais démarré n'est pas actif, et il n'a aucune étape à
  // valider. Aucun de ces sites d'appel n'a eu besoin d'être touché.
  lazy(els.startTutorialBtn, () => import('./tutorialUI.js').then(m => {
  tutorialModule = m.initTutorial({
    els,
    getUser: () => currentUser,
    getGameState: () => gameState,
    setGameState: s => { gameState = s; },
    setGameMode: m => { gameMode = m; },
    clearUndoSnapshot: () => { undoSnapshot = null; },
    handleCellClick,
    render,
    backToSetup: () => overlaysModule.backToSetup(),
    openRealProfileTab: tab => {
      if (currentUser && profileModuleRef && mercatoModuleRef) {
        switchProfileTab(tab, profileModuleRef, mercatoModuleRef);
        return true;
      }
      return false;
    },
    refreshFounderBadge: () => profileModuleRef?.refreshFounderBadge()
  });
  }));
  // Tirs au but : chargé au premier clic (#324). Le module câble lui-même
  // homeShootoutBtn dans son init(), donc l'amorçage rejoue le clic.
  lazy(document.getElementById('homeShootoutBtn'), ensureShootout);
  // Règles & FAQ (M11 #252) : overlay autonome, contenu cloné de .seo-about.
  initFaq();
  const homeLogo = document.getElementById('homeLogoBtn');
  homeLogo?.addEventListener('click', () => confirmAbandonThen(() => overlaysModule.goToLanding()));
  homeLogo?.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); confirmAbandonThen(() => overlaysModule.goToLanding()); } });
  // La seance de tirs est un ecran plein : toute navigation vers un autre ecran
  // doit la masquer (sinon elle "resterait" affichee par-dessous).
  document.getElementById('shopBtn')?.addEventListener('click', () => els.shootoutScreen?.classList.add('hidden'));
  document.getElementById('profileBtn')?.addEventListener('click', () => els.shootoutScreen?.classList.add('hidden'));

  // ---------- #310 : routeur par hash ----------
  // Les écrans restent affichés par les modules existants ; le routeur ne fait
  // qu'écrire l'URL (markRoute) et rejouer la navigation au Retour du
  // navigateur. Aucune décision d'affichage ne lui appartient.
  els.shopBtn?.addEventListener('click', () => markRoute('boutique'));
  els.profileBtn?.addEventListener('click', () => markRoute('profil'));
  // Ce bouton n'est pas dans `els` : shootoutUI le câble par getElementById.
  document.getElementById('homeShootoutBtn')?.addEventListener('click', () => markRoute('tirs-au-but'));
  homeLogo?.addEventListener('click', () => markRoute('accueil'));

  router = initRouter({
    confirmLeaveGame: () => new Promise(resolve => {
      // confirmAbandonThen n'appelle son callback que si l'on confirme ; on
      // résout donc à false après coup si rien ne s'est passé.
      let confirmed = false;
      confirmAbandonThen(() => { confirmed = true; resolve(true); })
        .then(() => { if (!confirmed) resolve(false); });
    }),
    onNavigate: screen => {
      switch (screen) {
        case 'jouer':
          overlaysModule?.goToLanding();
          els.setupScreen?.classList.add('hidden');
          els.configScreen?.classList.remove('hidden');
          break;
        case 'boutique': els.shopBtn?.click(); break;
        case 'profil': els.profileBtn?.click(); break;
        // Lien profond #tirs-au-but : troisième entrée sans clic (#324).
        case 'tirs-au-but': ensureShootout().then(m => m?.openShootout()); break;
        // Une partie ne se restaure pas depuis une URL : son état n'est nulle
        // part dans le lien. On retombe sur l'accueil plutôt que d'afficher un
        // plateau vide, et on corrige l'URL pour qu'elle dise la vérité.
        case 'partie':
        case 'accueil':
        default:
          overlaysModule?.goToLanding();
          if (screen === 'partie') router?.go('accueil', { replace: true });
          break;
      }
    }
  });
  router.start();
  registerServiceWorker();
  handlePaymentReturn();
  installE2ETestSeam();

  // Pub : premier affichage de la bannière d'accueil (le gating décide s'il y
  // a réellement quelque chose à montrer). L'état « sans pub » sera affiné dès
  // que la session sera résolue (voir refreshAdsForSession dans wireAccount).
  // Perf (PR H) : différé à l'idle pour ne pas peser sur le LCP du premier
  // rendu — le chargement du SDK pub n'entre jamais dans le chemin critique.
  whenIdle(refreshHomeBanner);
}

// Seam de test E2E — JAMAIS actif en production. Gated par window.__TM_E2E__,
// positionné par le test Playwright AVANT le chargement (page.addInitScript) ;
// config.js ne touche pas ce drapeau, donc il survit à l'init. Permet d'exercer
// les vrais overlays but/fin de partie sans avoir à jouer une partie complète
// (non déterministe via l'UI) : le test force un état de jeu puis rejoue le même
// point d'entrée que le moteur (handlePostActionEffects). Aucune autorité serveur
// n'est en jeu — l'état local d'une partie hors-ligne n'a aucune valeur.
function installE2ETestSeam() {
  if (!window.__TM_E2E__) return;
  // #324 : sous ce drapeau UNIQUEMENT, on charge tout de suite les écrans
  // différés. Plusieurs specs attendent des hooks posés par leur init()
  // (window.__tmMercatoTest, par exemple) juste après page.goto('/') — les
  // faire tous cliquer d'abord rendrait les tests plus fragiles que le code
  // qu'ils protègent. En production le drapeau est absent : rien ne change.
  Promise.all(_lazyLoaders.map(load => load())).catch(() => {});
  window.__tmTest = {
    getState: () => gameState,
    setState: (patch) => { gameState = { ...gameState, ...patch }; return gameState; },
    applyPostEffects: (previous) => handlePostActionEffects(previous),
    // #259 — permet de constater le message de forfait du dialogue d'abandon
    // en mode en ligne sans monter deux clients + backend.
    setGameMode: (m) => { gameMode = m; },
    TEAMS,
    PHASES,
  };
}

// Exécute `fn` quand le navigateur est inactif, avec repli setTimeout.
function whenIdle(fn) {
  if (typeof requestIdleCallback === 'function') requestIdleCallback(() => fn(), { timeout: 2000 });
  else setTimeout(fn, 200);
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
    accountModule?.refreshAfterCheckout();
  } else if (checkoutResult === 'pass_success') {
    // Retour d'un abonnement Pass Saison (URL dédiée côté Edge Function).
    // L'activation passe par le webhook Stripe : elle peut prendre quelques
    // secondes — le message le dit pour éviter un rechargement paniqué.
    showPurchaseToast('🎫', t('Pass Saison activé ! (quelques secondes de délai possibles)'), false);
    els.shopBtn?.click();
    accountModule?.refreshAfterCheckout();
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
// Enregistré APRÈS l'événement load, jamais pendant (#324). L'installation du
// service worker déclenche `cache.addAll()` sur 66 fichiers : lancée depuis
// init() (DOMContentLoaded), elle doublait le nombre de requêtes en vol au pire
// moment, en concurrence avec les modules de la page et les scripts publicitaires.
// C'est le visiteur de PREMIÈRE visite qui payait — précisément celui qui n'a
// pas encore de cache à y gagner. Décaler ne retire rien au hors-ligne : le
// cache sera prêt bien avant la visite suivante.
function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  const go = () => navigator.serviceWorker.register('./sw.js').catch(err => {
    console.error('Service worker non enregistré :', err);
  });
  const afterLoad = () => {
    if (typeof requestIdleCallback === 'function') requestIdleCallback(go, { timeout: 3000 });
    else setTimeout(go, 1000);
  };
  if (document.readyState === 'complete') afterLoad();
  else window.addEventListener('load', afterLoad, { once: true });
}


document.addEventListener('DOMContentLoaded', () => {
  init();
});
