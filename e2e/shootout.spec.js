import { test, expect } from '@playwright/test';

// Séance de tirs au but (#130) — jouable sans compte via le bouton dédié de
// l'écran de configuration (mode standalone). Exerce la boucle complète d'un
// tir : viser une zone → verrouiller la puissance → un résultat s'affiche.
// L'issue du tir (but/arrêt/raté) est aléatoire, mais un résultat est TOUJOURS
// produit — c'est ce qu'on vérifie (pas l'issue précise).

test('lancer une séance de tirs et jouer un tir', async ({ page }) => {
  await page.goto('/');
  await page.locator('#goToSetupBtn').click();
  await page.locator('#launchShootoutBtn').click();

  await expect(page.locator('#shootoutScreen')).toBeVisible();
  await expect(page.locator('#shootoutScoreBleu')).toHaveText('0');
  await expect(page.locator('#shootoutScoreRouge')).toHaveText('0');
  // 6 zones de tir.
  await expect(page.locator('#pkZones .pk-zone')).toHaveCount(6);

  // Démarrer le tour (bouton « JOUER »).
  await page.locator('#pkCta').click();

  // Viser une zone → la jauge de puissance apparaît.
  await page.locator('#pkZones .pk-zone').first().click();
  await expect(page.locator('#pkPowerWrap')).toBeVisible();

  // Verrouiller la puissance (tirer).
  await page.locator('#pkCta').click();

  // Un résultat s'affiche (but / arrêt / raté).
  await expect(page.locator('#pkResult')).toHaveClass(/show/, { timeout: 6000 });
  await expect(page.locator('#pkResultMain')).not.toHaveText('');
});
