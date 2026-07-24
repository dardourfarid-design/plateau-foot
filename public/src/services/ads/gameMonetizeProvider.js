// ===================== GAMEMONETIZE PROVIDER =====================
// Implémentation du contrat AdProvider (voir AdProvider.contract.js) pour la
// régie GameMonetize — retenue « en attendant AdSense » car elle n'impose aucun
// seuil de trafic et sert dès aujourd'hui de l'interstitiel et du rewarded sur
// jeu navigateur (eCPM jeu bien supérieur au Display AdSense générique).
//
// PÉRIMÈTRE : GameMonetize brille sur l'INTERSTITIEL (entre deux parties) et le
// REWARDED (vidéo opt-in). Ce n'est PAS une régie de bannière Display DOM :
// showBanner() renvoie donc false — les bannières hors-jeu restent servies par
// googleAdSenseProvider. Le routage par format est décidé dans adProvider.js.
//
// SÉCURITÉ DU CRÉDIT REWARDED : GameMonetize (SDK HTML5, socle GameDistribution)
// NE fournit PAS de postback S2S signé équivalent au SSV Google. Le signal
// « vue terminée » est un ÉVÉNEMENT NAVIGATEUR (SDK_REWARDED_WATCH_COMPLETE).
// Ce provider se contente donc de piloter l'affichage et de rapporter
// completed:true UNIQUEMENT sur cet événement. Il ne crédite JAMAIS : le crédit
// passe par le modèle nonce serveur (rewarded-begin / rewarded-complete +
// migration 0044), qui préserve l'invariant de 0026/0036 « le client n'écrit
// jamais le grand livre ». Voir rewardedGrant.js côté client.
//
// ACTIVATION : renseigner config.ads.gameMonetize.gameId (fourni par le tableau
// de bord GameMonetize après inscription du jeu), puis router interstitial et/ou
// rewarded vers 'gamemonetize' dans config.ads.providers et passer les flags de
// format à true. Sans gameId, init() échoue proprement (aucun SDK chargé).
//
// MÉTHODES SDK — VÉRIFIÉES avec un vrai gameId (build obfusqué courant) :
// window.sdk n'expose QUE showBanner() (play() est un no-op ; showAd/preloadAd
// n'existent pas). Une pub réelle a été observée avec cette séquence d'events
// (reçus par l'onEvent posé AVANT le chargement — voir plus bas) :
//   SDK_GAME_PAUSE → [STARTED … COMPLETE] → SDK_GAME_START
// L'interstitiel utilise donc showBanner() + ces deux bornes. Le REWARDED se
// distingue par l'événement SDK_REWARDED_WATCH_COMPLETE, émis UNIQUEMENT si
// l'inventaire rewarded est activé pour ce jeu côté dashboard GameMonetize ;
// sans lui, completed reste false → aucun crédit indu (le joueur ne voit qu'un
// interstitiel). En local, seul l'interstitiel a pu être observé.
//
// IMPORTANT (vérifié) : le SDK MÉMORISE window.SDK_OPTIONS.onEvent AU CHARGEMENT
// et ignore toute réassignation ultérieure. On installe donc l'aiguilleur
// définitif (onSdkEvent) AVANT d'insérer le script, et on ne le remplace jamais.

const SCRIPT_SRC = 'https://api.gamemonetize.com/sdk.js';
const SCRIPT_ID = 'gamemonetize-sdk';

// Un affichage ne doit jamais suspendre le jeu indéfiniment si le SDK n'émet
// pas l'événement de fin attendu (no-fill silencieux, bloqueur). Large pour
// couvrir une vidéo rewarded longue (les vues observées durent ~10-15 s).
const AD_TIMEOUT_MS = 45000;

// GARDE-FOU ANTI-ÉCRAN NOIR (constaté en production). Le SDK insère un
// conteneur plein écran `#sdk__advertisement_slot` au fond NOIR *avant* de
// savoir s'il aura une pub à y mettre. En cas de no-fill (pas de consentement
// TCF, domaine non approuvé, inventaire vide), il ne le retire JAMAIS : la
// vidéo reste sans source et le joueur est bloqué sur un écran noir définitif.
// On ne peut pas compter sur le SDK pour nettoyer — on le fait nous-mêmes.
// Délai laissé à une vraie pub pour démarrer (démarrage observé : < 1 s).
const FILL_TIMEOUT_MS = 6000;
const AD_SLOT_ID = 'sdk__advertisement_slot';

export const isMock = false;

let _sdk = null;
let _readyPromise = null;

