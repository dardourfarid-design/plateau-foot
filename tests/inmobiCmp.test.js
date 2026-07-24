// Chargeur du CMP InMobi. On verrouille surtout la construction de l'URL :
// une erreur y est silencieuse (script bloqué ou 404, aucun consentement, donc
// aucune pub) — le mode d'échec le plus coûteux rencontré sur cette intégration.

import { describe, test, expect } from './test-utils.js';

if (typeof globalThis.window === 'undefined') globalThis.window = {};

const { cmpScriptUrl, loadInMobiCmp } = await import('../public/src/services/ads/inmobiCmp.js');

describe('inmobiCmp — construction de l\'URL', () => {
  test('sans configuration : aucune URL (échec propre, pas de CMP chargé)', () => {
    expect(cmpScriptUrl(null)).toBe(null);
    expect(cmpScriptUrl({})).toBe(null);
  });

  test('depuis le propertyId : format officiel avec tag_version=V3', () => {
    const url = cmpScriptUrl({ propertyId: 'pLpA6AsDPtRE3' });
    expect(url.indexOf('https://cmp.inmobi.com/choice/pLpA6AsDPtRE3/') === 0).toBe(true);
    expect(url.indexOf('/choice.js?tag_version=V3') !== -1).toBe(true);
  });

  test('scriptUrl explicite : prioritaire sur la construction automatique', () => {
    const url = cmpScriptUrl({ propertyId: 'ABC', scriptUrl: 'https://cmp.inmobi.com/x/choice.js' });
    expect(url).toBe('https://cmp.inmobi.com/x/choice.js');
  });

  test('le propertyId est encodé (jamais injecté brut dans l\'URL)', () => {
    const url = cmpScriptUrl({ propertyId: 'a/b?c' });
    expect(url.indexOf('a%2Fb%3Fc') !== -1).toBe(true);
  });
});

describe('inmobiCmp — chargement', () => {
  // L'environnement est maîtrisé explicitement : d'autres fichiers de test
  // laissent parfois un `document` global, ce qui invaliderait la prémisse.
  test('sans DOM : no-op sûr (importable et testable hors navigateur)', () => {
    const savedDoc = globalThis.document;
    delete globalThis.document;
    try {
      expect(loadInMobiCmp({ propertyId: 'pLpA6AsDPtRE3' })).toBe(false);
    } finally {
      if (savedDoc !== undefined) globalThis.document = savedDoc;
    }
  });

  test('sans propertyId ni scriptUrl : aucun CMP chargé', () => {
    const savedDoc = globalThis.document;
    delete globalThis.document;
    try {
      expect(loadInMobiCmp({})).toBe(false);
    } finally {
      if (savedDoc !== undefined) globalThis.document = savedDoc;
    }
  });
});
