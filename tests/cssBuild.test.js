import { describe, test, expect } from './test-utils.js';
import { buildCss, listCssSources } from '../tools/build-css.mjs';
import { readFileSync } from 'node:fs';
import path from 'node:path';

// #312 — public/styles.css est GÉNÉRÉ depuis public/css/*.css mais COMMITÉ
// (il est servi tel quel en développement). Sans ces tests, on peut modifier
// une source et oublier de régénérer : c'est l'ancienne feuille qui reste en
// ligne, sans que rien ne le signale.

// Les fins de ligne sont normalisées des deux côtés : git les convertit selon
// la plateforme (CRLF sous Windows, LF en CI Linux). Comparer les octets bruts
// rendrait ce test rouge sur une machine et vert sur l'autre — ce qu'il vérifie,
// c'est que le CONTENU correspond, pas l'encodage des sauts de ligne.
const lf = s => s.replace(/\r\n/g, '\n');

const committed = lf(readFileSync(new URL('../public/styles.css', import.meta.url), 'utf8'));

describe('styles.css généré (#312)', () => {
  test('le fichier commité correspond à ses sources', async () => {
    const expected = lf(await buildCss());
    // Comparaison ligne à ligne : un diff de 3 400 lignes est illisible, le
    // numéro de la première ligne divergente ne l'est pas.
    const a = expected.split('\n');
    const b = committed.split('\n');
    const firstDiff = a.findIndex((l, i) => l !== b[i]);
    if (firstDiff !== -1 || a.length !== b.length) {
      throw new Error(
        `styles.css ne correspond plus à public/css/ (1re différence ligne ${firstDiff + 1}). ` +
        'Relance `node tools/build-css.mjs` et commite le résultat.'
      );
    }
    expect(committed.length).toBe(expected.length);
  });

  test('l\'entête prévient que le fichier est généré', () => {
    expect(committed.includes('NE PAS ÉDITER À LA MAIN')).toBe(true);
  });
});

// La lisibilité était l'objet même de #312 : styles.css faisait 3 339 lignes
// d'un bloc. Ce plafond empêche de reconstituer un monolithe fichier par
// fichier. Si une source le dépasse, découpe-la — ne relève pas le plafond.
describe('taille des sources CSS (#312)', () => {
  test('aucun fichier de public/css/ ne dépasse 600 lignes', async () => {
    const files = await listCssSources();
    const tooBig = files
      .map(f => ({ name: path.basename(f), n: readFileSync(f, 'utf8').split('\n').length }))
      .filter(f => f.n > 600);
    if (tooBig.length) {
      throw new Error('Trop long : ' + tooBig.map(f => `${f.name} (${f.n})`).join(', '));
    }
    expect(tooBig.length).toBe(0);
  });

  test('l\'ordre de cascade est porté par un préfixe numérique', async () => {
    // L'ordre alphabétique EST l'ordre de concaténation : un fichier sans
    // préfixe s'intercalerait n'importe où et changerait le rendu.
    for (const f of await listCssSources()) {
      expect(/^\d{2}-/.test(path.basename(f))).toBe(true);
    }
  });
});
