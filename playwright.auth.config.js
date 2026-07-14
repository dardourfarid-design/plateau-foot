import { defineConfig, devices } from '@playwright/test';

// Config Playwright dédiée aux E2E AUTHENTIFIÉS (#129). Séparée de la config
// principale car ces tests :
//   - visent un backend Supabase de TEST (jamais la prod) : le job CI réécrit
//     public/config.js avec TEST_SUPABASE_URL / TEST_SUPABASE_ANON_KEY avant
//     de lancer ;
//   - exigent un compte de test (E2E_USER / E2E_PASS).
// En l'absence de ces variables, les specs se sautent proprement.
export default defineConfig({
  testDir: './e2e/auth',
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: 'http://localhost:8080',
    trace: 'on-first-retry'
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'node tools/static-server.mjs public 8080',
    url: 'http://localhost:8080',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000
  }
});
