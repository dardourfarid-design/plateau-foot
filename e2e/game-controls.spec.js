import { test, expect } from './fixtures.js';

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

// #259 — abandonner une partie en cours passe désormais par une confirmation.
test('« Nouvelle partie » demande confirmation puis ramène à la configuration', async ({ page }) => {
  await page.locator('#restartBtn').click();
  await expect(page.locator('#appDialogOverlay')).toBeVisible();
  await page.locator('#appDialogOkBtn').click();
  await expect(page.locator('#configScreen')).toBeVisible();
  await expect(page.locator('#gameScreen')).toBeHidden();
});

test('annuler la confirmation conserve la partie intacte (#259)', async ({ page }) => {
  // Un coup joué pour vérifier que rien n'est perdu après l'annulation.
  await page.locator('#boardGrid .cell .token.bleu:not(.gardien)').first().click();
  await expect(page.locator('#boardGrid .cell.dest-move').first()).toBeVisible();

  await page.locator('#restartBtn').click();
  await expect(page.locator('#appDialogOverlay')).toBeVisible();
  await page.locator('#appDialogCancelBtn').click();

  await expect(page.locator('#gameScreen')).toBeVisible();
  await expect(page.locator('#configScreen')).toBeHidden();
  // La sélection en cours n'a pas été réinitialisée : la partie est intacte.
  await expect(page.locator('#boardGrid .cell.dest-move').first()).toBeVisible();
});

// Seam gated (__TM_E2E__) : constate le message de forfait spécifique au mode
// en ligne sans monter deux clients + backend (même pattern que game-overlays).
test('en ligne, le dialogue d\'abandon avertit du forfait (#259)', async ({ page }) => {
  await page.addInitScript(() => { window.__TM_E2E__ = true; });
  await page.goto('/');
  await page.locator('#goToSetupBtn').click();
  await page.locator('#startBtn').click();
  await expect(page.locator('#gameScreen')).toBeVisible();
  await page.waitForFunction(() => !!window.__tmTest);

  await page.evaluate(() => window.__tmTest.setGameMode('online'));
  await page.locator('#restartBtn').click();
  await expect(page.locator('#appDialogOverlay')).toBeVisible();
  await expect(page.locator('#appDialogBody')).toContainText('forfait');
  await page.locator('#appDialogCancelBtn').click();
  await expect(page.locator('#gameScreen')).toBeVisible();
});

test('le logo TM en pleine partie demande confirmation (#259)', async ({ page }) => {
  await page.locator('#homeLogoBtn').click();
  await expect(page.locator('#appDialogOverlay')).toBeVisible();
  await page.locator('#appDialogCancelBtn').click();
  await expect(page.locator('#gameScreen')).toBeVisible();

  await page.locator('#homeLogoBtn').click();
  await page.locator('#appDialogOkBtn').click();
  await expect(page.locator('#setupScreen')).toBeVisible();
  await expect(page.locator('#gameScreen')).toBeHidden();
});
