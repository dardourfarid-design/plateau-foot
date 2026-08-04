// ===================== GABARIT COMMUN DES PAGES ÉDITORIALES =====================
// Partagé par tools/build-blog.mjs (articles + index du blog) et
// tools/build-pages.mjs (règles, FAQ, glossaire, à propos, contact).
//
// POURQUOI UN MODULE COMMUN
// Les deux générateurs produisaient à l'origine le même <head> (canonical, Open
// Graph, JSON-LD, polices) et le même pied de page. Dupliqué, cet en-tête
// diverge : on ajoute une page au pied de page du blog et pas à celui des pages
// de référence, et un pan du site devient orphelin. Ici, ajouter une entrée à
// NAV la fait apparaître partout d'un coup.
//
// Rien ici ne connaît le CONTENU : les deux générateurs restent maîtres de leur
// <main>.

// TODO(#307) : basculer sur le domaine personnalisé une fois branché sur
// Vercel. Un seul endroit à changer — canonical, og:url et sitemap en dérivent.
export const ORIGIN = 'https://tactic-master.vercel.app';

// Adresse de contact publiée sur /contact et dans les CGU. DOIT être une boîte
// réellement relevée : un examinateur AdSense (comme un joueur) qui écrit dans
// le vide constate un site abandonné.
export const CONTACT_EMAIL = 'contact@tactic-master.com';

// Dépôt public : second canal de contact, vérifiable, et preuve que le jeu est
// maintenu par quelqu'un d'identifiable.
export const REPO_URL = 'https://github.com/dardourfarid-design/plateau-foot';

// Police : celles DÉJÀ chargées par le site (#309). Ne pas en ajouter — le
// poids des webfonts sur le chemin critique est un sujet réglé, pas à rouvrir.
export const FONTS =
  'https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800' +
  '&family=Space+Grotesk:wght@400;500;600;700&display=swap';

// Pied de page commun. L'ordre va du plus utile au joueur au plus
// administratif. Toute page publiée doit figurer ici : c'est le seul maillage
// interne qui garantisse qu'aucune n'est atteignable uniquement par le sitemap.
export const NAV = Object.freeze([
  { href: '/blog', label: 'Tous les articles' },
  { href: '/regles', label: 'Règles complètes' },
  { href: '/faq', label: 'FAQ' },
  { href: '/glossaire', label: 'Glossaire' },
  { href: '/a-propos', label: 'À propos' },
  { href: '/contact', label: 'Contact' },
  { href: '/terms', label: 'Conditions' },
  { href: '/privacy', label: 'Confidentialité' }
]);

// Pied de page anglais. Volontairement plus court : seules les pages qui
// existent réellement en anglais y figurent, plus le retour à la landing EN.
// Renvoyer un anglophone vers /glossaire (français) serait pire que de ne rien
// proposer.
export const NAV_EN = Object.freeze([
  { href: '/en', label: 'Home' },
  { href: '/en/rules', label: 'Full rules' },
  { href: '/en/faq', label: 'FAQ' },
  { href: '/contact', label: 'Contact' },
  { href: '/terms', label: 'Terms' },
  { href: '/privacy', label: 'Privacy' }
]);

const NAV_BY_LANG = { fr: NAV, en: NAV_EN };

export const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
  .replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const frDate = iso => new Date(iso + 'T12:00:00Z').toLocaleDateString('fr-FR',
  { year: 'numeric', month: 'long', day: 'numeric' });

/**
 * <head> complet + ouverture du <body>.
 * `alternate` déclare la page équivalente dans l'autre langue : les deux pages
 * doivent se citer RÉCIPROQUEMENT, sinon Google ignore purement et simplement
 * la déclaration (c'est la règle de l'annotation hreflang, pas une option).
 * @param {{title, description, url, lang?, ogType?, jsonLd?, extraCss?, alternate?}} o
 */
export function head({
  title, description, url, lang = 'fr', ogType = 'article', jsonLd, extraCss = '',
  alternate = null
}) {
  const hreflang = alternate ? `
<link rel="alternate" hreflang="${lang}" href="${url}">
<link rel="alternate" hreflang="${alternate.lang}" href="${ORIGIN}${alternate.path}">
<link rel="alternate" hreflang="x-default" href="${lang === 'fr' ? url : `${ORIGIN}${alternate.path}`}">` : '';

  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<!-- FICHIER GÉNÉRÉ — ne pas éditer à la main. Le contenu se modifie dans
     content/ puis se régénère (voir tools/build-blog.mjs, tools/build-pages.mjs). -->
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${url}">${hreflang}
<meta property="og:type" content="${ogType}">
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

export const header = (lang = 'fr') => `
<header class="blog-top">
  <a class="blog-home" href="${lang === 'en' ? '/en' : '/'}">← Tactic Master</a>
</header>`;

export const footer = (lang = 'fr') => `
<footer class="blog-foot">
  ${(NAV_BY_LANG[lang] || NAV).map(n => `<a href="${n.href}">${n.label}</a>`).join('\n  &nbsp;·&nbsp;\n  ')}
  <p>© 2026 Tactic Master</p>
</footer>
</body>
</html>
`;

// Le CTA anglais pointe vers /?lang=en, qui démarre l'interface en anglais —
// même mécanique que le CTA de la landing EN. Envoyer vers / servirait le jeu
// en français à quelqu'un qui vient de lire les règles en anglais.
export const cta = (lang = 'fr') => lang === 'en' ? `
<aside class="blog-cta">
  <p>Tactic Master is free and runs straight in your browser — no install, no
     account needed.</p>
  <a class="btn primary" href="/?lang=en&amp;utm_source=blog">Play a match</a>
</aside>` : `
<aside class="blog-cta">
  <p>Tactic Master est gratuit et se joue directement dans le navigateur, sans
     installation ni compte.</p>
  <a class="btn primary" href="/?utm_source=blog">Jouer une partie</a>
</aside>`;

// Fil d'Ariane structuré : réclamé par Google pour afficher un chemin plutôt
// qu'une URL brute dans les résultats, et utile aux moteurs génératifs pour
// situer une page dans le site.
export function breadcrumb(items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: `${ORIGIN}${it.path}`
    }))
  };
}
