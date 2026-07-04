# Bible des règles — Tactic Master v0.5 « Duels & Flow »

Ce document est la référence détaillée des règles, plus précise que le code
lui-même. Il est destiné aux développeurs, au futur mode d'aide en jeu, et à
toute personne qui doit raisonner sur l'équilibrage. Chaque règle introduite en
v0.5 est décrite avec ses conditions exactes, ses cas limites, et l'intention de
design qui la motive.

Toutes les règles vivent dans `src/engine/` (moteur pur, sans DOM) et sont
couvertes par la suite de tests (`npm test`, 140 tests à ce jour).

---

## 1. Rappel des règles de base (inchangées)

- Plateau **7 colonnes × 9 lignes**. Cages centrées sur les colonnes 2‑3‑4,
  ligne 0 (cage Rouge) et ligne 8 (cage Bleu).
- Formation standard : **6 pions par équipe** (1 gardien, 2 défenseurs,
  3 attaquants).
- À son tour, un joueur **déplace un pion d'une case** (8 directions), puis, si
  ce pion est adjacent au ballon, peut **pousser le ballon** en ligne droite
  jusqu'au premier obstacle.
- Le **gardien** ne se déplace que latéralement sur sa ligne de cage.
- **Pas de capture** de pions. On gagne en marquant le nombre de buts requis.
- Le ballon est un **objet libre** : il n'y a pas de « porteur ». La possession,
  c'est simplement le fait d'avoir un pion à côté du ballon pour le jouer.

L'objectif de la v0.5 est d'ajouter de la **tension par tour**, de récompenser
le **beau jeu**, et de **varier les parties**, sans casser la promesse « simple
à apprendre ». Toutes les mécaniques ci‑dessous sont **déterministes** (aucun
dé) : c'est un choix assumé, fidèle à l'ADN des jeux abstraits à information
complète (échecs, dames, go).

---

## 2. Couverture / interception (déterministe)

**Règle.** Un pion de champ (non gardien) « couvre » les 4 cases qui lui sont
**orthogonalement** adjacentes (haut, bas, gauche, droite). Une passe **ne peut
ni s'arrêter sur, ni traverser** une case couverte par l'adversaire : la ligne
de passe s'arrête juste avant.

**Conditions exactes** (`getPassDestinations`, `isCellCoveredBy`) :

- La couverture est évaluée pour l'**équipe adverse** à celle qui joue la passe
  (`state.turn`).
- Seules les adjacences **orthogonales** couvrent. Les diagonales ne couvrent
  pas — elles restent des couloirs d'expression tactique et gardent la règle
  lisible d'un coup d'œil.
- Le **gardien ne couvre pas** : il défend en occupant physiquement les cases de
  sa cage, pas par une « aura ». Sans cette exception, marquer deviendrait
  quasi impossible.
- Nos **propres** pions ne gênent jamais nos passes (la couverture est une
  notion strictement adverse).

**Cas limites.**

- Une case occupée reste un obstacle dur (comportement d'avant v0.5) : la passe
  s'arrête avant, qu'il y ait couverture ou non.
- Une case couverte **et** libre devient injouable pour la passe, mais reste
  franchissable par un **déplacement de pion** (la couverture ne concerne que le
  ballon, jamais les pions).

**Intention.** C'était le levier n°1 : donner un rôle **actif** à la défense.
Avant, l'adversaire ne faisait que bloquer passivement des cases occupées.
Maintenant, le placement défensif « coupe » des couloirs, et l'attaquant doit
manœuvrer pour ouvrir des lignes. La règle remplace les idées initiales de
« tacle » et de « pressing » — inadaptées au modèle de ballon libre — par une
seule règle propre qui les unifie.

**Équilibrage vérifié.** Simulation IA vs IA (`tools/balance-sim.mjs`, 40
parties/config) : **100 % des parties se terminent**, ~3,5 buts/partie. La
couverture ne provoque pas de blocage.

---

## 3. Une‑deux (mouvement bonus)

**Règle.** Si une passe **arrive à côté d'un appui allié** (un pion de champ à
soi, orthogonalement adjacent à la case d'arrivée du ballon), l'équipe rejoue
**immédiatement un déplacement de pion bonus** — jamais une seconde passe. Après
ce déplacement bonus, la main passe normalement à l'adversaire.

**Conditions exactes** (`applyBallMovement`, flag `comboMoveAvailable`) :

- Le bonus n'est **pas cumulable** : on ne le déclenche pas s'il y a déjà un
  bonus en cours (`comboMoveAvailable`) ou un Relais en attente.
- Pendant le mouvement bonus, **aucune passe** n'est autorisée (`passBall` et
  `listLegalMoves` le garantissent) : c'est un déplacement, un seul.
