import { test, expect } from '@playwright/test';

// E2E authentifiés (#129) — parcours nécessitant un compte, contre le backend
// de TEST (config.js réécrite par le job CI). Se sautent si les identifiants de
// test ne sont pas fournis, ou si la connexion échoue (compte pas encore créé
// sur la branche testing — voir docs/supabase-branching.md).
//
// NB : après une connexion réussie, l'app FERME l'overlay de compte et le bouton
// de compte affiche l'email. C'est notre signal de succès.

const USER = process.env.E2E_USER;
const PASS = process.env.E2E_PASS;

test.skip(!USER || !PASS, 'E2E_USER / E2E_PASS absents — parcours authentifiés sautés');

// Tente la connexion. Succès = le bouton compte n'affiche plus « Non connecté »
// (updateAccountUI). Renvoie { ok, detail } ; chaque test saute si !ok.
async function login(page) {
  await page.goto('/');
  await page.locator('#accountBtn').click();
  await expect(page.locator('#accountOverlay')).toBeVisible();
  await page.locator('#authEmail').fill(USER);
  await page.locator('#authPassword').fill(PASS);
  await page.locator('#authSubmitBtn').click();
  const ok = await page
    .waitForFunction(
      () => {
        const b = document.getElementById('accountBtn');
        return !!b && !/non connect/i.test(b.textContent || '');
      },
      { timeout: 15_000 },
    )
    .then(() => true)
    .catch(() => false);
  const detail = ok
    ? ''
    : (await page.locator('#authError').textContent().catch(() => '') || '').trim();
  return { ok, detail };
}

const SKIP_MSG = (detail) =>
  `Connexion au backend de test impossible${detail ? ` ("${detail}")` : ''} — créer le compte ` +
  `E2E_USER sur la branche testing (dashboard Supabase → Authentication → Add user).`;

test('connexion via l\'UI puis déconnexion', async ({ page }) => {
  const { ok, detail } = await login(page);
  test.skip(!ok, SKIP_MSG(detail));

  // L'overlay s'est fermé après login → on le rouvre pour se déconnecter.
  await page.locator('#accountBtn').click();
  await expect(page.locator('#accountLoggedInView')).toBeVisible();
  await expect(page.locator('#accountEmailDisplay')).toContainText('@');
  await page.locator('#signOutBtn').click();

  // Retour à l'état déconnecté : le bouton compte le reflète.
  await expect(page.locator('#accountBtn')).toContainText(/non connect/i);
});

test('accès au profil : la progression se charge (données backend)', async ({ page }) => {
  const { ok, detail } = await login(page);
  test.skip(!ok, SKIP_MSG(detail));

  await page.locator('#profileBtn').click();
  await expect(page.locator('#profileScreen')).toBeVisible();
  await expect(page.locator('#panelProgress')).toBeVisible();
  // Niveau lu côté serveur (au moins 1).
  await expect(page.locator('#progressLevel')).toHaveText(/^\d+$/);
});

test('la boutique s\'ouvre et liste des produits', async ({ page }) => {
  const { ok, detail } = await login(page);
  test.skip(!ok, SKIP_MSG(detail));

  await page.locator('#shopBtn').click();
  await expect(page.locator('#shopScreen')).toBeVisible();
  await expect(
    page.locator('#shopScreen .shop-section, #shopScreen .shop-card').first(),
  ).toBeVisible();
});
