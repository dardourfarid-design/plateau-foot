import { test, expect } from '@playwright/test';

// E2E authentifiés (#129) — parcours nécessitant un compte, contre le backend
// de TEST (config.js réécrite par le job CI). Se sautent si les identifiants de
// test ne sont pas fournis.

const USER = process.env.E2E_USER;
const PASS = process.env.E2E_PASS;

test.skip(!USER || !PASS, 'E2E_USER / E2E_PASS absents — parcours authentifiés sautés');

async function login(page) {
  await page.goto('/');
  await page.locator('#accountBtn').click();
  await expect(page.locator('#accountOverlay')).toBeVisible();
  await page.locator('#authEmail').fill(USER);
  await page.locator('#authPassword').fill(PASS);
  await page.locator('#authSubmitBtn').click();
  // Diagnostic : la connexion aboutit à la vue « Mon compte », OU un message
  // d'erreur s'affiche — dans ce cas on le remonte pour comprendre en CI.
  await Promise.race([
    page.locator('#accountLoggedInView').waitFor({ state: 'visible', timeout: 15_000 }),
    page.locator('#authError').waitFor({ state: 'visible', timeout: 15_000 }),
  ]).catch(() => {});
  const errText = (await page.locator('#authError').textContent().catch(() => '') || '').trim();
  if (errText) throw new Error(`Connexion refusée par le backend de test : "${errText}"`);
  await expect(page.locator('#accountLoggedInView')).toBeVisible();
  await expect(page.locator('#accountEmailDisplay')).toContainText('@');
}

test('connexion via l\'UI puis déconnexion', async ({ page }) => {
  await login(page);
  await page.locator('#signOutBtn').click();
  // Retour à l'état déconnecté : le formulaire de connexion réapparaît.
  await expect(page.locator('#authSubmitBtn')).toBeVisible();
});

test('accès au profil : la progression se charge (données backend)', async ({ page }) => {
  await login(page);
  await page.locator('#accountCloseBtn').click();
  await page.locator('#profileBtn').click();
  await expect(page.locator('#profileScreen')).toBeVisible();
  // L'onglet Progression affiche des stats lues côté serveur (niveau numérique).
  await expect(page.locator('#panelProgress')).toBeVisible();
  await expect(page.locator('#progressLevel')).toHaveText(/^\d+$/);
});

test('la boutique s\'ouvre et liste des produits', async ({ page }) => {
  await login(page);
  await page.locator('#accountCloseBtn').click();
  await page.locator('#shopBtn').click();
  await expect(page.locator('#shopScreen')).toBeVisible();
  // Au moins une section/carte de boutique est rendue (catalogue chargé).
  await expect(page.locator('#shopScreen .shop-section, #shopScreen .shop-card').first()).toBeVisible();
});
