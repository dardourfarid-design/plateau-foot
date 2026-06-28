import { printSummary } from './test-utils.js';

console.log('Plateau Foot — suite de tests du moteur de jeu\n');

await import('./constants.test.js');
await import('./gameEngine.test.js');
await import('./themeManager.test.js');

const success = printSummary();
process.exit(success ? 0 : 1);