// Résolveurs des affichages en cours. Le SDK est piloté par événements (onEvent) ;
// on relie chaque appel showX à une promesse résolue par l'événement de fin.
let _pendingInterstitial = null;
let _pendingRewarded = null;

function adsConfig() {
  if (typeof window === 'undefined') return {};
  return window.__PLATEAU_FOOT_CONFIG__?.ads || {};
}

function gameId() {
  return adsConfig().gameMonetize?.gameId || null;
}

function hasDom() {
  return typeof document !== 'undefined' && !!document.getElementById;
}

// ---- Garde-fou anti-écran noir -------------------------------------------

function adSlotEl() {
  return hasDom() ? document.getElementById(AD_SLOT_ID) : null;
}

/**
 * Une VRAIE pub est-elle en train de jouer ? On se fie à l'état observable de
 * la vidéo plutôt qu'aux seuls événements du SDK : en no-fill, la balise reste
 * sans source (readyState 0) et en pause — signature exacte de l'écran noir.
 */
function adIsPlaying() {
  if (!hasDom()) return false;
  const v = document.querySelector(`#${AD_SLOT_ID} video`) || document.getElementById('imaVideo');
  return !!(v && !v.paused && v.currentTime > 0);
}

/**
 * Masque le conteneur du SDK. La pub étant TERMINÉE à ce stade (fin détectée ou
 * no-fill), on adoucit le retour au jeu par un fondu court (règle UX de
 * continuité spatiale) plutôt qu'un cut brutal du plein écran. `prefers-reduced-
 * motion` ou absence de matchMedia → masquage direct. Réversible via restoreAdSlot.
 */
