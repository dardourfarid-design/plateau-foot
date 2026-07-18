// ===================== PAGES DE PARTAGE (#111) =====================
// Génère public/partage/{victoire,defaite,match-nul}.html — les pages
// d'atterrissage des liens partagés en fin de partie.
//
// Pourquoi des pages statiques distinctes plutôt qu'une seule page paramétrée :
// les métadonnées Open Graph doivent être dans le HTML SERVI. Les robots
// d'aperçu (Messenger, WhatsApp, Discord, X…) n'exécutent pas le JavaScript —
// une balise og:image posée côté client ne serait jamais lue, et le lien
// partagé s'afficherait sans vignette.
//
// Pourquoi générées et non écrites à la main : trois copies d'un même gabarit
// divergent toujours. Modifier CE fichier, puis relancer :
//   node tools/build-share-pages.mjs
//
// Ces pages sont en noindex : ce sont des points d'entrée de partage, pas du
// contenu éditorial. Les laisser indexer créerait trois pages quasi vides en
// concurrence avec l'accueil. Le noindex n'empêche PAS les aperçus de liens.

import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'public', 'partage');

// TODO(#307) : remplacer par le domaine personnalisé une fois branché sur
// Vercel — les URL canoniques et og:url doivent pointer vers le domaine final.
const ORIGIN = 'https://tactic-master.vercel.app';

const PAGES = [
  {
    slug: 'victoire',
    title: 'Victoire à Tactic Master',
    heading: 'Il a gagné.',
    line: 'Quelqu\'un vient de remporter sa partie de Tactic Master — un jeu de plateau tactique entre les dames et le football. À toi de faire mieux.',
    cta: 'Jouer une partie'
  },
  {
    slug: 'defaite',
    title: 'Défaite à Tactic Master',
    heading: 'Il a perdu.',
    line: 'Quelqu\'un vient de se faire battre à Tactic Master — un jeu de plateau tactique entre les dames et le football. Prends sa revanche.',
    cta: 'Prendre la revanche'
  },
  {
    slug: 'match-nul',
    title: 'Match nul à Tactic Master',
    heading: 'Personne n\'a gagné.',
    line: 'Une partie de Tactic Master s\'est terminée sur un match nul — un jeu de plateau tactique entre les dames et le football. Viens les départager.',
    cta: 'Départager'
  }
];

function buildPage({ slug, title, heading, line, cta }) {
  const url = `${ORIGIN}/partage/${slug}`;
  const image = `${ORIGIN}/img/partage/${slug}.jpg`;
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<!-- FICHIER GÉNÉRÉ par tools/build-share-pages.mjs — ne pas éditer à la main. -->
<title>${title}</title>
<meta name="description" content="${line}">
<meta name="robots" content="noindex, follow">
<link rel="canonical" href="${url}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Tactic Master">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${line}">
<meta property="og:image" content="${image}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:url" content="${url}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${title}">
<meta name="twitter:description" content="${line}">
<meta name="twitter:image" content="${image}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700;800&family=Space+Grotesk:wght@500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/styles.css">
<style>
.share-land{max-width:640px;margin:0 auto;padding:64px 20px 80px;text-align:center;color:var(--craie)}
.share-land img{width:100%;height:auto;border-radius:14px;border:1px solid rgba(200,132,26,0.35);margin-bottom:32px}
.share-land h1{font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:44px;text-transform:uppercase;margin-bottom:14px;line-height:1.05}
.share-land p{font-size:16px;line-height:1.6;color:var(--craie-att);margin-bottom:32px}
.share-land .btn{font-size:17px;padding:14px 30px}
</style>
</head>
<body>
<main class="share-land">
  <img src="/img/partage/${slug}.jpg" alt="" width="1200" height="630">
  <h1>${heading}</h1>
  <p>${line}</p>
  <a class="btn primary" href="/?utm_source=partage&amp;utm_content=${slug}">${cta}</a>
</main>
</body>
</html>
`;
}

await mkdir(OUT_DIR, { recursive: true });
for (const page of PAGES) {
  await writeFile(path.join(OUT_DIR, `${page.slug}.html`), buildPage(page), 'utf8');
  console.log(`✓ partage/${page.slug}.html`);
}
