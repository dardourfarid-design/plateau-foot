import { defineConfig, devices } from '@playwright/test';

// Config Playwright pour les tests E2E (parcours critiques dans un vrai
// navigateur). Complète les tests unitaires du moteur (node tests/run-tests.js).
// Le serveur statique sert public/ à la racine, comme Vercel en prod.
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:8080',
    trace: 'on-first-retry'
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } }
  ],
  webServer: {
    command: 'node tools/static-server.mjs public 8080',
    url: 'http://localhost:8080',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000
  }
});
