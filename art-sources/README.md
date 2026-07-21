# Masters des illustrations

Fichiers **sources**, en pleine résolution. Ils ne sont pas servis : Vercel ne
déploie que `public/` (`outputDirectory` dans `vercel.json`). Ils vivent ici
pour pouvoir ré-exporter les assets si une taille d'affichage change.

## `shootout/` — avatars de la séance de tirs au but (#243)

| master | rendu dans le jeu | emplacement CSS |
|---|---|---|
| `gardien.png` (975×1474) | `public/img/shootout/keeper.png` (259×392) | `.pk-keeper`, max 132×196 |
| `tireur.png` (891×1847) | `public/img/shootout/shooter.png` (181×376) | `.pk-shooter`, max 124×188 |
| `ballon.png` (256×258) | `public/img/ball.png` (72×72) | `.pk-ball` **et** `.ball` du plateau |

Les deux avatars de la séance ont été **remplacés en juillet 2026** (#329) :
gardien en kit bleu floqué `TM` n°1, tireur de dos en kit jaune/rouge floqué
`TACTIC MASTER` n°7. Le recolorage bleu → or décrit pour l'ancien `tireur.png`
ne s'applique plus : la nouvelle illustration est déjà aux couleurs du jeu.

## Passer d'un master à l'asset servi

Le trajet est **scripté et reproductible** — `tools/prepare-shootout-avatars.mjs`
(voir son en-tête pour l'installation de `sharp`, volontairement hors
`package.json`) :

```
npm i --no-save sharp
node tools/prepare-shootout-avatars.mjs <gardien.jpeg> <tireur.jpeg>
```

1. **détourage** — les illustrations arrivent en JPEG avec un damier gris/blanc
   « de transparence » **cuit dans l'image** : le JPEG n'a pas de canal alpha.
   Le script part des bords et ne progresse que de proche en proche à travers
   des pixels de damier, ce qui laisse intacts les blancs *intérieurs* du sujet.
   Il traite ensuite les poches de damier **enfermées** — le tireur a les mains
   sur les hanches, bras et torse forment deux triangles clos — en les
   distinguant du sujet par deux critères : le damier n'a que deux tons francs
   (peu de valeurs intermédiaires, contrairement aux crampons blancs modelés)
   et il les alterne à parts voisines (contrairement au logo `TM` de la
   poitrine, uniformément clair). Retirer l'un des deux critères perce soit les
   chaussures, soit le logo — c'est arrivé, dans cet ordre ;
2. **recadrage sur le contenu opaque** — sans quoi la marge transparente fait
   rendre la figure plus petite que son emplacement, le CSS utilisant
   `object-fit: contain` ;
3. **redimensionnement** dans un gabarit de 2× les maxima CSS, pour rester net
   en écran haute densité sans toucher à la mise en page.

Après remplacement, **incrémenter `CACHE_NAME` dans `public/sw.js`** : les noms
de fichiers ne changent pas, donc sans ça un joueur déjà venu garde les anciens
avatars.

Le ballon est **partagé** entre le plateau et la séance : un seul fichier,
`public/img/ball.png`. Ne pas le redivergencer.
