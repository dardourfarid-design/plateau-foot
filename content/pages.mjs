// ===================== PAGES DE RÉFÉRENCE (hors blog) =====================
// Source unique des pages éditoriales servies à la racine : /regles, /faq,
// /glossaire, /a-propos, /contact. Chaque entrée produit public/<slug>.html et
// une entrée de sitemap, via `node tools/build-pages.mjs`.
//
// POURQUOI CES PAGES EXISTENT
// Les règles et la FAQ vivaient uniquement dans une overlay `display:none` de
// l'accueil. Un contenu masqué est déprécié par les moteurs et invisible pour un
// lecteur qui arrive depuis une recherche : le site n'exposait donc, en pratique,
// qu'une page de jeu sans texte. L'overlay reste (c'est le bon geste en cours de
// partie), mais la référence vit désormais à une URL propre, lisible sans
// JavaScript.
//
// POUR AJOUTER UNE PAGE
//   1. écrire le corps dans content/pages/<slug>.mjs ;
//   2. ajouter une entrée ici ;
//   3. ajouter l'URL à NAV dans tools/lib/page-layout.mjs (sinon la page n'est
//      atteignable que par le sitemap — une page orpheline est mal explorée) ;
//   4. `node tools/build-pages.mjs`, puis commiter le HTML produit et le sitemap.
//
// RÈGLE DE FOND, NON NÉGOCIABLE (identique au blog)
// Toute affirmation sur les règles doit être vérifiée dans
// public/src/engine/gameEngine.js AVANT publication.

import { REGLES } from './pages/regles.mjs';
import { FAQ, FAQ_GROUPS } from './pages/faq.mjs';
import { GLOSSAIRE, TERMES } from './pages/glossaire.mjs';
import { A_PROPOS } from './pages/a-propos.mjs';
import { CONTACT } from './pages/contact.mjs';
import { EN_RULES } from './pages/en-rules.mjs';
import { EN_FAQ, EN_FAQ_GROUPS } from './pages/en-faq.mjs';
import { ORIGIN } from '../tools/lib/page-layout.mjs';

// Retire le balisage d'une réponse : le JSON-LD attend du texte, pas du HTML.
const plain = s => String(s).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

