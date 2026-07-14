import { test, expect } from '@playwright/test';

// Overlay de proposition d'échange mercato (#147) — exercé via le seam de test
// gated (window.__TM_E2E__ → window.__tmMercatoTest.openOffer), car ouvrir cet
// overlay demande normalement un ami réel dans le panneau. On teste l'UI de
// l'overlay (rendu des deux colonnes, validation client de la confirmation,
// fermeture) sans dépendre d'un second compte et SANS créer d'offre (le hook
// n'appelle jamais createMercatoOffer). Déterministe, aucun backend requis.

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => { window.__TM_E2E__ = true; });
  await page.goto('/');
  await page.waitForFunction(() => !!window.__tmMercatoTest);
});

test('proposition d\'échange : overlay, validation client et fermeture', async ({ page }) => {
  // L'overlay vit dans #profileScreen, réellement affiché seulement une fois
  // connecté. Pour ce test d'UI pur (anonyme), on dévoile le conteneur afin que
  // les boutons de l'overlay soient interactifs — aucune donnée backend requise.
  await page.evaluate(() => document.getElementById('profileScreen').classList.remove('hidden'));

  // Ouvre l'overlay ciblant un ami fictif. On attend la résolution (les
  // chargements de collections échouent sans backend, sans incidence sur l'UI).
  await page.evaluate(() =>
    window.__tmMercatoTest.openOffer('friend-test-id', 'Ami Test').catch(() => {}),
  );

  await expect(page.locator('#mercatoOfferOverlay')).toBeVisible();
  await expect(page.locator('#mercatoOfferOverlay')).toHaveClass(/show/);
  await expect(page.locator('#friendPlayerSelectLabel')).toContainText('Ami Test');

  // Validation client : confirmer sans joueur sélectionné des deux côtés
  // affiche une erreur — et n'envoie AUCUNE offre (pas d'appel backend).
  await page.locator('#confirmMercatoOfferBtn').click();
  await expect(page.locator('#mercatoOfferError')).toContainText(/choisis un joueur/i);

  // Fermeture de l'overlay (classe `show`).
  await page.locator('#closeMercatoOfferBtn').click();
  await expect(page.locator('#mercatoOfferOverlay')).not.toHaveClass(/show/);
});
