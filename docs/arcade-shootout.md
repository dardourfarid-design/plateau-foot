# Séance de tirs au but — design « Arcade » (à intégrer)

Design retenu : **Arcade** (couleurs vives, contours francs, confettis +
secousse d'écran sur but, texte qui « pop »). Il remplace l'ancien rendu vert.

## Fichiers modifiés (3)

1. **public/index.html** — le SVG de la scène (`<svg id="shootoutScene" class="shootout-scene">`)
   a été reskinné en arcade : pelouse verte vive, cage blanche épaisse, gardien
   n°1 jaune à contours noirs, tireur n°9 bleu, gros ballon cerclé de noir,
   tribune de supporters. **Les IDs et les coordonnées sont inchangés**
   (`shootoutKeeper` @ translate(150,110), `shootoutBall`/`shootoutBallSpin`
   @ translate(126,198), `shootoutShooter` @ translate(92,196), zones
   `.shootout-zone`), donc la logique JS existante fonctionne telle quelle.
   Seul ajout : `id="shootoutScene"` sur le `<svg>` (cible des confettis).

2. **public/styles.css** — bloc `/* SÉANCE DE TIRS AU BUT (Arcade v1) ... */`
   (à la fin du fichier) : fond « stade » plein écran, carte centrée 540px
   (bordure jaune), scène 420px (validé pour tenir à l'écran), boutons jaunes
   à bordure noire, pastilles de score visibles (`display:inline-block`),
   keyframes `soShake` (secousse), `soPop` (texte), `soBob` (public).

3. **src/ui/main.js** — dans le bloc « SÉANCE DE TIRS AU BUT (UI) » :
   - `wireShootout()` met en cache `els.shootoutScene` et `els.shootoutModal`.
   - nouvelle fonction `spawnShootoutConfetti()`.
   - `playShootoutDir()` : sur un but → confettis + secousse de la carte +
     texte « BUT ! » qui pop (sinon « Arrêt ! »).
   > **Note** : `public/src/` est la source unique du code (déploiement
   > statique, sans build) — édite directement ces fichiers.

## Vérifs
- `npm test` → 144 tests au vert (le moteur `penaltyShootout.js` est inchangé).
- Rendu et proportions validés dans Chrome (carte centrée, tout visible).
- Service worker en `tactic-master-v7` (pense à l'incrémenter si tu changes des
  assets, pour forcer le cache à se rafraîchir).

## Rappel gameplay (inchangé)
Best-of-5 + mort subite. Tu es toujours Bleu : tu **tires** à ton tour, tu
**plonges** (choisis un côté) quand l'IA tire. Accessible depuis l'écran de
config (bouton « ⚽ Séance de tirs au but ») et en **départage** automatique
d'une manche courte terminée sur un nul.
