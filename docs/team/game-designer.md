# Game Designer — Tactic Master

## Mission sur ce projet

Garantir que les règles restent simples à apprendre mais intéressantes à
maîtriser, et concevoir l'équilibrage des futurs modes (IA, multijoueur,
variantes). Le game design de Tactic Master n'est pas "fini" : les règles de
base sont stables, mais chaque nouveau mode (IA, classement, variantes de
plateau) pose de nouvelles questions d'équilibre que ce rôle doit trancher.

## Ce qui existe déjà à connaître avant de modifier quoi que ce soit

- Le moteur de règles est dans `public/src/engine/gameEngine.js`, entièrement séparé
  de l'affichage — toute modification de règle se fait là, jamais dans l'UI.
- Les règles actuelles : plateau 9×11, déplacement d'une case en 8 directions,
  passe en ligne droite jusqu'au premier obstacle, gardien cantonné à une zone
  de 3×3 devant sa cage, pas de capture de pions.
- 49 tests automatisés (`npm test`) couvrent déjà toutes les règles actuelles
  — toute proposition de changement de règle doit s'accompagner d'un test qui
  prouve le nouveau comportement avant d'être considérée terminée.
- L'IA (`public/src/engine/ai.js`) a 3 niveaux ; le niveau Facile est volontairement
  imparfait (60% de coups aléatoires) pour rester battable par un débutant —
  c'est un choix de design assumé, pas un manque de finition technique.

## Compétences attendues

- Compréhension fine des jeux abstraits à information complète (échecs, dames,
  go) pour évaluer la profondeur stratégique d'une règle avant de la proposer.
- Capacité à formaliser une règle de façon suffisamment précise pour qu'un
  développeur puisse l'implémenter sans ambiguïté (pas de "le pion devrait
  pouvoir un peu plus..." — des conditions exactes, des cas limites traités).
- Sensibilité à l'équilibre "simple à apprendre / profond à maîtriser", qui est
  la promesse centrale du jeu (cf. le pitch sur la page d'accueil : "aussi
  simple que les dames").
- Savoir lire et raisonner sur du pseudo-code ou du JS simple, pour pouvoir
  vérifier directement dans `gameEngine.js` qu'une règle existante fait bien
  ce qu'elle est censée faire avant de proposer un changement.

## Premiers chantiers concrets

1. Revoir l'équilibrage du niveau IA "Difficile" : actuellement un mini-minimax
   sur 2 tours avec une heuristique simple (écart de buts + proximité du
   ballon au but). Tester si un joueur intermédiaire peut le battre
   régulièrement, et proposer un ajustement de l'heuristique si trop facile
   ou trop dur.
2. Concevoir les règles d'un mode classé pour le futur multijoueur (système de
   points, gestion des abandons en cours de partie, égalités).
3. Évaluer si une variante de plateau (taille différente, plus/moins de pions)
   apporterait une vraie diversité de jeu ou casserait l'équilibre actuel —
   et si oui, la formaliser précisément pour implémentation.
4. Documenter par écrit (markdown, dans ce dossier) une "bible des règles" plus
   détaillée que le code lui-même, à destination des futurs développeurs et
   d'un éventuel mode d'aide en jeu.

## Mise à jour v0.5 « Duels & Flow » (juillet 2026)

Le game design a franchi une étape majeure : la v0.5 ajoute de la **tension par
tour**, récompense le **beau jeu** et **varie les parties**, tout en gardant la
promesse « simple à apprendre ». Toutes les mécaniques sont **déterministes**
(aucun dé), fidèles à l'ADN abstrait à information complète du jeu.

Nouvelles règles (détail exact, cas limites et intentions dans
`docs/team/regles-bible-v0.5.md`) :

1. **Couverture / interception** — un pion de champ coupe les cases
   orthogonalement adjacentes ; une passe ne peut ni s'y arrêter ni les
   traverser. Remplace les idées de tacle/pressing (inadaptées au ballon libre)
   par une seule règle propre. C'est le cœur du nouveau jeu défensif.
2. **Une‑deux** — une passe qui arrive à côté d'un appui allié offre un
   déplacement bonus.
3. **Momentum** — suivi des passes consécutives, mis en valeur au but.
4. **Anti‑blocage** — engagement neutre au centre après `STALL_LIMIT = 8` tours
   sans passe.
5. **Cases spéciales** — ailes = « centre » ignorant la couverture ; point de
   penalty = tir perforant.
6. **Pouvoir bonus gratuit par match** — un pouvoir aléatoire par équipe, pour
   rendre le jeu gratuit plus fun sans casser la monétisation.
7. **Variante Tactique (8 pions)** + **séance de tirs au but** (module
   `penaltyShootout.js`) + mort subite exposée en config.

**Chantiers du rôle — état :**

- ✅ *Bible des règles* écrite (`regles-bible-v0.5.md`).
- ✅ *Outil d'équilibrage* livré (`tools/balance-sim.mjs`). Mesure actuelle :
  100 % des parties se terminent, ~3,5 buts/partie, en standard comme en
  Tactique. La couverture ne provoque pas de blocage.
- ✅ *Variante de plateau* évaluée puis formalisée (Tactique, 8 pions).
- ⏳ *Mode classé* (points, abandons, égalités) : la séance de tirs au but pose
  déjà la brique « départage » ; le système de points reste à concevoir.
- ⏳ Rééquilibrage de l'IA « Difficile » face aux nouvelles règles : l'IA
  fonctionne avec la couverture (elle passe par `getPassDestinations`), mais son
  heuristique n'exploite pas encore activement le une‑deux ni les cases
  spéciales — piste d'amélioration.

