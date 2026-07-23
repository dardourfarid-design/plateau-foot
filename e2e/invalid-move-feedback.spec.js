import { test, expect } from './fixtures.js';

// #263 — un clic qui ne mène à aucun coup légal doit donner un retour visuel
// (micro-secousse .cell-invalid) plutôt qu'un silence. La classe est transitoire
// (retirée en fin d'animation) : pour ne pas dépendre du timing, on installe un
// MutationObserver AVANT le clic, qui mémorise durablement son passage.

async function startGame(page) {
  await page.goto('/');
  await page.locator('#goToSetupBtn').click();
  await page.locator('#startBtn').click();
  await expect(page.locator('#gameScreen')).toBeVisible();
}

async function armInvalidWatcher(page) {
  await page.evaluate(() => {
    window.__invalidSeen = false;
    const grid = document.getElementById('boardGrid');
    new MutationObserver(muts => {
      for (const m of muts) {
        const el = m.target;
        if (el.classList && el.classList.contains('cell-invalid')) window.__invalidSeen = true;
      }
    }).observe(grid, { subtree: true, attributes: true, attributeFilter: ['class'] });
  });
}

test('cliquer un pion adverse (rien de sélectionné) déclenche la secousse', async ({ page }) => {
  await startGame(page);
  await armInvalidWatcher(page);

  // Aucun pion sélectionné : cliquer une case adverse ne peut rien sélectionner
  // → clic mort → retour visuel.
  await page.locator('#boardGrid .cell:has(.token.rouge)').first().click();

  await page.waitForFunction(() => window.__invalidSeen === true, { timeout: 3000 });
  expect(await page.evaluate(() => window.__invalidSeen)).toBe(true);
});

test('avec un pion sélectionné, cliquer une case illégale déclenche la secousse', async ({ page }) => {
  await startGame(page);

  // Sélectionner un pion bleu de champ (destinations illuminées).
  await page.locator('#boardGrid .cell .token.bleu:not(.gardien)').first().click();
  await expect(page.locator('#boardGrid .cell.dest-move').first()).toBeVisible();

  await armInvalidWatcher(page);

  // Cliquer une case occupée par un pion ADVERSE : jamais une destination légale
  // (aucune capture dans ce jeu) et pas un pion sélectionnable pour Bleu → le
  // coup est refusé, le pion est désélectionné et la secousse se déclenche.
  await page.locator('#boardGrid .cell:has(.token.rouge)').first().click();

  await page.waitForFunction(() => window.__invalidSeen === true, { timeout: 3000 });
  expect(await page.evaluate(() => window.__invalidSeen)).toBe(true);
});
