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

import { ARTICLES } from '../content/blog/articles.mjs';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'public', 'blog');

// TODO(#307) : basculer sur le domaine personnalisé une fois branché sur
// Vercel. Un seul endroit à changer — canonical, og:url et sitemap en dérivent.
const ORIGIN = 'https://tactic-master.vercel.app';

// Police : celles DÉJÀ chargées par le site (#309). Ne pas en ajouter — le
// poids des webfonts sur le chemin critique est un sujet réglé, pas à rouvrir.
const FONTS =
  'https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800' +
  '&family=Space+Grotesk:wght@400;500;600;700&display=swap';

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
  .replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const frDate = iso => new Date(iso + 'T12:00:00Z').toLocaleDateString('fr-FR',
  { year: 'numeric', month: 'long', day: 'numeric' });

function head({ title, description, url, extraCss = '', jsonLd }) {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<!-- FICHIER GÉNÉRÉ par tools/build-blog.mjs — ne pas éditer à la main.
     Le contenu se modifie dans content/blog/articles.mjs. -->
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${url}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="Tactic Master">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:image" content="${ORIGIN}/og-image.jpg">
<meta property="og:url" content="${url}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${ORIGIN}/og-image.jpg">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="${FONTS}" rel="stylesheet">
<link rel="stylesheet" href="/styles.css">
<link rel="stylesheet" href="/blog/blog.css">
${jsonLd ? `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>` : ''}${extraCss}
</head>
<body>`;
}

const header = `
<header class="blog-top">
  <a class="blog-home" href="/">← Tactic Master</a>
</header>`;

const footer = `
<footer class="blog-foot">
  <a href="/blog">Tous les articles</a> &nbsp;·&nbsp;
  <a href="/terms">Conditions</a> &nbsp;·&nbsp;
  <a href="/privacy">Confidentialité</a>
  <p>© 2026 Tactic Master</p>
</footer>
</body>
</html>
`;

const cta = `
<aside class="blog-cta">
  <p>Tactic Master est gratuit et se joue directement dans le navigateur, sans
     installation ni compte.</p>
  <a class="btn primary" href="/?utm_source=blog">Jouer une partie</a>
</aside>`;

function buildArticle(a) {
  const url = `${ORIGIN}/blog/${a.slug}`;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: a.title,
    description: a.description,
    datePublished: a.date,
    dateModified: a.date,
    image: `${ORIGIN}/og-image.jpg`,
    author: { '@type': 'Organization', name: 'Tactic Master' },
    publisher: { '@type': 'Organization', name: 'Tactic Master' },
    mainEntityOfPage: { '@type': 'WebPage', '@id': url }
  };
  return head({ title: `${a.title} — Tactic Master`, description: a.description, url, jsonLd })
    + header
    + `\n<main class="blog-article">
  <p class="blog-date"><time datetime="${a.date}">${frDate(a.date)}</time></p>
  <h1>${esc(a.title)}</h1>
${a.body.trim()}
${cta}
</main>`
    + footer;
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
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'Blog',
      name: 'Le blog de Tactic Master',
      url,
      blogPost: ARTICLES.map(a => ({
        '@type': 'BlogPosting',
        headline: a.title,
        datePublished: a.date,
        url: `${ORIGIN}/blog/${a.slug}`
      }))
    }
  })
    + header
    + `\n<main class="blog-index">
  <h1>Le blog</h1>
  <p class="blog-intro">Les règles en détail, des stratégies concrètes, et de temps
     en temps les coulisses du développement.</p>
  <ul class="blog-list">${cards}
  </ul>
${cta}
</main>`
    + footer;
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
