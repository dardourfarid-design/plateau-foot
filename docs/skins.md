# Tactic Master — Habillages de plateau (UI skins)

Ajoute 3 thèmes qui restylent entièrement le plateau (au-delà des couleurs) :

- **Chalkboard** — gratuit (nouveau thème par défaut alternatif)
- **Stadium Night** — premium, 1,99 €
- **Arcade Turf** — premium, 1,99 €

Ils réutilisent **exactement** le système existant : table `themes`,
`purchases`, paiement mock/Stripe. Aucun nouveau chemin de paiement.

## Comment ça marche

Chaque thème porte une clé `skin` dans sa config JSON (ex: `"skin":"stadium-night"`).
`themeManager.applyTheme()` pose alors la classe `skin-<id>` sur `<body>` via la
nouvelle fonction `applySkin()`, et `public/skins.css` restyle le plateau, les
pions, la feuille de match et les boutons. Un thème couleur classique (sans clé
`skin`) retire toute classe skin-\* → rendu par défaut inchangé.

## Fichiers de ce paquet (à copier dans le dépôt, mêmes chemins)

| Fichier | Action |
|---|---|
| `public/src/ui/themeManager.js` | modifié — ajoute `applySkin()` + appel dans `applyTheme()` |
| `public/src/ui/shopUI.js` | modifié — 3 thèmes ajoutés au catalogue de secours (offline) |


| `public/index.html` | modifié — `<link ... skins.css>` + police Fredoka |
| `public/skins.css` | **nouveau** — les 3 habillages |
| `public/skins-preview.html` | **nouveau** — outil de dev pour prévisualiser (optionnel, non servi en prod) |
| `supabase/migrations/0022_ui_skins.sql` | **nouveau** — enregistre les 3 thèmes en base |

## Étapes

1. Copie les fichiers ci-dessus aux mêmes chemins dans ton dépôt (écrase les 5 modifiés).
   (`public/src/` est la source unique — édite directement ces fichiers.)
2. Exécute la migration `0022_ui_skins.sql` dans le SQL Editor Supabase (comme les précédentes).
3. Commit + push. Le déploiement Vercel/Netlify étant 100% statique, rien d'autre à faire.
4. (Local) `python3 -m http.server 8080` puis ouvre `/public/skins-preview.html`
   pour voir les 3 skins, ou `/public/index.html` → Boutique pour les acheter/appliquer.

## Prix

Chalkboard `price_cents: 0` · Stadium Night & Arcade Turf `price_cents: 199`.
Modifiable dans `0022_ui_skins.sql` et dans le fallback de `shopUI.js`.