- Le handoff est **propre** : le mouvement bonus consommé, le tour passe à
  l'adversaire (contrairement au comportement historique du pouvoir Relais).

**Intention.** Récompenser le jeu de passes fluide façon « une‑deux ». C'est la
généralisation gratuite et universelle de l'idée du pouvoir Relais. Incite à
garder des coéquipiers proches des lignes de passe.

---

## 4. Momentum

**Règle (mesure, pas contrainte).** L'état suit `passStreak` : le nombre de
passes consécutives de l'équipe en possession. Il repart à 1 quand la possession
change de camp. À chaque but, `lastGoalPassStreak` expose le momentum de
l'action.

**Usage.** Un but marqué au bout de **3 passes ou plus** est mis en valeur dans
l'UI (célébration spéciale « action à N passes ! »). Le champ est prévu pour
brancher un **bonus de pièces/XP** côté serveur (voir §9, hook non encore câblé
dans l'économie Supabase).

---

## 5. Anti‑blocage (chrono de possession)

**Règle.** L'état suit `ballIdleTurns` : le nombre de tours consécutifs **sans
aucune passe** (pur repositionnement de pions). Une passe remet ce compteur à 0.
Si le compteur atteint **`STALL_LIMIT = 8`** (soit 4 tours par camp sans qu'un
seul ballon ne soit joué), un **engagement neutre** se déclenche : le ballon
revient au centre (s'il est libre), les compteurs sont remis à zéro, et
`stalled` passe à vrai le temps d'un tour.

**Cas limites.**

- On ne **relocalise jamais les pions** lors d'un engagement neutre (contrairement
  à la remise en jeu après un but), pour ne pas effacer une composition
  mercato/perso en cours de partie.
- Si la case centrale est occupée, le ballon reste où il est (seuls les
  compteurs se réinitialisent) — jamais de chevauchement.

**Intention.** Empêcher le camping / les impasses figées. Volontairement rare :
il ne se déclenche qu'en cas de vraie impasse. La simulation le mesure
(≈ 1,4 déclenchement/partie en standard, ≈ 3,6 en variante Tactique plus dense).

---

## 6. Cases spéciales

### 6.1 Ailes = « centre »

**Règle.** Une passe qui **part d'une colonne de bord** (0 ou 6) ignore la
couverture adverse sur ce coup (`isWingPass`). Un centre venu de l'aile est
difficile à intercepter.

**Intention.** Récompenser le jeu large, ouvrir une voie de contournement quand
le centre est verrouillé par la couverture.

### 6.2 Point de penalty = tir perforant

**Règle.** Chaque équipe a un **point de penalty** : la case centrale (colonne 3)
à deux rangées de la cage adverse — **(2, 3)** pour Bleu, **(6, 3)** pour Rouge
(`penaltySpotFor`). Depuis cette case, un tir vers la cage **ignore la
couverture** et **transperce un seul défenseur de champ**.

**Cas limites.**

- Le **gardien arrête quand même** le penalty : le tir ne traverse jamais le
  gardien ni un pion allié.
- On ne transperce **qu'un seul** défenseur de champ ; un second défenseur dans
  l'axe bloque le tir.

**Intention.** Donner une vraie récompense au fait d'amener le ballon jusqu'au
point de penalty : les défenseurs ne peuvent plus se contenter de faire barrage
de leur corps, seul le placement du gardien compte encore.

---

## 7. Pouvoir bonus gratuit par match

**Règle.** Avec l'option `freePowers` (activée par défaut en local/IA), chaque
équipe reçoit, au coup d'envoi, **un pouvoir tiré au sort** placé sur un de ses
pions de champ (`assignFreePowers`). Les pouvoirs sont ceux du mercato : Tir
Puissant, Sprint, Mur, Relais, Repli adverse — utilisables **une fois** par
partie.

**Intention.** Le « sel » du jeu (les pouvoirs) était réservé aux pions mercato
(collection/payant). Le donner gratuitement, un par match, rend chaque partie
plus vivante **sans casser la monétisation** : les pions mercato restent
supérieurs (pouvoir **fixe et choisi**, alors que le bonus est **aléatoire**).

**Note technique.** L'attribution est déterministe si l'on injecte `options.rng`
(utilisé par les tests). Les pouvoirs bonus et les pouvoirs de composition
(`applyPowersToGameState`) coexistent sans conflit.

---

## 8. Modes et variantes

### 8.1 Variante « Tactique » (8 pions)

`createGame({ variant: 'tactique' })` construit une formation dense de **8 pions
par équipe** (1 gardien, 3 défenseurs, 4 attaquants, les attaquants occupant les
colonnes 0‑2‑4‑6 pour exploiter les ailes). La partie « standard » reste à 6
pions. La variante est préservée à la remise en jeu après un but.

**Décision de design.** Le mode standard reste la porte d'entrée « simple comme
les dames ». La profondeur v0.5 vient des **mécaniques** (couverture, une‑deux,
cases spéciales), pas du nombre de pions — ajouter des pions au mode par défaut
aurait rendu les buts trop rares et le plateau confus. La variante Tactique
sert le public qui veut plus de duels.

### 8.2 Mort subite et manche courte

- **Mort subite** : `createGame({ goalsToWin: 1 })`, exposé en config (option « 1 »).
- **Manche courte** : `createGame({ turnLimit: N })`. La partie s'arrête au bout de
  `N` tours joués (`turnCount`). Score différent → vainqueur ; score égal →
  `isDraw: true` (match nul), départagé aux tirs au but (voir 8.3). Exposé en
  config via l'option Format « Manche courte » (`turnLimit = 40`). Vérifié :
  sur 60 manches IA de 40 tours, ~1/3 finissent nulles et déclenchent le
  départage, le reste est décidé au score.

### 8.3 Séance de tirs au but (`src/engine/penaltyShootout.js`)

Mini‑jeu déterministe de départage des égalités. Chaque tir oppose une direction
choisie par le tireur (`gauche`/`centre`/`droite`) à une direction choisie par le
gardien : **but si les deux diffèrent**, arrêt sinon. Règles classiques :
5 tirs chacun, **clinch anticipé**, puis **mort subite par paires**.

- `createShootout({ bestOf })`, `shoot(state, tireur, gardien)`,
  `isShootoutOver`, `shootoutWinner`, `randomDirection(rng)`.
- Le penalty comporte une part de « je te vois / tu me vois » (choix simultané
  caché) : c'est assumé — un penalty **est** un duel de lecture, pas une position
  d'échecs. C'est la seule entorse tolérée à l'information complète, et elle est
  circonscrite à ce mini‑jeu de départage.

Le moteur du mini‑jeu est complet et testé, **et son écran interactif est câblé**
(choix de direction : tu tires quand c'est ton tour, tu plonges quand l'IA tire ;
gardien et ballon animés, score, pastilles de tirs, mort subite). Deux usages :
en **standalone** (bouton « Séance de tirs au but » en config) et en **départage**
automatique d'une manche courte terminée sur un nul (`state.isDraw`), où la séance
désigne le vainqueur du match.

---

## 9. Récapitulatif des champs d'état ajoutés (v0.5)

| Champ | Rôle |
|---|---|
| `variant` | `'standard'` ou `'tactique'` (préservé aux remises en jeu) |
| `possession` | dernière équipe à avoir joué le ballon |
| `passStreak` | passes consécutives de la possession (momentum) |
| `lastGoalPassStreak` | momentum de l'action du dernier but (hook bonus) |
| `ballIdleTurns` | tours consécutifs sans passe (anti‑blocage) |
| `stalled` | vrai le tour où l'engagement neutre s'est déclenché |
| `comboMoveAvailable` | un déplacement bonus une‑deux est dû |

Constantes : `STALL_LIMIT = 8`. Helpers exposés : `isCellCoveredBy`,
`isWingPass`, `penaltySpotFor`, `isPenaltyShot`, `ORTHOGONAL_DIRS`.

---

## 10. État d'avancement

**Câblé et testé** (moteur + UI) : couverture, une‑deux, momentum, anti‑blocage,
ailes, point de penalty, pouvoir bonus/match, variante Tactique, mort subite,
**manche courte + séance de tirs au but (standalone et départage)**, juice de but,
repères visuels des cases spéciales, options d'écran de config, tutoriel étendu.

**Moteur prêt, UI à finir** :

1. **Bonus de momentum côté économie** — `lastGoalPassStreak` est exposé ; il
   reste à brancher la récompense pièces/XP dans le RPC serveur
   `record_game_result` (nouvelle migration Supabase), là où sont déjà gérés les
   gains de partie.
2. **Mode en ligne** — les nouvelles options (variante, pouvoirs bonus) ne sont
   pour l'instant appliquées qu'en local/IA ; les activer en ligne demande que
   les deux joueurs s'accordent sur le même règlement (à traiter dans le
   protocole multijoueur pour éviter toute désynchronisation).
