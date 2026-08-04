// ===================== GÉNÉRATEUR DES PAGES DE RÉFÉRENCE =====================
// Produit public/<slug>.html pour chaque entrée de content/pages.mjs (règles,
// FAQ, glossaire, à propos, contact) et met à jour le bloc « pages » du sitemap.
//
//   node tools/build-pages.mjs
//
// Comme le blog, les fichiers produits sont COMMITÉS : ces pages doivent être
// servies en HTML statique, lisibles par les robots sans JavaScript. C'est tout
// l'intérêt de les avoir sorties de l'overlay de l'accueil.
//
// Le gabarit (head, en-tête, pied de page, origine) est partagé avec
// tools/build-blog.mjs via tools/lib/page-layout.mjs.

import { PAGES } from '../content/pages.mjs';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ORIGIN, CONTACT_EMAIL, esc, head, header, footer, cta, breadcrumb
} from './lib/page-layout.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function buildPage(p) {
  const lang = p.lang || 'fr';
  const url = `${ORIGIN}/${p.slug}`;
  const home = lang === 'en' ? { name: 'Home', path: '/en' } : { name: 'Accueil', path: '/' };
  const jsonLd = [
    p.schema({ url, contactEmail: CONTACT_EMAIL }),
    breadcrumb([home, { name: p.title, path: `/${p.slug}` }])
  ];

  return head({
    title: `${p.title} — Tactic Master`,
    description: p.description,
    url,
    lang,
    ogType: 'website',
    jsonLd,
    alternate: p.alternate
  })
    + header(lang)
    + `\n<main class="blog-article page-doc">
  <h1>${esc(p.title)}</h1>
${p.body.trim()}
${cta(lang)}
</main>`
    + footer(lang);
}

// --- Sitemap : réécrit le bloc « pages », sans toucher au reste --------------
// Bloc distinct de celui du blog : les deux générateurs tournent
// indépendamment, chacun ne doit réécrire que le sien.
async function updateSitemap() {
  const file = path.join(ROOT, 'public', 'sitemap.xml');
  let xml = await readFile(file, 'utf8');

  const MARK_START = '  <!-- pages:début (généré par tools/build-pages.mjs) -->';
  const MARK_END = '  <!-- pages:fin -->';

  const entries = PAGES.map(p => `  <url>
    <loc>${ORIGIN}/${p.slug}</loc>
    <lastmod>${p.updated}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>${p.priority}</priority>
  </url>`).join('\n');

  const block = `${MARK_START}\n${entries}\n${MARK_END}`;

  if (xml.includes(MARK_START)) {
    // Marqueurs échappés avant d'être passés à RegExp : ils contiennent des
    // parenthèses et des points, lus sinon comme des groupes de capture — le
    // remplacement échouerait en silence (bug déjà vu sur le bloc du blog).
    const rx = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    xml = xml.replace(new RegExp(`${rx(MARK_START)}[\\s\\S]*?${rx(MARK_END)}`), block);
  } else {
    xml = xml.replace('</urlset>', `${block}\n</urlset>`);
  }
  await writeFile(file, xml, 'utf8');
}

for (const p of PAGES) {
  // À la racine de public/, comme terms.html et privacy.html : avec
  // cleanUrls, Vercel sert alors /regles, /faq… sans extension. Un slug qui
  // contient un « / » (en/rules) produit un sous-dossier, servi de la même
  // manière — public/en/index.html est déjà servi en /en.
  const out = path.join(ROOT, 'public', `${p.slug}.html`);
  await mkdir(path.dirname(out), { recursive: true });
  await writeFile(out, buildPage(p), 'utf8');
  console.log(`✓ ${p.slug}.html (servi en /${p.slug})`);
}
await updateSitemap();
console.log(`✓ sitemap.xml — ${PAGES.length} page(s) de référence`);
