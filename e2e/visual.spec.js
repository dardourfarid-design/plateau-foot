import { test, expect } from './fixtures.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Régression visuelle (#132) : screenshots de référence comparés à chaque PR.
//
// Les baselines sont générées SUR LINUX (CI ubuntu) par le workflow manuel
// « visual-baselines » puis committées via PR — le rendu (polices, antialiasing)
// diverge entre OS, donc :
//   - hors linux : tests sautés (pas de comparaison possible localement sous
//     Windows/macOS) ;
//   - baselines absentes : tests sautés (le gate ne s'active qu'une fois les
//     références validées et versionnées).
const snapDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'visual.spec.js-snapshots',
);
const hasBaselines = fs.existsSync(snapDir) && fs.readdirSync(snapDir).length > 0;
const updating = process.env.UPDATE_SNAPSHOTS === '1';

test.skip(process.platform !== 'linux', 'baselines linux (CI) uniquement');
test.skip(!hasBaselines && !updating, 'baselines absentes — lancer le workflow visual-baselines');

// Attend un rendu stable (polices chargées) avant la capture.
async function stabilize(page) {
  await page.evaluate(() => (document.fonts ? document.fonts.ready : null));
}

const SHOT = { maxDiffPixelRatio: 0.01, animations: 'disabled' };

test('accueil — visuel', async ({ page }) => {
  await page.goto('/');
  await stabilize(page);
  await expect(page).toHaveScreenshot('accueil.png', SHOT);
});

test('écran de configuration — visuel', async ({ page }) => {
  await page.goto('/');
  await page.locator('#goToSetupBtn').click();
  await expect(page.locator('#configScreen')).toBeVisible();
  await stabilize(page);
  await expect(page).toHaveScreenshot('config.png', SHOT);
});

test('plateau en partie — visuel', async ({ page }) => {
  await page.goto('/');
  await page.locator('#goToSetupBtn').click();
  await page.locator('#startBtn').click();
  await expect(page.locator('#boardGrid .cell')).toHaveCount(63);
  await stabilize(page);
  await expect(page).toHaveScreenshot('partie.png', SHOT);
});

test('modale de compte — visuel', async ({ page }) => {
  await page.goto('/');
  await page.locator('#accountBtn').click();
  await expect(page.locator('#accountOverlay')).toBeVisible();
  await stabilize(page);
  await expect(page).toHaveScreenshot('compte.png', SHOT);
});
