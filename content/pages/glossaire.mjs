// Page /glossaire. TERMES est la source : le corps HTML et le JSON-LD
// DefinedTermSet en sont tous deux dérivés (tools/build-pages.mjs).
// Définitions vérifiées dans public/src/engine/ (2026-08-04).

export const TERMES = [
  {
    t: 'Adjacence',
    d: `Deux cases sont adjacentes si elles se touchent, y compris en diagonale —
    huit voisines par case. C'est la portée d'un déplacement, et la condition pour
    qu'un pion puisse pousser le ballon. À ne pas confondre avec l'adjacence
    orthogonale, qui définit la couverture.`
  },
  {
    t: 'Aile',
    d: `Les deux colonnes de bord du terrain, la première et la septième. Une
    passe qui en part est un centre.`
  },
  {
    t: 'Anti-blocage',
    d: `Mécanisme qui remet le ballon au centre après huit tours consécutifs sans
    la moindre passe. Il empêche deux joueurs prudents de figer indéfiniment la
    partie. Les pions ne sont pas replacés.`
  },
  {
    t: 'Attaquant',
    d: `Les trois pions de la ligne avancée au coup d'envoi — quatre en formation
    tactique. L'appellation décrit une position de départ, pas une capacité :
    attaquants et défenseurs se déplacent exactement de la même façon.`
  },
  {
    t: 'Ballon',
    d: `L'unique ballon de la partie. Il occupe une case, ne peut être ni traversé
    ni porté, et se déplace uniquement quand un pion adjacent le pousse.`
  },
  {
    t: 'But',
    d: `Ballon immobilisé sur l'une des trois cases de la cage adverse. Après un
    but, le ballon revient au centre, tous les pions reprennent leur position de
    départ et l'équipe qui a encaissé engage.`
  },
  {
    t: 'Cage',
    d: `Les trois cases centrales de la ligne de fond d'un camp. C'est la zone à
    protéger, et la seule où un but peut être marqué.`
  },
  {
    t: 'Case couverte',
    d: `Case rendue infranchissable pour les passes adverses par la présence d'un
    pion de champ ennemi directement au-dessus, en dessous, à gauche ou à droite.
    Une passe ne peut ni s'y arrêter ni la traverser.`
  },
  {
    t: 'Centre',
    d: `Passe partant d'une colonne de bord. Elle ignore complètement la
    couverture adverse, ce qui en fait le contre direct d'une défense massée dans
    l'axe. Actif au palier Expert.`
  },
  {
    t: 'Classique',
    d: `Palier de règles par défaut : couverture défensive et une-deux actives,
    centres et point de penalty inactifs, formation à six pions, pouvoirs
    disponibles.`
  },
  {
    t: 'Couverture défensive',
    d: `Mécanique centrale du jeu : chaque pion de champ rend infranchissables les
    quatre cases orthogonalement voisines. Les diagonales restent ouvertes, et le
    gardien ne couvre rien.`
  },
  {
    t: 'Découverte',
    d: `Palier de règles le plus simple : aucune interception, ni une-deux, ni
    centre, ni point de penalty. Les passes ne sont arrêtées que par les pions
    eux-mêmes et les bords. C'est le palier des puzzles et des premières parties.`
  },
  {
    t: 'Défenseur',
    d: `Les deux pions de la ligne arrière au coup d'envoi — trois en formation
    tactique. Comme les attaquants, ils se déplacent d'une case dans les huit
    directions et peuvent marquer.`
  },
  {
    t: 'Engagement neutre',
    d: `Remise du ballon au centre déclenchée par l'anti-blocage. La possession
    est remise à zéro : aucune équipe n'est considérée comme détentrice du ballon.`
  },
  {
    t: 'Expert',
    d: `Palier de règles complet : couverture, une-deux, centres depuis les ailes
    et point de penalty, sur une formation tactique à huit pions par camp.`
  },
  {
    t: 'Formation standard',
    d: `Six pions par équipe : un gardien, deux défenseurs et trois attaquants.
    C'est la formation des paliers Découverte et Classique.`
  },
  {
    t: 'Formation tactique',
    d: `Huit pions par équipe : un gardien, trois défenseurs et quatre attaquants.
    Le terrain devient plus dense et les lignes de passe plus difficiles à
    ouvrir. C'est la formation du palier Expert.`
  },
  {
    t: 'Gardien',
    d: `Le seul pion aux règles particulières : il ne se déplace que sur les trois
    cases de sa ligne de cage, et il ne couvre aucune case. Il défend en occupant
    physiquement une case du but.`
  },
  {
    t: 'Ligne de fond',
    d: `La première et la dernière ligne du plateau. Elle abrite la cage — ses
    trois cases centrales — et la case de départ du gardien.`
  },
  {
    t: 'Momentum',
    d: `Nombre de passes consécutives réalisées par l'équipe en possession. Il
    repart à un dès que le ballon change de camp. Un but marqué au terme d'au
    moins trois passes est signalé comme un bonus de momentum, et le meilleur
    enchaînement de chaque équipe est retenu jusqu'à la fin du match.`
  },
  {
    t: 'Mur',
    d: `Pouvoir : pendant le tour adverse suivant, le pion concerné coupe aussi
    les passes diagonales qui contournent son coin, c'est-à-dire celles qui
    passent entre lui et une case voisine. Le seul moyen de fermer une diagonale
    dans le jeu. Il ne gêne jamais le camp qui l'a érigé, et son effet vaut même
    contre un centre ou un tir puissant.`
  },
  {
    t: 'Palier de règles',
    d: `Ensemble cohérent de mécaniques activées pour une partie : Découverte,
    Classique ou Expert. Chaque mécanique reste modifiable individuellement dans
    les options avancées.`
  },
  {
    t: 'Passe',
    d: `Poussée du ballon en ligne droite par un pion adjacent. Le ballon glisse
    jusqu'au premier obstacle, et le joueur choisit librement sur quelle case
    libre de la trajectoire il s'arrête.`
  },
  {
    t: 'Pion de champ',
    d: `Tout pion qui n'est pas le gardien. Ce sont les seuls à couvrir des cases,
    et les seuls que le pouvoir Repli adverse peut faire reculer.`
  },
  {
    t: 'Point de penalty',
    d: `Case centrale située à deux lignes de la cage adverse. Un tir parti de là
    ignore la couverture et transperce un défenseur de champ, jamais le gardien.
    Actif au palier Expert.`
  },
  {
    t: 'Possession',
    d: `Dernière équipe à avoir touché le ballon par une passe. Elle détermine le
    momentum et se remet à zéro après un but ou un engagement neutre.`
  },
  {
    t: 'Pouvoir',
    d: `Capacité attachée à un pion, utilisable une seule fois par match. Cinq
    existent : Tir Puissant, Sprint, Mur, Relais et Repli adverse. Après usage, le
    pion redevient ordinaire.`
  },
  {
    t: 'Puzzle du jour',
    d: `Position prédéfinie à résoudre en un nombre de coups imposé, identique
    pour tous les joueurs un jour donné. Les puzzles se jouent au palier
    Découverte.`
  },
  {
    t: 'Relais',
    d: `Pouvoir : après une passe, l'équipe déplace immédiatement un second pion.
    Jamais une seconde passe.`
  },
  {
    t: 'Repli adverse',
    d: `Pouvoir : force un pion adverse de champ à reculer d'une case vers son
    propre camp. Sans effet sur les gardiens, et impossible si la case de repli
    est occupée.`
  },
  {
    t: 'Sprint',
    d: `Pouvoir : le pion se déplace de deux cases en ligne droite au lieu d'une.
    Les deux cases du trajet doivent être libres — il n'y a pas de saut.`
  },
  {
    t: 'Tir Puissant',
    d: `Pouvoir : la passe traverse le premier pion rencontré au lieu de s'arrêter
    contre lui. Décisif face à une défense massée devant la cage.`
  },
  {
    t: 'Tirs au but',
    d: `Mode arcade servant de départage après un match nul, avec visée et jauge
    de puissance. C'est le seul moment du jeu où la mécanique n'est pas au tour
    par tour pur.`
  },
  {
    t: 'Tour',
    d: `Une action et une seule : déplacer un pion, ou pousser le ballon avec un
    pion déjà au contact. Un déplacement qui amène un pion contre le ballon
    autorise une passe dans la foulée.`
  },
  {
    t: 'Une-deux',
    d: `Déplacement bonus accordé quand le ballon s'immobilise orthogonalement à
    côté d'un pion de champ allié à l'issue d'une passe. Jamais une seconde
    passe, jamais cumulable.`
  }
];

const squash = s => String(s).replace(/\s+/g, ' ').trim();

// Ancre stable par terme (/glossaire#couverture-defensive) : un lien vers une
// définition précise doit rester valable. NFD décompose « é » en « e » + accent
// combinant, que \p{Diacritic} retire — une classe nommée plutôt qu'un
// intervalle de caractères combinants, invisibles à la relecture.
const anchor = s => s.toLowerCase().normalize('NFD')
  .replace(/\p{Diacritic}/gu, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export const GLOSSAIRE = `
<p class="page-lead">Le vocabulaire de Tactic Master, des termes de plateau aux
mécaniques de règles. Chaque définition correspond au comportement réel du
moteur de jeu. Pour le fonctionnement d'ensemble, voir les
<a href="/regles">règles complètes</a>.</p>

<dl class="glossary">
${TERMES.map(e => `  <dt id="${anchor(e.t)}">${e.t}</dt>
  <dd>${squash(e.d)}</dd>`).join('\n')}
</dl>

<p>Un terme manquant ? Signalez-le depuis la page <a href="/contact">contact</a>,
il sera ajouté.</p>
`;
