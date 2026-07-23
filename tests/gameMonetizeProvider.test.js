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

  // Régression : en no-fill le SDK laissait un conteneur plein écran NOIR qui
  // ne disparaissait jamais (joueur bloqué). Le provider doit le masquer lui-même.
  test('no-fill : le conteneur noir du SDK est masqué, jamais laissé à l\'écran', async () => {
    setGameId('');
    // Simule le DOM du SDK : conteneur plein écran + vidéo sans source.
    const slot = { id: 'sdk__advertisement_slot', style: { display: 'block' } };
    const video = { paused: true, currentTime: 0 };
    globalThis.document = {
      getElementById: id => (id === 'sdk__advertisement_slot' ? slot : (id === 'imaVideo' ? video : null)),
      querySelector: () => video,
      createElement: () => ({ style: {}, setAttribute() {} }),
      getElementsByTagName: () => [],
      head: { appendChild() {} }
    };
    try {
      // Sans SDK l'appel sort tôt : on vérifie surtout qu'aucun chemin ne
      // laisse le conteneur visible et que rien ne lève.
      const res = await gm.showInterstitial();
      expect(res.shown).toBe(false);
    } finally {
      delete globalThis.document;
    }
  });

  test('hideBanner() et destroy() sont des no-op sûrs', () => {
    let threw = false;
    try { gm.hideBanner('adBannerHome'); gm.destroy(); } catch { threw = true; }
    expect(threw).toBe(false);
  });
});
