import { test, expect } from '@playwright/test';

// Navigation vers/depuis la boutique — trou de docs/regression-matrix.md (#147).
// L'ouverture ne demande pas de compte (catalogue de secours hors ligne).
// On teste la navigation d'écran (DOM), pas le chargement réseau du catalogue.

test('la boutique s\'ouvre depuis l\'accueil et « ← Retour » y ramène', async ({ page }) => {
  await page.goto('/');
  await page.locator('#shopBtn').click();
  await expect(page.locator('#shopScreen')).toBeVisible();
  await expect(page.locator('#setupScreen')).toBeHidden();

  await page.locator('#shopBackBtn').click();
  await expect(page.locator('#shopScreen')).toBeHidden();
  await expect(page.locator('#setupScreen')).toBeVisible();
});

test('la boutique conserve le contexte : retour vers la configuration', async ({ page }) => {
  await page.goto('/');
  await page.locator('#goToSetupBtn').click();
  await expect(page.locator('#configScreen')).toBeVisible();

  await page.locator('#shopBtn').click();
  await expect(page.locator('#shopScreen')).toBeVisible();

  // rememberScreenContext/restoreScreenContext doit ramener à la config, pas à l'accueil.
  await page.locator('#shopBackBtn').click();
  await expect(page.locator('#configScreen')).toBeVisible();
  await expect(page.locator('#shopScreen')).toBeHidden();
});
