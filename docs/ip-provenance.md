# Provenance de la propriété intellectuelle

Document de référence pour toute due diligence : origine et régime de droits de
chaque composant du produit. Dernière revue : 2026-07-23.

## Titularité

- **Code source** : écrit pour le projet (avec assistance d'outils IA de
  développement, dont les conditions attribuent les sorties au client).
  Historique git : un seul auteur humain (`dardourfarid-design`,
  dardour.farid@gmail.com) + le bot CI. Aucune contribution externe mergée.
- **Licence du dépôt** : propriétaire, « tous droits réservés » — voir
  [`LICENSE`](../LICENSE). Le dépôt est public (source-available) depuis le
  2026-07-21, sans concession de droits.

## Dépendances logicielles

| Composant | Distribution | Licence | Statut |
|---|---|---|---|
| `@supabase/supabase-js` 2.110.1 | **livré** (bundle vendorisé `public/vendor/`) | MIT | notice de copyright conservée en tête du fichier |
| `@playwright/test`, `@axe-core/playwright`, `c8`, `esbuild` | outils de dev/CI uniquement, non livrés | Apache-2.0 / MPL-2.0 / ISC / MIT | conformes |
| `sharp` (+ binaires `@img/*`, dont LGPL pour libvips) | outil local ponctuel (`npm i --no-save`), non livré, hors `package.json` | Apache-2.0 / LGPL-3.0 | usage outillage uniquement — aucune obligation de distribution |
| Transitives de `node_modules` | non livrées | MIT ×72, ISC ×16, Apache-2.0 ×5, BSD-3 ×3, BlueOak ×5, MPL-2.0 ×2, 0BSD ×1 | aucun copyleft fort ; inventaire du 2026-07-23 |

**Aucune dépendance d'exécution n'est distribuée avec le produit hormis le
bundle Supabase (MIT).** Le reste du code livré est du JavaScript/CSS/HTML
écrit dans ce dépôt.

## Polices

Space Grotesk et Barlow Condensed, chargées via Google Fonts
(`public/src/ui/lazyFonts.js`) — licence **SIL Open Font License 1.1**,
usage commercial libre, aucune redistribution de fichiers de police dans le
dépôt.

## Sons

Entièrement **synthétisés en WebAudio**
(`public/src/services/soundService.js`). Aucun sample, aucune bibliothèque
sonore tierce.

## Images

| Asset | Origine | Notes |
|---|---|---|
| Icônes PWA, image OG, images de partage (`victoire/defaite/match-nul.jpg`) | design maison (typographie + plateau stylisé) | © projet |
| `public/img/ball.png` | illustration générée par IA (kit fourni par le produit) | ballon unique partagé plateau + séance |
| Avatars shootout (`keeper.png`, `shooter.png`) | **illustrations générées par IA** — v1 (juil. 2026, #243) via **ChatGPT** (OpenAI) ; v2 actuelle (#329) via **Flow** | kits propres au jeu (floqués TM / TACTIC MASTER) ; les masters pleine résolution sont dans `art-sources/shootout/` |

### Points d'attention sur les images IA (assumés, décision produit #243)

1. **Protégeabilité** : selon la juridiction (notamment aux États-Unis), une
   image générée sans apport humain suffisant peut ne pas être protégeable par
   le droit d'auteur. Conséquence pratique : des tiers pourraient réutiliser
   ces avatars ; le reste du produit (code, design, marque d'usage) n'est pas
   affecté.
2. **Conditions des outils** : OpenAI (ChatGPT) cède au client les droits sur
   les sorties ; Google (Flow) ne revendique pas la propriété du contenu.
   CGU en vigueur aux dates de génération **archivées** (permaliens Wayback
   datés) : voir [`legal-archive/cgu-avatars-ia.md`](legal-archive/cgu-avatars-ia.md).
   Les prompts de génération n'ont pas été conservés (constat acté).
3. **Style** : la v1 présentait un style shōnen proche d'une œuvre existante ;
   la v2 a retiré les signaux identifiables (kits recolorés aux couleurs du
   jeu, flocage propre). Risque résiduel faible, documenté.

## Concept de jeu

Mécanique hybride dames/football conçue pour le projet. Les règles de jeu ne
sont pas protégeables par le droit d'auteur (idées) ; l'expression (code,
textes, visuels, identité) l'est et appartient au projet.

## Contenus éditoriaux

Landing (FR/EN), blog (`content/blog/` → `public/blog/`), FAQ, pages légales :
rédigés pour le projet. Aucune reprise de contenu tiers.

## Marque

« Tactic Master » est utilisé comme nom commercial ; **aucun dépôt de marque
(INPI/EUIPO) n'est enregistré à ce jour**. Action ouverte : recherche
d'antériorité puis dépôt dans les classes pertinentes (jeux, logiciels).

## Actions ouvertes

- [x] Archiver les CGU de Flow et d'OpenAI en vigueur aux dates de
      génération des avatars — fait le 2026-07-23, voir
      [`legal-archive/cgu-avatars-ia.md`](legal-archive/cgu-avatars-ia.md).
      Prompts non conservés (constat acté par le propriétaire).
- [ ] Recherche d'antériorité + dépôt de la marque « Tactic Master ».
