// Pont TCF → signal de consentement interne. C'est la logique qui autorise (ou
// non) le chargement des SDK pub : un faux positif ferait charger une régie
// sans consentement (risque RGPD), un faux négatif tuerait tout revenu.

import { describe, test, expect } from './test-utils.js';

if (typeof globalThis.window === 'undefined') globalThis.window = {};

const { grantedFromTcData, isConclusiveStatus, bridgeTcfConsent, GOOGLE_VENDOR_ID } =
  await import('../public/src/services/ads/tcfConsent.js');

const tc = (over = {}) => Object.assign({
  gdprApplies: true,
  purpose: { consents: { 1: true } },
  vendor: { consents: { [GOOGLE_VENDOR_ID]: true } }
}, over);

describe('tcfConsent — mapping du verdict', () => {
  test('hors périmètre RGPD : accordé sans rien exiger', () => {
    expect(grantedFromTcData({ gdprApplies: false })).toBe(true);
  });

  test('consentement complet : accordé', () => {
    expect(grantedFromTcData(tc())).toBe(true);
  });

  test('finalité 1 refusée : refusé (aucune régie ne peut fonctionner)', () => {
    expect(grantedFromTcData(tc({ purpose: { consents: { 1: false } } }))).toBe(false);
  });

  test('vendeur Google explicitement refusé : refusé', () => {
    expect(grantedFromTcData(tc({ vendor: { consents: { [GOOGLE_VENDOR_ID]: false } } }))).toBe(false);
  });

  test('vendeurs non détaillés : on ne bloque pas sur une absence d\'information', () => {
    expect(grantedFromTcData(tc({ vendor: undefined }))).toBe(true);
  });

  test('données absentes ou incomplètes : indécis (null), jamais un faux accord', () => {
    expect(grantedFromTcData(null)).toBe(null);
    expect(grantedFromTcData({ gdprApplies: true })).toBe(null);
  });
});

describe('tcfConsent — statuts et branchement', () => {
  test('seuls tcloaded et useractioncomplete sont concluants', () => {
    expect(isConclusiveStatus('tcloaded')).toBe(true);
    expect(isConclusiveStatus('useractioncomplete')).toBe(true);
    expect(isConclusiveStatus('cmpuishown')).toBe(false); // l'utilisateur n'a pas répondu
  });

  test('sans __tcfapi : no-op sûr (pas de CMP chargé)', () => {
    delete globalThis.window.__tcfapi;
    expect(bridgeTcfConsent(() => {})).toBe(false);
  });

  test('applique le verdict quand le CMP émet un statut concluant', () => {
    const calls = [];
    globalThis.window.__tcfapi = (cmd, v, cb) => {
      if (cmd !== 'addEventListener') return;
      cb(Object.assign(tc(), { eventStatus: 'cmpuishown' }), true);       // ignoré
      cb(Object.assign(tc({ purpose: { consents: { 1: false } } }), { eventStatus: 'useractioncomplete' }), true);
    };
    expect(bridgeTcfConsent(g => calls.push(g))).toBe(true);
    expect(calls.length).toBe(1);   // le statut intermédiaire n'a rien déclenché
    expect(calls[0]).toBe(false);   // refus correctement propagé
    delete globalThis.window.__tcfapi;
  });

  test('un échec du CMP (success=false) ne change rien', () => {
    const calls = [];
    globalThis.window.__tcfapi = (cmd, v, cb) => { if (cmd === 'addEventListener') cb(null, false); };
    bridgeTcfConsent(g => calls.push(g));
    expect(calls.length).toBe(0);
    delete globalThis.window.__tcfapi;
  });
});
