import { printSummary } from './test-utils.js';

console.log('Tactic Master — suite de tests du moteur de jeu\n');

await import('./constants.test.js');
await import('./gameEngine.test.js');
await import('./themeManager.test.js');
await import('./ai.test.js');
await import('./multiplayer-protocol.test.js');
await import('./playerIdentity.test.js');
await import('./playerAvatar.test.js');
await import('./powers.test.js');
await import('./penaltyShootout.test.js');
await import('./penaltyShootoutV2.test.js');
await import('./profileUI.test.js');
await import('./mercatoUI.test.js');

const success = printSummary();
process.exit(success ? 0 : 1);
