// Provider GameMonetize (interstitiel + rewarded « en attendant AdSense »).
// Sous Node il n'y a ni DOM ni SDK : on vérifie surtout les dégradations
// propres (jamais de blocage, jamais de crédit auto) et le fait que la bannière
// Display n'est pas du ressort de GameMonetize.

import { describe, test, expect } from './test-utils.js';

if (typeof globalThis.window === 'undefined') globalThis.window = {};

const gm = await import('../public/src/services/ads/gameMonetizeProvider.js');

function setGameId(id) {
  globalThis.window.__PLATEAU_FOOT_CONFIG__ = { ads: { gameMonetize: { gameId: id } } };
}

describe('gameMonetizeProvider', () => {
  test('isMock est false (vraie régie)', () => {
    expect(gm.isMock).toBe(false);
  });

  test('init() sans gameId échoue proprement (aucun SDK chargé)', async () => {
    setGameId('');
    expect(await gm.init()).toBe(false);
  });

  test('showBanner() renvoie false : la bannière Display reste à AdSense', async () => {
    setGameId('');
    expect(await gm.showBanner('adBannerHome')).toBe(false);
  });

  test('showInterstitial() sans SDK dégrade en { shown:false } sans lever', async () => {
    setGameId('');
    const res = await gm.showInterstitial();
    expect(res.shown).toBe(false);
  });

  test('showRewarded() sans SDK ne complète pas et ne crédite rien', async () => {
    setGameId('');
    const res = await gm.showRewarded({ nonce: 'x' });
    expect(res.completed).toBe(false);
  });

  test('hideBanner() et destroy() sont des no-op sûrs', () => {
    let threw = false;
    try { gm.hideBanner('adBannerHome'); gm.destroy(); } catch { threw = true; }
    expect(threw).toBe(false);
  });
});
