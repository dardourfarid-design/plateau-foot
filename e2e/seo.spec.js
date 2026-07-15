import { test, expect } from './fixtures.js';

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

test('la landing /en/ se charge : h1, hreflang réciproques, CTA vers /?lang=en', async ({ page }) => {
  await page.goto('/en/');
  await expect(page).toHaveTitle(/football board game/i);
  await expect(page.locator('h1')).toHaveCount(1);
  await expect(page.locator('link[rel="alternate"][hreflang]')).toHaveCount(3);
  await expect(page.locator('a.cta-main')).toHaveAttribute('href', '/?lang=en');
  // La FR doit porter les mêmes hreflang (annotations réciproques obligatoires).
  await page.goto('/');
  await expect(page.locator('link[rel="alternate"][hreflang]')).toHaveCount(3);
});

test("l'app démarre en anglais via /?lang=en (#183)", async ({ page }) => {
  await page.goto('/?lang=en');
  // Le CTA principal de l'accueil (« Jouer » → « Play ») doit être traduit.
  await expect(page.locator('#quickPlayBtn')).toContainText('Play');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
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
