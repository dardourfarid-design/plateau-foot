// ===================== CONTENU DU BLOG (#300 / #301) =====================
// Source unique des articles. Chaque entrée produit une page
// public/blog/<slug>.html et une carte sur public/blog/index.html, via
// `node tools/build-blog.mjs`.
//
// POURQUOI DES DONNÉES ET NON DES FICHIERS HTML ÉCRITS À LA MAIN
// Un article, c'est du contenu + une dizaine de balises de tête (title,
// description, canonical, Open Graph, JSON-LD). Écrites à la main, ces balises
// divergent au 3e article : un canonical oublié, une og:url copiée de
// l'article précédent. Ici elles sont dérivées du slug, donc toujours justes.
//
// POUR AJOUTER UN ARTICLE
//   1. ajouter une entrée à ARTICLES (la plus récente en premier) ;
//   2. `node tools/build-blog.mjs` ;
//   3. commiter les fichiers générés dans public/blog/ et le sitemap.
//
// RÈGLE DE FOND, NON NÉGOCIABLE
// Toute affirmation sur les règles doit être vérifiée dans
// public/src/engine/gameEngine.js AVANT publication. Le premier jet de cet
// article contenait trois erreurs (tour de jeu, distance de passe, composition
// de l'équipe) qui n'ont été vues qu'en relisant le moteur. Un article de
// règles faux est pire que pas d'article du tout.
//
// `body` est du HTML (h2/h3, p, ul, ol). Pas de <h1> : il est généré depuis
// `title`, et il ne doit y en avoir qu'un par page.

import {
  STRATEGIES_POUR_GAGNER, BATTRE_IA_DIFFICILE, JOUER_A_DEUX, DAMES_ET_FOOTBALL
} from './strategies.mjs';
import {
  LA_COUVERTURE_DEFENSIVE, MAITRISER_LA_UNE_DEUX, LE_POINT_DE_PENALTY,
  LES_CINQ_POUVOIRS, LE_ROLE_DU_GARDIEN
} from './mecaniques.mjs';
import {
  BIEN_OUVRIR_UNE_PARTIE, DEFENDRE_SANS_TACLER, CHOISIR_SON_PALIER,
  COMMENT_FONCTIONNE_L_IA, JOUER_AVEC_DES_ENFANTS
} from './pratique.mjs';

