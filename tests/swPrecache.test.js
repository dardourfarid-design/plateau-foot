import { describe, test, expect } from './test-utils.js';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// #325 — GARDE-FOU DU PRÉCACHE DU SERVICE WORKER.
//
// sw.js installe son cache via `cache.addAll(STATIC_ASSETS)`, opération
// ATOMIQUE : si UNE seule des ~65 entrées répond 404, l'installation entière
// échoue et le service worker ne s'active jamais — silencieusement. Une liste
// maintenue à la main (renommage d'un module, découpe d'un fichier) mérite un
// filet qui transforme cet échec d'exécution en échec de build.
//
// Ce test vérifie deux choses, toutes deux sans réseau :
//   1. chaque chemin local existe bien dans public/ (attrape les 404) ;
//   2. aucune entrée n'est une URL que cleanUrls redirigerait en 3xx — c.-à-d.
//      './index.html' ou un chemin en '.html'. C'est le défaut d'origine de
//      #325 : './index.html' existait comme fichier (donc le point 1 ne le
//      voyait pas) mais répondait 308 en production, gaspillant une requête et
//      stockant une réponse redirigée. Seul './' (l'origine) est autorisé.

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = path.join(ROOT, 'public');
const sw = readFileSync(path.join(PUBLIC, 'sw.js'), 'utf8');

// Extrait les littéraux de STATIC_ASSETS. On ne retient que les lignes dont la
// forme commence par une apostrophe : une entrée est `'./x',`, une ligne de
// commentaire commence par `//`. Ce filtre est plus sûr qu'un strip de `//…`,
// car les commentaires du fichier contiennent eux-mêmes des apostrophes ('/').
function staticAssets() {
  const bloc = sw.match(/const STATIC_ASSETS = \[([\s\S]*?)\n\];/);
  if (!bloc) throw new Error('STATIC_ASSETS introuvable dans sw.js');
  return bloc[1]
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.startsWith("'"))
    .map(l => (l.match(/'([^']+)'/) || [])[1])
    .filter(Boolean);
}

describe('précache du service worker (#325)', () => {
  const assets = staticAssets();

  test('la liste n\'est pas vide (extraction correcte)', () => {
    expect(assets.length > 10).toBe(true);
  });

  test('chaque chemin local existe dans public/', () => {
    // Les URLs absolues (http…) ne sont pas dans cette liste aujourd'hui, mais
    // on les ignorerait : le test ne porte que sur les actifs locaux.
    const manquants = assets
      .filter(a => !/^https?:/.test(a))
      .filter(a => a !== './') // './' = l'origine, pas un fichier
      .map(a => a.replace(/^\.\//, ''))
      .filter(rel => !existsSync(path.join(PUBLIC, rel)));
    if (manquants.length) throw new Error(
      `Précaché(s) mais absent(s) de public/ : ${manquants.join(', ')}. ` +
      `cache.addAll est atomique — une seule 404 empêche le SW de s'installer.`
    );
    expect(manquants.length).toBe(0);
  });

  test('aucune entrée que cleanUrls redirigerait (308)', () => {
    // vercel.json : cleanUrls retire '.html' ('/x.html' → '/x', '/index.html'
    // → '/') et trailingSlash:false retire la barre finale. './' (la racine)
    // est la seule exception légitime.
    const redirigees = assets.filter(a => {
      if (a === './') return false;
      if (/\.html$/.test(a)) return true;       // .html → 308
      if (/\/$/.test(a)) return true;           // barre finale → 308
      return false;
    });
    if (redirigees.length) throw new Error(
      `Entrée(s) que cleanUrls redirige en 3xx : ${redirigees.join(', ')}. ` +
      `Précacher une URL redirigée gaspille une requête et stocke une réponse ` +
      `redirigée. Utilise './' pour la racine, et le chemin propre (sans .html) sinon.`
    );
    expect(redirigees.length).toBe(0);
  });
});
