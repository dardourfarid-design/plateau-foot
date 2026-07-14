import { test, expect } from '@playwright/test';

// PWA / hors-ligne (#147) : manifest installable + service worker qui sert
// l'app en cache quand le réseau tombe (stratégie network-first, filet
// hors-ligne). Parcours anonymes, aucun backend.

test('le manifest est lié et valide (nom + icônes)', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', 'manifest.json');

  const manifest = await page.evaluate(async () => {
    const res = await fetch('/manifest.json');
    return res.ok ? res.json() : null;
  });
  expect(manifest).toBeTruthy();
  expect(manifest.name).toBeTruthy();
  expect(Array.isArray(manifest.icons) && manifest.icons.length).toBeTruthy();
});

test('le service worker s\'enregistre et devient actif', async ({ page }) => {
  await page.goto('/');
  const active = await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return false;
    const reg = await navigator.serviceWorker.ready;
    return !!(reg && (reg.active || reg.installing || reg.waiting));
  });
  expect(active).toBeTruthy();
});

test('l\'application reste servie hors-ligne (cache du service worker)', async ({ page, context }) => {
  await page.goto('/');
  // Attendre que le SW soit prêt et contrôle la page (recharge pour prise de contrôle).
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect(page.locator('.logo-title')).toContainText('TACTIC');

  // Couper le réseau : le rechargement doit être servi depuis le cache du SW.
  await context.setOffline(true);
  try {
    await page.reload();
    await expect(page.locator('.logo-title')).toContainText('TACTIC');
    await expect(page.locator('#goToSetupBtn')).toBeVisible();
  } finally {
    await context.setOffline(false);
  }
});
