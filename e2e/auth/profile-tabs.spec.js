import { test, expect } from '@playwright/test';

// E2E authentifiés (#129, #147) — navigation des 5 onglets du profil. Contre le
// backend de TEST (config.js réécrite par le job CI). Se sautent si les
// identifiants de test sont absents ou si la connexion échoue. On teste la
// bascule d'onglet (panneau visible + onglet actif), pas le contenu chargé en
// async — ce qui reste déterministe.

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

const TABS = [
  { tab: 'progress', panel: '#panelProgress' },
  { tab: 'challenges', panel: '#panelChallenges' },
  { tab: 'team', panel: '#panelTeam' },
  { tab: 'mercato', panel: '#panelMercato' },
  { tab: 'leaderboard', panel: '#panelLeaderboard' },
];

test('les 5 onglets du profil basculent le bon panneau', async ({ page }) => {
  const { ok, detail } = await login(page);
  test.skip(!ok, SKIP_MSG(detail));

  await page.locator('#profileBtn').click();
  await expect(page.locator('#profileScreen')).toBeVisible();

  for (const { tab, panel } of TABS) {
    await page.locator(`.profile-tab[data-tab="${tab}"]`).click();
    // L'onglet cliqué devient actif...
    await expect(page.locator(`.profile-tab[data-tab="${tab}"]`)).toHaveClass(/active/);
    // ...et son panneau est le seul visible.
    await expect(page.locator(panel)).toBeVisible();
    await expect(page.locator('#profileScreen .profile-panel:not(.hidden)')).toHaveCount(1);
  }
});
