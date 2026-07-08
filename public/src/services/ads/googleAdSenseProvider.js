// ===================== GOOGLE ADSENSE PROVIDER =====================
// Implémentation réelle du contrat AdProvider pour Google AdSense.
// Épic monétisation publicitaire, activation (#25/#28).
//
// Ne gère QUE l'affichage : tout le gating (consentement, payant, kill switch,
// format) reste dans adService. Le consentement RGPD lui-même est géré par le
// CMP certifié Google (message « Confidentialité et messages » publié côté
// AdSense), qui se charge avec le script adsbygoogle et gère TCF.
//
// AdSense ne fournit nativement que le Display (bannières). Les interstitiels
// et les vidéos récompensées nécessitent d'autres unités (Auto ads / Ad
// Manager) : tant qu'elles n'existent pas, ces formats renvoient « indisponible »
// sans jamais bloquer le jeu.

const SCRIPT_SRC = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js';

export const isMock = false;

let _loaded = false;
let _loadingPromise = null;

function adsConfig() {
  if (typeof window === 'undefined') return {};
  return window.__PLATEAU_FOOT_CONFIG__?.ads || {};
}

// Le client AdSense (ca-pub-…) est stocké dans ads.cmp.publisherId.
function adsClient() {
  return adsConfig().cmp?.publisherId || null;
}

function bannerSlotId() {
  return adsConfig().slots?.banner || null;
}

function hasDom() {
  return typeof document !== 'undefined' && !!document.getElementById;
}

function loadScript(src) {
  if (_loadingPromise) return _loadingPromise;
  _loadingPromise = new Promise((resolve, reject) => {
    if (!hasDom()) { reject(new Error('no DOM')); return; }
    const s = document.createElement('script');
    s.async = true;
    s.src = src;
    s.crossOrigin = 'anonymous';
    s.onload = () => resolve(true);
    s.onerror = () => reject(new Error('adsbygoogle load failed'));
    document.head.appendChild(s);
  });
  return _loadingPromise;
}

export async function init(context) {
  if (_loaded) return true;
  const client = adsClient();
  if (!client) return false; // publisherId manquant : rien à charger
  try {
    // Le script embarque et déclenche aussi le CMP Google (Funding Choices)
    // configuré côté AdSense : c'est lui qui recueille le consentement TCF.
    await loadScript(`${SCRIPT_SRC}?client=${encodeURIComponent(client)}`);
    _loaded = true;
    return true;
  } catch {
    return false;
  }
}

export async function showBanner(slotElementId) {
  if (!_loaded && !(await init())) return false;
  if (!hasDom() || !slotElementId) return false;
  const container = document.getElementById(slotElementId);
  const client = adsClient();
  const adSlot = bannerSlotId();
  if (!container || !client || !adSlot) return false;

  // Réinjecte une unité fraîche (évite le « ins déjà rempli » d'AdSense au
  // retour sur l'écran d'accueil).
  container.innerHTML = '';
  const ins = document.createElement('ins');
  ins.className = 'adsbygoogle';
  ins.style.display = 'block';
  ins.setAttribute('data-ad-client', client);
  ins.setAttribute('data-ad-slot', adSlot);
  ins.setAttribute('data-ad-format', 'auto');
  ins.setAttribute('data-full-width-responsive', 'true');
  container.appendChild(ins);

  try {
    (window.adsbygoogle = window.adsbygoogle || []).push({});
    return true;
  } catch {
    return false;
  }
}

export function hideBanner(slotElementId) {
  if (!hasDom() || !slotElementId) return;
  const container = document.getElementById(slotElementId);
  if (container) container.innerHTML = '';
}

export async function showInterstitial() {
  // Pas d'unité interstitielle AdSense configurée (nécessite Auto ads / une
  // unité dédiée). On ne bloque jamais le jeu.
  return { shown: false };
}

export async function showRewarded() {
  // Le rewarded passe par Google Ad Manager + SSV, pas par AdSense Display.
  return { completed: false, reason: 'no-rewarded-unit' };
}

export function destroy() {
  // Le script AdSense reste chargé (global) ; on ne retire que les unités
  // affichées, fait au cas par cas via hideBanner.
}