function prefersReducedMotion() {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function hideAdSlot() {
  const el = adSlotEl();
  if (!el) return;
  if (prefersReducedMotion()) { el.style.display = 'none'; return; }
  el.style.transition = 'opacity 220ms ease';
  // Reflow forcé : fige l'état de départ (opacity 1) AVANT de passer à 0, sinon
  // le navigateur applique les deux dans le même recalcul et saute l'animation.
  void el.offsetHeight;
  el.style.opacity = '0';
  const done = () => {
    el.style.display = 'none';
    el.style.transition = '';
    el.removeEventListener('transitionend', done);
  };
  el.addEventListener('transitionend', done);
  setTimeout(done, 300); // filet si transitionend ne se déclenche pas (idempotent)
}

/** Réaffiche le conteneur (il a pu être masqué/estompé par un affichage précédent). */
function restoreAdSlot() {
  const el = adSlotEl();
  if (!el) return;
  el.style.display = '';
  el.style.opacity = '';
  el.style.transition = '';
}

// ---- Indicateur de chargement (#367 UX : « loading-states ») --------------
// Pendant la fenêtre de chargement, le conteneur du SDK est un rectangle NOIR
// vide — perçu comme un plantage. On y insère un libellé « Publicité en cours… »
// accessible, RETIRÉ dès qu'une vraie pub joue. Insertion en PREMIER enfant du
// conteneur : l'iframe pub, ajoutée ensuite par le SDK, se dessine PAR-DESSUS —
// l'indicateur ne masque donc jamais une pub servie (aucun risque viewability).
const LOADING_HINT_CLASS = 'tm-ad-loading';
const LOADING_STYLE_ID = 'tm-ad-loading-style';

function ensureLoadingStyle() {
  if (!hasDom() || document.getElementById(LOADING_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = LOADING_STYLE_ID;
  // style-src 'unsafe-inline' est autorisé par la CSP → keyframes inline OK.
  style.textContent =
    `.${LOADING_HINT_CLASS}{position:absolute;inset:0;display:flex;flex-direction:column;` +
    `align-items:center;justify-content:center;gap:14px;background:#0C0A07;` +
    `color:rgba(242,232,213,.72);font:600 14px/1.4 'Barlow Condensed',system-ui,sans-serif;` +
    `letter-spacing:.08em;text-transform:uppercase;z-index:0}` +
    `.${LOADING_HINT_CLASS} i{width:26px;height:26px;border-radius:50%;` +
    `border:3px solid rgba(200,132,26,.25);border-top-color:#C8841A;` +
    `animation:tm-ad-spin .8s linear infinite}` +
    `@keyframes tm-ad-spin{to{transform:rotate(360deg)}}` +
    `@media (prefers-reduced-motion:reduce){.${LOADING_HINT_CLASS} i{animation:none}}`;
  document.head.appendChild(style);
}

/** Insère l'indicateur de chargement dans le conteneur (idempotent). */
function ensureLoadingHint() {
  const slot = adSlotEl();
  if (!slot || slot.querySelector(`.${LOADING_HINT_CLASS}`)) return;
  ensureLoadingStyle();
  const hint = document.createElement('div');
  hint.className = LOADING_HINT_CLASS;
  hint.setAttribute('role', 'status');
  hint.setAttribute('aria-live', 'polite');
  hint.innerHTML = '<i aria-hidden="true"></i><span>Publicité en cours…</span>';
  slot.insertBefore(hint, slot.firstChild); // derrière l'iframe pub à venir
}

/** Retire l'indicateur de chargement (sûr si absent). */
function removeLoadingHint() {
  const slot = adSlotEl();
  const hint = slot && slot.querySelector(`.${LOADING_HINT_CLASS}`);
  if (hint) hint.remove();
}

/**
 * Moniteur d'affichage. GameMonetize NE nettoie PAS son conteneur noir tout
 * seul, et émet SDK_GAME_START très tardivement après la fin visuelle de la
 * vidéo (constaté : 20-30 s d'écran sombre). On ne dépend donc PAS de cet
 * événement : on observe l'état réel de la vidéo et on solde l'affichage dès
 * que la situation est tranchée. Trois issues :
 *   - NO-FILL : aucune pub n'a démarré avant FILL_TIMEOUT_MS → il n'y a pas
 *     d'inventaire, on retire le conteneur.
 *   - FIN     : une pub a démarré PUIS ne joue plus (deux relevés consécutifs,
 *     pour ignorer une micro-pause de buffering) → la pub est finie.
 *   - FILET   : au-delà de AD_TIMEOUT_MS on tranche quoi qu'il arrive.
 * Retourne une fonction d'annulation (deux minuteurs à libérer).
 */
function armAdMonitor(onDone) {
  const POLL_MS = 300; // assez court pour un indicateur réactif (< 300 ms perçu)
  let started = false;
  let misses = 0;
  let elapsed = 0;

  const interval = setInterval(() => {
    elapsed += POLL_MS;
    if (adIsPlaying()) { started = true; misses = 0; removeLoadingHint(); return; }
    if (!started) {
      // Fenêtre de remplissage : on montre « Publicité en cours… » puis, si rien
      // n'a démarré à temps, no-fill.
      ensureLoadingHint();
      if (elapsed >= FILL_TIMEOUT_MS) { cancel(); onDone('no-fill'); }
      return;
    }
    // A démarré puis s'est arrêté : fin de pub, confirmée sur 2 relevés (~600 ms).
    if (++misses >= 2) { cancel(); onDone('ended'); }
  }, POLL_MS);

  const hardStop = setTimeout(() => { cancel(); onDone('timeout'); }, AD_TIMEOUT_MS);

  function cancel() { clearInterval(interval); clearTimeout(hardStop); }
  return cancel;
}

// Aiguillage central des événements SDK vers les affichages en attente.
// Les noms d'événements suivent le socle GameMonetize/GameDistribution ; ils
// sont regroupés ici pour être ajustables en un seul endroit si besoin.
function onSdkEvent(event) {
  const name = event && event.name;
  if (!name) return;
  switch (name) {
    case 'SDK_READY':
      _sdk = (typeof window !== 'undefined' && window.sdk) || _sdk;
      break;
    // Une vraie pub va s'afficher : on note qu'un inventaire a bien été servi.
    case 'SDK_GAME_PAUSE':
      if (_pendingInterstitial) _pendingInterstitial.sawAd = true;
      break;
    // Fin de la pub (reprise du jeu) : on solde l'affichage en cours, qu'il
    // s'agisse d'un interstitiel ou d'un rewarded (même borne de fin).
    case 'SDK_GAME_START':
      if (_pendingInterstitial) _pendingInterstitial.settle({ shown: !!_pendingInterstitial.sawAd });
      if (_pendingRewarded) _pendingRewarded.settle();
      break;
    // Rewarded regardé jusqu'au bout : SEUL signal qui autorise une récompense.
    case 'SDK_REWARDED_WATCH_COMPLETE':
      if (_pendingRewarded) _pendingRewarded.completed = true;
      break;
    default:
      break;
  }
}

function loadScript() {
  if (_readyPromise) return _readyPromise;
  _readyPromise = new Promise((resolve, reject) => {
    if (!hasDom()) { reject(new Error('no DOM')); return; }
    if (document.getElementById(SCRIPT_ID)) { resolve(true); return; }

    // Le SDK lit sa config dans window.SDK_OPTIONS AVANT que le script se charge.
    window.SDK_OPTIONS = {
      gameId: gameId(),
      onEvent(event) {
        try { onSdkEvent(event); } catch { /* un handler ne doit jamais casser le SDK */ }
        if (event && event.name === 'SDK_READY') resolve(true);
      }
    };

    const s = document.createElement('script');
    s.id = SCRIPT_ID;
    s.async = true;
    s.src = SCRIPT_SRC;
    s.onerror = () => reject(new Error('gamemonetize sdk load failed'));
    const first = document.getElementsByTagName('script')[0];
    if (first && first.parentNode) first.parentNode.insertBefore(s, first);
    else document.head.appendChild(s);
  });
  return _readyPromise;
}

export async function init() {
  if (_sdk) return true;
  if (!gameId()) return false; // pas de gameId : rien à charger (échec propre)
  try {
    await loadScript();
    // SDK_READY a normalement déjà exposé window.sdk ; on le récupère au cas où.
    if (!_sdk && typeof window !== 'undefined') _sdk = window.sdk || null;
    return !!_sdk;
  } catch {
    return false;
  }
}

// GameMonetize ne fait pas de bannière Display DOM : ce format reste à AdSense.
export async function showBanner() {
  return false;
}

export function hideBanner() {
  // Aucun rendu de bannière côté GameMonetize : rien à retirer.
}

// Interstitiel entre deux parties. Résolu par les événements pause→start ;
// dégrade en { shown:false } au timeout (jamais de blocage du retour au menu).
export async function showInterstitial() {
  if (!_sdk && !(await init())) return { shown: false };
  if (_pendingInterstitial) return { shown: false }; // un seul à la fois
  if (!_sdk || typeof _sdk.showBanner !== 'function') return { shown: false };

  return new Promise((resolve) => {
    let done = false;
    const finish = (res) => {
      if (done) return;
      done = true;
      cancelMonitor();
      // Le conteneur noir ne doit jamais survivre à la résolution.
      removeLoadingHint();
      if (!adIsPlaying()) hideAdSlot();
      _pendingInterstitial = null;
      resolve(res);
    };
    // Le moniteur solde dès que la vidéo est finie (indépendant du tardif
    // SDK_GAME_START, cause des 20-30 s d'écran sombre).
    const cancelMonitor = armAdMonitor((reason) => finish({ shown: reason === 'ended' }));
    _pendingInterstitial = { sawAd: false, settle: finish };
    try {
      restoreAdSlot(); // un no-fill précédent a pu masquer le conteneur
      _sdk.showBanner();
    } catch {
      finish({ shown: false });
    }
  });
}

// Vidéo récompensée (opt-in). completed:true UNIQUEMENT sur
// SDK_REWARDED_WATCH_COMPLETE. Ne crédite rien (voir en-tête) : le crédit passe
// par le modèle nonce serveur. `context` est ignoré ici (aucun S2S côté régie).
export async function showRewarded() {
  if (!_sdk && !(await init())) return { completed: false, reason: 'init-failed' };
  if (_pendingRewarded) return { completed: false, reason: 'busy' };
  if (!_sdk) return { completed: false, reason: 'no-sdk' };

  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      cancelMonitor();
      removeLoadingHint();
      if (!adIsPlaying()) hideAdSlot();
      const completed = !!(_pendingRewarded && _pendingRewarded.completed);
      _pendingRewarded = null;
      resolve({ completed });
    };
    const cancelMonitor = armAdMonitor(finish);
    _pendingRewarded = { completed: false, settle: finish };
    restoreAdSlot();

    // Ce build n'a que showBanner(). completed ne devient true que si
    // SDK_REWARDED_WATCH_COMPLETE est émis pendant la pub (inventaire rewarded
    // activé côté dashboard) ; sinon la reprise (SDK_GAME_START) solde à
    // completed:false, sans crédit. La résolution passe par onSdkEvent —
    // JAMAIS par une réassignation de onEvent (ignorée par le SDK).
    try {
      if (typeof _sdk.showBanner === 'function') _sdk.showBanner();
      else finish();
    } catch {
      finish();
    }
  });
}

export function destroy() {
  // Le SDK reste chargé (global) ; on annule seulement les affichages en attente.
  if (_pendingInterstitial) { _pendingInterstitial.settle({ shown: false }); }
  if (_pendingRewarded) { _pendingRewarded.settle(); }
}