export const PAGES = [
  {
    slug: 'regles',
    title: 'Les règles complètes de Tactic Master',
    description:
      'La référence complète des règles de Tactic Master : plateau, déplacements, passes, couverture défensive, une-deux, point de penalty, paliers et pouvoirs.',
    updated: '2026-08-04',
    priority: '0.9',
    // hreflang : cette page et /en/rules doivent se citer RÉCIPROQUEMENT, sinon
    // Google ignore la déclaration. Les deux `alternate` sont donc symétriques.
    alternate: { lang: 'en', path: '/en/rules' },
    body: REGLES,
    schema: ({ url }) => ({
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: 'Les règles complètes de Tactic Master',
      description: 'Référence exhaustive des règles du jeu de plateau de foot Tactic Master.',
      dateModified: '2026-08-04',
      inLanguage: 'fr',
      isAccessibleForFree: true,
      author: { '@type': 'Organization', name: 'Tactic Master', url: ORIGIN },
      publisher: { '@type': 'Organization', name: 'Tactic Master' },
      mainEntityOfPage: { '@type': 'WebPage', '@id': url }
    })
  },
  {
    slug: 'faq',
    title: 'Questions fréquentes sur Tactic Master',
    description:
      'Toutes les réponses sur Tactic Master : prise en main, règles et cas limites, modes de jeu, niveaux de difficulté, compte, boutique et données personnelles.',
    updated: '2026-08-04',
    priority: '0.8',
    alternate: { lang: 'en', path: '/en/faq' },
    body: FAQ,
    // Le balisage FAQPage est dérivé des mêmes données que le texte visible :
    // une question ne peut pas figurer dans l'un sans l'autre.
    schema: () => ({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      inLanguage: 'fr',
      mainEntity: FAQ_GROUPS.flatMap(g => g.items).map(it => ({
        '@type': 'Question',
        name: plain(it.q),
        acceptedAnswer: { '@type': 'Answer', text: plain(it.a) }
      }))
    })
  },
  {
    slug: 'glossaire',
    title: 'Glossaire de Tactic Master',
    description:
      'Le vocabulaire de Tactic Master défini terme par terme : couverture, centre, une-deux, point de penalty, momentum, paliers de règles, pouvoirs et pion de champ.',
    updated: '2026-08-04',
    priority: '0.6',
    body: GLOSSAIRE,
    schema: ({ url }) => ({
      '@context': 'https://schema.org',
      '@type': 'DefinedTermSet',
      name: 'Glossaire de Tactic Master',
      url,
      inLanguage: 'fr',
      hasDefinedTerm: TERMES.map(e => ({
        '@type': 'DefinedTerm',
        name: e.t,
        description: plain(e.d),
        inDefinedTermSet: url
      }))
    })
  },
  {
    slug: 'a-propos',
    title: 'À propos de Tactic Master',
    description:
      'Qui édite Tactic Master, pourquoi ce jeu de plateau de foot existe, comment il est fabriqué, et selon quelles règles les contenus de ce site sont vérifiés.',
    updated: '2026-08-04',
    priority: '0.5',
    body: A_PROPOS,
    schema: ({ url }) => ({
      '@context': 'https://schema.org',
      '@type': 'AboutPage',
      url,
      inLanguage: 'fr',
      mainEntity: {
        '@type': 'Organization',
        name: 'Tactic Master',
        description: 'Éditeur indépendant du jeu de plateau de football Tactic Master.',
        url: ORIGIN
      }
    })
  },
  {
    slug: 'contact',
    title: 'Contacter Tactic Master',
    description:
      'Comment joindre Tactic Master : courriel pour les questions, les données personnelles et les achats, dépôt public pour signaler un bug ou proposer une idée.',
    updated: '2026-08-04',
    priority: '0.5',
    body: CONTACT,
    schema: ({ url, contactEmail }) => ({
      '@context': 'https://schema.org',
      '@type': 'ContactPage',
      url,
      inLanguage: 'fr',
      mainEntity: {
        '@type': 'Organization',
        name: 'Tactic Master',
        email: contactEmail,
        contactPoint: {
          '@type': 'ContactPoint',
          contactType: 'customer support',
          email: contactEmail,
          availableLanguage: ['fr', 'en']
        }
      }
    })
  },

  // --- Pages anglaises -------------------------------------------------------
  // Servies sous /en/, à côté de la landing /en déjà générée par
  // tools/build-en.mjs. Seules les DEUX pages qui existent réellement en anglais
  // sont publiées : une page à moitié traduite vaut moins que pas de page.
  {
    slug: 'en/rules',
    lang: 'en',
    title: 'Tactic Master rules',
    description:
      'The complete rules of Tactic Master: board, turn structure, passing, defensive cover, the one-two, the penalty spot, rule tiers, powers and edge cases.',
    updated: '2026-08-04',
    priority: '0.7',
    alternate: { lang: 'fr', path: '/regles' },
    body: EN_RULES,
    schema: ({ url }) => ({
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: 'Tactic Master rules',
      description: 'Complete rules reference for the Tactic Master football board game.',
      dateModified: '2026-08-04',
      inLanguage: 'en',
      isAccessibleForFree: true,
      author: { '@type': 'Organization', name: 'Tactic Master', url: ORIGIN },
      publisher: { '@type': 'Organization', name: 'Tactic Master' },
      mainEntityOfPage: { '@type': 'WebPage', '@id': url }
    })
  },
  {
    slug: 'en/faq',
    lang: 'en',
    title: 'Tactic Master FAQ',
    description:
      'Answers about Tactic Master: getting started, rules and edge cases, game modes, computer difficulty levels, accounts, the shop, data and browser support.',
    updated: '2026-08-04',
    priority: '0.6',
    alternate: { lang: 'fr', path: '/faq' },
    body: EN_FAQ,
    schema: () => ({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      inLanguage: 'en',
      mainEntity: EN_FAQ_GROUPS.flatMap(g => g.items).map(it => ({
        '@type': 'Question',
        name: plain(it.q),
        acceptedAnswer: { '@type': 'Answer', text: plain(it.a) }
      }))
    })
  }
];
