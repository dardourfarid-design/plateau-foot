// ===================== A/B TESTING (pub) =====================
// Épic monétisation publicitaire, PR H (issue #33).
//
// Assignation de variante DÉTERMINISTE et STABLE par client : un même
// utilisateur voit toujours la même variante d'une expérience (sinon les
// mesures sont ininterprétables et l'UX papillonne). Aucune donnée
// personnelle : un identifiant client aléatoire opaque en localStorage.
//
// Sert notamment à tester la fréquence des interstitiels et l'activation de
// placements sans redéploiement (les variantes sont décrites en config).

const CLIENT_ID_KEY = 'tm_client_id_v1';

function makeStore() {
  try {
    if (typeof localStorage !== 'undefined') {
      const probe = '__tm_probe_ab__';
      localStorage.setItem(probe, '1');
      localStorage.removeItem(probe);
      return localStorage;
    }
  } catch { /* indisponible → mémoire */ }
  const mem = new Map();
  return {
    getItem: k => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => mem.set(k, String(v))
  };
}

const store = makeStore();

function randomId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'c-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/** Identifiant client stable (créé au premier appel), opaque et non personnel. */
export function getClientId() {
  let id = store.getItem(CLIENT_ID_KEY);
  if (!id) { id = randomId(); store.setItem(CLIENT_ID_KEY, id); }
  return id;
}

// Hash déterministe simple (FNV-1a 32 bits) → entier non signé.
function hash(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Bucket stable 0..99 pour une expérience donnée (client + nom d'expérience).
 * Permet des rollouts pourcentés (« 10 % des joueurs »).
 */
export function bucket(experiment, clientId = getClientId()) {
  return hash(`${clientId}::${experiment}`) % 100;
}

/**
 * Choisit une variante stable parmi `options` pour une expérience. Répartition
 * uniforme et déterministe. Renvoie `options[0]` si la liste est vide/invalide.
 */
export function pick(experiment, options, clientId = getClientId()) {
  if (!Array.isArray(options) || options.length === 0) return undefined;
  const idx = hash(`${clientId}::${experiment}`) % options.length;
  return options[idx];
}
