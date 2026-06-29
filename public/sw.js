// ===================== SERVICE WORKER =====================
// Cache uniquement les fichiers statiques (HTML/CSS/JS/icônes) pour que
// l'app s'installe et se relance rapidement, y compris hors-ligne pour
// l'écran d'accueil et le jeu local/IA (qui ne dépendent pas du réseau).
//
// Ne met JAMAIS en cache les appels Supabase (auth, boutique, multijoueur,
// profil) : ces requêtes passent toutes par des domaines externes
// (supabase.co) non interceptés ici, donc elles restent toujours fraîches
// et fonctionnent normalement dès que le réseau est disponible.

const CACHE_NAME = 'tactic-master-v1';
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

  // Ne jamais intercepter les appels vers des domaines externes (Supabase,
  // CDN de polices/scripts) — uniquement le cache-first sur nos propres
  // fichiers statiques, servis depuis la même origine que l'app.
  if (url.origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseClone));
        return response;
      }).catch(() => cached);
    })
  );
});
