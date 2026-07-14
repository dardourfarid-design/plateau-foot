import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Accessibilité automatisée (axe-core, WCAG 2.0/2.1 A & AA) sur les écrans
// publics (jouables sans compte). Échec CI sur toute violation
// « serious »/« critical », **color-contrast inclus** (#136).
//
// NB : les écrans config/partie apparaissent via un fondu d'opacité. Il faut
// attendre la fin de la transition avant d'analyser, sinon axe mesure des
// couleurs à demi-transparentes (contrastes transitoirement sous le seuil) —
// ce qui n'est pas une vraie violation. `settle()` s'en charge.

async function settle(page, screenSelector) {
  await page.evaluate(() => (document.fonts ? document.fonts.ready : null));
  if (screenSelector) {
    await page.waitForFunction(
      (sel) => {
        const el = document.querySelector(sel);
        return el && getComputedStyle(el).opacity === '1';
      },
      screenSelector,
      { timeout: 5000 },
    );
  }
}

async function seriousViolations(page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  return results.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${v.id} (${v.impact}) — ${v.nodes.length} élément(s)`);
}

test('accueil — aucune violation a11y sérieuse', async ({ page }) => {
  await page.goto('/');
  await settle(page);
  const v = await seriousViolations(page);
  expect(v, v.join('\n')).toEqual([]);
});

test('écran de configuration — aucune violation a11y sérieuse', async ({ page }) => {
  await page.goto('/');
  await page.locator('#goToSetupBtn').click();
  await expect(page.locator('#configScreen')).toBeVisible();
  await settle(page, '#configScreen');
  const v = await seriousViolations(page);
  expect(v, v.join('\n')).toEqual([]);
});

test('partie en cours — aucune violation a11y sérieuse', async ({ page }) => {
  await page.goto('/');
  await page.locator('#goToSetupBtn').click();
  await page.locator('#startBtn').click();
  await expect(page.locator('#gameScreen')).toBeVisible();
  await settle(page, '#gameScreen');
  const v = await seriousViolations(page);
  expect(v, v.join('\n')).toEqual([]);
});

test('modale de compte — aucune violation a11y sérieuse', async ({ page }) => {
  await page.goto('/');
  await page.locator('#accountBtn').click();
  await expect(page.locator('#accountOverlay')).toBeVisible();
  await settle(page, '#accountOverlay');
  const v = await seriousViolations(page);
  expect(v, v.join('\n')).toEqual([]);
});
