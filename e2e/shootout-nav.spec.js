import { test, expect } from './fixtures.js';

// Couverture de la navigation/thèmes de la séance de tirs (le tir lui-même est
// couvert par shootout.spec.js) — trous de docs/regression-matrix.md (#147).
// Anonyme : seul le thème « stade » est débloqué, les autres ouvrent la modale
// de compte (achat) — comportement de gating vérifié ici.

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  // #220 : la séance se lance directement depuis l'accueil, au niveau de « Jouer ».
  await page.locator('#homeShootoutBtn').click();
  await expect(page.locator('#shootoutScreen')).toBeVisible();
});

test('le thème par défaut est « stade » et le switcher affiche 4 thèmes', async ({ page }) => {
  await expect(page.locator('#shootoutScreen')).toHaveAttribute('data-pk-theme', 'stade');
  await expect(page.locator('#pkSwitcher .pk-theme-btn')).toHaveCount(4);
});

test('un thème verrouillé ouvre la modale de compte (achat)', async ({ page }) => {
  await page.locator('#pkSwitcher .pk-theme-btn[data-theme="neon"]').click();
  await expect(page.locator('#accountOverlay')).toBeVisible();
});

// Note : #shootoutBackBtn / #shootoutReplayBtn vivent dans #shootoutEndRow,
// masqué tant que la séance n'est pas terminée — ils ne sont donc testables
// qu'en fin de séance (parcours long, non déterministe). En cours de séance,
// la sortie se fait par le logo TM (topbar).
test('le logo TM quitte la séance de tirs', async ({ page }) => {
  await page.locator('#homeLogoBtn').click();
  await expect(page.locator('#shootoutScreen')).toBeHidden();
  await expect(page.locator('#setupScreen')).toBeVisible();
});
