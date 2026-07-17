import { test, expect } from './fixtures.js';

// Couverture des raccourcis de navigation globaux (topbar + retours) — trous
// identifiés par docs/regression-matrix.md (issue #147). Parcours anonymes,
// aucun backend.

test('le logo TM ramène à l\'accueil depuis la configuration', async ({ page }) => {
  await page.goto('/');
  await page.locator('#goToSetupBtn').click();
  await expect(page.locator('#configScreen')).toBeVisible();

  await page.locator('#homeLogoBtn').click();
  await expect(page.locator('#setupScreen')).toBeVisible();
  await expect(page.locator('#configScreen')).toBeHidden();
});

test('le logo TM ramène à l\'accueil depuis une partie', async ({ page }) => {
  await page.goto('/');
  await page.locator('#goToSetupBtn').click();
  await page.locator('#startBtn').click();
  await expect(page.locator('#gameScreen')).toBeVisible();

  await page.locator('#homeLogoBtn').click();
  // #259 — quitter une partie en cours demande désormais confirmation.
  await page.locator('#appDialogOkBtn').click();
  await expect(page.locator('#setupScreen')).toBeVisible();
  await expect(page.locator('#gameScreen')).toBeHidden();
});

test('« ← Retour » depuis la configuration revient à l\'accueil', async ({ page }) => {
  await page.goto('/');
  await page.locator('#goToSetupBtn').click();
  await expect(page.locator('#configScreen')).toBeVisible();

  await page.locator('#configBackBtn').click();
  await expect(page.locator('#setupScreen')).toBeVisible();
  await expect(page.locator('#configScreen')).toBeHidden();
});
