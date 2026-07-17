// ===================== SERVICE WORKER =====================
// Stratégie "network-first" : toujours essayer le réseau en premier, ne
// retomber sur le cache qu'en cas d'échec réseau (vraiment hors-ligne).
//
// Choix délibéré, différent d'un cache-first classique : pendant que ce
// projet est en développement actif avec des mises à jour fréquentes, un
// cache-first peut servir indéfiniment une ancienne version du jeu sans
// que rien (rechargement forcé inclus) ne le détecte — c'est exactement ce
// qui s'est produit ici. Network-first élimine ce risque : la version la
// plus récente est utilisée dès que le réseau répond, le cache ne sert
// que de filet de secours hors-ligne.
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
const CACHE_NAME = 'tactic-master-v22'; // v22 : overlay Règles & FAQ + cartes de modes du hero (M11 #252/#253)
const STATIC_ASSETS = [
  // './' ET './index.html' : le manifest a start_url "/" (#184) — sans
  // l'entrée './', une navigation hors-ligne vers / raterait le cache
  // (match exact sur l'URL de requête, pas de fallback navigation).
  './',
  './index.html',
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
  './src/engine/constants.js',
  './src/engine/gameEngine.js',
  './src/engine/penaltyShootoutV2.js',
  './src/engine/powers.js',
  './src/services/ads/abTest.js',
  './src/services/ads/adAnalytics.js',
  './src/services/ads/adProvider.js',
  './src/services/ads/adService.js',
  './src/services/ads/googleAdSenseProvider.js',
  './src/services/ads/googleCmp.js',
  './src/services/ads/interstitialFrequency.js',
  './src/services/ads/mockAdProvider.js',
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
  './src/ui/boardRenderer.js',
  './src/ui/dialogs.js',
  './src/ui/faqUI.js',
  './src/ui/i18n.js',
  './src/ui/i18n-en.js',
  './src/ui/main.js',
  './src/ui/mercatoUI.js',
  './src/ui/onlineUI.js',
  './src/ui/overlaysUI.js',
  './src/ui/playerAvatar.js',
  './src/ui/playerIdentity.js',
  './src/ui/powersUI.js',
  './src/ui/profileUI.js',
  './src/ui/shootoutUI.js',
  './src/ui/shopUI.js',
  './src/ui/themeManager.js',
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

  event.respondWith(
    fetch(event.request)
      .then(response => {
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseClone));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
