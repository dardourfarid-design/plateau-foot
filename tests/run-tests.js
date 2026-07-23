import { printSummary, runAll } from './test-utils.js';

console.log('Tactic Master — suite de tests du moteur de jeu\n');

await import('./constants.test.js');
await import('./gameEngine.test.js');
await import('./themeManager.test.js');
await import('./ai.test.js');
await import('./multiplayer-protocol.test.js');
await import('./replayActions.test.js');
await import('./edgeEngineSync.test.js');
await import('./playerIdentity.test.js');
await import('./playerAvatar.test.js');
await import('./powers.test.js');
await import('./penaltyShootoutV2.test.js');
await import('./profileUI.test.js');
await import('./mercatoUI.test.js');
await import('./advertisingConsent.test.js');
await import('./adService.test.js');
await import('./adProviderRouting.test.js');
await import('./gameMonetizeProvider.test.js');
await import('./interstitialFrequency.test.js');
await import('./adAnalytics.test.js');
await import('./abTest.test.js');
await import('./tutorial.test.js');
await import('./ai-powers.test.js');
await import('./matchSummary.test.js');
await import('./shareResult.test.js');
await import('./lazyFonts.test.js');
await import('./blog.test.js');
await import('./router.test.js');
await import('./moduleSize.test.js');
await import('./cssBuild.test.js');
await import('./puzzles.test.js');
await import('./boardA11y.test.js');
await import('./houseAds.test.js');
await import('./swPrecache.test.js');
await import('./quickPlayDescriptor.test.js');
await import('./moveFeedback.test.js');
await import('./inviteShare.test.js');
await import('./enLandingGenerated.test.js');

// Les imports ci-dessus ne font qu'ENREGISTRER les tests ; on les exécute
// ici séquentiellement (avec await), pour que les tests async ne s'entrelacent
// pas sur l'état partagé.
await runAll();

const success = printSummary();
process.exit(success ? 0 : 1);
