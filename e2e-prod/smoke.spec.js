import { test, expect } from '@playwright/test';

// SMOKE DE PRODUCTION — parcours critiques ANONYMES contre le site live.
// Objectif : détecter une panne de prod (déploiement cassé, config.js absent,
// backend HS) indépendamment de tout commit. Aucune donnée n'est écrite :
// navigation et lecture uniquement, jamais d'auth ni d'appel qui muterait la
// base de prod. baseURL vient de playwright.prod.config.js (env PROD_URL).

test.describe('smoke de production', () => {
  test("l'accueil charge sans erreur JS", async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/');
    await expect(page.locator('.logo-title')).toContainText('TACTIC');
    await expect(page.locator('#goToSetupBtn')).toBeVisible();
    expect(errors, `erreurs JS: ${errors.join(' | ')}`).toEqual([]);
  });

  test('« Jouer » mène à la configuration', async ({ page }) => {
    await page.goto('/');
    await page.locator('#goToSetupBtn').click();
    await expect(page.locator('#configScreen')).toBeVisible();
    await expect(page.locator('#startBtn')).toBeVisible();
  });

  test('lancer une partie affiche le plateau', async ({ page }) => {
    await page.goto('/');
    await page.locator('#goToSetupBtn').click();
    await page.locator('#startBtn').click();
    await expect(page.locator('#gameScreen')).toBeVisible();
    await expect(page.locator('#boardGrid')).toBeVisible();
    await expect(page.locator('#boardGrid > *').first()).toBeVisible();
  });

  test('la modale de compte s\'ouvre', async ({ page }) => {
    await page.goto('/');
    await page.locator('#accountBtn').click();
    await expect(page.locator('#accountOverlay')).toBeVisible();
  });
});
