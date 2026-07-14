import { test, expect } from '@playwright/test';

// Achat de thème via Stripe Checkout (SANDBOX) — parcours de bout en bout (#147).
//
// OPT-IN : ne tourne que si E2E_STRIPE=1 (en plus des identifiants de test).
// Raison : il dépend (1) du backend de test configuré avec les clés Stripe
// sandbox, (2) de l'état du compte (le bouton « acheter » n'apparaît que si le
// thème n'est ni possédé, ni couvert par un pass, ni payable en pièces/crédits),
// et (3) de la page hostée checkout.stripe.com (externe). On l'isole donc du
// signal de santé pour ne pas le rendre instable ; on le lance à la demande.
//
// Carte de test Stripe : 4242 4242 4242 4242 — 12/30 — CVC 123.

const USER = process.env.E2E_USER;
const PASS = process.env.E2E_PASS;
const ENABLED = process.env.E2E_STRIPE === '1';

test.skip(!ENABLED, 'Opt-in : E2E_STRIPE=1 requis (flux Stripe sandbox externe).');
test.skip(!USER || !PASS, 'E2E_USER / E2E_PASS absents.');

async function login(page) {
  await page.goto('/');
  await page.locator('#accountBtn').click();
  await expect(page.locator('#accountOverlay')).toBeVisible();
  await page.locator('#authEmail').fill(USER);
  await page.locator('#authPassword').fill(PASS);
  await page.locator('#authSubmitBtn').click();
  return page
    .waitForFunction(
      () => {
        const b = document.getElementById('accountBtn');
        return !!b && !/non connect/i.test(b.textContent || '');
      },
      { timeout: 15_000 },
    )
    .then(() => true)
    .catch(() => false);
}

test('achat d\'un thème via Stripe Checkout (carte sandbox) → thème débloqué', async ({ page }) => {
  const ok = await login(page);
  test.skip(!ok, 'Connexion au backend de test impossible.');

  await page.locator('#shopBtn').click();
  await expect(page.locator('#shopScreen')).toBeVisible();

  // Bouton d'achat en argent réel (déclenche Stripe Checkout). Absent si le
  // compte possède déjà tout / paie en pièces → on saute proprement.
  const buy = page.locator('.shop-kit-buy-btn').first();
  const hasBuy = await buy.count().then((n) => n > 0);
  test.skip(!hasBuy, 'Aucun thème payable en argent réel pour ce compte (déjà possédés ou payables en pièces).');

  await buy.click();

  // Redirection vers la page hostée Stripe. Si elle n'arrive pas (fournisseur
  // mock actif, ou Checkout non configuré sur le backend de test), on saute.
  const wentToStripe = await page
    .waitForURL(/checkout\.stripe\.com/, { timeout: 15_000 })
    .then(() => true)
    .catch(() => false);
  test.skip(!wentToStripe, 'Pas de redirection Stripe (fournisseur mock ou Checkout non configuré).');

  // Remplir la carte sandbox sur checkout.stripe.com (page hostée, non-iframe).
  // Sélecteurs susceptibles d'évoluer côté Stripe — ajuster si besoin.
  const email = page.locator('#email');
  if (await email.count()) await email.fill(USER);
  await page.locator('#cardNumber').fill('4242424242424242');
  await page.locator('#cardExpiry').fill('12 / 30');
  await page.locator('#cardCvc').fill('123');
  const name = page.locator('#billingName');
  if (await name.count()) await name.fill('Testeur E2E');

  await page.locator('.SubmitButton, button[type="submit"]').first().click();

  // Retour sur l'app avec ?checkout=success → toast de confirmation.
  await page.waitForURL(/checkout=success/, { timeout: 30_000 });
  await expect(page.locator('#purchaseToast')).toHaveClass(/show/);
  await expect(page.locator('#purchaseToastText')).toContainText(/confirmé|débloqué/i);
});
