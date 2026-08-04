// ===================== GÉNÉRATEUR DU BLOG (#300) =====================
// Produit public/blog.html (servi en /blog) et une page par article depuis
// content/blog/articles.mjs, puis remet à jour les entrées /blog du sitemap.
//
//   node tools/build-blog.mjs
//
// Les fichiers produits sont COMMITÉS (pas de génération au déploiement) : le
// blog doit rester servi en HTML statique, lisible par les robots sans
// JavaScript. tools/build.mjs se contente ensuite de les copier vers dist/.
//
// Le HTML n'est pas minifié : il est copié verbatim par le build, ce qui rend
// les balises servies identiques à celles qu'on relit ici.
//
// L'en-tête, le pied de page et l'origine vivent dans tools/lib/page-layout.mjs,
// partagés avec tools/build-pages.mjs (règles, FAQ, glossaire…) : une page
// ajoutée à NAV apparaît dans le pied de page du blog ET des pages de référence.

import { ARTICLES } from '../content/blog/articles.mjs';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ORIGIN, esc, frDate, head, header, footer, cta, breadcrumb
} from './lib/page-layout.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'public', 'blog');

function buildArticle(a) {
  const url = `${ORIGIN}/blog/${a.slug}`;
  const jsonLd = [{
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: a.title,
    description: a.description,
    datePublished: a.date,
    dateModified: a.date,
    image: `${ORIGIN}/og-image.jpg`,
    // Auteur = l'organisation, pas une personne nommée : l'éditeur ne souhaite
    // pas être identifié (décision du 2026-08-04). `/a-propos` porte alors seul
    // le signal d'expertise, via la méthode de vérification des contenus.
    author: { '@type': 'Organization', name: 'Tactic Master', url: `${ORIGIN}/a-propos` },
    publisher: { '@type': 'Organization', name: 'Tactic Master', url: ORIGIN },
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    isAccessibleForFree: true,
    inLanguage: 'fr'
  }, breadcrumb([
    { name: 'Accueil', path: '/' },
    { name: 'Blog', path: '/blog' },
    { name: a.title, path: `/blog/${a.slug}` }
  ])];

  // Lectures liées : les deux articles suivants dans l'ordre de publication,
  // en boucle. Sans ce bloc, chaque article est un cul-de-sac — un visiteur
  // (et un robot) n'y voit qu'une page isolée au lieu d'un corpus.
  const i = ARTICLES.findIndex(x => x.slug === a.slug);
  const related = [1, 2]
    .map(k => ARTICLES[(i + k) % ARTICLES.length])
    .filter(x => x && x.slug !== a.slug);

  const relatedHtml = related.length ? `
<nav class="blog-related" aria-label="À lire ensuite">
  <h2>À lire ensuite</h2>
  <ul>${related.map(r => `
    <li><a href="/blog/${r.slug}">${esc(r.title)}</a> — ${esc(r.description)}</li>`).join('')}
  </ul>
</nav>` : '';

  return head({ title: `${a.title} — Tactic Master`, description: a.description, url, jsonLd })
    + header()
    + `\n<main class="blog-article">
  <p class="blog-date"><time datetime="${a.date}">${frDate(a.date)}</time></p>
  <h1>${esc(a.title)}</h1>
${a.body.trim()}
${relatedHtml}
${cta()}
</main>`
    + footer();
}

function buildIndex() {
  const url = `${ORIGIN}/blog`;
  const cards = ARTICLES.map(a => `
    <li class="blog-card">
      <a href="/blog/${a.slug}">
        <p class="blog-date"><time datetime="${a.date}">${frDate(a.date)}</time></p>
        <h2>${esc(a.title)}</h2>
        <p class="blog-excerpt">${esc(a.description)}</p>
        <span class="blog-more">Lire →</span>
      </a>
    </li>`).join('');

  return head({
    title: 'Le blog — Tactic Master',
    description: 'Règles, stratégies et coulisses de Tactic Master, le jeu de plateau de foot gratuit jouable dans le navigateur.',
    url,
    ogType: 'website',
    jsonLd: [{
      '@context': 'https://schema.org',
      '@type': 'Blog',
      name: 'Le blog de Tactic Master',
      url,
      inLanguage: 'fr',
      blogPost: ARTICLES.map(a => ({
        '@type': 'BlogPosting',
        headline: a.title,
        datePublished: a.date,
        url: `${ORIGIN}/blog/${a.slug}`
      }))
    }, breadcrumb([
      { name: 'Accueil', path: '/' },
      { name: 'Blog', path: '/blog' }
    ])]
  })
    + header()
    + `\n<main class="blog-index">
  <h1>Le blog</h1>
  <p class="blog-intro">Les règles en détail, des stratégies concrètes, et de temps
     en temps les coulisses du développement. Pour la référence exhaustive, voir
     les <a href="/regles">règles complètes</a>, la <a href="/faq">FAQ</a> et le
     <a href="/glossaire">glossaire</a>.</p>
  <ul class="blog-list">${cards}
  </ul>
${cta()}
</main>`
    + footer();
}

// --- Sitemap : réécrit le bloc /blog, sans toucher au reste ------------------
async function updateSitemap() {
  const file = path.join(ROOT, 'public', 'sitemap.xml');
  let xml = await readFile(file, 'utf8');

  const MARK_START = '  <!-- blog:début (généré par tools/build-blog.mjs) -->';
  const MARK_END = '  <!-- blog:fin -->';

  const entries = [{ loc: `${ORIGIN}/blog`, lastmod: ARTICLES[0]?.date, priority: '0.7' }]
    .concat(ARTICLES.map(a => ({ loc: `${ORIGIN}/blog/${a.slug}`, lastmod: a.date, priority: '0.6' })))
    .map(e => `  <url>
    <loc>${e.loc}</loc>
    <lastmod>${e.lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>${e.priority}</priority>
  </url>`).join('\n');

  const block = `${MARK_START}\n${entries}\n${MARK_END}`;

  if (xml.includes(MARK_START)) {
    // Les marqueurs contiennent des parenthèses et des points : sans échappement,
    // ils sont lus comme des groupes de capture et le remplacement échoue en
    // silence — le sitemap gardait alors ses anciennes entrées.
    const rx = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    xml = xml.replace(new RegExp(`${rx(MARK_START)}[\\s\\S]*?${rx(MARK_END)}`), block);
  } else {
    xml = xml.replace('</urlset>', `${block}\n</urlset>`);
  }
  await writeFile(file, xml, 'utf8');
}

await mkdir(OUT_DIR, { recursive: true });
// L'index vit en public/blog.html, PAS en public/blog/index.html : avec
// cleanUrls, Vercel sert alors /blog exactement comme il sert déjà /terms et
// /privacy — un mécanisme éprouvé sur ce site. S'appuyer sur la résolution
// d'index de répertoire ferait dépendre l'URL d'un comportement non testé
// localement (le serveur statique de dev renvoie 404 sur /blog).
await writeFile(path.join(ROOT, 'public', 'blog.html'), buildIndex(), 'utf8');
console.log('✓ blog.html (servi en /blog)');
for (const a of ARTICLES) {
  await writeFile(path.join(OUT_DIR, `${a.slug}.html`), buildArticle(a), 'utf8');
  console.log(`✓ blog/${a.slug}.html`);
}
await updateSitemap();
console.log(`✓ sitemap.xml — ${ARTICLES.length + 1} entrée(s) /blog`);
