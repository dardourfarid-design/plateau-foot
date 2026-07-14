import { test, expect } from '@playwright/test';

// Pages légales (#147) : accessibles sans compte, exigées pour la vente.
// Parcours anonymes, aucun backend.

test('le pied de page renvoie vers les CGU/CGV et la confidentialité', async ({ page }) => {
  await page.goto('/');
  const terms = page.locator('.legal-footer a[href="terms.html"]');
  const privacy = page.locator('.legal-footer a[href="privacy.html"]');
  await expect(terms).toBeVisible();
  await expect(privacy).toBeVisible();
});

test('la page Conditions d\'utilisation & de vente se charge', async ({ page }) => {
  await page.goto('/terms.html');
  await expect(page).toHaveTitle(/Conditions d'utilisation/i);
  await expect(page.locator('h1')).toContainText("Conditions d'utilisation");
});

test('la page Confidentialité se charge', async ({ page }) => {
  await page.goto('/privacy.html');
  await expect(page).toHaveTitle(/confidentialité/i);
  await expect(page.locator('h1')).toContainText('Politique de confidentialité');
});

test('cliquer le lien CGU du pied de page ouvre la bonne page', async ({ page }) => {
  await page.goto('/');
  await page.locator('.legal-footer a[href="terms.html"]').click();
  await expect(page).toHaveURL(/terms\.html$/);
  await expect(page.locator('h1')).toContainText("Conditions d'utilisation");
});
