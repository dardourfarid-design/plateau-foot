import { readFileSync } from 'node:fs';
import { describe, test, expect } from './test-utils.js';
import { ENGINE_FILES, readPair } from '../tools/sync-edge-engine.mjs';
import { buildBundle, OUTPUT } from '../tools/bundle-edge-function.mjs';

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

// Le bundle mono-fichier (déploiement manuel) doit rester le reflet exact des
// sources : sinon on distribuerait un moteur périmé à coller dans le dashboard.
// Correctif en cas d'échec : `node tools/bundle-edge-function.mjs`.
describe('bundle mono-fichier de l’Edge Function', () => {
  test('push-game-state.single.ts est à jour vis-à-vis des sources', () => {
    let committed = null;
    // Normalise en LF : sur un checkout Windows (autocrlf) le fichier peut être
    // en CRLF, alors que buildBundle() produit toujours du LF.
    try { committed = readFileSync(OUTPUT, 'utf8').replace(/\r\n/g, '\n'); } catch { /* absent = échec */ }
    expect(committed).toBeTruthy();
    expect(committed).toBe(buildBundle());
  });
});
