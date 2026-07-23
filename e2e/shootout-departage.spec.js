import { test, expect } from './fixtures.js';

// Départage aux tirs au but (#228) — le départage doit hériter de l'adversaire
// RÉEL de la partie qu'il tranche : 2 joueurs sur le même écran si la manche
// courte se jouait en 'local', l'ordinateur en 'ai'. Exercé via le seam de test
// gated (window.__TM_E2E__ → window.__tmTest) : on force une fin de manche
// courte à égalité puis on rejoue le vrai point d'entrée du moteur
// (handlePostActionEffects), exactement comme game-overlays.spec.js.

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => { window.__TM_E2E__ = true; });
  await page.goto('/');
  await page.locator('#goToSetupBtn').click();
  await page.locator('#startBtn').click();
  await expect(page.locator('#gameScreen')).toBeVisible();
  await page.waitForFunction(() => !!window.__tmTest);
});

// Force une fin de partie à égalité (manche courte) et rejoue les effets
// post-action — c'est le chemin isDraw de handlePostActionEffects qui lance
// startShootoutDepartage(opponent hérité du gameMode).
async function forceDraw(page, gameMode) {
  await page.evaluate((mode) => {
    const t = window.__tmTest;
    t.setGameMode(mode);
    const prev = t.getState();
    t.setState({ score: { bleu: 1, rouge: 1 }, gameOver: true, isDraw: true, winner: null });
    t.applyPostEffects(prev);
  }, gameMode);
}

test('égalité en 2 joueurs locaux → départage Joueur 1 vs Joueur 2', async ({ page }) => {
  await forceDraw(page, 'local');

  // La séance s'ouvre en mode départage (temporisation de 450 ms couverte par
  // l'attente Playwright) et nomme les DEUX humains — pas « Ordinateur ».
  await expect(page.locator('#shootoutScreen')).toBeVisible({ timeout: 5000 });
  await expect(page.locator('#shootoutTitle')).toContainText(/départage/i);
  await expect(page.locator('#soLabelBleu')).toHaveText('Joueur 1');
  await expect(page.locator('#soLabelRouge')).toHaveText('Joueur 2');
  // L'adversaire est hérité : pas de sélecteur de choix en départage.
  await expect(page.locator('#soOpponent')).toBeHidden();
});

test('égalité contre l\'IA → départage face à l\'Ordinateur', async ({ page }) => {
  await forceDraw(page, 'ai');

  await expect(page.locator('#shootoutScreen')).toBeVisible({ timeout: 5000 });
  await expect(page.locator('#soLabelBleu')).toHaveText('Toi');
  await expect(page.locator('#soLabelRouge')).toHaveText('Ordinateur');
  await expect(page.locator('#soOpponent')).toBeHidden();
});

test('départage 2 joueurs : le tir passe la main au gardien humain', async ({ page }) => {
  await forceDraw(page, 'local');
  await expect(page.locator('#shootoutScreen')).toBeVisible({ timeout: 5000 });

  // Joueur 1 tire : JOUER → viser → jauge → TIRER.
  await page.locator('#pkCta').click();
  await expect(page.locator('#pkHint')).toContainText('Joueur 1');
  await page.locator('#pkZones .pk-zone').first().click();
  await expect(page.locator('#pkPowerWrap')).toBeVisible();
  await page.locator('#pkCta').click();

  // Pas de gardien automatique : c'est à Joueur 2 de plonger (pass-and-play).
  await expect(page.locator('#pkHint')).toContainText('Joueur 2');
  await page.locator('#pkZones .pk-zone').last().click();

  // Le tir se résout et un résultat s'affiche.
  await expect(page.locator('#pkResult')).toHaveClass(/show/, { timeout: 6000 });
  await expect(page.locator('#pkResultMain')).not.toHaveText('');
});
