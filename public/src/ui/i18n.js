// ===================== INTERNATIONALISATION (i18n) =====================
// Systeme de traduction leger, sans dependance. Francais par defaut, anglais
// en option, permutable via le toggle FR|EN en haut a droite.
//
// Modele "source francaise" : la cle de traduction EST le texte francais.
//  - Le JS appelle t('Texte francais', {var}) - lisible tel quel, traduit a la
//    volee en anglais.
//  - applyTranslations()/startAutoTranslate() traduisent le DOM statique et
//    dynamique par correspondance du texte francais (aucune annotation HTML
//    necessaire). Les paragraphes multi-lignes sont toleres (espaces normalises).
//  - Dictionnaire unique Francais -> Anglais (DICT.en). Entree absente => repli
//    sur le francais (jamais de "undefined" a l'ecran).
//  - Choix persiste dans localStorage. Defaut = francais (pas d'auto-detection).

const STORAGE_KEY = 'tm_lang';
export const SUPPORTED_LANGS = ['fr', 'en'];
let current = 'fr';
const listeners = new Set();

// Dictionnaire Francais -> Anglais. Rempli par ./i18n-en.js (registerMessages).
export const DICT = { en: {} };

/** Ajoute/complete des entrees de traduction anglaises (cle = texte francais). */
export function registerMessages(enMap = {}) {
  Object.assign(DICT.en, enMap);
}

export function getLang() { return current; }

/** Initialise la langue depuis l'URL (?lang=) puis localStorage (defaut fr).
 *  A appeler au boot. Le parametre URL gagne et persiste : la landing /en/
 *  (#183) renvoie vers /?lang=en pour demarrer l'app en anglais. */
export function initLang() {
  let lang = 'fr';
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (SUPPORTED_LANGS.includes(saved)) lang = saved;
  } catch (_) { /* stockage indisponible : on reste en fr */ }
  try {
    const fromUrl = new URLSearchParams(window.location.search).get('lang');
    if (SUPPORTED_LANGS.includes(fromUrl) && fromUrl !== lang) {
      lang = fromUrl;
      try { window.localStorage.setItem(STORAGE_KEY, lang); } catch (_) { /* ignore */ }
    }
  } catch (_) { /* pas d'URL exploitable (tests noeud) : on garde lang */ }
  current = lang;
  if (typeof document !== 'undefined' && document.documentElement) {
    document.documentElement.lang = lang;
  }
  return lang;
}

function substitute(str, vars) {
  if (!vars) return str;
  let s = str;
  for (const k in vars) s = s.split('{' + k + '}').join(String(vars[k]));
  return s;
}

// Recherche une traduction anglaise, en tolerant les differences d'espaces.
function lookupEn(fr) {
  let en = DICT.en[fr];
  if (en === undefined) en = DICT.en[fr.replace(/\s+/g, ' ')];
  return en;
}

/** Traduit un texte francais dans la langue courante, avec substitution {var}. */
export function t(fr, vars) {
  if (fr == null) return '';
  if (current === 'fr') return substitute(fr, vars);
  const en = lookupEn(fr);
  return substitute(en !== undefined ? en : fr, vars);
}

/** S'abonne aux changements de langue (pour re-render le contenu dynamique). */
export function onLangChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Change la langue, persiste, reapplique au DOM et notifie les abonnes. */
export function setLang(lang) {
  if (!SUPPORTED_LANGS.includes(lang) || lang === current) return;
  current = lang;
  try { window.localStorage.setItem(STORAGE_KEY, lang); } catch (_) { /* ignore */ }
  if (typeof document !== 'undefined' && document.documentElement) {
    document.documentElement.lang = lang;
  }
  applyTranslations(typeof document !== 'undefined' ? document : null);
  listeners.forEach(fn => { try { fn(lang); } catch (_) { /* isole les abonnes */ } });
}

const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'SVG', 'TEXTAREA', 'CODE', 'NOSCRIPT']);
const I18N_ATTRS = ['placeholder', 'aria-label', 'title'];

function translateTextNode(n, lang) {
  const frBase = n.__i18nFr !== undefined ? n.__i18nFr : n.nodeValue;
  const trimmed = frBase.trim();
  if (!trimmed) return;
  if (lang === 'en') {
    const en = lookupEn(trimmed);
    if (en === undefined) return;
    if (n.__i18nFr === undefined) n.__i18nFr = n.nodeValue;
    n.nodeValue = n.nodeValue.replace(trimmed, en);
  } else if (n.__i18nFr !== undefined) {
    n.nodeValue = n.__i18nFr;
  }
}

function translateTextNodes(root, lang) {
  if (typeof document === 'undefined' || !document.createTreeWalker) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      let el = node.parentNode;
      while (el) {
        if (el.nodeType === 1 && SKIP_TAGS.has(el.tagName)) return NodeFilter.FILTER_REJECT;
        el = el.parentNode;
      }
      return NodeFilter.FILTER_ACCEPT;
    }
  });
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach(n => translateTextNode(n, lang));
}

function translateAttributes(root, lang) {
  if (!root.querySelectorAll) return;
  const sel = I18N_ATTRS.map(a => '[' + a + ']').join(',');
  root.querySelectorAll(sel).forEach(el => {
    I18N_ATTRS.forEach(attr => {
      if (!el.hasAttribute(attr)) return;
      const store = '__i18n_' + attr;
      const frBase = el[store] !== undefined ? el[store] : el.getAttribute(attr);
      const trimmed = frBase.trim();
      if (!trimmed) return;
      if (lang === 'en') {
        const en = lookupEn(trimmed);
        if (en === undefined) return;
        if (el[store] === undefined) el[store] = el.getAttribute(attr);
        el.setAttribute(attr, en);
      } else if (el[store] !== undefined) {
        el.setAttribute(attr, el[store]);
      }
    });
  });
}

/** Applique/retire les traductions a tout le contenu statique sous root. */
export function applyTranslations(root) {
  const scope = root || (typeof document !== 'undefined' ? document : null);
  if (!scope) return;
  translateTextNodes(scope, current);
  translateAttributes(scope, current);
}

// Traduction automatique du contenu insere dynamiquement.
let _observer = null;
export function startAutoTranslate() {
  if (_observer || typeof MutationObserver === 'undefined' || typeof document === 'undefined') return;
  _observer = new MutationObserver(mutations => {
    if (current === 'fr') return;
    for (const m of mutations) {
      m.addedNodes.forEach(node => {
        if (node.nodeType === 1) {
          translateTextNodes(node, current);
          translateAttributes(node, current);
        } else if (node.nodeType === 3) {
          translateTextNode(node, current);
        }
      });
    }
  });
  _observer.observe(document.body, { childList: true, subtree: true });
}

/** Construit et branche le toggle FR|EN dans container. Retourne l'element. */
export function mountLangToggle(container, onChange) {
  if (!container) return null;
  const wrap = document.createElement('div');
  wrap.className = 'lang-toggle';
  wrap.setAttribute('role', 'group');
  wrap.setAttribute('aria-label', 'Language / Langue');
  SUPPORTED_LANGS.forEach(lang => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'lang-opt' + (lang === current ? ' active' : '');
    btn.dataset.lang = lang;
    btn.textContent = lang.toUpperCase();
    btn.addEventListener('click', () => {
      if (lang === current) return;
      setLang(lang);
      wrap.querySelectorAll('.lang-opt').forEach(o =>
        o.classList.toggle('active', o.dataset.lang === lang));
      if (typeof onChange === 'function') onChange(lang);
    });
    wrap.appendChild(btn);
  });
  container.appendChild(wrap);
  return wrap;
}
