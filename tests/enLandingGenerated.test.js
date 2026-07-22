import { describe, test, expect } from './test-utils.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { renderEnLanding } from '../tools/build-en.mjs';

// #313 — GARDE-FOU « FICHIER GÉNÉRÉ À JOUR » (même principe que
// edgeEngineSync.test.js pour le moteur des Edge Functions).
//
// public/en/index.html n'est plus maintenu à la main : il est produit par
// tools/build-en.mjs depuis content/enLanding.mjs. Ce test échoue si le fichier
// committé a dérivé de ce que le générateur produit — soit qu'on a édité le
// HTML directement (interdit), soit qu'on a changé le contenu/gabarit sans
// régénérer. Dans les deux cas : `node tools/build-en.mjs` puis commit.

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EN = path.join(ROOT, 'public', 'en', 'index.html');

// Normalise les fins de ligne : le générateur émet du LF, mais un checkout
// Windows (autocrlf) peut présenter le fichier en CRLF. La comparaison porte
// sur le contenu, pas sur la convention de fin de ligne.
const lf = s => s.replace(/\r\n/g, '\n');

describe('landing EN générée (#313)', () => {
  test('public/en/index.html est à jour vis-à-vis de build-en.mjs', () => {
    const committe = lf(readFileSync(EN, 'utf8'));
    const genere = lf(renderEnLanding());
    if (committe !== genere) {
      // Aide au diagnostic : première ligne qui diffère.
      const a = committe.split('\n'), b = genere.split('\n');
      let i = 0;
      while (i < a.length && i < b.length && a[i] === b[i]) i++;
      throw new Error(
        `public/en/index.html a dérivé du générateur (1re différence ligne ${i + 1}).\n` +
        `  committé : ${JSON.stringify(a[i])}\n` +
        `  généré   : ${JSON.stringify(b[i])}\n` +
        `Régénère : node tools/build-en.mjs`
      );
    }
    expect(committe).toBe(genere);
  });
});
