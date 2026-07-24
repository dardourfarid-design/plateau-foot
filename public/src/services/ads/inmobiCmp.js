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

/** URL du script CMP : override de config, sinon format officiel InMobi (tag V3). */
export function cmpScriptUrl(cfg) {
  if (!cfg) return null;
  if (cfg.scriptUrl) return cfg.scriptUrl;
  if (!cfg.propertyId) return null;
  const host = (typeof location !== 'undefined' && location.hostname) || '';
  return `https://cmp.inmobi.com/choice/${encodeURIComponent(cfg.propertyId)}/${encodeURIComponent(host)}/choice.js?tag_version=V3`;
}

// ---- Stub TCF (repris du snippet officiel, transposé hors inline) ----------
//
// Le snippet InMobi installe ce stub AVANT choice.js. Deux rôles essentiels :
//   1. créer l'iframe `__tcfapiLocator`, que les SDK publicitaires tournant
//      DANS des iframes (GPT, IMA) recherchent pour dialoguer avec le CMP par
//      postMessage. Sans elle, la pub ne récupère pas le consentement.
//   2. mettre en file les appels émis avant le chargement du CMP : notre pont
//      s'abonne immédiatement, et choice.js rejoue la file à son arrivée.
//
// Transposé en JS de module car notre CSP interdit les <script> inline
// (pas de 'unsafe-inline') — même contrainte que pour googleCmp.js.
const TCF_LOCATOR_NAME = '__tcfapiLocator';

// Accès défensif : `frames` est garanti en navigateur, pas hors DOM, et une
// fenêtre parente cross-origin peut lever à la lecture.
function hasLocator(w) {
  try { return !!(w && w.frames && w.frames[TCF_LOCATOR_NAME]); } catch { return false; }
}

function addLocatorFrame() {
  // On passe par le `document` global (et non window.document) : c'est celui
  // que hasDom() valide, et les deux ne coïncident qu'en navigateur réel.
  const doc = typeof document !== 'undefined' ? document : null;
  if (!doc) return false;
  if (hasLocator(window)) return false; // un autre CMP est déjà là
  if (doc.body) {
    const iframe = doc.createElement('iframe');
    iframe.style.cssText = 'display:none';
    iframe.name = TCF_LOCATOR_NAME;
    doc.body.appendChild(iframe);
  } else {
    setTimeout(addLocatorFrame, 5); // body pas encore prêt
  }
  return true;
}

function makeTcfStub() {
  if (typeof window === 'undefined' || !hasDom()) return;

  // Si un locator existe déjà (autre CMP, ou page encadrée), on ne touche à rien :
  // deux CMP concurrents produiraient des chaînes TCF incohérentes.
  let win = window;
  while (win) {
    if (hasLocator(win)) return;
    if (win === window.top) break;
    win = win.parent;
  }

  const queue = [];
  let gdprApplies;

  function tcfAPIHandler(...args) {
    if (!args.length) return queue;             // drainage par choice.js
    if (args[0] === 'setGdprApplies') {
      if (args.length > 3 && args[2] === 2 && typeof args[3] === 'boolean') {
        gdprApplies = args[3];
      }
      return undefined;
    }
    if (args[0] === 'ping') {
      if (typeof args[2] === 'function') {
        args[2]({ gdprApplies, cmpLoaded: false, cmpStatus: 'stub' });
      }
      return undefined;
    }
    if (args[0] === 'init' && typeof args[3] === 'object') {
      args[3] = Object.assign(args[3], { tag_version: 'V3' });
    }
    queue.push(args);                            // rejoué au chargement du CMP
    return undefined;
  }

  // Relais postMessage : permet aux iframes publicitaires d'interroger le CMP.
  function postMessageEventHandler(event) {
    const msgIsString = typeof event.data === 'string';
    let json = {};
    try { json = msgIsString ? JSON.parse(event.data) : event.data; } catch { /* ignoré */ }
    const payload = json && json.__tcfapiCall;
    if (!payload) return;
    window.__tcfapi(payload.command, payload.version, (returnValue, success) => {
      let returnMsg = { __tcfapiReturn: { returnValue, success, callId: payload.callId } };
      if (msgIsString) returnMsg = JSON.stringify(returnMsg);
      if (event.source && event.source.postMessage) event.source.postMessage(returnMsg, '*');
    }, payload.parameter);
  }

  addLocatorFrame();
  window.__tcfapi = tcfAPIHandler;
  // Garde défensive : addEventListener manque dans un environnement partiel.
  if (typeof window.addEventListener === 'function') {
    window.addEventListener('message', postMessageEventHandler, false);
  }
}

