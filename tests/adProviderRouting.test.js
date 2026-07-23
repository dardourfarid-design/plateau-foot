// Routage par format de l'assemblage des régies (adProvider.js, composite).
// Vérifie que chaque format — banner / interstitial / rewarded — est bien servi
// par la régie déclarée dans config.ads.providers, et que l'absence de routage
// retombe sur la régie par défaut (AdSense) sans casser le flux.

import { describe, test, expect } from './test-utils.js';

if (typeof globalThis.window === 'undefined') globalThis.window = {};

const adProvider = await import('../public/src/services/ads/adProvider.js');

function setProviders(providers, extra = {}) {
  globalThis.window.__PLATEAU_FOOT_CONFIG__ = { ads: { providers, ...extra } };
}

describe('adProvider (routage par format)', () => {
  test('interstitiel routé vers le mock : affichage simulé disponible', async () => {
    setProviders({ interstitial: 'mock' });
    const res = await adProvider.showInterstitial();
    expect(res.shown).toBe(true); // le mock considère toujours une pub dispo
  });

  test('rewarded routé vers le mock : complétion simulée', async () => {
    setProviders({ rewarded: 'mock' });
    const res = await adProvider.showRewarded({});
    expect(res.completed).toBe(true);
  });

  test('interstitiel routé vers GameMonetize sans gameId : indisponible, jamais bloquant', async () => {
    setProviders({ interstitial: 'gamemonetize' }, { gameMonetize: { gameId: '' } });
    const res = await adProvider.showInterstitial();
    expect(res.shown).toBe(false);
  });

  test('sans routage, rewarded retombe sur la régie par défaut (AdSense, pas d\'unité rewarded)', async () => {
    setProviders(undefined);
    const res = await adProvider.showRewarded({});
    expect(res.completed).toBe(false);
  });

  test('régie inconnue pour un format : repli sur la régie par défaut', async () => {
    setProviders({ interstitial: 'inexistante' });
    const res = await adProvider.showInterstitial();
    // AdSense n'a pas d'unité interstitielle → { shown:false }, sans lever.
    expect(res.shown).toBe(false);
  });
});
