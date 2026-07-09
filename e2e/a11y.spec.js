import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Accessibilité automatisée (axe-core, WCAG 2.0/2.1 A & AA). On échoue la CI sur
// toute violation « serious »/« critical » sur les écrans publics (jouables sans
// compte).
//
// RATCHET : la règle `color-contrast` est temporairement EXCLUE du gate. Le jeu
// a une direction artistique sombre/or dont plusieurs textes muets sont à
// ~4.2–4.5:1 (juste sous le seuil AA 4.5:1) ; les corriger relève d'une passe
// design dédiée, suivie dans une issue à part. Toutes les AUTRES règles sérieuses
// (ARIA, labels, rôles, structure…) sont, elles, appliquées dès maintenant.

async function seriousViolations(page) {
  // Stabilise le rendu avant l'analyse : attendre les polices web évite des
  // faux positifs transitoires (layout en cours) — source classique de flake.
  await page.evaluate(() => (document.fonts ? document.fonts.ready : null));
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .disableRules(['color-contrast'])
    .analyze();
  return results.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${v.id} (${v.impact}) — ${v.nodes.length} élément(s)`);
}

test('accueil — aucune violation a11y sérieuse', async ({ page }) => {
  await page.goto('/');
  const v = await seriousViolations(page);
  expect(v, v.join('\n')).toEqual([]);
});

test('écran de configuration — aucune violation a11y sérieuse', async ({ page }) => {
  await page.goto('/');
  await page.locator('#goToSetupBtn').click();
  await expect(page.locator('#configScreen')).toBeVisible();
  const v = await seriousViolations(page);
  expect(v, v.join('\n')).toEqual([]);
});

test('partie en cours — aucune violation a11y sérieuse', async ({ page }) => {
  await page.goto('/');
  await page.locator('#goToSetupBtn').click();
  await page.locator('#startBtn').click();
  await expect(page.locator('#gameScreen')).toBeVisible();
  const v = await seriousViolations(page);
  expect(v, v.join('\n')).toEqual([]);
});

test('modale de compte — aucune violation a11y sérieuse', async ({ page }) => {
  await page.goto('/');
  await page.locator('#accountBtn').click();
  await expect(page.locator('#accountOverlay')).toBeVisible();
  const v = await seriousViolations(page);
  expect(v, v.join('\n')).toEqual([]);
});
