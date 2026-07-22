// ============ GÉNÉRATEUR DE LA LANDING ANGLAISE (#313) ============
// Produit public/en/index.html à partir de content/enLanding.mjs. La page EN
// n'est PLUS maintenue à la main : elle avait dérivé trois fois de l'accueil FR
// (tag Plausible #322 ; manifest, lien blog, mention des modes #313). Ici,
// l'échafaudage structurel (métas, PWA, hreflang, Plausible) est écrit une
// seule fois et ne peut plus être oublié, et la FAQ alimente à la fois les
// <details> visibles et le JSON-LD FAQPage — plus de miroir à tenir à la main.
//
//   node tools/build-en.mjs           # régénère le fichier
//   node tests/run-tests.js           # enLandingGenerated.test.js échoue si dérive
//
// NB : la page EN est une LANDING statique autonome (hero + section éditoriale
// + pied de page), pas un clone de l'app FR. Le CTA renvoie vers /?lang=en, qui
// démarre l'interface en anglais. On ne « traduit » donc pas index.html : on
// rend un gabarit dédié à partir de données anglaises.

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  DOMAIN, meta, hero, about, facts, rulesInShort, faq, howToSteps, game
} from '../content/enLanding.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public', 'en', 'index.html');

const OG_IMAGE = `${DOMAIN}/og-image.jpg`;
const URL_EN = `${DOMAIN}${meta.path}`;

// Échappement : texte (esc) vs valeur d'attribut (escAttr, qui protège aussi ").
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escAttr = s => esc(s).replace(/"/g, '&quot;');

// ---- JSON-LD : objet JS -> JSON.stringify, donc toujours du JSON valide ----
function jsonLd() {
  const graph = [
    {
      '@type': 'VideoGame',
      '@id': `${URL_EN}#game`,
      name: 'Tactic Master',
      url: URL_EN,
      image: OG_IMAGE,
      description: game.description,
      inLanguage: 'en',
      genre: ['Board game', 'Strategy', 'Sports'],
      gamePlatform: ['Web', 'PWA'],
      operatingSystem: 'Web',
      applicationCategory: 'GameApplication',
      playMode: ['SinglePlayer', 'MultiPlayer'],
      numberOfPlayers: { '@type': 'QuantitativeValue', minValue: 1, maxValue: 2 },
      author: { '@type': 'Organization', name: 'Tactic Master' },
      publisher: { '@type': 'Organization', name: 'Tactic Master' },
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
      isAccessibleForFree: true,
      keywords: game.keywords,
      about: game.about
    },
    {
      '@type': 'HowTo',
      '@id': `${URL_EN}#rules`,
      name: 'How to play Tactic Master',
      description: "The full rules of Tactic Master: move a piece, push the ball, score in the opponent's goal.",
      inLanguage: 'en',
      totalTime: 'PT1M',
      step: howToSteps.map((s, i) => ({
        '@type': 'HowToStep', position: i + 1, name: s.name, text: s.text
      }))
    },
    {
      '@type': 'FAQPage',
      '@id': `${URL_EN}#faq`,
      mainEntity: faq.map(({ q, a }) => ({
        '@type': 'Question',
        name: q,
        acceptedAnswer: { '@type': 'Answer', text: a }
      }))
    }
  ];
  return JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }, null, 2);
}

export function renderEnLanding() {
  const factsHtml = facts
    .map(([dt, dd]) => `    <dt>${esc(dt)}</dt><dd>${esc(dd)}</dd>`)
    .join('\n');
  const rulesHtml = rulesInShort
    .map(li => `    <li>${esc(li)}</li>`)
    .join('\n');
  const faqHtml = faq
    .map(({ q, a }) => `  <details>\n    <summary>${esc(q)}</summary>\n    <p>${esc(a)}</p>\n  </details>`)
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(meta.title)}</title>
<meta name="description" content="${escAttr(meta.description)}">

