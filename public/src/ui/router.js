// ===================== ROUTEUR PAR HASH (#310) =====================
// Le jeu est une SPA « pauvre » : chaque écran est un <div class="hidden">
// basculé en JS, sans que l'URL bouge jamais. Conséquence directe : le bouton
// Retour du navigateur SORT DU SITE au lieu de revenir à l'écran précédent.
// Sur mobile, le geste de retour est le geste de navigation principal — c'est
// une perte de session directe, donc un problème d'acquisition autant que de
// confort.
//
// CE MODULE NE DÉCIDE RIEN. Il ne connaît ni les écrans ni leurs règles : il
// traduit dans les deux sens entre une route (chaîne) et l'historique du
// navigateur. C'est l'appelant (main.js) qui sait comment afficher un écran.
//
// POURQUOI DES HASH ET PAS DES CHEMINS
// Des chemins (/boutique) exigeraient une réécriture serveur pour que chaque
// URL renvoie index.html. Les hash fonctionnent sur n'importe quel hébergement
// statique, ne créent aucune URL indexable concurrente de l'accueil, et
// n'interfèrent pas avec les vraies pages du site (/blog, /terms).
//
// Bénéfice secondaire : des URLs par écran rendent les écrans distinguables
// dans Plausible (#49). Aujourd'hui tout le trafic est agrégé sur une seule
// page et on ne sait pas quels écrans sont réellement visités.

/** Routes connues. La valeur est le nom logique d'écran passé à onNavigate. */
const ROUTES = Object.freeze({
  '': 'accueil',
  '#accueil': 'accueil',
  '#jouer': 'jouer',
  '#partie': 'partie',
  '#boutique': 'boutique',
  '#profil': 'profil',
  '#tirs-au-but': 'tirs-au-but'
});

const HASH_BY_SCREEN = Object.freeze({
  accueil: '',
  jouer: '#jouer',
  partie: '#partie',
  boutique: '#boutique',
  profil: '#profil',
  'tirs-au-but': '#tirs-au-but'
});

/**
 * Traduit un hash en nom d'écran. Un hash inconnu retombe sur l'accueil plutôt
 * que d'afficher un écran vide : un lien partagé mal recopié doit atterrir
 * quelque part de sensé.
 * @param {string} hash
 * @returns {string}
 */
export function screenForHash(hash) {
  return ROUTES[hash || ''] || 'accueil';
}

/** Hash canonique d'un écran ('' pour l'accueil). */
export function hashForScreen(screen) {
  return HASH_BY_SCREEN[screen] ?? '';
}

/**
 * Initialise le routeur.
 *
 * @param {object} deps
 * @param {(screen: string) => void} deps.onNavigate  affiche l'écran demandé.
 *        Appelé au démarrage (lien profond) et à chaque Retour/Avancer.
 * @param {() => Promise<boolean>} [deps.confirmLeaveGame]  consulté avant de quitter une
 *        partie en cours ; résoudre à false laisse le joueur sur sa partie.
 * @param {Window} [deps.win]  injectable pour les tests.
 * @returns {{ go: (screen: string, opts?: {replace?: boolean}) => void,
 *             current: () => string, start: () => void }}
 */
export function initRouter({ onNavigate, confirmLeaveGame, win } = {}) {
  const w = win || (typeof window !== 'undefined' ? window : null);
  // On exige `location` ET `history`, pas seulement l'existence de `window` :
  // plusieurs suites de tests posent un `globalThis.window = {}` minimal pour
  // faire tourner des modules UI sous Node. Se fier au seul `typeof window`
  // ferait planter le routeur sur `location.hash` dans ce cas — et, en
  // production, dans tout contexte incomplet (certains WebViews embarqués).
  if (!w || !w.location || !w.history) {
    // Contexte non navigateur : routeur inerte plutôt que plantage.
    return { go() {}, current: () => 'accueil', start() {} };
  }

  // Écran considéré comme affiché. Sert à ne pas réagir à nos propres
  // changements de hash, et à savoir d'où l'on vient sur un popstate.
  let currentScreen = screenForHash(w.location.hash);

  /**
   * Navigue vers un écran ET écrit l'historique. À appeler depuis l'UI quand
   * l'utilisateur change d'écran.
   */
  function go(screen, { replace = false } = {}) {
    if (!HASH_BY_SCREEN[screen]) return;
    if (screen === currentScreen) return;

    const hash = hashForScreen(screen);
    const url = hash || w.location.pathname + w.location.search;
    try {
      if (replace) w.history.replaceState({ screen }, '', url);
      else w.history.pushState({ screen }, '', url);
    } catch {
      // history indisponible (contextes exotiques, file://) : on continue sans
      // historique plutôt que de casser la navigation.
    }
    currentScreen = screen;
  }

  // Retour / Avancer du navigateur.
  async function onPopState() {
    const target = screenForHash(w.location.hash);
    if (target === currentScreen) return;

    // Quitter une partie en cours doit être confirmé : le Retour est un geste
    // réflexe sur mobile, et perdre une partie par accident est bien plus
    // agaçant que de confirmer.
    //
    // La confirmation est ASYNCHRONE (modale) alors que popstate a déjà eu
    // lieu : on ne peut pas l'annuler en la refusant. On remet donc tout de
    // suite l'entrée « partie » dans l'historique — ce qui annule de fait le
    // retour — puis on ne repart en arrière que si l'utilisateur accepte.
    if (currentScreen === 'partie' && confirmLeaveGame) {
      try {
        w.history.pushState({ screen: 'partie' }, '', hashForScreen('partie'));
      } catch { /* sans effet */ }

      const ok = await confirmLeaveGame();
      if (!ok) return;

      try {
        w.history.replaceState({ screen: target }, '',
          hashForScreen(target) || w.location.pathname + w.location.search);
      } catch { /* sans effet */ }
    }

    currentScreen = target;
    onNavigate?.(target);
  }

  /**
   * Démarre le routeur : applique la route initiale (lien profond) et branche
   * l'écoute. Séparé du constructeur pour que l'appelant finisse de câbler son
   * UI avant qu'un onNavigate ne soit déclenché.
   */
  function start() {
    w.addEventListener('popstate', onPopState);
    const initial = screenForHash(w.location.hash);
    // replaceState et non pushState : la première entrée d'historique ne doit
    // pas créer un Retour vers elle-même.
    try {
      w.history.replaceState({ screen: initial }, '',
        hashForScreen(initial) || w.location.pathname + w.location.search);
    } catch { /* sans effet */ }
    currentScreen = initial;
    if (initial !== 'accueil') onNavigate?.(initial);
  }

  return { go, current: () => currentScreen, start };
}
