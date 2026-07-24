// ===================== SERVICE WORKER =====================
// Stratégie "network-first BORNÉE" : toujours essayer le réseau en premier,
// mais ne pas l'attendre indéfiniment — au-delà de NETWORK_TIMEOUT_MS on sert
// le cache s'il existe, tout en laissant le réseau finir en tâche de fond pour
// rafraîchir ce cache. On ne retombe sur le cache qu'en cas d'échec réseau
// (vraiment hors-ligne) OU de réseau trop lent (#265).
//
// Choix délibéré, différent d'un cache-first classique : pendant que ce
// projet est en développement actif avec des mises à jour fréquentes, un
// cache-first peut servir indéfiniment une ancienne version du jeu sans
// que rien (rechargement forcé inclus) ne le détecte — c'est exactement ce
// qui s'est produit ici. Network-first élimine ce risque : la version la
// plus récente est utilisée dès que le réseau répond, le cache ne sert
// que de filet de secours hors-ligne ou de secours anti-latence.
//
// Ne met JAMAIS en cache les appels Supabase (auth, boutique, multijoueur,
// profil) : ces requêtes passent par un domaine externe (supabase.co) non
// intercepté ici, donc elles restent toujours en direct.

// v11 (#21 lot 3) : liste JS régénérée depuis le graphe d'imports statiques
// réel de src/ui/main.js (40 modules — ajout des modules extraits shootoutUI/
// accountUI/tutorialUI, des services ads/i18n manquants ; retrait des fichiers
// non importés au runtime : notificationService, mockPaymentProvider,
// PaymentProvider.contract). i18n-en.js est chargé dynamiquement (langue EN) :
// précaché aussi pour que le hors-ligne fonctionne dans les deux langues.
// À maintenir en même temps que la liste modulepreload d'index.html.
// NB : cette liste sert le HORS-LIGNE, pas le graphe de boot. Les modules
// chargés à la demande (shopUI, profileUI, ai.js…) y figurent AUSSI, sinon le
// jeu ne fonctionnerait plus hors connexion dès qu'on ouvre un de ces écrans.
// C'est pourquoi ai.js reste précaché alors qu'il a quitté le graphe statique.
// ⚠️ Le document HTML est mis en cache AVEC ses en-têtes de réponse : une CSP
// modifiée dans vercel.json reste donc masquée par l'ancienne version cachée
// tant que CACHE_NAME n'est pas bumpé. Toute évolution d'en-tête HTTP doit
// s'accompagner d'un bump ici (v37 → v38 : CSP élargie à GameMonetize/IMA).
const CACHE_NAME = 'tactic-master-v45'; // v45 : fondu de retour apres interstitiel

