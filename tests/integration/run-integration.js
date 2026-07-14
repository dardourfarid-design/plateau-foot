// ===================== RUNNER TESTS D'INTÉGRATION SUPABASE =====================
// Épic tests / issue #128. Exécute des tests contre un VRAI backend Supabase de
// test (branche `testing`), jamais la prod. Se saute proprement (exit 0) si les
// secrets ne sont pas fournis (exécution locale, forks) — ainsi la CI reste
// verte partout, et ne teste réellement que là où les secrets existent.
//
// Secrets attendus (voir docs/supabase-branching.md, issue #139) :
//   TEST_SUPABASE_URL, TEST_SUPABASE_ANON_KEY  (obligatoires)
//   E2E_USER, E2E_PASS                          (optionnels : tests authentifiés)

import { printSummary, runAll } from '../test-utils.js';

const url = process.env.TEST_SUPABASE_URL;
const anonKey = process.env.TEST_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.log('Intégration Supabase : TEST_SUPABASE_URL / TEST_SUPABASE_ANON_KEY absents → tests sautés.');
  process.exit(0);
}

// Rendu accessible aux fichiers de test (chargés dynamiquement ci-dessous).
globalThis.__TM_TEST_SUPABASE__ = {
  url,
  anonKey,
  user: process.env.E2E_USER || null,
  pass: process.env.E2E_PASS || null
};

console.log('Tactic Master — tests d\'intégration Supabase (backend de test)\n');

await import('./supabase.integration.test.js');

await runAll();
process.exit(printSummary() ? 0 : 1);