// ---- Stub GPP (Global Privacy Platform) ------------------------------------
//
// choice.js d'InMobi appelle window.__gpp AVANT d'installer sa vraie
// implémentation ; sans stub, il lève « __gpp is not a function » (constaté en
// prod). On porte donc AUSSI le stub GPP du snippet officiel (locator + file
// d'attente + réponses minimales), même transposition hors inline que le TCF.
function makeGppStub() {
  if (typeof window === 'undefined' || !hasDom()) return;
  if ('__gpp' in window && typeof window.__gpp === 'function') return;

  const CMP_ID = 10;
  const SUPPORTED_APIS = [
    '2:tcfeuv2', '6:uspv1', '7:usnatv1', '8:usca',
    '9:usvav1', '10:uscov1', '11:usutv1', '12:usctv1'
  ];
  const pingData = () => ({
    gppVersion: '1.1', cmpStatus: 'stub', cmpDisplayStatus: 'hidden',
    signalStatus: 'not ready', supportedAPIs: SUPPORTED_APIS, cmpId: CMP_ID,
    sectionList: [], applicableSections: [-1], gppString: '', parsedSections: {}
  });

  function addGppFrame(name) {
    if (window.frames[name]) return;
    if (document.body) {
      const i = document.createElement('iframe');
      i.style.cssText = 'display:none';
      i.name = name;
      document.body.appendChild(i);
    } else {
      setTimeout(() => addGppFrame(name), 10);
    }
  }

  const gpp = function gppStub(...b) {
    const q = gpp; // porte la file/les events sur la fonction elle-même
    q.queue = q.queue || [];
    q.events = q.events || [];
    if (!b.length || (b.length === 1 && b[0] === 'queue')) return q.queue;
    if (b.length === 1 && b[0] === 'events') return q.events;

    const cmd = b[0];
    const clb = b.length > 1 ? b[1] : null;
    const par = b.length > 2 ? b[2] : null;

    if (cmd === 'ping') {
      clb(pingData(), true);
    } else if (cmd === 'addEventListener') {
      if (!('lastId' in q)) q.lastId = 0;
      q.lastId++;
      const id = q.lastId;
      q.events.push({ id, callback: clb, parameter: par });
      clb({ eventName: 'listenerRegistered', listenerId: id, data: true, pingData: pingData() }, true);
    } else if (cmd === 'removeEventListener') {
      let removed = false;
      for (let i = 0; i < q.events.length; i++) {
        if (q.events[i].id == par) { q.events.splice(i, 1); removed = true; break; }
      }
      clb({ eventName: 'listenerRemoved', listenerId: par, data: removed, pingData: pingData() }, true);
    } else if (cmd === 'hasSection') {
      clb(false, true);
    } else if (cmd === 'getSection' || cmd === 'getField') {
      clb(null, true);
    } else {
      q.queue.push([].slice.apply(b));
    }
  };

  function gppMsgHandler(event) {
    const msgIsString = typeof event.data === 'string';
    let json = null;
    try { json = msgIsString ? JSON.parse(event.data) : event.data; } catch { json = null; }
    if (typeof json !== 'object' || json === null || !('__gppCall' in json)) return;
    const i = json.__gppCall;
    window.__gpp(i.command, (returnValue, success) => {
      const returnMsg = { __gppReturn: { returnValue, success, callId: i.callId } };
      event.source.postMessage(msgIsString ? JSON.stringify(returnMsg) : returnMsg, '*');
    }, 'parameter' in i ? i.parameter : null, 'version' in i ? i.version : '1.1');
  }

  window.__gpp = gpp;
  if (typeof window.addEventListener === 'function') {
    window.addEventListener('message', gppMsgHandler, false);
  }
  addGppFrame('__gppLocator');
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

  // 1. Stubs AVANT le script : locators TCF + GPP en place, files ouvertes.
  //    choice.js interroge les deux ; sans le stub GPP il lève « __gpp is not
  //    a function » (constaté en prod).
  makeTcfStub();
  makeGppStub();

  // 2. Script distant du CMP (seul élément injecté : pas d'inline, cf. CSP).
  const s = document.createElement('script');
  s.id = SCRIPT_ID;
  s.async = true;
  s.src = url;
  s.setAttribute('data-tm-cmp', 'inmobi');
  document.head.appendChild(s);

  // 3. Abonnement au verdict. Grâce au stub, __tcfapi existe déjà : l'appel est
  // mis en file et rejoué par choice.js. whenTcfApiReady couvre le cas où le
  // stub a été volontairement omis (locator déjà présent).
  if (typeof window !== 'undefined' && typeof window.__tcfapi === 'function') {
    bridgeTcfConsent();
  } else {
    whenTcfApiReady(() => bridgeTcfConsent());
  }
  _loaded = true;
  return true;
}
