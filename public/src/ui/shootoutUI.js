// ===================== SÉANCE DE TIRS AU BUT (UI v2) =====================
// Écran plein, branché sur le moteur penaltyShootoutV2 (6 zones + jauge de
// puissance/timing). Le joueur est toujours Bleu et TIRE ; l'IA (Rouge) tire
// seule (résultat résolu par le moteur, annoncé par un toast).
// Machine à états : ready → aim → power → shooting → result → (cpu) → over.
//
// Extrait de main.js (#21). Même pattern que initShop()/initProfile() :
// initShootout(deps) reçoit ses dépendances explicitement (objet els partagé,
// accès à l'utilisateur courant, ouverture du panneau de connexion) et
// retourne les points d'entrée que main.js orchestre (ouverture standalone,
// départage de fin de match).

import {
  createShootout, playerShoot, shootoutWinner, isShootoutOver,
  isSuddenDeath, readKeeperZone, randomSweet,
  cpuPlanShot, resolveCpuShot, cpuShootAgainstDive
} from '../engine/penaltyShootoutV2.js';
import { TEAMS } from '../engine/constants.js';
import { pickHouseAds } from '../services/ads/houseAds.js';
import { t } from './i18n.js';
import { showToast, showAlert } from './dialogs.js';
import { checkoutTheme } from '../services/payment/paymentProvider.js';
import { fetchMyPurchases } from '../services/supabaseClient.js';
import { ensureThemeFonts } from './lazyFonts.js';

// #228 — adversaire de la séance amicale, mémorisé d'une séance à l'autre.
// 'cpu' = ordinateur (avec niveau), 'human' = 2 joueurs sur le même écran.
let soOpponent = 'cpu';
let soDifficulty = 55;
const PK_ZONES = [
  { id: 'tl', x: 25, y: 30 }, { id: 'tc', x: 50, y: 26 }, { id: 'tr', x: 75, y: 30 },
  { id: 'bl', x: 25, y: 47 }, { id: 'bc', x: 50, y: 50 }, { id: 'br', x: 75, y: 47 },
];
const PK_BALL_REST = { x: 50, y: 79 };
const PK_KEEPER_REST = { x: 50, y: 40 };
const PK_CROWD_COLORS = ['#4f8cff', '#ff5b5b', '#9fb0cf'];

// Thèmes visuels de la séance. Stade est gratuit/défaut ; Néon/Cartoon/Manga
// sont monétisés (déverrouillage par possession, migration 0034).
const PK_THEMES = ['stade', 'neon', 'cartoon', 'manga'];
const PK_THEME_KEY = 'tm-pk-theme';
const PK_PAID_THEMES = ['neon', 'cartoon', 'manga'];
const PK_SKIN_PRICE_CENTS = 199;

/**
 * Initialise l'UI des tirs au but.
 * @param {object} deps
 * @param {object} deps.els            objet partagé de références DOM (main.js) ;
 *                                     le module y ajoute ses propres clés pk*.
 * @param {() => object|null} deps.getCurrentUser  utilisateur connecté ou null.
 * @param {() => void} deps.promptSignIn  ouvre l'overlay de connexion.
 * @returns {{ openShootout: () => void, startShootoutDepartage: () => void }}
 */
