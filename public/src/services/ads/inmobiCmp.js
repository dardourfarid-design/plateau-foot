// ===================== CMP INMOBI (ex-Quantcast Choice) =====================
// CMP certifié Google + IAB TCF, indépendant d'AdSense. Retenu parce que la
// diffusion Google en EEE/UK/Suisse EXIGE un CMP certifié depuis janvier 2024 :
// sans chaîne de consentement, GameMonetize (qui sert via GPT/IMA) ne remplit
// rien — constaté en production.
//
// UN SEUL CMP À LA FOIS. Faire cohabiter deux CMP (celui-ci + Funding Choices
// de Google) produit deux bandeaux et des chaînes TCF concurrentes. Ce CMP
// couvre AUSSI le futur AdSense : quand il sera validé, on ne rallume PAS
// Funding Choices — le routage reste sur 'inmobi' (voir cmpProvider.js).
//
// CSP : le snippet officiel embarque un <script> inline (le stub __tcfapi),
// interdit par notre CSP (pas de 'unsafe-inline'). Comme pour googleCmp.js, on
// n'injecte donc QUE le script distant ; les appels précoces sont couverts en
// attendant l'apparition de __tcfapi plutôt que par un stub.
//
// L'URL exacte du script est fournie par le tableau de bord InMobi et peut
// varier selon le compte : elle est donc CONFIGURABLE (ads.cmp.inmobi.scriptUrl)
// plutôt que devinée — un domaine erroné coûterait un blocage CSP silencieux
// de plus. À défaut, on retombe sur le format documenté.

import { bridgeTcfConsent } from './tcfConsent.js';

const SCRIPT_ID = 'inmobi-cmp';

// Le CMP installe __tcfapi de façon asynchrone : on l'attend au lieu de
// supposer qu'il est déjà là au moment du branchement.
const TCFAPI_POLL_MS = 250;
const TCFAPI_TIMEOUT_MS = 15000;

let _loaded = false;

function hasDom() {
  return typeof document !== 'undefined' && !!document.createElement;
}

/** URL du script CMP : override de config, sinon format documenté InMobi. */
export function cmpScriptUrl(cfg) {
  if (!cfg) return null;
  if (cfg.scriptUrl) return cfg.scriptUrl;
  if (!cfg.propertyId) return null;
  const host = (typeof location !== 'undefined' && location.hostname) || '';
  return `https://cmp.inmobi.com/choice/${encodeURIComponent(cfg.propertyId)}/${encodeURIComponent(host)}/choice.js`;
}

/** Attend l'apparition de window.__tcfapi puis branche le pont de consentement. */
function whenTcfApiReady(onReady, timeoutMs = TCFAPI_TIMEOUT_MS) {
  if (typeof window === 'undefined') return;
  const started = Date.now();
  const tick = () => {
    if (typeof window.__tcfapi === 'function') { onReady(); return; }
    if (Date.now() - started >= timeoutMs) return; // CMP absent/bloqué : on renonce
    setTimeout(tick, TCFAPI_POLL_MS);
  };
  tick();
}

/**
 * Charge le CMP InMobi et relie son verdict au signal interne. Idempotent.
 * @param {{ propertyId?: string, scriptUrl?: string }} cfg
 * @returns {boolean} true si le chargement a été (ou est déjà) lancé.
 */
export function loadInMobiCmp(cfg) {
  if (_loaded) return true;
  if (!hasDom()) return false;
  const url = cmpScriptUrl(cfg);
  if (!url) return false; // pas d'identifiant : aucun CMP (échec propre)

  const s = document.createElement('script');
  s.id = SCRIPT_ID;
  s.async = true;
  s.src = url;
  s.setAttribute('data-tm-cmp', 'inmobi');
  document.head.appendChild(s);

  whenTcfApiReady(() => bridgeTcfConsent());
  _loaded = true;
  return true;
}
