import { test, expect } from '@playwright/test';

// E2E authentifiés — badge Fondateur dans l'entête du profil (#61).
//
// Pourquoi une interception réseau plutôt qu'un vrai compte Fondateur : `is_founder`
// s'obtient en achetant le Pack Fondateurs, et le stock est limité (200 places,
// décrémenté par la migration 0031). Brûler une place pour un test, ou dépendre du
// statut du compte E2E, rendrait le test coûteux et non déterministe. On stube donc
// la seule chose qui décide de l'affichage — la réponse REST sur `profiles.is_founder`
// — et on teste ce qui nous intéresse vraiment : le CÂBLAGE de l'entête du profil.
//
// C'est précisément le trou que la passe de DoD du 2026-07-16 a trouvé : le badge, son
// CSS et `getMyFounderStatus()` existaient tous, mais rien ne les reliait à l'écran de
// profil réel — `refreshFounderBadge()` n'était appelé que depuis le tutoriel. Les deux
// cas (fondateur / non-fondateur) sont couverts : un badge qui s'affiche toujours est
// un bug aussi grave qu'un badge qui ne s'affiche jamais.

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

/**
 * Force la réponse de `select=is_founder` sur /rest/v1/profiles.
 * Les autres requêtes `profiles` (pseudo, avatar…) doivent continuer à passer :
 * on ne détourne que celles qui demandent explicitement is_founder.
 */
async function stubFounderStatus(page, isFounder) {
  await page.route(/\/rest\/v1\/profiles\?.*is_founder/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      // maybeSingle() accepte un tableau de 0 ou 1 élément.
      body: JSON.stringify([{ is_founder: isFounder }]),
    });
  });
}

test.describe('Badge Fondateur dans le profil (#61)', () => {
  test('un Fondateur voit le badge en ouvrant son profil', async ({ page }) => {
    await stubFounderStatus(page, true);
    const { ok, detail } = await login(page);
    test.skip(!ok, SKIP_MSG(detail));

    await page.locator('#profileBtn').click();
    await expect(page.locator('#profileScreen')).toBeVisible();

    const badge = page.locator('#founderBadge');
    await expect(badge).toBeVisible();
    await expect(badge).toHaveText(/Fondateur|Founder/);
  });

  test("un non-Fondateur ne voit pas le badge", async ({ page }) => {
    await stubFounderStatus(page, false);
    const { ok, detail } = await login(page);
    test.skip(!ok, SKIP_MSG(detail));

    await page.locator('#profileBtn').click();
    await expect(page.locator('#profileScreen')).toBeVisible();

    // Laisse au fetch le temps de répondre : sans attente, un badge qui s'affiche
    // à tort passerait inaperçu (il part masqué dans le HTML).
    await page.waitForTimeout(1500);
    await expect(page.locator('#founderBadge')).toBeHidden();
  });

  test('le badge ne fuite pas entre deux ouvertures du profil', async ({ page }) => {
    // Régression : le badge est un élément statique de l'entête, réutilisé d'une
    // ouverture à l'autre. S'il n'est pas remis à zéro, l'état d'un compte Fondateur
    // pourrait rester affiché après une déconnexion.
    await stubFounderStatus(page, true);
    const { ok, detail } = await login(page);
    test.skip(!ok, SKIP_MSG(detail));

    await page.locator('#profileBtn').click();
    await expect(page.locator('#founderBadge')).toBeVisible();

    // Retour à l'accueil, puis on rebascule le backend sur « non fondateur ».
    await page.locator('#profileBackBtn').click();
    await page.unroute(/\/rest\/v1\/profiles\?.*is_founder/);
    await stubFounderStatus(page, false);

    await page.locator('#profileBtn').click();
    await expect(page.locator('#profileScreen')).toBeVisible();
    await expect(page.locator('#founderBadge')).toBeHidden();
  });
});
