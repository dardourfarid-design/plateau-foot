import { test, expect } from '@playwright/test';

// Contenu indexable & données structurées (#181/#182) : le seul texte que les
// moteurs lisent sur cette SPA. Vérifie qu'il reste visible et que le JSON-LD
// reste le miroir de la FAQ visible.

test('la page a un h1 unique et visible (titre du jeu)', async ({ page }) => {
  await page.goto('/');
  const h1 = page.locator('h1');
  await expect(h1).toHaveCount(1);
  await expect(h1).toBeVisible();
  await expect(h1).toContainText(/TACTIC/i);
});

test('la section éditoriale est présente et visible (pas de display:none)', async ({ page }) => {
  await page.goto('/');
  const about = page.locator('section.seo-about');
  await expect(about).toBeVisible();
  await expect(about.locator('h2')).toContainText(/jeu de plateau de foot/i);
});

test('la FAQ visible se déplie et correspond au JSON-LD FAQPage', async ({ page }) => {
  await page.goto('/');
  const faq = page.locator('.seo-about details');
  const first = faq.first();
  await first.locator('summary').click();
  await expect(first.locator('p')).toBeVisible();

  // Le JSON-LD doit parser et contenir autant de questions que la FAQ visible.
  const graph = await page.evaluate(() => {
    const el = document.querySelector('script[type="application/ld+json"]');
    return JSON.parse(el.textContent)['@graph'];
  });
  const types = graph.map(n => n['@type']);
  expect(types).toContain('WebSite');
  expect(types).toContain('VideoGame');
  const faqNode = graph.find(n => n['@type'] === 'FAQPage');
  expect(faqNode.mainEntity.length).toBe(await faq.count());
});
