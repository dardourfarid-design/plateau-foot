import { test, expect } from '@playwright/test';

// Tutoriel guidé : jouable sans compte. Vérifie l'ouverture, l'affichage de la
// progression, l'avancement et la fermeture (« Passer »).

test('le tutoriel guidé s\'ouvre, avance et se ferme', async ({ page }) => {
  await page.goto('/');
  await page.locator('#startTutorialBtn').click();

  const bubble = page.locator('#tutorialBubble');
  await expect(bubble).toBeVisible();
  await expect(page.locator('#tutorialProgress')).toContainText('Étape 1/');

  // Avancer d'une étape (le bouton « Suivant » apparaît quand l'étape le permet).
  const next = page.locator('#tutorialNextBtn');
  if (await next.isVisible()) {
    await next.click();
    await expect(page.locator('#tutorialProgress')).not.toContainText('Étape 1/');
  }

  // Fermer via « Passer le tutoriel ».
  await page.locator('#tutorialSkipBtn').click();
  await expect(bubble).toBeHidden();
});
