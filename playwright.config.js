import { defineConfig, devices } from '@playwright/test';
import { readFileSync } from 'node:fs';

// Config Playwright pour les tests E2E (parcours critiques dans un vrai
// navigateur). Complète les tests unitaires du moteur (node tests/run-tests.js).
// Le serveur statique sert public/ à la racine, comme Vercel en prod.

// ---------- Garde-fou : aucun trafic backend depuis les E2E publics ----------
//
// Contrairement à playwright.auth.config.js et playwright.prod.config.js, cette
// config n'avait aucune garde. Elle sert pourtant public/ tel quel, donc avec
// les VRAIES clés de production de public/config.js — et accountUI appelle
// getCurrentUser() au démarrage.
//
// En pratique aucune requête ne partait, mais par CONJONCTION de deux
// propriétés, pas par décision : le SDK court-circuite getUser() quand aucune
// session n'est stockée, et Playwright ouvre un contexte neuf à chaque test.
// Trois changements anodins suffisaient à casser ça en silence : ajouter un
// storageState ici, sortir une spec de e2e/auth/, ou faire passer un futur
// écran par un appel non gaté.
//
// On rend donc l'invariant explicite : le navigateur ne peut pas RÉSOUDRE
// l'hôte du backend. Toute dépendance accidentelle échoue immédiatement et
// visiblement, au lieu de partir sur le réseau sans que personne ne le voie.
//
// Vaut aussi en CI : ces specs n'ont jamais besoin du backend. Les E2E qui en
// ont besoin vivent dans e2e/auth/ et ont leur propre config.
function backendHostFromConfig() {
  const cfg = readFileSync(new URL('./public/config.js', import.meta.url), 'utf8');
  const match = cfg.match(/supabaseUrl:\s*['"]https?:\/\/([^/'"]+)/);

  // Fail-closed : si l'hôte n'est pas extractible (config.js réorganisé,
  // renommage…), on refuse de lancer plutôt que de laisser passer du trafic
  // silencieusement. Un échec bruyant ici est infiniment moins coûteux qu'une
  // fuite réseau qu'on ne remarque pas.
  if (!match) {
    throw new Error(
      'E2E publics : impossible de déterminer l\'hôte du backend depuis public/config.js. '
      + 'Le blocage réseau ne peut pas être garanti — corriger l\'extraction avant de relancer.'
    );
  }
  return match[1];
}

// MAP <hôte> 127.0.0.1:9 → « discard », un port fermé : la connexion échoue
// tout de suite, sans DNS ni sortie réseau.
const blockBackend = `--host-resolver-rules=MAP ${backendHostFromConfig()} 127.0.0.1:9`;

export default defineConfig({
  testDir: './e2e',
  // Les E2E authentifiés (e2e/auth/) tournent séparément (playwright.auth.config.js)
  // car ils exigent un backend de TEST et une réécriture de config.js.
  testIgnore: '**/auth/**',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:8080',
    trace: 'on-first-retry',
    launchOptions: { args: [blockBackend] }
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } }
  ],
  webServer: {
    // TM_E2E_DIR=dist rejoue toute la suite contre la sortie MINIFIÉE, celle
    // qui part réellement en production. Sans ce commutateur, les E2E ne
    // testeraient que les sources : une casse introduite par la minification
    // n'apparaîtrait qu'en prod. Voir tools/build.mjs et le job « E2E sur le
    // build de production » de ci.yml.
    command: `node tools/static-server.mjs ${process.env.TM_E2E_DIR || 'public'} 8080`,
    url: 'http://localhost:8080',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000
  }
});
