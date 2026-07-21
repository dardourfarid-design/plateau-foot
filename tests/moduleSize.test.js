import { describe, test, expect } from './test-utils.js';
import { readFileSync } from 'node:fs';

// #311 — GARDE-FOU ANTI-REGONFLEMENT.
//
// main.js avait déjà été ramené de ~1500 à ~1174 lignes par l'épic #156. Il
// était remonté à 1618 avant cette issue : le découpage seul ne tient pas, il
// faut quelque chose qui échoue quand le fichier regrossit.
//
// Ce test EST la livraison de #311. Sans lui, l'extraction serait à refaire
// dans trois mois.
//
// SI CE TEST ÉCHOUE : n'augmente pas le plafond par réflexe. Demande-toi
// d'abord si le code ajouté a sa place dans main.js — c'est un orchestrateur
// (amorçage, câblage, boucle de jeu), pas un fourre-tout. Les écrans et les
// fonctionnalités vont dans leur propre module UI, avec le pattern `deps`
// utilisé par shopUI / overlaysUI / dailyPuzzleUI / settingsUI.

const lineCount = rel =>
  readFileSync(new URL('../public/src/' + rel, import.meta.url), 'utf8')
    .split('\n').length;

// Plafonds volontairement serrés : la marge au-dessus du réel est d'environ
// 5 %, assez pour une correction de bug, trop peu pour y loger une
// fonctionnalité entière sans s'en rendre compte.
const LIMITS = {
  'ui/main.js': 1450
};

describe('taille des modules (#311)', () => {
  for (const [rel, max] of Object.entries(LIMITS)) {
    test(`${rel} reste sous ${max} lignes`, () => {
      const n = lineCount(rel);
      // Le message porte le chiffre réel : sans lui, un échec en CI oblige à
      // rejouer le test en local pour savoir de combien on dépasse.
      if (n > max) throw new Error(
        `${rel} fait ${n} lignes (plafond ${max}). ` +
        `Extrais un module plutôt que de relever le plafond — voir l'en-tête de ce fichier.`
      );
      expect(n <= max).toBe(true);
    });
  }
});
