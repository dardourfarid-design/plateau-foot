import { test, expect } from './fixtures.js';

// #264 — salle d'attente en ligne : copier / partager le code + bandeau de
// déconnexion adverse. La présence Realtime et la création de session exigent
// un backend (interdit ici, voir fixtures). On exerce donc le comportement CLIENT
// via le seam de test gated __TM_E2E__ → window.__tmOnlineTest (comme le seam
// principal de main.js), qui montre la salle d'attente et pilote la présence
// sans réseau. Le presse-papiers est remplacé par un espion in-page.

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.__TM_E2E__ = true;
    window.__copied = [];
    try {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText: async (t) => { window.__copied.push(t); } }
      });
    } catch (_) { /* déjà défini : on laisse le vrai presse-papiers */ }
  });
  await page.goto('/');
  await page.waitForFunction(() => !!window.__tmOnlineTest);
});

test('« Copier le code » copie le code brut et confirme', async ({ page }) => {
  await page.evaluate(() => window.__tmOnlineTest.showWaitingScreen('ABCDEF'));
  await expect(page.locator('#waitingScreen')).toBeVisible();
  await expect(page.locator('#inviteCodeDisplay')).toHaveText('ABCDEF');

  await page.locator('#copyInviteCodeBtn').click();

  await expect(page.locator('#waitingFeedback')).toHaveText('Code copié !');
  expect(await page.evaluate(() => window.__copied)).toEqual(['ABCDEF']);
});

test('« Partager » retombe sur la copie quand Web Share est absent', async ({ page }) => {
  // Pas de navigator.share défini → repli presse-papiers (message complet).
  await page.evaluate(() => window.__tmOnlineTest.showWaitingScreen('ZZZ999'));
  await page.locator('#shareInviteCodeBtn').click();

  await expect(page.locator('#waitingFeedback')).toHaveText('Code copié !');
  const copied = await page.evaluate(() => window.__copied.join('|'));
  expect(copied.includes('ZZZ999')).toBe(true);
});

test('le bandeau de déconnexion apparaît quand l\'adversaire part, disparaît à son retour', async ({ page }) => {
  // Le bandeau vit dans #gameScreen (masqué ici) : on teste le pilotage par la
  // classe .hidden plutôt que la visibilité effective, qui dépend de l'écran.
  const banner = page.locator('#opponentDisconnectedBanner');
  await expect(banner).toHaveClass(/hidden/);
  await expect(banner).toContainText(/déconnecté/i);

  await page.evaluate(() => window.__tmOnlineTest.setOpponentPresent(false));
  await expect(banner).not.toHaveClass(/hidden/);

  await page.evaluate(() => window.__tmOnlineTest.setOpponentPresent(true));
  await expect(banner).toHaveClass(/hidden/);
});
