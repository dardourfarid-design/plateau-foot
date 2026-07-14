import { test, expect } from '@playwright/test';

// Retour de paiement Stripe (#147) : après Checkout, Stripe renvoie sur l'app
// avec `?checkout=success|cancelled` → toast de confirmation/annulation. C'est
// la partie de l'UX de paiement qui est déterministe et testable sans backend
// ni Stripe (le flux Checkout complet est couvert à part, cf. auth/shop-purchase).

test('retour succès : toast de confirmation', async ({ page }) => {
  await page.goto('/?checkout=success');
  await expect(page.locator('#purchaseToast')).toHaveClass(/show/);
  await expect(page.locator('#purchaseToast')).not.toHaveClass(/cancelled/);
  await expect(page.locator('#purchaseToastText')).toContainText(/confirmé|débloqué/i);
});

test('retour annulé : toast d\'annulation, aucun débit', async ({ page }) => {
  await page.goto('/?checkout=cancelled');
  await expect(page.locator('#purchaseToast')).toHaveClass(/show/);
  await expect(page.locator('#purchaseToast')).toHaveClass(/cancelled/);
  await expect(page.locator('#purchaseToastText')).toContainText(/annulé/i);
});

test('le paramètre checkout est nettoyé de l\'URL après affichage', async ({ page }) => {
  await page.goto('/?checkout=success');
  await expect(page.locator('#purchaseToast')).toHaveClass(/show/);
  // history.replaceState retire ?checkout pour qu'un refresh ne rejoue pas le toast.
  await expect(page).not.toHaveURL(/checkout=/);
});
