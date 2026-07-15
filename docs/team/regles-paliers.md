# Remise à plat des règles — modèle en paliers

> **Livrable du spike [#198](https://github.com/dardourfarid-design/plateau-foot/issues/198)** (épic Règles [#195](https://github.com/dardourfarid-design/plateau-foot/issues/195)).
> Ce document **tranche** le sort de chaque règle et définit **le modèle de paliers** réutilisé par les préréglages de difficulté ([#206](https://github.com/dardourfarid-design/plateau-foot/issues/206)), le tutoriel ([#200](https://github.com/dardourfarid-design/plateau-foot/issues/200)) et l'aide en jeu ([#199](https://github.com/dardourfarid-design/plateau-foot/issues/199)).
> Référence détaillée des règles : [`regles-bible-v0.5.md`](regles-bible-v0.5.md). Moteur : `public/src/engine/`.

## 1. Le problème en une phrase

La v0.5 « Duels & Flow » a empilé **7 mécaniques** sur les règles de base, toutes **actives en permanence et invisibles** à l'écran. Deux d'entre elles (ailes, point de penalty) sont des **exceptions** à une troisième (la couverture) — or les exceptions sont ce qui coûte le plus cher à apprendre. La promesse *« simple comme les dames »* et la profondeur réelle ne sont plus alignées : un débutant subit des règles qu'on ne lui a jamais montrées (« pourquoi ma passe s'arrête là ? »).

**Constat technique.** `createGame(options)` n'expose aujourd'hui que `goalsToWin`, `variant`, `freePowers`, `turnLimit`. Couverture, une-deux, ailes et point de penalty sont **codés en dur** dans `getPassDestinations` / `moveSelectedToken` — impossible de les désactiver pour un débutant. C'est le principal manque à combler.

## 2. Décision : un modèle en 3 paliers

On introduit une notion de **palier de règles** (« ruleset »), orthogonale à la force de l'IA. Chaque palier n'ajoute que ce que le joueur est prêt à absorber.

| Palier | Ajoute par rapport au précédent | Intention | Public |
|---|---|---|---|
| **Découverte** | — (règles de base seules) | *Vraiment* comme les dames : déplacer, pousser, marquer. Zéro exception. | 1ʳᵉ partie, tutoriel de base |
| **Classique** ⭐ | couverture/interception **+ une-deux** | Le duo qui donne un sens à la défense **et** au jeu de passes. Doivent être **rendues visibles** (#201). C'est le mode par défaut. | Joueur régulier |
| **Expert** | ailes + point de penalty + pouvoirs + variante Tactique (8 pions) | Exceptions et options tactiques pour les passionnés. | Joueur confirmé |

**Règles de base (tous paliers, jamais retirées) :** plateau 7×9, 6 pions (1 GK + 2 déf + 3 att), déplacement 1 case/8 directions, poussée du ballon en ligne droite jusqu'au premier obstacle, gardien latéral sur sa ligne de cage, pas de capture, victoire au score.

**Par défaut = Classique.** Découverte est le premier contact (tutoriel, option « Découverte »). Expert est opt-in.

## 3. Verdict règle par règle

Chaque mécanique de la bible v0.5 reçoit une décision : **garder / rendre visible / simplifier / Expert / couper**.

| # | Mécanique | Verdict | Palier | Justification |
|---|---|---|---|---|
| 2 | **Couverture / interception** | **Rendre visible** | Classique | Levier n°1 de profondeur défensive, mais invisible → frustrante. On la garde mais elle **doit** être signalée à l'écran (#201). Sans elle, la défense redevient passive. |
| 3 | **Une-deux** (mouvement bonus) | **Garder** | Classique | Récompense le jeu de passes, se découvre naturellement (« j'ai rejoué ! »). Faible charge cognitive. À expliquer en une ligne dans l'aide. |
| 4 | **Momentum** | **Garder — comme récompense, pas comme règle** | tous | C'est une **mesure**, pas une contrainte : le joueur n'a rien à apprendre. On le garde partout, on ne l'« enseigne » pas ; on branche juste sa récompense (#203). |
| 5 | **Anti-blocage** (engagement neutre) | **Garder — filet de sécurité** | tous | Se déclenche ≈1,4×/partie, jamais un choix du joueur. Une phrase dans l'aide suffit. Aucun coût d'apprentissage. |
| 6.1 | **Ailes = centre** (passe de bord ignore la couverture) | **Repousser en Expert** | Expert | C'est une **exception à la couverture**. Tant que le joueur n'a pas digéré la couverture (Classique), lui ajouter son exception nuit à la lisibilité. |
| 6.2 | **Point de penalty** (tir perforant) | **Repousser en Expert + rendre visible** | Expert | Deuxième exception à la couverture, avec en plus une règle de perforation. Puissante et gratifiante mais à réserver aux joueurs installés. La case doit être **marquée sur le plateau** quand le palier l'active. |
| 7 | **Pouvoir bonus gratuit / match** | **Garder — off en Découverte** | Classique+ (toggle) | Le « sel » du jeu. Aléatoire (ne casse pas la monétisation des pions mercato). Désactivé en Découverte pour ne pas noyer le débutant ; toggle ailleurs (déjà `freePowers`). |
| 8.1 | **Variante Tactique** (8 pions) | **Garder — Expert/option** | Expert | Densité pour qui veut plus de duels ; jamais le mode d'entrée. Déjà géré par `variant`. |
| 8.2 | **Mort subite / manche courte** | **Garder — orthogonal (format)** | tous | C'est un **format de partie**, pas une règle de plateau. Reste dans les « Options avancées » (#205), indépendant du palier. |
| 8.3 | **Séance de tirs au but** | **Garder** | tous | Départage d'un nul + mode standalone. Inchangé. |

**Rien n'est coupé.** La simplification vient du **séquencement** (ce qu'on montre quand), pas de la suppression de profondeur — fidèle à la décision de design v0.5 (§8.1 de la bible : la profondeur vient des mécaniques, pas du nombre de pions).

## 4. Traduction moteur (contrat pour #206, #201, #200)

On ajoute un objet `rules` à `createGame(options)`, dérivé du palier. Les helpers existants sont déjà prêts à 90 % — `getPassDestinations` accepte déjà `ignoreCoverage`.

```js
// createGame(options) — nouveau champ dérivé, gelé dans l'état
const RULESETS = {
  decouverte: { coverage: false, oneTwo: false, wings: false, penaltySpot: false, powers: false, variant: 'standard' },
  classique:  { coverage: true,  oneTwo: true,  wings: false, penaltySpot: false, powers: true,  variant: 'standard' },
  expert:     { coverage: true,  oneTwo: true,  wings: true,  penaltySpot: true,  powers: true,  variant: 'tactique' },
};
// options.ruleset ∈ {'decouverte','classique','expert'} (défaut 'classique')
// options.rules peut surcharger finement un flag (Options avancées #205)
```

Points d'ancrage dans le code (là où les flags doivent être lus) :

- **`coverage`** → dans `getPassDestinations`, `ignoreCoverage` doit valoir `true` quand `state.rules.coverage === false` (aujourd'hui la couverture est toujours appliquée sauf aile/penalty). C'est le **seul vrai changement de logique** ; le reste est du câblage.
- **`wings`** → `isWingPass()` ne doit ouvrir le contournement que si `state.rules.wings`.
- **`penaltySpot`** → `isPenaltyShot()` / bloc perforant de `getPassDestinations` conditionnés à `state.rules.penaltySpot`.
- **`oneTwo`** → le flag `comboMoveAvailable` n'est armé que si `state.rules.oneTwo` (dans `applyBallMovement`).
- **`powers`** → déjà géré par `freePowers` ; le palier ne fait que fixer sa valeur par défaut.
- **`variant`** → déjà géré ; le palier fixe la valeur par défaut.

**Invariant à préserver :** l'équilibrage (`tools/balance-sim.mjs`) doit rester « 100 % des parties se terminent » pour chaque palier. Découverte a moins de mécaniques anti-blocage actives → **vérifier que l'engagement neutre (anti-blocage) reste actif en Découverte** (il l'est : c'est un filet, pas une règle de palier).

## 5. Ce que chaque issue hérite de ce spike

- **#206 (préréglages de difficulté)** : mappe `Découverte→(IA facile, ruleset decouverte)`, `Classique→(IA moyenne, ruleset classique)`, `Expert→(IA difficile, ruleset expert)`. Un seul choix, deux effets.
- **#200 (tutoriel)** : le tutoriel de base couvre **Découverte** ; un chapitre « Classique » introduit couverture + une-deux ; « Expert » optionnel pour ailes/penalty/pouvoirs. Ne jamais montrer une règle inactive.
- **#201 (visualisation)** : n'affiche les repères de couverture **que** si `rules.coverage`; marque la case de penalty **que** si `rules.penaltySpot`.
- **#199 (aide en jeu)** : filtre la liste des règles sur le `ruleset` courant.
- **#205 (options avancées)** : permet la surcharge fine (`options.rules`) par-dessus le préréglage, pour les bricoleurs.

## 6. Statut

- [x] Décision tranchée pour chaque mécanique de la bible v0.5 (§3).
- [x] Modèle de paliers nommé et réutilisable (§2, §4).
- [ ] Implémentation → issues #206 (flags/preset), #201, #200, #199 (aucune ligne de moteur écrite dans ce spike).

**Prochaine étape recommandée :** #206 (introduire `ruleset`/`rules` dans `createGame` + préréglages), car il débloque #200/#201/#199.
