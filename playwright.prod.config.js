import { defineConfig, devices } from '@playwright/test';

// Config Playwright pour le SMOKE DE PRODUCTION : joue quelques parcours
// critiques ANONYMES contre le site de prod réel (aucune écriture backend).
// Contrairement à playwright.config.js, il n'y a AUCUN webServer local — on
// cible directement l'URL live. Déclenché à la demande (workflow_dispatch)
// via .github/workflows/prod-smoke.yml. Voir docs/regression-runbook.md.
const PROD_URL = process.env.PROD_URL || 'https://tactic-master.vercel.app';

// Garde-fou politique IT (2026-07-15) : le smoke prod pilote le site live,
// dont le navigateur appelle le backend Supabase — trafic interdit depuis les
// postes de travail. Exécution réservée aux runners GitHub Actions (CI=true) :
// workflow prod-smoke.yml (workflow_dispatch).
if (!process.env.CI) {
  throw new Error(
    'Smoke prod : exécution locale interdite (politique IT — trafic vers le backend Supabase). '
    + 'Utiliser GitHub Actions : workflow « prod-smoke » (déclenchement manuel).'
  );
}

export default defineConfig({
  testDir: './e2e-prod',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: PROD_URL,
    trace: 'on-first-retry'
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } }
  ]
  // Pas de webServer : la cible est la prod live.
});
