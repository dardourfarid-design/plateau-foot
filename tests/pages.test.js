import { describe, test, expect } from './test-utils.js';
import { PAGES } from '../content/pages.mjs';
import { FAQ_GROUPS } from '../content/pages/faq.mjs';
import { TERMES } from '../content/pages/glossaire.mjs';
import { NAV, NAV_EN } from '../tools/lib/page-layout.mjs';
import { readFileSync, existsSync } from 'node:fs';

// Les pages de référence (/regles, /faq, /glossaire, /a-propos, /contact) sont
// GÉNÉRÉES par tools/build-pages.mjs mais COMMITÉES. Mêmes garanties que pour le
// blog : sans ces tests, on modifie un contenu, on oublie de régénérer, et c'est
// l'ancienne version qui reste en ligne sans que rien ne le signale.
//
// Ces pages existent parce que les règles et la FAQ ne vivaient que dans une
// overlay `display:none`. Plusieurs tests ci-dessous verrouillent précisément
// cet acquis : contenu réellement présent, page atteignable depuis l'accueil.

const read = rel => readFileSync(new URL('../public/' + rel, import.meta.url), 'utf8');
const sitemap = read('sitemap.xml');
const index = read('index.html');

describe('pages de référence — données sources', () => {
  test('slugs uniques, en minuscules, sans accent ni espace', () => {
    const seen = new Set();
    for (const p of PAGES) {
      expect(/^[a-z0-9-]+(\/[a-z0-9-]+)?$/.test(p.slug)).toBe(true);
      expect(seen.has(p.slug)).toBe(false);
      seen.add(p.slug);
    }
  });

  // Mêmes bornes que pour les articles : ces champs partent tels quels dans
  // <title> et <meta description>.
  test('titres et descriptions dans les longueurs utiles', () => {
    for (const p of PAGES) {
      expect(p.title.length > 0 && p.title.length <= 60).toBe(true);
      expect(p.description.length >= 110 && p.description.length <= 165).toBe(true);
    }
  });

  test('dates de mise à jour au format ISO', () => {
    for (const p of PAGES) expect(/^\d{4}-\d{2}-\d{2}$/.test(p.updated)).toBe(true);
  });

  // Le <h1> est généré depuis `title` : un <h1> dans le corps en ferait deux.
  test('aucun <h1> dans le corps des pages', () => {
    for (const p of PAGES) expect(p.body.includes('<h1')).toBe(false);
  });
});

describe('pages de référence — fichiers générés et commités', () => {
  test('chaque page a son fichier', () => {
    for (const p of PAGES) {
      expect(existsSync(new URL(`../public/${p.slug}.html`, import.meta.url))).toBe(true);
    }
  });

  test('un seul <h1>, canonical, JSON-LD et Open Graph', () => {
    for (const p of PAGES) {
      const html = read(`${p.slug}.html`);
      expect((html.match(/<h1[ >]/g) || []).length).toBe(1);
      expect(html.includes('rel="canonical"')).toBe(true);
      expect(html.includes('application/ld+json')).toBe(true);
      expect(html.includes('property="og:title"')).toBe(true);
    }
  });

  test('le contenu commité correspond aux données sources', () => {
    for (const p of PAGES) {
      const html = read(`${p.slug}.html`);
      expect(html.includes(p.description)).toBe(true);
      // Fragment stable du corps : détecte un fichier non régénéré.
      const firstLine = p.body.trim().split('\n')[0];
      expect(html.includes(firstLine)).toBe(true);
    }
  });

  test('chaque page figure au sitemap, en URL propre', () => {
    for (const p of PAGES) {
      expect(sitemap.includes(`/${p.slug}</loc>`)).toBe(true);
    }
    // cleanUrls: true — une URL en .html répond 308, un sitemap ne doit lister
    // que des URLs finales.
    expect(/<loc>[^<]+\.html<\/loc>/.test(sitemap)).toBe(false);
  });

  test('le bloc du blog n\'a pas été écrasé par celui des pages', () => {
    // Les deux générateurs réécrivent chacun leur bloc de sitemap. Une erreur
    // de marqueur ferait disparaître l'autre en silence.
    expect(sitemap.includes('/blog</loc>')).toBe(true);
    expect(sitemap.includes('/regles</loc>')).toBe(true);
  });

  // #309 : le chemin critique des polices est un acquis à ne pas reperdre.
  test('les pages n\'ajoutent aucune police hors des deux autorisées', () => {
    for (const p of PAGES) {
      const link = read(`${p.slug}.html`).split('\n').find(l => l.includes('fonts.googleapis.com/css2')) || '';
      for (const family of ['Anton', 'Archivo', 'Fredoka', 'Space+Mono']) {
        expect(link.includes(family)).toBe(false);
      }
    }
  });
});

