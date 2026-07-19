import { describe, test, expect } from './test-utils.js';
import { ARTICLES } from '../content/blog/articles.mjs';
import { readFileSync, existsSync } from 'node:fs';

// #300 — le blog est GÉNÉRÉ (tools/build-blog.mjs) mais COMMITÉ. Ces tests
// garantissent que les fichiers commités correspondent bien aux données : sans
// eux, on peut modifier un article et oublier de régénérer, et c'est l'ancienne
// version qui reste en ligne sans que rien ne le signale.

const read = rel => readFileSync(new URL('../public/' + rel, import.meta.url), 'utf8');
const sitemap = read('sitemap.xml');

describe('blog — cohérence des données (#300)', () => {
  test('au moins un article', () => {
    expect(ARTICLES.length > 0).toBe(true);
  });

  test('slugs uniques, en minuscules, sans accent ni espace', () => {
    const seen = new Set();
    for (const a of ARTICLES) {
      expect(/^[a-z0-9-]+$/.test(a.slug)).toBe(true);
      expect(seen.has(a.slug)).toBe(false);
      seen.add(a.slug);
    }
  });

  // Ces deux champs partent tels quels dans <title> et <meta description> :
  // trop longs, ils sont tronqués par Google ; absents, la page est ignorée.
  test('titres et descriptions dans les longueurs utiles', () => {
    for (const a of ARTICLES) {
      expect(a.title.length > 0 && a.title.length <= 60).toBe(true);
      expect(a.description.length >= 110 && a.description.length <= 165).toBe(true);
    }
  });

  test('dates au format ISO', () => {
    for (const a of ARTICLES) expect(/^\d{4}-\d{2}-\d{2}$/.test(a.date)).toBe(true);
  });

  // Le <h1> est généré depuis `title` : un <h1> dans le corps en ferait deux.
  test('aucun <h1> dans le corps des articles', () => {
    for (const a of ARTICLES) expect(a.body.includes('<h1')).toBe(false);
  });
});

describe('blog — pages générées et commitées (#300)', () => {
  test('chaque article a sa page', () => {
    for (const a of ARTICLES) {
      expect(existsSync(new URL(`../public/blog/${a.slug}.html`, import.meta.url))).toBe(true);
    }
  });

  test('index et pages : un seul <h1>, canonical et JSON-LD présents', () => {
    for (const rel of ['blog.html', ...ARTICLES.map(a => `blog/${a.slug}.html`)]) {
      const html = read(rel);
      expect((html.match(/<h1[ >]/g) || []).length).toBe(1);
      expect(html.includes('rel="canonical"')).toBe(true);
      expect(html.includes('application/ld+json')).toBe(true);
      expect(html.includes('property="og:title"')).toBe(true);
    }
  });

  test('le contenu commité correspond aux données sources', () => {
    for (const a of ARTICLES) {
      const html = read(`blog/${a.slug}.html`);
      expect(html.includes(a.description)).toBe(true);
      // Un fragment stable du corps : détecte un fichier non régénéré.
      const firstPara = a.body.trim().split('\n')[0];
      expect(html.includes(firstPara)).toBe(true);
    }
  });

  test('chaque article figure au sitemap, en URL propre', () => {
    expect(sitemap.includes('/blog</loc>')).toBe(true);
    for (const a of ARTICLES) {
      expect(sitemap.includes(`/blog/${a.slug}</loc>`)).toBe(true);
    }
  });

  // cleanUrls: true — une URL en .html répond 308. Un sitemap ne doit lister
  // que des URLs finales, et un lien interne ne doit pas provoquer de redirection.
  test('aucune URL .html dans le sitemap ni dans les liens internes du blog', () => {
    expect(/\/blog\/[a-z0-9-]+\.html<\/loc>/.test(sitemap)).toBe(false);
    for (const rel of ['blog.html', ...ARTICLES.map(a => `blog/${a.slug}.html`)]) {
      expect(/href="\/blog\/[a-z0-9-]+\.html"/.test(read(rel))).toBe(false);
    }
  });

  test('le blog est atteignable depuis l\'accueil', () => {
    expect(read('index.html').includes('href="/blog"')).toBe(true);
  });

  // #309 : le chemin critique des polices est un acquis à ne pas reperdre par
  // une page de blog qui réintroduirait une famille.
  test('les pages du blog n\'ajoutent aucune police hors des deux autorisées', () => {
    for (const rel of ['blog.html', ...ARTICLES.map(a => `blog/${a.slug}.html`)]) {
      const link = read(rel).split('\n').find(l => l.includes('fonts.googleapis.com/css2')) || '';
      for (const family of ['Anton', 'Archivo', 'Fredoka', 'Space+Mono']) {
        expect(link.includes(family)).toBe(false);
      }
    }
  });
});
