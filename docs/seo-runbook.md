# Runbook SEO — domaine canonique & indexation

> Référence : épic #176. Domaine canonique actuel : **`https://tactic-master.vercel.app`**
> (décision « domaine custom » toujours ouverte, voir #179).
>
> Volet **GEO** (être cité par ChatGPT / Perplexity / AI Overviews) :
> voir `docs/geo-runbook.md`.

## Où le domaine est écrit en dur (à changer ENSEMBLE le jour J)

| Fichier | Emplacement(s) |
|---|---|
| `public/index.html` | `<link rel="canonical">`, `og:url`, `og:image`, `twitter:image`, JSON-LD `url`, `data-domain` Plausible |
| `public/sitemap.xml` | les 3 `<loc>` |
| `public/robots.txt` | ligne `Sitemap:` + l'URL de `llms.txt` en commentaire |
| `public/llms.txt` | en-tête « Site : », section « Pages » (GEO, voir `geo-runbook.md`) |
| `public/terms.html` | `<link rel="canonical">` |
| `public/privacy.html` | `<link rel="canonical">` |
| `public/en/index.html` | canonical, hreflang ×3, `og:url`/`og:image` ×2, JSON-LD (#183) |
| `public/index.html` (bis) | les 3 `<link rel="alternate" hreflang>` (#183) |
| `tools/seo-check.mjs` | constante `DOMAIN` (garde-fou CI, #185) |

Vérification rapide qu'aucune occurrence n'a été oubliée :

```bash
grep -rn "tactic-master.vercel.app" public/
```

## Procédure de migration vers un domaine custom (si décidé, #179)

1. Acheter le domaine + l'ajouter au projet Vercel (Vercel redirige alors
   automatiquement `*.vercel.app` → domaine en 308 ; vérifier que c'est actif).
2. Remplacer toutes les occurrences du tableau ci-dessus.
3. Mettre à jour hors repo : **Supabase** (Auth → URL de redirection),
   **Stripe** (URLs de retour Checkout), **Plausible** (domaine du site),
   **AdSense/ads.txt** (domaine déclaré).
4. Search Console : ajouter la nouvelle propriété, outil « Changement
   d'adresse », re-soumettre `sitemap.xml` (idem Bing).
5. Bump `CACHE_NAME` dans `public/sw.js` (index.html précaché change).

## Politique d'indexation des pages

| Page | Politique | Mécanisme |
|---|---|---|
| `/` | indexée | canonical + sitemap + hreflang (fr, x-default) |
| `/en/` | indexée (landing EN statique, CTA → `/?lang=en`) | canonical + sitemap + hreflang (en) |
| `/terms`, `/privacy` | indexées (signal de confiance, requis AdSense) | canonical + sitemap, URLs propres (`cleanUrls`) |
| `/reset-password`, `/skins-preview` | non indexées | `<meta name="robots" content="noindex">` + `X-Robots-Tag` (vercel.json) |
| `/src/**` | crawlable (nécessaire au rendu Googlebot, #177) mais non listé | absent du sitemap |

Le sitemap ne doit lister que des URLs **finales** (pas de `.html`, `cleanUrls:true`
les redirige en 308) et **jamais** une page `noindex`.

## Garde-fou CI (#185)

Le workflow **SEO** (`.github/workflows/seo-check.yml`) tourne sur toute PR
touchant `public/` ou `vercel.json`, et à la demande (workflow_dispatch) :

- **Validations statiques** (`node tools/seo-check.mjs`, lançable en local) :
  cohérence robots/sitemap/canonical, métas sociales, `<h1>` unique, JSON-LD
  parsable et FAQPage synchronisée avec la FAQ visible, `noindex` des pages
  utilitaires, assets du manifest présents.
- **Lighthouse CI** (`.lighthouserc.json`) : audite l'accueil via
  `tools/static-server.mjs`. Le score **SEO < 0.95 est bloquant** ;
  perf / accessibilité / best-practices sont en avertissement (runners CI
  trop variables). Rapport téléchargeable en artefact (`rapport-lighthouse`).
