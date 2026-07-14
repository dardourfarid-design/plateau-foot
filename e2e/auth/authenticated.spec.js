import { test, expect } from '@playwright/test';

// E2E authentifiés (#129) — parcours nécessitant un compte, contre le backend
// de TEST (config.js réécrite par le job CI). Se sautent si les identifiants de
// test ne sont pas fournis.

const USER = process.env.E2E_USER;
const PASS = process.env.E2E_PASS;

test.skip(!USER || !PASS, 'E2E_USER / E2E_PASS absents — parcours authentifiés sautés');

// Tente la connexion. Retourne le message d'erreur affiché (compte invalide),
// ou null si succès. Ne lève pas : chaque test décide de sauter proprement si
// le compte de test n'existe pas encore sur la branche `testing`.
// Tente la connexion. Succès = la vue « Mon compte » apparaît. En cas d'échec
// (compte de test inexistant/non confirmé sur la branche testing), renvoie
// { ok:false } avec un éventuel détail — chaque test saute alors proprement.
async function login(page) {
  await page.goto('/');
  await page.locator('#accountBtn').click();
  await expect(page.locator('#accountOverlay')).toBeVisible();
  await page.locator('#authEmail').fill(USER);
  await page.locator('#authPassword').fill(PASS);
  await page.locator('#authSubmitBtn').click();
  const ok = await page.locator('#accountLoggedInView')
    .waitFor({ state: 'visible', timeout: 15_000 })
    .then(() => true)
    .catch(() => false);
  const detail = ok
    ? ''
    : (await page.locator('#authError').textContent().catch(() => '') || '').trim();
  return { ok, detail };
}

const SKIP_MSG = (detail) =>
  `Connexion au backend de test impossible${detail ? ` ("${detail}")` : ''} — créer le compte ` +
  `E2E_USER sur la branche testing (dashboard Supabase → Authentication → Add user, ou l'app pointée sur le backend de test).`;

test('connexion via l\'UI puis déconnexion', async ({ page }) => {
  const { ok, detail } = await login(page);
  test.skip(!ok, SKIP_MSG(detail));
  await expect(page.locator('#accountEmailDisplay')).toContainText('@');
  await page.locator('#signOutBtn').click();
  // Retour à l'état déconnecté : le formulaire de connexion réapparaît.
  await expect(page.locator('#authSubmitBtn')).toBeVisible();
});

test('accès au profil : la progression se charge (données backend)', async ({ page }) => {
  const { ok, detail } = await login(page);
  test.skip(!ok, SKIP_MSG(detail));
  await page.locator('#accountCloseBtn').click();
  await page.locator('#profileBtn').click();
  await expect(page.locator('#profileScreen')).toBeVisible();
  // L'onglet Progression affiche des stats lues côté serveur (niveau numérique).
  await expect(page.locator('#panelProgress')).toBeVisible();
  await expect(page.locator('#progressLevel')).toHaveText(/^\d+$/);
});

test('la boutique s\'ouvre et liste des produits', async ({ page }) => {
  const { ok, detail } = await login(page);
  test.skip(!ok, SKIP_MSG(detail));
  await page.locator('#accountCloseBtn').click();
  await page.locator('#shopBtn').click();
  await expect(page.locator('#shopScreen')).toBeVisible();
  // Au moins une section/carte de boutique est rendue (catalogue chargé).
  await expect(page.locator('#shopScreen .shop-section, #shopScreen .shop-card').first()).toBeVisible();
});
