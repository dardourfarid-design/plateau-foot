import { test, expect } from '@playwright/test';

// Overlays but / fin de partie (#147) — exercés via le seam de test gated
// (window.__TM_E2E__ → window.__tmTest), qui force un état de jeu puis rejoue le
// vrai point d'entrée du moteur (handlePostActionEffects). On teste ainsi le
// VRAI chemin d'affichage des overlays et le câblage de leurs boutons, sans
// dépendre d'une partie jouée jusqu'au but (non déterministe via l'UI).

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => { window.__TM_E2E__ = true; });
  await page.goto('/');
  await page.locator('#goToSetupBtn').click();
  await page.locator('#startBtn').click();
  await expect(page.locator('#gameScreen')).toBeVisible();
  // Le seam n'est disponible qu'après init().
  await page.waitForFunction(() => !!window.__tmTest);
});

// Force un état de jeu puis rejoue les effets post-action (comme après un coup).
async function forceState(page, patch) {
  await page.evaluate((p) => {
    const t = window.__tmTest;
    const prev = t.getState();       // état d'avant (lastGoalBy nul en début de partie)
    t.setState(p);
    t.applyPostEffects(prev);
  }, patch);
}

test('overlay BUT s\'affiche puis « Continuer » reprend la partie', async ({ page }) => {
  await forceState(page, {
    score: { bleu: 1, rouge: 0 }, lastGoalBy: 'bleu',
    gameOver: false, winner: null, isDraw: false,
  });
  await expect(page.locator('#goalOverlay')).toHaveClass(/show/);
  await expect(page.locator('#goalSub')).not.toHaveText('');

  await page.locator('#continueBtn').click();
  await expect(page.locator('#goalOverlay')).not.toHaveClass(/show/);
  await expect(page.locator('#gameScreen')).toBeVisible();
});

test('overlay FIN de partie (victoire bleue) puis « Rejouer » → configuration', async ({ page }) => {
  await forceState(page, {
    score: { bleu: 3, rouge: 1 }, lastGoalBy: 'bleu',
    gameOver: true, winner: 'bleu', isDraw: false,
  });
  await expect(page.locator('#endOverlay')).toHaveClass(/show/);
  await expect(page.locator('#endTitle')).toHaveClass(/bleu/);
  await expect(page.locator('#endSub')).toContainText('3');

  await page.locator('#newGameBtn').click();
  await expect(page.locator('#endOverlay')).not.toHaveClass(/show/);
  await expect(page.locator('#configScreen')).toBeVisible();
});

test('« Terminer le tour » apparaît en phase de passe et passe la main', async ({ page }) => {
  // Place la partie dans l'état "pion déplacé, peut encore passer" : c'est le
  // seul moment où le bouton « Terminer le tour » est proposé.
  await page.evaluate(() => {
    const t = window.__tmTest;
    t.setState({ phase: t.PHASES.MOVED_CAN_PASS, turn: 'bleu' });
    t.applyPostEffects(t.getState());
  });
  await expect(page.locator('#endTurnBtn')).toBeVisible();
  await expect(page.locator('#turnBanner')).toContainText(/bleu/i);

  await page.locator('#endTurnBtn').click();
  await expect(page.locator('#turnBanner')).toContainText(/rouge/i);
  await expect(page.locator('#endTurnBtn')).toBeHidden();
});

test('overlay FIN de partie (victoire rouge) puis « ← Accueil » → configuration', async ({ page }) => {
  await forceState(page, {
    score: { bleu: 1, rouge: 3 }, lastGoalBy: 'rouge',
    gameOver: true, winner: 'rouge', isDraw: false,
  });
  await expect(page.locator('#endOverlay')).toHaveClass(/show/);
  await expect(page.locator('#endTitle')).toHaveClass(/rouge/);

  await page.locator('#backToSetupFromEndBtn').click();
  await expect(page.locator('#endOverlay')).not.toHaveClass(/show/);
  await expect(page.locator('#configScreen')).toBeVisible();
});
