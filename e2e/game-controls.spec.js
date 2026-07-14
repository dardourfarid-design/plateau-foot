import { test, expect } from '@playwright/test';

// Couverture des contrôles de partie (hors coup joué, déjà couvert par
// gameplay.spec.js) — trous de docs/regression-matrix.md (#147). Mode local
// (2 joueurs) : les deux équipes sont humaines, aucun backend ni IA.

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.locator('#goToSetupBtn').click();
  await page.locator('#startBtn').click();
  await expect(page.locator('#gameScreen')).toBeVisible();
  await expect(page.locator('#boardGrid .cell')).toHaveCount(63);
});

test('« Annuler le coup » efface la sélection en cours', async ({ page }) => {
  // Sélectionner un pion fait apparaître ses destinations possibles.
  await page.locator('#boardGrid .cell .token.bleu:not(.gardien)').first().click();
  await expect(page.locator('#boardGrid .cell.dest-move').first()).toBeVisible();

  await page.locator('#cancelBtn').click();
  await expect(page.locator('#boardGrid .cell.dest-move')).toHaveCount(0);
});

test('« Nouvelle partie » ramène à l\'écran de configuration', async ({ page }) => {
  await page.locator('#restartBtn').click();
  await expect(page.locator('#configScreen')).toBeVisible();
  await expect(page.locator('#gameScreen')).toBeHidden();
});