export function initShootout({ els, getCurrentUser, promptSignIn }) {

  let ownedPkSkins = new Set();
  let so = null;              // { phase, mode, engine, selectedZone, sweet, powerPct, dir, raf }
  let soCrowdBuilt = false;

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
    // #230 : un SEUL dessin par figure (SVG). La recolorisation par thème passe
    // désormais par un filtre CSS ([data-pk-theme] .pk-shooter img), au lieu de
    // 8 PNG teintés à la main — les thèmes payants restent différenciés.
  }

  // ---------- Monétisation des thèmes (Néon/Cartoon/Manga payants) ----------
  // Chaque thème payant correspond au produit `themes` d'id 'shootout-<thème>'
  // (migration 0034). La POSSESSION vient d'une ligne purchases 'completed',
  // exactement comme un thème de plateau. Stade est toujours débloqué.

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
    const currentUser = getCurrentUser();
    if (!currentUser) {
      showToast(t('Connecte-toi pour débloquer ce thème.'));
      promptSignIn();
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

    // #220 : la séance se lance depuis l'ACCUEIL, au même niveau que « Jouer »
    // (elle n'est plus enfouie dans l'écran de configuration).
    document.getElementById('homeShootoutBtn')?.addEventListener('click', openShootout);

    // #228 — choix de l'adversaire (Ordinateur + niveau, ou 2 joueurs).
    els.soOpponent = document.getElementById('soOpponent');
    els.soLevelOptions = document.getElementById('soLevelOptions');
    els.soLabelBleu = document.getElementById('soLabelBleu');
    els.soLabelRouge = document.getElementById('soLabelRouge');
    document.getElementById('soOpponentOptions')?.querySelectorAll('.setup-option').forEach(o => {
      o.addEventListener('click', () => {
        o.parentElement.querySelectorAll('.setup-option').forEach(x => x.classList.remove('active'));
        o.classList.add('active');
        soOpponent = o.dataset.val;
        if (so) { so.opponent = soOpponent; renderShootout(); }
      });
    });
    els.soLevelOptions?.querySelectorAll('.setup-option').forEach(o => {
      o.addEventListener('click', () => {
        els.soLevelOptions.querySelectorAll('.setup-option').forEach(x => x.classList.remove('active'));
        o.classList.add('active');
        soDifficulty = parseInt(o.dataset.val, 10);
        if (so && so.phase === 'ready') { so.engine = createShootout({ difficulty: soDifficulty }); renderShootout(); }
      });
    });
    els.pkCta?.addEventListener('click', pkOnCta);
    document.getElementById('shootoutReplayBtn')?.addEventListener('click', () => {
      // Départage : le match est joué, on rend la main à l'accueil. Amical : on relance une séance.
      if (so && so.mode === 'departage') { leaveShootout(); els.setupScreen.classList.remove('hidden'); }
      else openShootout();
    });
    document.getElementById('shootoutBackBtn')?.addEventListener('click', () => {
      // L'accueil est désormais le parent de la séance dans les deux modes.
      leaveShootout();
      els.setupScreen.classList.remove('hidden');
    });
  }

  function hideAllScreensForShootout() {
    ['setupScreen', 'configScreen', 'waitingScreen', 'gameScreen', 'shopScreen', 'profileScreen']
      .forEach(k => els[k] && els[k].classList.add('hidden'));
    els.endOverlay?.classList.remove('show');
    els.goalOverlay?.classList.remove('show');
  }

  /**
   * #231 — Remplit le panneau LED du stade avec notre PROPRE promo, adaptée au
   * joueur. Ce sont des messages maison : le projet garantit « aucune pub
   * pendant une partie », et une séance en est une. Si une vraie régie est un
   * jour décidée, c'est ce seul point d'entrée qui déléguera.
   */
  function renderHouseAds() {
    const cells = document.querySelectorAll('#pkLed .pk-led-cell');
    if (!cells.length) return;
    const ads = pickHouseAds({ signedIn: !!getCurrentUser() }, cells.length);
    cells.forEach((cell, i) => { cell.textContent = t(ads[i] || ''); });
  }

  function openShootout() { launchShootout('standalone', 'Séance de tirs au but'); }
  function startShootoutDepartage() { launchShootout('departage', 'Départage aux tirs au but'); }

  function launchShootout(mode, title) {
    // #228 : le départage hérite du contexte (toujours face à l'ordinateur, comme
    // la partie qu'il tranche) ; l'amical suit le choix fait à l'écran.
    const opponent = mode === 'departage' ? 'cpu' : soOpponent;
    so = {
      phase: 'ready', mode, opponent,
      engine: createShootout({ difficulty: soDifficulty }),
      selectedZone: null, sweet: 50, powerPct: 0, dir: 1, raf: null
    };
    if (els.shootoutTitle) els.shootoutTitle.textContent = t(title);
    hideAllScreensForShootout();
    // #309 — les polices des 4 thèmes de tirs au but ne sont plus dans le <head>
    // de l'accueil : on les demande ici, à l'ouverture de l'écran qui les
    // utilise. Idempotent, et volontairement AVANT applyPkTheme().
    ensureThemeFonts();
    els.shootoutScreen.classList.remove('hidden');
    renderHouseAds(); // #231
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
    if (!so) return;
    if (so.phase === 'dive') { pkDive(id); return; }   // #227 : le joueur plonge face au CPU
    if (so.phase === 'keeper') { pkKeeperPick(id); return; } // #228 : gardien humain
    if (so.phase !== 'aim') return;
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

    // #228 — en 2 joueurs, le gardien est humain : on masque la visée et on
    // passe la main à l'autre joueur (pass-and-play). Contre l'ordinateur, le
    // gardien « lit » le tir comme avant.
    if (so.opponent === 'human') {
      so.pendingShot = { zone: zone.id, power: so.powerPct, sweet: so.sweet };
      so.phase = 'keeper';
      renderShootout();
      return;
    }

    const keeperId = readKeeperZone(zone.id, so.engine.difficulty);
    so.engine = playerShoot(so.engine, { zone: zone.id, power: so.powerPct, sweet: so.sweet, keeperZone: keeperId });
    const outcome = so.engine.history[so.engine.history.length - 1].outcome;

    renderShootout();
    pkPlayShotAnimation(zone.id, keeperId, outcome === 'miss');
    setTimeout(() => pkShowResult(outcome), 660);
  }

  /** #228 — 2 joueurs : le gardien humain choisit son plongeon, puis on résout. */
  function pkKeeperPick(id) {
    if (!so || so.phase !== 'keeper' || !so.pendingShot) return;
    so.phase = 'shooting';
    const shot = { ...so.pendingShot, keeperZone: id };
    so.engine = playerShoot(so.engine, shot);
    const outcome = so.engine.history[so.engine.history.length - 1].outcome;
    so.pendingShot = null;
    renderShootout();
    pkPlayShotAnimation(shot.zone, id, outcome === 'miss');
    setTimeout(() => pkShowResult(outcome), 660);
  }

  /**
   * Chorégraphie d'un tir, partagée par les deux camps (#227) : le tireur frappe,
   * le gardien plonge dans `keeperZoneId`, le ballon file vers `zoneId` (ou en
   * dehors si le tir n'est pas cadré).
   */
  function pkPlayShotAnimation(zoneId, keeperZoneId, wide) {
    const zone = PK_ZONES.find(z => z.id === zoneId) || PK_ZONES[4];
    const kz = PK_ZONES.find(z => z.id === keeperZoneId) || PK_ZONES[4];
    els.pkShooter?.classList.add('kick');
    const ky = 40 + (kz.y < 38 ? -11 : 8);
    const krot = kz.x < 50 ? -44 : (kz.x > 50 ? 44 : 0);
    pkSetKeeper(kz.x, ky, krot);
    let bx = zone.x, by = zone.y;
    if (wide) { if (zone.x === 50) { by = 14; } else { bx = zone.x < 50 ? -8 : 108; by = zone.y - 3; } }
    pkSetBall(bx, by, wide ? 0.8 : 0.55);
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
      // #227 : la suite dépend de qui vient de tirer. Bleu (le joueur) -> on
      // enchaîne sur le tour adverse (plongeon) ; Rouge -> manche suivante.
      els.pkStage?.classList.remove('opponent-turn');
      pkNextTurn();
    }, 1600);
  }

  /**
   * Enchaîne le tour suivant selon le mode (#228) :
   *  - contre l'ordinateur, quand c'est à Rouge de tirer, le joueur plonge (#227) ;
   *  - sinon (Bleu, ou 2 joueurs), un humain tire : manche normale.
   */
  function pkNextTurn() {
    if (isShootoutOver(so.engine)) { pkEnd(); return; }
    pkResetScene();
    renderShootout();
    if (so.opponent === 'cpu' && so.engine.taker === TEAMS.ROUGE) {
      setTimeout(pkStartDive, 450);
    } else {
      setTimeout(pkStartRound, 450);
    }
  }

  /**
   * #227 — Tour adverse : le tir n'est plus tiré au dé puis résumé par un toast.
   * Le plan de tir (zone + cadrage) est décidé maintenant, MASQUÉ au joueur, qui
   * doit choisir où plonger. L'issue ne dépend donc plus que de sa lecture.
   */
  function pkStartDive() {
    so.phase = 'dive';
    // La difficulté est celle de la SÉANCE (#228), plus une constante globale :
    // l'ancienne SO_DIFFICULTY a été supprimée et la référence oubliée ici
    // faisait planter tout le tour adverse (séance figée après le 1er tir).
    so.cpuPlan = cpuPlanShot(so.engine.difficulty);
    so.selectedZone = null;
    pkResetScene();
    els.pkStage?.classList.add('opponent-turn');
    if (els.pkToast) {
      els.pkToast.textContent = t('Au tour de Rouge');
      els.pkToast.className = 'pk-toast show';
      setTimeout(() => els.pkToast?.classList.remove('show'), 900);
    }
    renderShootout();
  }

  /** Le joueur plonge dans `id` : on résout le tir adverse et on l'anime. */
  function pkDive(id) {
    if (!so || so.phase !== 'dive') return;
    so.selectedZone = id;
    so.phase = 'shooting';
    const outcome = resolveCpuShot(so.cpuPlan, id);
    so.engine = cpuShootAgainstDive(so.engine, so.cpuPlan, id);
    renderShootout();
    pkPlayShotAnimation(so.cpuPlan.zone, id, outcome === 'miss');
    setTimeout(() => pkShowResult(outcome), 660);
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
    // #228 : en 2 joueurs, on nomme qui doit agir (le duel est en pass-and-play).
    const twoP = so.opponent === 'human';
    const shooter = s.taker === TEAMS.BLEU ? t('Joueur 1') : t('Joueur 2');
    const keeper = s.taker === TEAMS.BLEU ? t('Joueur 2') : t('Joueur 1');
    if (phase === 'ready') return t('Prêt ? Choisis un coin et marque !');
    if (phase === 'aim') return twoP ? t('{who} tire — choisis ton coin', { who: shooter }) : t('À toi ! Touche un coin du but');
    if (phase === 'power') return t('Stoppe la jauge dans la zone verte');
    if (phase === 'keeper') return t('{who} : à toi de plonger !', { who: keeper }); // #228
    if (phase === 'dive') return t('Rouge tire — devine le coin et plonge !');       // #227
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

    // #228 : le choix de l'adversaire n'a de sens qu'avant le coup d'envoi, et
    // le niveau seulement face à l'ordinateur. Jamais en départage (hérité).
    const pickable = phase === 'ready' && so.mode !== 'departage';
    els.soOpponent?.classList.toggle('hidden', !pickable);
    // #229 : l'ambiance est un réglage d'avant-match — on la masque une fois la
    // séance lancée (elle encombrait la scène en permanence). Reste dispo en
    // départage, où l'adversaire est imposé mais le décor non.
    els.pkSwitcher?.classList.toggle('hidden', phase !== 'ready');
    els.soLevelOptions?.classList.toggle('hidden', so.opponent !== 'cpu');
    if (els.soLabelBleu) els.soLabelBleu.textContent = so.opponent === 'human' ? t('Joueur 1') : t('Toi');
    if (els.soLabelRouge) els.soLabelRouge.textContent = so.opponent === 'human' ? t('Joueur 2') : t('Ordinateur');

    // #227/#228 : zones cliquables pour viser (aim), plonger face au CPU (dive)
    // ou garder la cage en 2 joueurs (keeper).
    const keeping = phase === 'dive' || phase === 'keeper';
    els.pkZones?.classList.toggle('aim', phase === 'aim' || keeping);
    els.pkZones?.classList.toggle('dive', keeping);
    // En phase 'keeper', la visée du tireur DOIT rester masquée : le gardien est
    // assis devant le même écran.
    els.pkZones?.querySelectorAll('.pk-zone').forEach(z =>
      z.classList.toggle('selected', phase !== 'keeper' && z.dataset.zone === so.selectedZone));

    if (els.pkHint) els.pkHint.textContent = pkHintText(phase, s);
  }

  wireShootout();

  return { openShootout, startShootoutDepartage };
}
