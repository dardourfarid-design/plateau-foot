import { describe, test, expect } from './test-utils.js';
import { ENGINE_FILES, readPair } from '../tools/sync-edge-engine.mjs';

// #260 — l'Edge Function push-game-state importe le moteur depuis une copie
// versionnée sous supabase/functions/push-game-state/_engine/ (dans le dossier
// de la fonction, seule zone embarquée de façon fiable au déploiement). Ce test
// garantit que la copie n'a pas dérivé de la source public/src/engine/ : sans
// lui, une modif du moteur non resynchronisée ferait valider le client mais
// rejouer un moteur périmé côté serveur.
// Correctif en cas d'échec : `node tools/sync-edge-engine.mjs`.

describe('copie moteur de l’Edge Function (_engine)', () => {
  for (const name of ENGINE_FILES) {
    test(`${name} est identique à public/src/engine/${name}`, () => {
      const { src, dst } = readPair(name);
      expect(dst).toBeTruthy(); // la copie doit exister
      expect(dst).toBe(src);    // et être identique octet pour octet
    });
  }
});
