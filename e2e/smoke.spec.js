import { test, expect } from './fixtures.js';

// Tests E2E « fumée » : parcours critiques dans un vrai navigateur. Volontairement
// robustes (sélecteurs par id stables, pas de dépendance à un compte — le jeu est
// jouable sans compte). Objectif : détecter toute casse majeure (erreur JS au
// chargement, modules ES cassés, navigation entre écrans rompue) à chaque PR.

test('l\'accueil se charge sans erreur JS', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto('/');
  await expect(page).toHaveTitle(/Tactic Master/);
  await expect(page.locator('.logo-title')).toContainText('TACTIC');
  await expect(page.locator('#goToSetupBtn')).toBeVisible();

  expect(errors, `erreurs page: ${errors.join(' | ')}`).toHaveLength(0);
});

test('« Jouer » mène à l\'écran de configuration', async ({ page }) => {
  await page.goto('/');
  await page.locator('#goToSetupBtn').click();

  await expect(page.locator('#configScreen')).toBeVisible();
  await expect(page.locator('#setupScreen')).toBeHidden();
  // Le bouton de lancement de partie est présent sur la config.
  await expect(page.locator('#startBtn')).toBeVisible();
});

test('lancer une partie affiche le plateau', async ({ page }) => {
  await page.goto('/');
  await page.locator('#goToSetupBtn').click();
  await page.locator('#startBtn').click();

  await expect(page.locator('#gameScreen')).toBeVisible();
  // Le plateau est construit (cases générées dynamiquement).
  await expect(page.locator('#boardGrid')).toBeVisible();
  await expect(page.locator('#boardGrid > *').first()).toBeVisible();
});

test('la modale de compte s\'ouvre', async ({ page }) => {
  await page.goto('/');
  await page.locator('#accountBtn').click();
  await expect(page.locator('#accountOverlay')).toBeVisible();
});