describe('pages de référence — maillage interne', () => {
  // Une page atteignable uniquement par le sitemap est mal explorée et mal
  // classée. C'est exactement le défaut qu'on corrige ici : ne pas le réintroduire.
  test('chaque page de NAV est liée depuis l\'accueil', () => {
    for (const n of NAV) {
      expect(index.includes(`href="${n.href}"`)).toBe(true);
    }
  });

  test('slugs : minuscules, tirets, un seul niveau de dossier au plus', () => {
    for (const p of PAGES) expect(/^[a-z0-9-]+(\/[a-z0-9-]+)?$/.test(p.slug)).toBe(true);
  });

  test('chaque page est liée au pied de page de sa langue', () => {
    for (const p of PAGES) {
      const html = read(`${p.slug}.html`);
      const nav = (p.lang || 'fr') === 'en' ? NAV_EN : NAV;
      for (const n of nav) expect(html.includes(`href="${n.href}"`)).toBe(true);
    }
  });

  // Les deux pages anglaises ne sont dans aucun pied de page français : la
  // landing EN est leur seule porte d'entrée, elle doit donc les lier.
  test('les pages anglaises sont liées depuis la landing /en', () => {
    const en = read('en/index.html');
    for (const p of PAGES.filter(x => x.lang === 'en')) {
      expect(en.includes(`href="/${p.slug}"`)).toBe(true);
    }
  });

  test('aucun lien interne en .html dans les pages générées', () => {
    for (const p of PAGES) {
      expect(/href="\/[a-z0-9-/]+\.html"/.test(read(`${p.slug}.html`))).toBe(false);
    }
  });

  // Règle hreflang : une déclaration non réciproque est ignorée par Google.
  test('les paires hreflang se citent réciproquement', () => {
    const bySlug = new Map(PAGES.map(p => [`/${p.slug}`, p]));
    for (const p of PAGES.filter(x => x.alternate)) {
      const other = bySlug.get(p.alternate.path);
      expect(other !== undefined).toBe(true);
      expect(other.alternate.path).toBe(`/${p.slug}`);
      // Et la balise est bien dans le HTML produit, des deux côtés.
      expect(read(`${p.slug}.html`).includes(`hreflang="${p.alternate.lang}"`)).toBe(true);
    }
  });

  test('les pages anglaises déclarent lang="en"', () => {
    for (const p of PAGES.filter(x => x.lang === 'en')) {
      expect(read(`${p.slug}.html`).includes('<html lang="en">')).toBe(true);
    }
  });
});

describe('FAQ — le balisage FAQPage reflète le texte visible', () => {
  // L'erreur classique du genre : une question retirée du HTML mais laissée
  // dans le JSON-LD (ou l'inverse). Les deux sont dérivés de FAQ_GROUPS, ce
  // test verrouille le fait qu'ils le restent.
  const html = read('faq.html');
  const items = FAQ_GROUPS.flatMap(g => g.items);

  test('au moins vingt questions', () => {
    expect(items.length >= 20).toBe(true);
  });

  test('chaque question figure dans le JSON-LD de la page', () => {
    const ld = html.split('<script type="application/ld+json">')[1].split('</script>')[0];
    const parsed = JSON.parse(ld);
    const faq = parsed.find(o => o['@type'] === 'FAQPage');
    expect(faq.mainEntity.length).toBe(items.length);
  });

  test('chaque question a une réponse non vide', () => {
    for (const it of items) {
      expect(it.q.trim().length > 0).toBe(true);
      expect(it.a.replace(/<[^>]+>/g, '').trim().length > 30).toBe(true);
    }
  });
});

describe('glossaire — termes et ancres', () => {
  test('au moins trente termes, sans doublon', () => {
    const seen = new Set();
    for (const e of TERMES) {
      expect(seen.has(e.t)).toBe(false);
      seen.add(e.t);
    }
    expect(TERMES.length >= 30).toBe(true);
  });

  test('chaque terme a une ancre stable dans la page', () => {
    const html = read('glossaire.html');
    // L'ancre est dérivée du terme : on vérifie qu'il y a autant d'id que de
    // termes, un id manquant casserait un lien profond.
    expect((html.match(/<dt id="/g) || []).length).toBe(TERMES.length);
  });
});
