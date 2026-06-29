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

const CACHE_NAME = 'tactic-master-v2'; // incrémenté pour invalider l'ancien cache v1 chez les utilisateurs déjà installés
const STATIC_ASSETS = [
  './index.html',
  './styles.css',
  './config.js',
  './manifest.json',
  './src/engine/constants.js',
  './src/engine/gameEngine.js',
  './src/engine/ai.js',
  './src/engine/undoManager.js',
  './src/ui/main.js',
  './src/ui/boardRenderer.js',
  './src/ui/themeManager.js',
  './src/ui/tutorial.js',
  './src/ui/playerIdentity.js',
  './src/ui/playerAvatar.js'
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
