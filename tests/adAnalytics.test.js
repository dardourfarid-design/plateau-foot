// Tests de l'analytics publicitaire (épic pub, PR G / issue #32).
// Invariant : aucun événement émis si le consentement analytics est refusé.

import { describe, test, expect } from './test-utils.js';

if (typeof globalThis.window === 'undefined') globalThis.window = {};

const { setAnalyticsConsent } = await import('../public/src/services/analyticsConsentService.js');
const adAnalytics = await import('../public/src/services/ads/adAnalytics.js');

describe('adAnalytics — gating par consentement', () => {
  test('n\'émet rien si l\'analytics est refusé', async () => {
    const events = [];
    const restore = adAnalytics._setTransport((name, props) => events.push({ name, props }));
    await setAnalyticsConsent(false); // refus explicite

    expect(adAnalytics.track('ad_impression', { format: 'banner' })).toBeFalsy();
    adAnalytics.trackRewardedOptIn();
    adAnalytics.trackRewardedCompleted(true);
    expect(events).toHaveLength(0);

    restore();
  });

  test('émet les événements attendus si l\'analytics est autorisé', async () => {
    const events = [];
    const restore = adAnalytics._setTransport((name, props) => events.push({ name, props }));
    await setAnalyticsConsent(true);

    expect(adAnalytics.trackAdImpression('banner', 'adBannerHome')).toBeTruthy();
    adAnalytics.trackRewardedOptIn();
    adAnalytics.trackRewardedCompleted(false);

    expect(events).toHaveLength(3);
    expect(events[0]).toEqual({ name: 'ad_impression', props: { format: 'banner', slot: 'adBannerHome' } });
    expect(events[1]).toEqual({ name: 'rewarded_opt_in', props: undefined });
    expect(events[2]).toEqual({ name: 'rewarded_result', props: { completed: 'no' } });

    restore();
  });
});
