import { test, expect } from '@playwright/test';

// E2E authentifiés (#129, #147) — actions du profil qui NE MUTENT PAS le backend :
// ouverture/configuration de l'overlay de création de joueur (fermé sans
// sauvegarde) et validation d'une demande d'ami vers un pseudo inexistant.
// Contre le backend de TEST ; se sautent sans identifiants.

const USER = process.env.E2E_USER;
const PASS = process.env.E2E_PASS;

test.skip(!USER || !PASS, 'E2E_USER / E2E_PASS absents — parcours authentifiés sautés');

async function login(page) {
  await page.goto('/');
  await page.locator('#accountBtn').click();
  await expect(page.locator('#accountOverlay')).toBeVisible();
  await page.locator('#authEmail').fill(USER);
  await page.locator('#authPassword').fill(PASS);
  await page.locator('#authSubmitBtn').click();
  const ok = await page
    .waitForFunction(
      () => {
        const b = document.getElementById('accountBtn');
        return !!b && !/non connect/i.test(b.textContent || '');
      },
      { timeout: 15_000 },
    )
    .then(() => true)
    .catch(() => false);
  const detail = ok
    ? ''
    : (await page.locator('#authError').textContent().catch(() => '') || '').trim();
  return { ok, detail };
}

const SKIP_MSG = (detail) =>
  `Connexion au backend de test impossible${detail ? ` ("${detail}")` : ''} — créer le compte ` +
  `E2E_USER sur la branche testing (dashboard Supabase → Authentication → Add user).`;

async function openProfileTab(page, tab) {
  await page.locator('#profileBtn').click();
  await expect(page.locator('#profileScreen')).toBeVisible();
  await page.locator(`.profile-tab[data-tab="${tab}"]`).click();
}

test('création de joueur : ouvrir l\'overlay, choisir des options, fermer sans sauvegarder', async ({ page }) => {
  const { ok, detail } = await login(page);
  test.skip(!ok, SKIP_MSG(detail));

  await openProfileTab(page, 'team');
  await expect(page.locator('#panelTeam')).toBeVisible();

  await page.locator('#openCreatePlayerBtn').click();
  await expect(page.locator('#createPlayerOverlay')).toHaveClass(/show/);

  await page.locator('#newPlayerName').fill('Testeur E2E');
  // Chaque groupe d'options déplace l'état actif vers l'option choisie.
  await page.locator('#newPlayerStyleOptions .setup-option[data-style="costaud"]').click();
  await expect(page.locator('#newPlayerStyleOptions .setup-option[data-style="costaud"]')).toHaveClass(/active/);
  await page.locator('#newPlayerPatternOptions .setup-option[data-pattern="stripes"]').click();
  await expect(page.locator('#newPlayerPatternOptions .setup-option[data-pattern="stripes"]')).toHaveClass(/active/);
  await page.locator('#newPlayerAccessoryOptions .setup-option[data-accessory="star"]').click();
  await expect(page.locator('#newPlayerAccessoryOptions .setup-option[data-accessory="star"]')).toHaveClass(/active/);

  // Fermer SANS confirmer : aucune écriture backend (pas de quota consommé).
  await page.locator('#closeCreatePlayerBtn').click();
  await expect(page.locator('#createPlayerOverlay')).not.toHaveClass(/show/);
});

test('mercato : demande d\'ami vers un pseudo inexistant affiche une erreur', async ({ page }) => {
  const { ok, detail } = await login(page);
  test.skip(!ok, SKIP_MSG(detail));

  await openProfileTab(page, 'mercato');
  await expect(page.locator('#panelMercato')).toBeVisible();

  // Pseudo volontairement inexistant → le backend rejette, aucune relation créée.
  await page.locator('#friendPseudoInput').fill(`__inexistant_${Date.now()}`);
  await page.locator('#sendFriendRequestBtn').click();
  await expect(page.locator('#friendRequestError')).not.toHaveText('', { timeout: 10_000 });
});
