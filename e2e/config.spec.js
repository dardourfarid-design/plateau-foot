import { test, expect } from './fixtures.js';

// Couverture de l'écran de configuration : bascules de mode, groupes d'options,
// et validation du code en ligne — trous de docs/regression-matrix.md (#147).
// Parcours anonymes, aucun backend (le code court échoue AVANT tout appel réseau).

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.locator('#goToSetupBtn').click();
  await expect(page.locator('#configScreen')).toBeVisible();
});

test('le mode « En ligne » affiche le bloc online et masque le bloc local/IA', async ({ page }) => {
  await page.locator('#modeOptions .setup-option[data-val="online"]').click();
  await expect(page.locator('#onlineBlock')).toBeVisible();
  await expect(page.locator('#localAiBlock')).toBeHidden();

  // Retour au mode 2 joueurs : le bloc local réapparaît, online disparaît.
  await page.locator('#modeOptions .setup-option[data-val="local"]').click();
  await expect(page.locator('#localAiBlock')).toBeVisible();
  await expect(page.locator('#onlineBlock')).toBeHidden();
});

test('le mode « vs IA » révèle le choix de difficulté', async ({ page }) => {
  await expect(page.locator('#aiDifficultyField')).toBeHidden();
  await page.locator('#modeOptions .setup-option[data-val="ai"]').click();
  await expect(page.locator('#aiDifficultyField')).toBeVisible();
});

// Chaque groupe d'options déplace la classe active vers l'option cliquée.
for (const { group, val } of [
  { group: '#variantOptions', val: 'tactique' },
  { group: '#powersOptions', val: 'off' },
  { group: '#formatOptions', val: 'manche' },
  { group: '#goalOptions', val: '5' },
]) {
  test(`sélection d'une option dans ${group}`, async ({ page }) => {
    // Ces réglages vivent désormais dans « Options avancées » (#205), replié par
    // défaut : on le déplie avant d'interagir.
    await page.locator('#advancedOptions .advanced-summary').click();
    const opt = page.locator(`${group} .setup-option[data-val="${val}"]`);
    await opt.click();
    await expect(opt).toHaveClass(/active/);
    // Une seule option active à la fois dans le groupe.
    await expect(page.locator(`${group} .setup-option.active`)).toHaveCount(1);
  });
}

test('un code de partie trop court affiche une erreur (sans appel réseau)', async ({ page }) => {
  await page.locator('#modeOptions .setup-option[data-val="online"]').click();
  await page.locator('#joinCodeInput').fill('AB');
  await page.locator('#joinOnlineBtn').click();
  await expect(page.locator('#onlineError')).not.toHaveText('');
});