export const ARTICLES = [
  {
    slug: 'la-couverture-defensive',
    title: 'Comprendre la couverture défensive',
    description:
      'La mécanique qui décide le plus de parties de Tactic Master : ce que couvre un pion, pourquoi les diagonales restent ouvertes, et comment défendre en quinconce.',
    date: '2026-08-04',
    body: LA_COUVERTURE_DEFENSIVE
  },
  {
    slug: 'bien-ouvrir-une-partie',
    title: 'Bien ouvrir une partie de Tactic Master',
    description:
      'Ce que la position de départ autorise vraiment, pourquoi la passe droit devant est bloquée, trois ouvertures qui marchent et les erreurs des cinq premiers tours.',
    date: '2026-08-03',
    body: BIEN_OUVRIR_UNE_PARTIE
  },
  {
    slug: 'defendre-sans-tacler',
    title: 'Défendre sans jamais tacler',
    description:
      'Il n\'existe aucune façon de reprendre le ballon à l\'adversaire : six règles pour défendre par le placement, du quinconce au dégagement qui déclenche une une-deux.',
    date: '2026-08-02',
    body: DEFENDRE_SANS_TACLER
  },
  {
    slug: 'choisir-son-palier-de-regles',
    title: 'Découverte, Classique ou Expert ?',
    description:
      'Les trois paliers de règles de Tactic Master comparés : ce que chacun active, à qui il s\'adresse, ses limites, et les deux réglages fins qui valent le détour.',
    date: '2026-08-01',
    body: CHOISIR_SON_PALIER
  },
  {
    slug: 'comment-fonctionne-l-ia',
    title: 'Comment fonctionne l\'ordinateur du jeu',
    description:
      'Les coulisses des trois niveaux de Tactic Master : comment chacun choisit son coup, ce qu\'il évalue, ce qu\'il ignore, et comment exploiter ses angles morts.',
    date: '2026-07-31',
    body: COMMENT_FONCTIONNE_L_IA
  },
  {
    slug: 'maitriser-la-une-deux',
    title: 'Maîtriser la une-deux',
    description:
      'Le déplacement bonus le plus sous-exploité de Tactic Master : ce qui le déclenche exactement, comment le provoquer un tour à l\'avance et où dépenser le gain.',
    date: '2026-07-30',
    body: MAITRISER_LA_UNE_DEUX
  },
  {
    slug: 'le-point-de-penalty',
    title: 'Le point de penalty, la case qui débloque',
    description:
      'Une case par camp vaut plus que les autres : où elle se trouve, ce qu\'un tir y gagne, les trois façons d\'y amener le ballon et les trois façons de la défendre.',
    date: '2026-07-29',
    body: LE_POINT_DE_PENALTY
  },
  {
    slug: 'les-cinq-pouvoirs',
    title: 'Les cinq pouvoirs et quand les utiliser',
    description:
      'Tir Puissant, Sprint, Relais, Repli adverse et Mur : l\'effet exact de chacun, le moment où il vaut un but, et la façon dont l\'ordinateur les déclenche.',
    date: '2026-07-28',
    body: LES_CINQ_POUVOIRS
  },
  {
    slug: 'le-role-du-gardien',
    title: 'Le rôle du gardien',
    description:
      'Trois cases, aucune couverture : pourquoi le gardien de Tactic Master obéit à ses propres règles, ce que cela change en attaque comme en défense, et ses limites.',
    date: '2026-07-27',
    body: LE_ROLE_DU_GARDIEN
  },
  {
    slug: 'jouer-avec-des-enfants',
    title: 'Jouer à Tactic Master avec des enfants',
    description:
      'Quel palier choisir, les trois phrases qui suffisent à expliquer le jeu, ce qui accroche selon l\'âge, et comment s\'handicaper honnêtement contre un enfant.',
    date: '2026-07-26',
    body: JOUER_AVEC_DES_ENFANTS
  },
  {
    slug: 'regles-du-jeu',
    title: 'Les règles de Tactic Master',
    description:
      'Toutes les règles du jeu de plateau de foot Tactic Master : déplacement des pions, passes, couverture défensive, rôle du gardien et conditions de victoire.',
    date: '2026-07-18',
    // Article de référence : sert de gabarit aux suivants.
    body: `
<p>Tactic Master emprunte sa mécanique aux dames et son but au football. Aucun dé,
aucune carte, aucun hasard : tout se joue au placement et à l'anticipation. Une
partie dure environ cinq minutes.</p>

<p>Voici les règles complètes, dans l'ordre où tu en auras besoin.</p>

<h2>Le plateau et les pièces</h2>

<p>Le terrain fait <strong>7 cases de large sur 9 de haut</strong>. Chaque équipe
aligne <strong>6 pions</strong> dans la formation par défaut : un gardien, deux
défenseurs et trois attaquants. Le ballon occupe une case à lui seul, au centre
du terrain au coup d'envoi.</p>

<p>Les cages sont les <strong>trois cases centrales de la ligne de fond</strong> de
chaque camp. C'est là qu'il faut envoyer le ballon.</p>

<p>Une formation « tactique » existe aussi, avec 8 pions par équipe (un gardien,
trois défenseurs, quatre attaquants). Elle est proposée avec le palier de règles
Expert, décrit plus bas.</p>

<h2>Ton tour de jeu</h2>

<p>C'est le point que les nouveaux joueurs comprennent souvent de travers, alors
autant être précis. À ton tour, tu fais <strong>une</strong> action, au choix :</p>

<ol>
  <li><strong>Déplacer un pion d'une case</strong>, dans n'importe quelle
      direction — diagonales comprises. La case d'arrivée doit être libre. Si ce
      pion arrive à côté du ballon, tu peux enchaîner par une passe ; sinon, ton
      tour s'arrête là.</li>
  <li><strong>Pousser le ballon avec un pion déjà à son contact</strong>, sans le
      déplacer : tu le sélectionnes, tu cliques la case d'arrivée du ballon.</li>
</ol>

<p>La passe qui suit un déplacement est <strong>optionnelle</strong> : rien ne
t'oblige à pousser le ballon parce que ton pion est arrivé à côté. En revanche, tu
ne peux jamais faire deux passes dans le même tour.</p>

<h2>La passe</h2>

<p>C'est le cœur du jeu, et ce qui le distingue des dames.</p>

<p>Le ballon part <strong>en ligne droite</strong>, dans l'une des huit directions.
Il peut parcourir plusieurs cases, et <strong>c'est toi qui choisis où il
s'arrête</strong> : chaque case libre du trajet est une destination valide. La
trajectoire est bloquée par le premier pion rencontré, quel que soit son camp, et
par le bord du terrain.</p>

<p>Autrement dit, tu n'es pas obligé d'envoyer le ballon le plus loin possible. Le
doser est justement l'essentiel du jeu : un ballon laissé trop loin de tes pions
est un ballon offert à l'adversaire.</p>

<h2>La couverture défensive</h2>

<p>Voilà la règle qui donne sa profondeur au jeu, et celle qu'on découvre
généralement en perdant.</p>

<p>Chaque pion de champ <strong>couvre les quatre cases orthogonalement
adjacentes</strong> — haut, bas, gauche, droite, <em>pas</em> les diagonales. Une
passe adverse ne peut ni s'arrêter sur une case couverte, ni la traverser.</p>

<p>Placer un pion, ce n'est donc pas seulement occuper une case : c'est fermer une
zone. Le gardien fait exception et ne couvre rien — il défend en occupant
physiquement sa cage, sinon marquer deviendrait impossible.</p>

<p>Comme la couverture est orthogonale, <strong>les diagonales restent ouvertes</strong>.
C'est là que se jouent la plupart des actions décisives.</p>

<h3>Deux exceptions à connaître</h3>

<ul>
  <li><strong>Le centre depuis l'aile.</strong> Une passe qui part d'une colonne de
      bord ignore complètement la couverture adverse. Le jeu large est récompensé.</li>
  <li><strong>Le point de penalty.</strong> Depuis la case centrale située à deux
      rangées de la cage adverse, un tir vers le but transperce <em>un</em> défenseur
      de champ. Le gardien, lui, reste infranchissable.</li>
</ul>

<h2>Le gardien</h2>

<p>Le gardien est le seul pion aux déplacements contraints : il ne bouge que
<strong>latéralement, sur sa ligne de cage</strong>. Ni avancer, ni reculer, ni
sortir de sa ligne.</p>

<p>En contrepartie, il est un obstacle physique : un ballon lancé vers lui s'arrête
à son contact. Bien placé, il ferme un angle entier.</p>

<h2>Les trois paliers de règles</h2>

<p>Toutes ces règles ne s'appliquent pas d'emblée. Trois paliers existent, à choisir
avant la partie :</p>

<ul>
  <li><strong>Découverte</strong> — sans couverture. Les passes traversent tout.
      Pour comprendre le déplacement et la passe sans se faire piéger.</li>
  <li><strong>Classique</strong> — couverture active, mais ni centres ni point de
      penalty. C'est le palier par défaut.</li>
  <li><strong>Expert</strong> — tout est actif, avec la formation tactique à
      8 pions.</li>
</ul>

<h2>Marquer, et gagner</h2>

<p>Tu marques en envoyant le ballon dans l'une des trois cases de la cage adverse.
Après un but, le ballon revient au centre.</p>

<p>La partie est gagnée par la première équipe à atteindre le <strong>nombre de buts
fixé au départ</strong>, réglable avant de jouer. Si une rencontre doit être
départagée à égalité, une séance de tirs au but tranche.</p>

<h2>Ce qu'il n'y a pas</h2>

<p>Autant lever les questions qui reviennent :</p>

<ul>
  <li><strong>Pas de capture.</strong> On ne prend jamais un pion adverse, aucun pion
      ne quitte le terrain.</li>
  <li><strong>Pas de hasard.</strong> Aucun dé, aucun tirage. Deux joueurs qui jouent
      les mêmes coups obtiennent le même résultat.</li>
  <li><strong>Pas de hors-jeu ni de fautes.</strong> Le vocabulaire est celui du
      football, la mécanique est celle d'un jeu abstrait.</li>
</ul>

<p>Une dernière chose : si les deux camps se contentent de déplacer leurs pions sans
jamais toucher au ballon, la partie ne s'enlise pas. Au bout de huit tours sans la
moindre passe, le ballon est automatiquement remis au centre.</p>
`
  },
  {
    slug: 'strategies-pour-gagner',
    title: '5 stratégies pour gagner tes premières parties',
    description:
      'Cinq principes concrets pour arrêter de perdre à Tactic Master : dosage des passes, diagonales laissées ouvertes par la couverture, jeu par les ailes.',
    date: '2026-07-17',
    body: STRATEGIES_POUR_GAGNER
  },
  {
    slug: 'battre-lia-difficile',
    title: "Comment battre l'IA en difficulté maximale",
    description:
      "L'IA difficile de Tactic Master anticipe un tour à l'avance, mais son évaluation ignore sa propre défense. Voici comment exploiter ses angles morts.",
    date: '2026-07-16',
    body: BATTRE_IA_DIFFICILE
  },
  {
    slug: 'jouer-a-deux',
    title: 'Jouer à deux, sur un écran ou en ligne',
    description:
      'Les deux façons de jouer à deux à Tactic Master : face à face sur le même appareil, ou à distance en partageant un code de partie entre joueurs.',
    date: '2026-07-15',
    body: JOUER_A_DEUX
  },
  {
    slug: 'dames-et-football',
    title: "Dames et football : d'où vient Tactic Master",
    description:
      "Pourquoi un jeu de foot sans hasard, sans dé et sans capture : les partis pris de conception de Tactic Master, et ce qu'ils changent au jeu.",
    date: '2026-07-14',
    body: DAMES_ET_FOOTBALL
  }
];
