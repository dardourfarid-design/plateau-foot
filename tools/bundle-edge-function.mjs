// Génère une version MONO-FICHIER de l'Edge Function push-game-state, avec le
// moteur inliné (aucun import local) : à coller telle quelle comme index.ts
// pour un déploiement 100 % manuel (tableau de bord Supabase), sans avoir à
// recréer le dossier _engine/.
//
// La sortie est committée dans tools/generated/push-game-state.single.ts et
// vérifiée par tests/edgeEngineSync.test.js (elle ne peut pas dériver des
// sources). Régénérer après toute modif du moteur ou de index.ts :
//   node tools/bundle-edge-function.mjs

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const FN = join(root, 'supabase', 'functions', 'push-game-state');
export const OUTPUT = join(root, 'tools', 'generated', 'push-game-state.single.ts');

// Retire les imports dont la source est LOCALE (commence par '.'), y compris
// multi-lignes. Conserve les imports distants (jsr:, https:).
function stripLocalImports(code) {
  return code.replace(/^import[\s\S]*?from\s*['"]\.[^'"]*['"];?\r?\n/gm, '');
}

// Retire TOUS les imports d'un fichier (utilisé pour index.ts, dont on replace
// l'import distant en tête du bundle).
function stripAllImports(code) {
  return code.replace(/^import[\s\S]*?from\s*['"][^'"]*['"];?\r?\n/gm, '');
}

export function buildBundle() {
  const constants = readFileSync(join(FN, '_engine', 'constants.js'), 'utf8');
  const gameEngine = stripLocalImports(readFileSync(join(FN, '_engine', 'gameEngine.js'), 'utf8'));
  const replayActions = stripLocalImports(readFileSync(join(FN, '_engine', 'replayActions.js'), 'utf8'));
  const indexBody = stripAllImports(readFileSync(join(FN, 'index.ts'), 'utf8'));

  const header =
`// ============================================================================
// push-game-state — VERSION MONO-FICHIER (GÉNÉRÉE — NE PAS ÉDITER À LA MAIN)
// ============================================================================
// Fichier prêt à coller comme "index.ts" dans le tableau de bord Supabase pour
// un déploiement 100 % manuel : le moteur du jeu est inliné, aucun import local
// (donc aucun dossier _engine/ à recréer). Source de vérité et déploiement CLI :
// supabase/functions/push-game-state/ (index.ts + _engine/).
//
// Régénérer : node tools/bundle-edge-function.mjs
// ============================================================================
// @ts-nocheck

import { createClient } from 'jsr:@supabase/supabase-js@2';
`;

  const sep = (title) => `\n// ==================== ${title} ====================\n`;

  return [
    header,
    sep('MOTEUR (inliné depuis public/src/engine via _engine)'),
    constants.trimEnd(), '',
    gameEngine.trimEnd(), '',
    replayActions.trimEnd(), '',
    sep('HANDLER (depuis index.ts)'),
    indexBody.trimStart().trimEnd(), ''
  ].join('\n');
}

function main() {
  mkdirSync(dirname(OUTPUT), { recursive: true });
  writeFileSync(OUTPUT, buildBundle());
  console.log('Généré :', OUTPUT);
}

if (process.argv[1]?.endsWith('bundle-edge-function.mjs')) main();
