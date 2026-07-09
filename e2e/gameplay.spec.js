import { test, expect } from '@playwright/test';

// Boucle de jeu de base (sans compte) : lancer une partie, sélectionner un pion
// bleu (surbrillance des destinations), jouer un coup (le pion se déplace, la
// surbrillance disparaît). Exerce le moteur de règles à travers l'UI réelle.

test('sélectionner un pion et jouer un coup', async ({ page }) => {
  await page.goto('/');
  await page.locator('#goToSetupBtn').click();
  await page.locator('#startBtn').click();

  await expect(page.locator('#gameScreen')).toBeVisible();
  await expect(page.locator('#turnBanner')).toHaveText('Au tour de bleu');
  // Plateau 7×9 = 63 cases.
  await expect(page.locator('#boardGrid .cell')).toHaveCount(63);

  // Sélectionner un pion bleu de champ (pas le gardien).
  await page.locator('#boardGrid .cell .token.bleu:not(.gardien)').first().click();

  // Les destinations valides s'illuminent (.dest-move + .move-dot).
  const dests = page.locator('#boardGrid .cell.dest-move');
  await expect(dests.first()).toBeVisible();
  const destCount = await dests.count();
  expect(destCount).toBeGreaterThan(0);

  // Jouer le coup : cliquer une destination → la surbrillance disparaît (coup joué).
  await dests.first().click();
  await expect(page.locator('#boardGrid .cell.dest-move')).toHaveCount(0);
});
