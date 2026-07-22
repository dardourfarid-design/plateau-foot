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

// #323 — GARDE-FOU DE PARITÉ STRUCTURELLE FR ↔ EN.
//
// La landing EN est recopiée à la main depuis l'accueil FR (#183). À chaque
// livraison, elle décroche en silence : elle avait perdu le tag Plausible
// (#322), le manifest PWA, le lien vers le blog et la mention des modes ajoutés
// depuis sa création. Ce test échoue si l'un de ces éléments structurants
// disparaît d'un côté sans l'autre — pour que la dérive redevienne visible en
// CI plutôt qu'après coup en production. (La vraie réparation de fond serait de
// GÉNÉRER /en au lieu de le maintenir — #313.)
async function structure(page, path) {
  await page.goto(path);
  return {
    manifest: await page.locator('link[rel="manifest"]').count(),
    appleIcon: await page.locator('link[rel="apple-touch-icon"]').count(),
    blogLink: await page.locator('footer.legal-footer a[href="/blog"]').count(),
    plausible: await page.locator('script[data-domain]').count(),
    canonical: await page.locator('link[rel="canonical"]').count(),
    hreflang: await page.locator('link[rel="alternate"][hreflang]').count()
  };
}

test('parité structurelle FR ↔ EN : manifest, blog, Plausible, canonical (#323)', async ({ page }) => {
  const fr = await structure(page, '/');
  const en = await structure(page, '/en/');

  // Chaque signal doit être présent des DEUX côtés (au moins une occurrence).
  for (const key of Object.keys(fr)) {
    expect(fr[key], `FR devrait porter ${key}`).toBeGreaterThan(0);
    expect(en[key], `EN devrait porter ${key}`).toBeGreaterThan(0);
  }
  // hreflang réciproques : même compte des deux côtés (3).
  expect(en.hreflang).toBe(fr.hreflang);

  // Les modes ajoutés depuis #183 sont mentionnés dans le fact sheet EN.
  await page.goto('/en/');
  await expect(page.locator('section.seo-about .seo-facts')).toContainText(/penalty shootout/i);
  await expect(page.locator('section.seo-about .seo-facts')).toContainText(/daily puzzle/i);
});

test("l'app démarre en anglais via /?lang=en (#183)", async ({ page }) => {
  await page.goto('/?lang=en');
  // Le CTA principal de l'accueil (« Jouer » → « Play ») doit être traduit.
  await expect(page.locator('#quickPlayBtn')).toContainText('Play');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
});

// #270 — hors landing, la section doublonne l'overlay Règles & FAQ : masquée.
test('la section éditoriale disparaît hors landing et revient à la landing', async ({ page }) => {
  await page.goto('/');
  const about = page.locator('section.seo-about');
  await expect(about).toBeVisible();

  await page.locator('#goToSetupBtn').click();
  await expect(page.locator('#configScreen')).toBeVisible();
  await expect(about).toBeHidden();

  await page.locator('#startBtn').click();
  await expect(page.locator('#gameScreen')).toBeVisible();
  await expect(about).toBeHidden();

  // Retour accueil : la partie en cours demande confirmation (#259).
  await page.locator('#homeLogoBtn').click();
  await page.locator('#appDialogOkBtn').click();
  await expect(page.locator('#setupScreen')).toBeVisible();
  await expect(about).toBeVisible();
});

// #270-bis — les questions ne sont plus en dur sur la landing : elles vivent
// dans l'overlay Règles & FAQ. On l'ouvre, on déplie une question, et on
// vérifie que le JSON-LD reste le miroir des questions de l'overlay.
test("l'overlay Règles & FAQ se déplie et correspond au JSON-LD FAQPage", async ({ page }) => {
  await page.goto('/');

  // Aucune question ne doit rester en dur dans la section éditoriale.
  await expect(page.locator('.seo-about details')).toHaveCount(0);

  await page.locator('#landingFaqBtn').click();
  await expect(page.locator('#faqOverlay')).toHaveClass(/show/);
  const faq = page.locator('#faqBody details');
  const first = faq.first();
  await first.locator('summary').click();
  await expect(first.locator('p')).toBeVisible();

  // Le JSON-LD doit parser et contenir autant de questions que l'overlay.
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