<!-- FICHIER GÉNÉRÉ — ne pas éditer à la main. Source : content/enLanding.mjs,
     gabarit : tools/build-en.mjs (#313). Régénérer : node tools/build-en.mjs
     Landing EN statique (#183) : version indexable pour le marché anglophone.
     Le CTA renvoie vers /?lang=en, qui démarre l'interface en anglais. -->
<link rel="canonical" href="${URL_EN}">
<link rel="alternate" hreflang="fr" href="${DOMAIN}/">
<link rel="alternate" hreflang="en" href="${URL_EN}">
<link rel="alternate" hreflang="x-default" href="${DOMAIN}/">

<meta property="og:type" content="website">
<meta property="og:site_name" content="Tactic Master">
<meta property="og:locale" content="en_US">
<meta property="og:locale:alternate" content="fr_FR">
<meta property="og:title" content="${escAttr(meta.title)}">
<meta property="og:description" content="${escAttr(meta.ogDescription)}">
<meta property="og:url" content="${URL_EN}">
<meta property="og:image" content="${OG_IMAGE}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escAttr(meta.title)}">
<meta name="twitter:description" content="${escAttr(meta.twitterDescription)}">
<meta name="twitter:image" content="${OG_IMAGE}">

<script type="application/ld+json">
${jsonLd()}
</script>

<meta name="theme-color" content="#1F3D2B">
<link rel="icon" type="image/png" sizes="512x512" href="/icons/icon-512.png">

<!-- PWA : installation sur écran d'accueil (#323). Chemins ABSOLUS — /en n'a
     pas de barre finale (cleanUrls), un chemin relatif se résoudrait de façon
     ambiguë. Le manifest est partagé avec le reste du site : son start_url "/"
     démarre en français ; distinguer la langue à l'installation relèverait d'un
     manifest par langue (#313), hors de portée ici. -->
<link rel="manifest" href="/manifest.json">
<!-- iOS ne lit pas le manifest standard pour l'icône/le plein écran. -->
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Tactic Master">
<link rel="apple-touch-icon" href="/icons/icon-192.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<!-- #309 — identique au <head> français : 2 familles seulement. Les polices
     d'habillage sont chargées à la demande par src/ui/lazyFonts.js. -->
<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;800;900&family=Space+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/styles.css">
<style>
.en-landing{ max-width:720px; margin:0 auto; padding:48px 20px 0; text-align:center; }
.en-landing .logo-title{ font-size:52px; }
.en-landing .cta-main{ margin:22px auto 6px; }
.en-landing .en-sub{ color:var(--craie-att); font-size:15px; margin:10px 0 0; }
/* La section éditoriale réutilise .seo-about (styles.css) mais alignée à gauche. */
.en-landing + .seo-about{ text-align:left; }
</style>

<!-- Analytics (Plausible) : MÊME bloc que l'accueil FR. data-domain est celui
     du site, pas celui de la page : /en et / partagent la même propriété. -->
<script src="/plausible-init.js"></script>
<script defer data-domain="tactic-master.vercel.app" src="https://plausible.io/js/script.js"></script>
</head>
<body>

<div class="en-landing">
  <h1 class="logo-title">
    ${esc(hero.titleTop)}<br>
    <span>${esc(hero.titleBottom)}</span>
    <span class="logo-title-underline" aria-hidden="true" style="margin:6px auto 12px"></span>
  </h1>
  <p class="en-sub">${esc(hero.sub)}</p>
  <a class="btn primary cta-main" href="${escAttr(hero.ctaHref)}" style="display:inline-block;text-decoration:none">
    ${esc(hero.ctaLabel)}
  </a>
  <p class="en-sub" style="font-size:13px;opacity:.8">${esc(hero.ctaSub)}</p>
</div>

<section class="seo-about" aria-label="About Tactic Master">
  <h2>${esc(about.heading)}</h2>
  <p>${esc(about.introBefore)}<strong>${esc(about.introLead)}</strong>${esc(about.introAfter)}</p>

  <!-- Fact sheet (GEO) : miroir EN de la <dl class="seo-facts"> de l'accueil. -->
  <dl class="seo-facts">
${factsHtml}
  </dl>

  <h3>The rules in short</h3>
  <ul>
${rulesHtml}
  </ul>

  <h3>Frequently asked questions</h3>
${faqHtml}
</section>

<footer class="legal-footer" style="text-align:center;padding:18px 12px 26px;font-size:12px;opacity:0.65">
  <!-- #323 : sans ce lien, le blog n'était atteignable depuis l'anglais que par
       le sitemap. Les articles sont en français, d'où le label. -->
  <a href="/blog" style="color:inherit">Blog (French)</a>
  &nbsp;·&nbsp;
  <a href="/terms" style="color:inherit">Terms of use &amp; sale (French)</a>
  &nbsp;·&nbsp;
  <a href="/privacy" style="color:inherit">Privacy (French)</a>
  &nbsp;·&nbsp;
  <span>© 2026 Tactic Master</span>
</footer>

</body>
</html>
`;
}

function main() {
  writeFileSync(OUT, renderEnLanding(), 'utf8');
  console.log('public/en/index.html régénéré depuis content/enLanding.mjs');
}

if (process.argv[1] && process.argv[1].endsWith('build-en.mjs')) main();
