import { test, expect } from './fixtures.js';

// Bascule de langue FR ⇄ EN via le toggle en haut à droite. Vérifie qu'un
// texte connu est bien retraduit et que l'état actif du toggle suit.

test('le toggle FR/EN retraduit l\'interface', async ({ page }) => {
  await page.goto('/');

  const sub = page.locator('.logo-sub');
  await expect(sub).toHaveText('Le foot se joue aussi assis');

  // Passer en anglais.
  await page.locator('.lang-opt[data-lang="en"]').click();
  await expect(page.locator('.lang-opt[data-lang="en"]')).toHaveClass(/active/);
  await expect(sub).toHaveText('Football, sitting down too');

  // Revenir en français.
  await page.locator('.lang-opt[data-lang="fr"]').click();
  await expect(sub).toHaveText('Le foot se joue aussi assis');
});
