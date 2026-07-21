// ===================== GARDE-FOU SEO STATIQUE (#185) =====================
// Vérifie les invariants SEO du site sans navigateur (complète Lighthouse) :
// cohérence robots/sitemap/canonical, métadonnées de l'accueil, JSON-LD
// parsable, noindex des pages utilitaires. Échoue (exit 1) à la première
// liste d'erreurs non vide — pensé pour la CI (seo-check.yml) et lançable
// à la main : node tools/seo-check.mjs
//
// Le domaine canonique est centralisé dans docs/seo-runbook.md : si le
// domaine change un jour, ce fichier fait partie des emplacements à mettre
// à jour (voir le tableau du runbook).

import { readFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';

const DOMAIN = 'https://tactic-master.vercel.app';
const PUBLIC = resolve('public');

const errors = [];
const ok = (msg) => console.log(`  ✓ ${msg}`);
const ko = (msg) => { errors.push(msg); console.log(`  ✗ ${msg}`); };
const read = (rel) => readFileSync(join(PUBLIC, rel), 'utf8');

// --- robots.txt -----------------------------------------------------------
console.log('robots.txt');
const robots = read('robots.txt');
if (/Disallow:\s*\/src\//i.test(robots)) {
  ko('robots.txt bloque /src/ — Googlebot ne peut plus rendre la SPA (#177)');
} else {
  ok('ne bloque pas /src/ (nécessaire au rendu Googlebot)');
}
if (robots.includes(`Sitemap: ${DOMAIN}/sitemap.xml`)) {
  ok('déclare le sitemap sur le domaine canonique');
} else {
  ko(`robots.txt ne déclare pas « Sitemap: ${DOMAIN}/sitemap.xml »`);
}

// --- GEO : crawlers génératifs & llms.txt ----------------------------------
// Un « Disallow: / » sur l'un de ces agents nous retire des réponses de
// ChatGPT/Claude/Perplexity/AI Overviews. Le garde-fou ne vérifie donc pas la
// présence des lignes (le joker suffirait) mais l'absence de blocage.
console.log('GEO');
const AI_AGENTS = ['GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot',
  'PerplexityBot', 'Google-Extended', 'Applebot-Extended'];
let aiBlocked = 0;
for (const agent of AI_AGENTS) {
  // Tous les blocs du robots.txt nommant cet agent (de sa ligne User-agent au
  // groupe suivant) : il faut les inspecter TOUS, un « Disallow: / » ajouté
  // plus bas dans le fichier annulerait un « Allow: / » écrit plus haut.
  const blocks = [...robots.matchAll(
    new RegExp(`^User-agent:[ \\t]*${agent}[ \\t]*$([\\s\\S]*?)(?=^User-agent:|^Sitemap:|$(?![\\s\\S]))`, 'gim')
  )];
  if (blocks.some(b => /^[ \t]*Disallow:[ \t]*\/[ \t]*$/im.test(b[1]))) {
    ko(`robots.txt : ${agent} est bloqué — le site ne sera plus cité par ce moteur`);
    aiBlocked++;
  }
}
if (aiBlocked === 0) ok(`aucun crawler génératif bloqué (${AI_AGENTS.length} vérifiés)`);
if (!existsSync(join(PUBLIC, 'llms.txt'))) {
  ko('public/llms.txt absent — résumé structuré à destination des modèles');
} else {
  const llms = read('llms.txt');
  if (!/^# /m.test(llms)) ko('llms.txt : pas de titre « # » (format llms.txt non respecté)');
  else if (!llms.includes(DOMAIN)) ko('llms.txt : ne référence pas le domaine canonique');
  else ok('llms.txt présent, titré et sur le domaine canonique');
}

// --- sitemap.xml ----------------------------------------------------------
console.log('sitemap.xml');
const sitemap = read('sitemap.xml');
const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
if (locs.length === 0) ko('sitemap.xml : aucune <loc> trouvée');
for (const loc of locs) {
  if (!loc.startsWith(DOMAIN)) ko(`sitemap : ${loc} n'est pas sur le domaine canonique`);
  if (loc.endsWith('.html')) ko(`sitemap : ${loc} — URLs .html interdites (cleanUrls les redirige en 308)`);
  // Symétrique de la règle .html ci-dessus, et tout aussi contraignante :
  // vercel.json a trailingSlash:false, donc /en/ répond 308 alors que /en
  // répond 200. Cette règle manquait — c'est par elle que /en/ avait pu
  // entrer dans le sitemap ET dans les canonical/hreflang des deux landings.
  if (loc !== `${DOMAIN}/` && loc.endsWith('/')) {
    ko(`sitemap : ${loc} — barre finale interdite (trailingSlash:false la redirige en 308)`);
  }
}
if (!/<lastmod>/.test(sitemap)) ko('sitemap : aucune balise <lastmod>');

// Chaque URL du sitemap doit correspondre à un fichier réel, indexable,
// avec title + meta description + canonical strictement égal à la <loc>.
for (const loc of locs) {
  const rel = loc.slice(DOMAIN.length).replace(/^\//, '').replace(/\/$/, '');
  // cleanUrls résout une URL propre de DEUX façons : /en peut être servi par
  // public/en.html OU par public/en/index.html. Ne tester que la première
  // rejetait /en alors que la page existe bien — il faut essayer les deux.
  const candidates = rel === '' ? ['index.html'] : [`${rel}.html`, `${rel}/index.html`];
  const path = candidates.find(c => existsSync(join(PUBLIC, c)));
  if (!path) { ko(`sitemap : ${loc} → aucun de public/${candidates.join(' ni public/')} n'existe`); continue; }
  const html = read(path);
  if (/<meta[^>]+name="robots"[^>]+noindex/i.test(html)) ko(`${path} est noindex mais listé dans le sitemap`);
  if (!/<title>[^<]+<\/title>/.test(html)) ko(`${path} : <title> manquant`);
  if (!/<meta[^>]+name="description"/.test(html)) ko(`${path} : meta description manquante`);
  const canon = html.match(/<link rel="canonical" href="([^"]+)"/);
  if (!canon) ko(`${path} : canonical manquant`);
  else if (canon[1] !== loc) ko(`${path} : canonical ${canon[1]} ≠ sitemap ${loc}`);
}
if (errors.length === 0) ok(`${locs.length} URL(s) : fichiers présents, indexables, canonical cohérent`);

// --- index.html : métadonnées sociales & contenu --------------------------
console.log('index.html');
const index = read('index.html');
for (const tag of ['og:title', 'og:description', 'og:image', 'og:url', 'og:site_name', 'og:locale']) {
  if (!index.includes(`property="${tag}"`)) ko(`index.html : ${tag} manquant`);
}
if (!index.includes('name="twitter:card"')) ko('index.html : twitter:card manquant');
const h1Count = (index.match(/<h1[\s>]/g) || []).length;
if (h1Count !== 1) ko(`index.html : ${h1Count} balise(s) <h1> (attendu : exactement 1, #181)`);
else ok('exactement un <h1>');
if (!/<section class="seo-about"/.test(index)) ko('index.html : section .seo-about absente (#181)');

// --- JSON-LD ---------------------------------------------------------------
console.log('JSON-LD');
const ld = index.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
if (!ld) {
  ko('index.html : bloc JSON-LD absent');
} else {
  try {
    const graph = JSON.parse(ld[1])['@graph'] || [];
    const types = graph.map(n => n['@type']);
    // HowTo (GEO) : les règles pas à pas sont la forme la plus reprise par les
    // moteurs génératifs quand on leur demande « comment jouer à… ».
    for (const t of ['WebSite', 'VideoGame', 'FAQPage', 'HowTo', 'Organization']) {
      if (!types.includes(t)) ko(`JSON-LD : type ${t} absent du @graph (#182)`);
    }
    if (types.includes('FAQPage')) {
      const nQ = graph.find(n => n['@type'] === 'FAQPage').mainEntity.length;
      const nDetails = (index.match(/<details>/g) || []).length;
      if (nQ !== nDetails) ko(`JSON-LD : ${nQ} questions FAQPage ≠ ${nDetails} <details> visibles`);
      else ok(`FAQPage synchronisée avec la FAQ visible (${nQ} questions)`);
    }
  } catch (e) {
    ko(`JSON-LD invalide : ${e.message}`);
  }
}

// --- pages utilitaires : noindex -------------------------------------------
console.log('pages utilitaires');
for (const page of ['reset-password.html', 'skins-preview.html']) {
  if (/<meta[^>]+name="robots"[^>]+noindex/i.test(read(page))) ok(`${page} : noindex présent`);
  else ko(`${page} : meta robots noindex manquante (#178)`);
}

// --- manifest & vercel.json -------------------------------------------------
console.log('manifest / vercel.json');
try {
  const manifest = JSON.parse(read('manifest.json'));
  for (const icon of manifest.icons || []) {
    if (!existsSync(join(PUBLIC, icon.src))) ko(`manifest : icône ${icon.src} introuvable`);
  }
  for (const shot of manifest.screenshots || []) {
    if (!existsSync(join(PUBLIC, shot.src))) ko(`manifest : screenshot ${shot.src} introuvable`);
  }
  ok('manifest.json valide, assets présents');
} catch (e) { ko(`manifest.json invalide : ${e.message}`); }
try {
  const vercel = JSON.parse(readFileSync('vercel.json', 'utf8'));
  if (vercel.cleanUrls !== true) ko('vercel.json : cleanUrls doit rester true (le sitemap liste des URLs propres)');
  else ok('vercel.json : cleanUrls actif');
} catch (e) { ko(`vercel.json invalide : ${e.message}`); }

// --- verdict ----------------------------------------------------------------
console.log('');
if (errors.length > 0) {
  console.error(`${errors.length} erreur(s) SEO — voir ci-dessus.`);
  process.exit(1);
}
console.log('Garde-fou SEO : tout est vert.');
