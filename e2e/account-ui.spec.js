import { test, expect } from './fixtures.js';

// Couverture de la modale de compte côté UI (bascules, validations client) —
// trous de docs/regression-matrix.md (#147). Tous ces parcours sont
// déterministes et SANS backend : les validations testées se déclenchent avant
// tout appel réseau (champs vides, email manquant).

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.locator('#accountBtn').click();
  await expect(page.locator('#accountOverlay')).toBeVisible();
});

test('bascule connexion ⇄ inscription : consentements et pseudo apparaissent', async ({ page }) => {
  // Mode connexion par défaut : pas de bloc consentement, pas de pseudo.
  await expect(page.locator('#consentBlock')).toBeHidden();
  await expect(page.locator('#authDisplayName')).toBeHidden();

  await page.locator('#authSwitchBtn').click();
  await expect(page.locator('#authTitle')).toHaveText('Créer un compte');
  await expect(page.locator('#consentBlock')).toBeVisible();
  await expect(page.locator('#authDisplayName')).toBeVisible();
  // Les 4 cases de consentement sont présentes et décochées par défaut.
  await expect(page.locator('#consentBlock input[type="checkbox"]')).toHaveCount(4);
  await expect(page.locator('#consentAnalytics')).not.toBeChecked();

  await page.locator('#authSwitchBtn').click();
  await expect(page.locator('#authTitle')).toHaveText('Connexion');
  await expect(page.locator('#consentBlock')).toBeHidden();
});

test('mot de passe oublié : affiche la vue de récupération et revient', async ({ page }) => {
  await page.locator('#forgotPasswordBtn').click();
  await expect(page.locator('#forgotPasswordView')).toBeVisible();
  await expect(page.locator('#accountLoggedOutView')).toBeHidden();

  await page.locator('#backToLoginBtn').click();
  await expect(page.locator('#accountLoggedOutView')).toBeVisible();
  await expect(page.locator('#forgotPasswordView')).toBeHidden();
});

test('connexion sans identifiants affiche une erreur (validation client)', async ({ page }) => {
  await page.locator('#authSubmitBtn').click();
  await expect(page.locator('#authError')).not.toHaveText('');
});

test('lien de réinitialisation sans email affiche une erreur (validation client)', async ({ page }) => {
  await page.locator('#forgotPasswordBtn').click();
  await page.locator('#forgotPasswordEmail').fill('');
  await page.locator('#sendResetLinkBtn').click();
  await expect(page.locator('#forgotPasswordError')).not.toHaveText('');
});

// L'overlay reste display:flex en permanence ; c'est la classe `show`
// (opacity + pointer-events) qui pilote son ouverture/fermeture.
test('« Fermer » masque la modale de compte', async ({ page }) => {
  await expect(page.locator('#accountOverlay')).toHaveClass(/show/);
  await page.locator('#accountCloseBtn').click();
  await expect(page.locator('#accountOverlay')).not.toHaveClass(/show/);
});

test('« Mon profil » en anonyme redirige vers la modale de compte', async ({ page }) => {
  // Fermer d'abord la modale ouverte par le beforeEach.
  await page.locator('#accountCloseBtn').click();
  await expect(page.locator('#accountOverlay')).not.toHaveClass(/show/);

  await page.locator('#profileBtn').click();
  await expect(page.locator('#accountOverlay')).toHaveClass(/show/);
  await expect(page.locator('#profileScreen')).toBeHidden();
});