// #265 — au-delà de ce délai, un réseau qui n'a pas encore répondu est doublé
// par le cache (si présent). Le fetch réseau n'est PAS annulé : il poursuit et
// rafraîchit le cache, exactement comme avant. 3 s = seuil « réseau dégradé »
// (lie-fi) au-delà duquel l'attente coûte plus que le risque de servir une
// version d'un cycle en retard.
const NETWORK_TIMEOUT_MS = 3000;
const STATIC_ASSETS = [
  // Seulement './' : le manifest a start_url "/" (#184), et une navigation
  // hors-ligne vers / est servie par cette entrée (match exact sur l'URL, qui
  // vaut l'origine + '/'). On NE précache PAS './index.html' (#325) : cleanUrls
  // (vercel.json) le redirige en 308, donc l'entrée coûtait une requête suivie
  // en pure perte à chaque installation, et stockait une réponse redirigée —
  // qui ferait échouer respondWith si elle servait une navigation. './' suffit.
  './',
  './styles.css',
  './skins.css',
  './config.js',
  './vendor/supabase-js-2.110.1.js',
  './plausible-init.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  // #230 : 2 SVG au lieu de 8 PNG teintés (la couleur par thème est un filtre CSS).
  './img/shootout/keeper.png',
  './img/shootout/shooter.png',
  './img/ball.png',
  './src/engine/ai.js',
  './src/engine/aiLevels.js',
  './src/engine/constants.js',
  './src/engine/gameEngine.js',
  './src/engine/penaltyShootoutV2.js',
  './src/engine/powers.js',
  './src/services/ads/abTest.js',
  './src/services/ads/adAnalytics.js',
  './src/services/ads/adProvider.js',
  './src/services/ads/adService.js',
  './src/services/ads/cmpProvider.js',
  './src/services/ads/gameMonetizeProvider.js',
  './src/services/ads/googleAdSenseProvider.js',
  './src/services/ads/googleCmp.js',
  './src/services/ads/inmobiCmp.js',
  './src/services/ads/interstitialFrequency.js',
  './src/services/ads/mockAdProvider.js',
  './src/services/ads/rewardedGrant.js',
  './src/services/ads/tcfConsent.js',
  './src/services/advertisingConsentService.js',
  './src/services/analyticsConsentService.js',
  './src/services/consentService.js',
  './src/services/currencyService.js',
  './src/services/customPlayerService.js',
  './src/services/mercatoService.js',
  './src/services/multiplayerService.js',
  './src/services/passService.js',
  './src/services/payment/paymentProvider.js',
  './src/services/payment/stripePaymentProvider.js',
  './src/services/playerCollectionService.js',
  './src/services/progressService.js',
  './src/services/supabaseClient.js',
  './src/ui/accountUI.js',
  './src/ui/aiEngine.js',
  './src/ui/boardRenderer.js',
  './src/ui/dailyPuzzleUI.js',
  './src/ui/dialogs.js',
  './src/ui/domRefs.js',
  './src/ui/faqUI.js',
  './src/ui/i18n.js',
  './src/ui/lazyFonts.js',
  './src/ui/lazyScreen.js',
  './src/ui/i18n-en.js',
  './src/ui/main.js',
  './src/ui/mercatoUI.js',
  './src/ui/moveFeedback.js',
  './src/ui/onlineUI.js',
  './src/ui/inviteShare.js',
  './src/ui/matchSummary.js',
  './src/ui/overlaysUI.js',
  './src/ui/router.js',
  './src/ui/shareResult.js',
  './src/ui/playerAvatar.js',
  './src/ui/playerIdentity.js',
  './src/ui/powersUI.js',
  './src/ui/profileUI.js',
  './src/ui/shootoutUI.js',
  './src/ui/settingsUI.js',
  './src/ui/shopConstants.js',
  './src/ui/shopUI.js',
  './src/ui/themeManager.js',
  './src/ui/themeStorage.js',
  './src/ui/tutorial.js',
  './src/ui/tutorialUI.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  if (url.origin !== self.location.origin) {
    return;
  }

  event.respondWith(networkFirstBounded(event.request));
});

// #265 — network-first avec un plafond de latence. Trois issues :
//   1. le réseau répond avant le timeout  → on sert le réseau (et on met à jour
//      le cache) : comportement network-first inchangé ;
//   2. le réseau échoue (hors-ligne)      → repli cache immédiat, comme avant ;
//   3. le réseau traîne au-delà du seuil  → on sert le cache s'il existe, SANS
//      annuler le fetch : il aboutira et rafraîchira le cache pour la fois d'après.
// S'il n'y a pas de cache pour cette requête, on attend le réseau quoi qu'il
// arrive (mieux vaut une réponse lente que pas de réponse).
function networkFirstBounded(request) {
  const network = fetch(request).then(response => {
    const clone = response.clone();
    caches.open(CACHE_NAME).then(cache => cache.put(request, clone)).catch(() => { /* cache indispo */ });
    return response;
  });

  // Marqueur distinct d'une Response, pour reconnaître qui a gagné la course.
  const TIMED_OUT = Symbol('timeout');
  let timer;
  const timeout = new Promise(resolve => {
    timer = setTimeout(() => resolve(TIMED_OUT), NETWORK_TIMEOUT_MS);
  });

  // `network.catch` neutralise le rejet réseau dans la course (repli cache) tout
  // en enregistrant un handler : pas de rejet non géré si le timeout gagne.
  return Promise.race([network.catch(() => TIMED_OUT), timeout]).then(winner => {
    clearTimeout(timer);
    if (winner !== TIMED_OUT) return winner; // le réseau a gagné avec une vraie Response
    // Timeout OU échec réseau : on sert le cache si on l'a, sinon on attend le réseau.
    return caches.match(request).then(cached => cached || network);
  });
}
