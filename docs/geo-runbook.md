# Runbook GEO — être cité par les moteurs génératifs

> Le SEO vise le **clic** depuis une page de résultats. Le GEO (*Generative
> Engine Optimization*) vise la **citation** dans une réponse de ChatGPT, Claude,
> Perplexity ou d'un AI Overview Google — où il n'y a souvent qu'une poignée de
> sources listées, et où l'utilisateur ne voit jamais la page.
>
> Voir aussi `docs/seo-runbook.md`, dont ce document est le complément : tout ce
> qui touche au domaine canonique, à l'indexation et au sitemap y reste traité.

## Les trois leviers en place

### 1. `public/llms.txt`

Résumé markdown du site destiné aux modèles : identité, faits chiffrés, règles,
modes, comparaisons, FAQ. Format `llms.txt` (titre `#`, citation `>`, sections).

C'est le fichier à mettre à jour **en premier** quand le jeu change. Un modèle
qui cite Tactic Master reprendra presque toujours une phrase d'ici.

Règle d'écriture : **chaque énoncé doit rester vrai isolément**, hors de son
contexte. Une phrase comme « c'est aussi le cas en ligne » est inutilisable ;
« le multijoueur en ligne se lance en partageant un code de partie » est citable.

### 2. `public/robots.txt` — crawlers génératifs

Les agents `GPTBot`, `OAI-SearchBot`, `ChatGPT-User`, `ClaudeBot`, `Claude-User`,
`Claude-SearchBot`, `PerplexityBot`, `Perplexity-User`, `Google-Extended` et
`Applebot-Extended` sont explicitement autorisés.

⚠️ **Bloquer un de ces agents = disparaître de ses réponses.** `Google-Extended`
et `Applebot-Extended` ne pilotent *pas* l'indexation classique : les refuser ne
retire pas le site de Google Search, seulement des réponses génératives.

### 3. Données structurées et contenu extractible

| Élément | Où | Rôle GEO |
|---|---|---|
| JSON-LD `HowTo` | `<head>` de `index.html` et `en/index.html` | Réponse toute faite à « comment jouer à Tactic Master ? » |
| JSON-LD `FAQPage` | idem | Paires question/réponse directement reprises |
| JSON-LD `VideoGame` (+ `keywords`, `about`, `isAccessibleForFree`) | idem | Fiche d'identité du produit |
| JSON-LD `Organization` | `index.html` | Rattache le site à un éditeur nommé |
| `<dl class="seo-facts">` | section `.seo-about` | Faits chiffrés courts, visibles, donc citables |
| FAQ visible | overlay `#faqBody` (FR) / `.seo-about` (EN) | Miroir obligatoire du `FAQPage` |

## Invariants vérifiés en CI

`node tools/seo-check.mjs` échoue si :

- un crawler génératif est bloqué par un `Disallow: /` (**tous** les blocs le
  nommant sont inspectés — un blocage plus bas dans le fichier annule un
  `Allow: /` écrit plus haut) ;
- `public/llms.txt` est absent, sans titre `#`, ou ne cite pas le domaine canonique ;
- le `@graph` de l'accueil ne contient pas `WebSite`, `Organization`, `VideoGame`,
  `HowTo` et `FAQPage` ;
- le nombre de questions du `FAQPage` diffère du nombre de `<details>` visibles.

## Quand le jeu change : la checklist

Une règle, un mode ou un prix qui bouge doit être répercuté aux **six** endroits,
sous peine de faire circuler une information fausse dans les réponses d'IA :

1. `public/llms.txt`
2. `<dl class="seo-facts">` de `public/index.html`
3. son miroir EN dans `public/en/index.html`
4. le JSON-LD `HowTo` des deux pages
5. le JSON-LD `FAQPage` **et** la FAQ visible des deux pages (le garde-fou ne
   compte que les questions, il ne compare pas les textes — la relecture est
   humaine)
6. `<lastmod>` du `sitemap.xml` + `CACHE_NAME` de `public/sw.js`

## Ce qu'on ne fait pas

- **Pas de faux avis ni de `aggregateRating` inventé.** Un `AggregateRating` sans
  avis réels est une donnée structurée mensongère : sanction Google, et les
  moteurs génératifs recoupent. À ajouter seulement le jour où de vrais avis existent.
- **Pas de texte caché réservé aux bots.** Le contenu servi aux crawlers IA est
  exactement celui servi aux humains ; `llms.txt` est un résumé, pas un doublon
  divergent.

## Mesurer

Il n'existe pas d'équivalent de la Search Console pour le GEO. À défaut :

- interroger périodiquement ChatGPT, Claude et Perplexity avec les requêtes
  cibles (« jeu de plateau de foot en ligne gratuit », « jeu de foot au tour par
  tour sans hasard ») et noter si le site est cité ;
- surveiller les visites référées par `chat.openai.com`, `perplexity.ai` et
  `claude.ai` dans Plausible.
