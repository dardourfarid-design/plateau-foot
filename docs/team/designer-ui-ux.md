# Designer UI/UX — Tactic Master

## Mission sur ce projet

Faire passer l'identité visuelle de "cohérente et fonctionnelle" à "vraiment
distinctive et professionnelle" : pousser plus loin le design system déjà en
place, produire des assets que le code seul ne peut pas bien générer
(icônes, illustrations, éventuel logo travaillé), et challenger les choix
d'ergonomie pris jusqu'ici par un développeur qui faisait aussi le design.

## Ce qui existe déjà à connaître avant de proposer des changements

- **Palette et typographie déjà fixées** : variables CSS dans
  `public/styles.css` (`--vert-terrain`, `--nuit`, `--terre`, etc.), Barlow
  Condensed pour les titres (registre "panneau de stade"), Space Grotesk pour
  le texte courant. Tout changement de direction visuelle majeure doit
  repartir de cette base ou justifier clairement de la remplacer.
- **8 thèmes déjà livrés** (Classique, Néon, Neige, Terre battue, Nuit de
  stade, Rétro 8-bit, Jungle, Crépuscule) — chacun ne fait que réassigner 5
  variables de couleur (`vertTerrain`, `vertTerrainClair`, `bleuEquipe`,
  `rougeEquipe`, `accent`). C'est un système simple à étendre mais qui limite
  la diversité réelle (pas de changement de texture, de forme des pions,
  etc.) — premier axe de réflexion pour aller plus loin.
- **Aucune icône custom** : les "icônes" actuelles sur la page d'accueil sont
  des caractères Unicode (♟, ●, ◷) choisis pour leur compatibilité
  universelle plutôt que pour leur qualité visuelle — un vrai point faible à
  corriger en priorité.
- **Responsive desktop ajouté après coup** : le produit a d'abord été pensé
  mobile-only puis adapté au desktop dans un sprint dédié — il y a
  probablement des angles morts dans cette adaptation à challenger avec un
  regard de designer plutôt que de développeur.
- **Pas de système d'animation construit** : seules quelques transitions CSS
  simples existent (pulsation des cases de passe, apparition des overlays).

## Compétences attendues

- Direction artistique capable de pousser une identité existante sans la
  dénaturer (le système gazon/nuit/terre fonctionne, l'enjeu est de
  l'approfondir, pas de tout recommencer).
- Production d'assets vectoriels (SVG) prêts à intégrer directement dans le
  code — pas seulement des maquettes statiques, mais des fichiers utilisables
  par un développeur sans aller-retour de production.
- Sensibilité aux contraintes d'une app sans framework lourd : privilégier des
  solutions CSS/SVG légères plutôt que des dépendances d'animation coûteuses.
- Capacité à faire des revues d'écrans existants (captures à l'appui) en
  argumentant précisément ce qui ne fonctionne pas, plutôt que des
  réécritures complètes non justifiées.

## Premiers chantiers concrets

1. Remplacer les icônes Unicode de la page d'accueil par de vraies icônes
   SVG cohérentes avec l'identité (trait, épaisseur, style).
2. Étendre le système de thèmes au-delà de la couleur : textures de gazon
   alternatives, formes de pions différentes par thème, pour que "Rétro
   8-bit" ou "Jungle" se ressentent vraiment, pas juste par leur palette.
3. Revue complète de la responsivité tablette (zone non testée explicitement
   jusqu'ici, entre les seuils mobile et desktop définis dans le CSS).
4. Concevoir les écrans manquants pour le multijoueur (salle d'attente,
   liste de joueurs, état "adversaire déconnecté") avant que les développeurs
   n'aient à les improviser.
