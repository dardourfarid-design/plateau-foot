# Masters des illustrations

Fichiers **sources**, en pleine résolution. Ils ne sont pas servis : Vercel ne
déploie que `public/` (`outputDirectory` dans `vercel.json`). Ils vivent ici
pour pouvoir ré-exporter les assets si une taille d'affichage change.

## `shootout/` — avatars de la séance de tirs au but (#243)

| master | rendu dans le jeu | emplacement CSS |
|---|---|---|
| `gardien.png` (752×719) | `public/img/shootout/keeper.png` (264×252) | `.pk-keeper`, max 132×196 |
| `tireur.png` (545×985) | `public/img/shootout/shooter.png` (210×376) | `.pk-shooter`, max 124×188 |
| `ballon.png` (256×258) | `public/img/ball.png` (72×72) | `.pk-ball` **et** `.ball` du plateau |

Traitement appliqué pour passer du master à l'asset servi (~1 Mo → 179 Ko) :

1. **recadrage sur le contenu opaque** — les trois masters portent ~29 % de marge
   transparente, qui fait rendre la figure plus petite que son emplacement
   puisque le CSS utilise `object-fit: contain` ;
2. **redimensionnement à 2×** la taille d'affichage réelle (mesurée dans la page,
   pas déduite du CSS : les `clamp()` dépendent de la largeur de la scène) ;
3. **`tireur.png` uniquement — recolorage du kit** : teinte 210° (bleu) → 45°
   (l'or du jeu), en relevant la luminosité (`l*0.9 + 0.2`), sinon le jaune
   sombre vire moutarde. Le master a gardé son kit bleu d'origine.

Le ballon est **partagé** entre le plateau et la séance : un seul fichier,
`public/img/ball.png`. Ne pas le redivergencer.
