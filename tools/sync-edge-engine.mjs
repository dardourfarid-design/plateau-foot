// Synchronise les copies du moteur utilisées par l'Edge Function
// push-game-state (#260). Supabase n'embarque au déploiement que les fichiers
// situés SOUS supabase/functions/ : un import vers public/src/engine/ échoue
// (« Module not found »). On maintient donc une copie versionnée sous
// supabase/functions/push-game-state/_engine/, identique octet pour octet.
//
// Usage : `node tools/sync-edge-engine.mjs` après toute modification du moteur.
// Le test tests/edgeEngineSync.test.js échoue si les copies ont dérivé.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(root, 'public', 'src', 'engine');
const DST = join(root, 'supabase', 'functions', 'push-game-state', '_engine');

// Sous-ensemble du moteur atteignable depuis replayActions.js
// (replayActions → gameEngine → constants). À étendre si l'arbre grandit.
export const ENGINE_FILES = ['constants.js', 'gameEngine.js', 'replayActions.js'];

export function readPair(name) {
  return {
    src: readFileSync(join(SRC, name), 'utf8'),
    dst: (() => { try { return readFileSync(join(DST, name), 'utf8'); } catch { return null; } })()
  };
}

function main() {
  mkdirSync(DST, { recursive: true });
  let changed = 0;
  for (const name of ENGINE_FILES) {
    const { src, dst } = readPair(name);
    if (src !== dst) { writeFileSync(join(DST, name), src); changed++; console.log('sync', name); }
  }
  console.log(changed ? `${changed} fichier(s) synchronisé(s).` : 'Déjà à jour.');
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('sync-edge-engine.mjs')) {
  main();
}
