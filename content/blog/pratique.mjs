// Articles PRATIQUES : ouverture, défense, choix du palier, fonctionnement de
// l'ordinateur, jeu en famille. Pendant que mecaniques.mjs décrit les règles,
// ces textes décrivent des façons de jouer.
//
// Les positions et les chiffres cités ont été obtenus en interrogeant le moteur
// (listLegalMoves sur la position de départ, lecture de ai.js), pas de mémoire.
// Vérifié le 2026-08-04.

export const BIEN_OUVRIR_UNE_PARTIE = `
<p>La plupart des parties de Tactic Master se décident bien avant la surface de
réparation. Au coup d'envoi, l'équipe qui engage dispose de
<strong>92 coups légaux</strong>, dont 54 touchent le ballon. C'est beaucoup pour
un jeu qui tient en cinq règles, et c'est largement assez pour perdre une partie
en trois tours.</p>

<p>Voici ce que la position de départ autorise réellement, et les trois ouvertures
qui fonctionnent.</p>

<h2>Ce que la position de départ vous donne</h2>

<p>Le ballon démarre au centre exact du terrain. Vos trois attaquants sont sur la
ligne 7, colonnes 2, 4 et 6. Deux d'entre eux peuvent atteindre en un seul
déplacement une case adjacente au ballon — ce qui signifie que
<strong>vous pouvez pousser le ballon dès votre premier tour</strong>. Un
déplacement qui amène un pion au contact du ballon autorise une passe dans la
foulée.</p>

<p>Mais toutes les directions ne se valent pas, et l'une d'elles est simplement
interdite.</p>

<h3>La passe droit devant est bloquée</h3>

<p>Au palier Classique, pousser le ballon droit vers la cage adverse est
<strong>impossible au premier tour</strong>. La case immédiatement devant lui est
couverte par l'attaquant adverse posté deux lignes plus haut dans l'axe. Une
passe ne peut ni s'y arrêter ni la traverser.</p>

<p>C'est la première leçon de la couverture défensive, et elle arrive au premier
coup : <strong>l'axe est fermé par défaut</strong>. Un joueur qui insiste sur le
couloir central va perdre des tours à taper contre un mur qu'il ne voit pas.</p>

<h3>Les diagonales, elles, sont ouvertes</h3>

<p>Les deux cases en biais devant le ballon sont libres de couverture, parce que
la couverture ne s'exerce jamais en diagonale. Vous pouvez donc avancer d'une
ligne — mais en biais seulement.</p>

<h3>Les ailes sont accessibles en une seule poussée</h3>

<p>Détail que presque personne ne remarque : depuis le centre, le ballon peut
atteindre la colonne de bord, à gauche comme à droite, <strong>en une seule
passe</strong>. Aucun pion n'est sur la trajectoire, aucune case n'est couverte.</p>

<p>Au palier Expert, où les centres depuis l'aile ignorent la couverture, c'est
une information considérable : le premier tour peut placer le ballon sur la case
depuis laquelle la défense adverse ne compte plus.</p>

<h2>Trois ouvertures qui marchent</h2>

<h3>1. L'ouverture en biais (la plus sûre)</h3>

<p>Amenez un attaquant au contact du ballon, puis poussez d'une seule case en
diagonale vers l'avant.</p>

<p>Le gain de terrain est minime, et c'est précisément ce qui la rend bonne : le
ballon reste à portée de votre pion, vous conservez la main sur la suite, et vous
n'avez offert aucune ligne à l'adversaire. Au tour suivant, votre attaquant est
déjà au contact — vous pouvez repousser immédiatement, sans perdre de tour à vous
rapprocher.</p>

<p>C'est l'ouverture à jouer si vous ne savez pas quoi jouer.</p>

<h3>2. L'ouverture par l'aile (la plus tranchante, au palier Expert)</h3>

<p>Poussez le ballon jusqu'à la colonne de bord dès le premier tour, puis passez
les deux tours suivants à amener un pion à son contact.</p>

<p>Vous cédez du temps et vous éloignez le ballon de votre soutien — deux
concessions réelles. En échange, vous obtenez une position d'où
<strong>chacune de vos passes ignore la couverture adverse</strong> aussi
longtemps que le ballon reste sur cette colonne. Contre un joueur qui défend en
massant ses pions dans l'axe, c'est décisif.</p>

<p>À éviter au palier Classique : sans la règle des centres, l'aile n'est qu'un
coin du terrain où le ballon a moins de directions disponibles.</p>

<h3>3. L'ouverture patiente (la plus solide)</h3>

<p>Ne touchez pas au ballon du premier tour. Avancez un défenseur d'une case en
diagonale, pour transformer votre ligne arrière alignée en quinconce.</p>

<p>Deux pions décalés en diagonale couvrent huit cases distinctes ; deux pions
côte à côte n'en couvrent que six, leurs croix se chevauchant. Ce simple
déplacement augmente d'un tiers la surface que vous interdisez, sans rien
concéder.</p>

<p>Vous laissez l'initiative à l'adversaire. Contre un joueur qui pousse le
ballon loin dès le premier tour — l'erreur la plus commune — vous récupérez la
possession au tour trois avec une défense déjà en place.</p>

<h2>Les trois erreurs d'ouverture</h2>

<h3>Envoyer le ballon le plus loin possible</h3>

<p>L'erreur numéro un, tous niveaux confondus. Chaque case libre de la trajectoire
est une destination valable : c'est vous qui choisissez où le ballon s'arrête.
Beaucoup de joueurs cliquent instinctivement sur la case la plus lointaine.</p>

<p>Un ballon envoyé loin est un ballon que vous ne contrôlez plus, et votre pion
est resté en arrière. Le camp qui aura un pion au contact du ballon au tour
suivant est celui qui jouera. Ne poussez jamais le ballon plus loin que votre
propre soutien.</p>

<h3>Monter les deux défenseurs</h3>

<p>Le jeu ne punit pas immédiatement, ce qui rend l'erreur difficile à
diagnostiquer. Mais souvenez-vous que <strong>le gardien ne couvre aucune
case</strong> : si vos deux défenseurs sont montés, la ligne devant votre but
n'est interdite à personne. Une seule passe adverse suffit alors à traverser tout
votre camp.</p>

<p>Gardez toujours un pion de champ entre le ballon et votre cage. Toujours.</p>

<h3>Courir après le ballon</h3>

<p>Comme il n'y a pas de capture, on croit d'abord que les pions adverses sont un
décor. C'est l'inverse : puisqu'une passe s'arrête au premier pion et ne peut pas
traverser une case couverte, chaque pion est un mur qui projette une zone
d'interdiction.</p>

<p>Un joueur qui court en permanence derrière le ballon perd contre un joueur qui
place ses pions.</p>

<h2>Un plan pour les cinq premiers tours</h2>

<ol>
  <li><strong>Tour 1</strong> — amenez un attaquant au contact et poussez d'une
      case en biais, ou décalez un défenseur en quinconce.</li>
  <li><strong>Tour 2</strong> — amenez un second pion à portée du ballon. Deux
      pions autour du ballon, c'est deux angles de passe et la possibilité de
      déclencher une une-deux.</li>
  <li><strong>Tour 3</strong> — regardez ce que l'adversaire a laissé ouvert. S'il
      a monté ses défenseurs, cherchez la diagonale la plus longue vers son but.
      Sinon, continuez à progresser d'une case.</li>
  <li><strong>Tour 4</strong> — visez une case adjacente à l'un de vos pions pour
      déclencher une une-deux, et dépensez le déplacement bonus à amener un
      troisième pion près du ballon.</li>
  <li><strong>Tour 5</strong> — vous devriez être dans le camp adverse avec deux
      pions au contact. C'est là que la partie commence vraiment.</li>
</ol>

<p>Rien de tout cela n'est spectaculaire, et c'est bien le propos : à ce jeu, les
buts ne viennent pas d'un coup génial mais d'une position construite trois tours
plus tôt.</p>
`;

export const DEFENDRE_SANS_TACLER = `
<p>Il n'existe aucune façon de prendre le ballon à l'adversaire dans Tactic
Master. Pas de tacle, pas d'interception active, pas de capture. Le mot
« défense » y désigne donc autre chose que dans un jeu de football — et c'est la
partie du jeu que les débutants négligent le plus longtemps.</p>

<p>Défendre, ici, c'est <strong>rendre des cases inutilisables</strong>.</p>

<h2>Le principe : la couverture</h2>

<p>Chaque pion de champ interdit aux passes adverses les quatre cases directement
au-dessus, en dessous, à gauche et à droite de lui. Une passe ennemie ne peut ni
s'y arrêter ni les traverser.</p>

<p>Un pion posé au bon endroit ne « bloque » donc pas seulement sa propre case :
il ferme une croix de cinq cases, la sienne comprise. C'est la totalité de
l'arsenal défensif du jeu, et c'est largement suffisant.</p>

<h2>Règle n° 1 : décalez, n'alignez pas</h2>

<p>C'est le conseil qui change le plus de choses, et il est contre-intuitif.</p>

<p>Deux pions <strong>côte à côte</strong> couvrent six cases : chacun en couvre
quatre, mais deux de ces couvertures se chevauchent, et la diagonale entre eux
reste ouverte.</p>

<p>Deux pions <strong>en diagonale</strong> l'un de l'autre couvrent huit cases
distinctes, et forment un filet en quinconce qui gêne les trajectoires droites
comme les trajectoires biaises.</p>

<p>À nombre de pions égal, la disposition en quinconce couvre un tiers de terrain
en plus. L'instinct footballistique pousse à aligner un mur ; le jeu récompense
le décalage.</p>

<h2>Règle n° 2 : le gardien n'est pas un défenseur</h2>

<p>Le gardien ne couvre aucune case. Aucune. Il défend uniquement en occupant
physiquement l'une des trois cases de son but.</p>

<p>Conséquence directe : une défense qui se résume à « mon gardien est devant ma
cage » n'existe pas. Si aucun pion de champ n'est descendu, la ligne devant le but
est totalement ouverte, et deux des trois cases du but sont libres à tout
instant.</p>

<p><strong>Gardez toujours au moins un pion de champ entre le ballon et votre
cage.</strong> C'est la règle défensive la plus rentable du jeu, et la plus
souvent violée.</p>

<h2>Règle n° 3 : défendez l'axe, pas le ballon</h2>

<p>Le réflexe naturel est de coller le ballon. Il est mauvais, pour une raison
mécanique : vous ne pouvez pas le prendre. Un pion posé à côté du ballon ne fait
que couvrir quatre cases dont l'adversaire n'a peut-être aucun besoin.</p>

<p>La bonne question n'est pas « où est le ballon ? » mais <strong>« quelle
trajectoire mène à ma cage ? »</strong>. Tracez mentalement les lignes — droites
et diagonales — entre le ballon et vos trois cases de but, et posez vos pions
dessus.</p>

<p>Un pion sur l'axe menaçant vaut trois pions autour du ballon.</p>

<h2>Règle n° 4 : surveillez les diagonales, personne ne le fait</h2>

<p>La couverture est strictement orthogonale. Vos pions ne ferment
<em>rien</em> en diagonale, jamais. Une ligne de trois défenseurs parfaitement
alignés laisse passer autant de trajectoires biaises qu'elle en bloque de
droites.</p>

<p>Quand vous évaluez votre position défensive, ne regardez pas si le mur est
joli. Regardez les quatre diagonales qui aboutissent à votre but, et demandez-vous
laquelle est libre. Il y en a presque toujours une.</p>

<p>Le seul moyen de fermer une diagonale est le pouvoir Mur — c'est précisément
la raison de son existence.</p>

<h2>Règle n° 5 : la meilleure défense est parfois une passe</h2>

<p>Puisqu'on ne reprend pas le ballon, la seule façon de réellement mettre fin à
une attaque est de <strong>pousser le ballon vous-même</strong>, dans une
direction qui ne vous coûte rien.</p>

<p>Si l'un de vos pions se retrouve au contact du ballon dans votre camp,
envisagez sérieusement de le dégager sur le côté, voire vers l'arrière. Vous
perdez du terrain ; vous gagnez le contrôle et vous récupérez la possession.</p>

<p>Mieux : visez une case orthogonalement adjacente à l'un de vos autres pions.
La une-deux se déclenche, et le déplacement bonus vous sert à remonter votre bloc
dans le même tour. C'est la façon la plus économique de sortir d'un siège.</p>

<h2>Règle n° 6 : bougez le gardien tôt</h2>

<p>Le gardien glisse d'une case par tour sur les trois cases de son but.
Traverser la cage d'un bout à l'autre lui prend donc <strong>deux tours</strong>.</p>

<p>Si vous attendez que le tir soit imminent pour l'aligner, il arrivera après le
ballon. Dès que l'attaque adverse se déporte d'un côté, commencez à le déplacer —
même si rien ne presse encore.</p>

<p>Et ne le laissez pas au centre par habitude : le centre n'est le meilleur poste
que si le ballon est centré.</p>

<h2>Le piège de la défense passive</h2>

<p>Tout ce qui précède pourrait laisser croire qu'il suffit de bien se placer et
d'attendre. Deux mécanismes l'empêchent.</p>

<p>D'abord, l'anti-blocage : après <strong>huit tours consécutifs sans la moindre
passe</strong>, le ballon est automatiquement remis au centre. Une défense qui ne
fait que se replacer finit par rendre le ballon.</p>

<p>Ensuite, un bloc immobile est un bloc lisible. Comme il n'y a aucun hasard,
votre adversaire dispose de tout le temps qu'il veut pour trouver la diagonale
que vous avez laissée. Il la trouvera.</p>

<p>La défense de Tactic Master n'est pas un mur, c'est un filet qu'il faut
retendre à chaque tour.</p>

<h2>En résumé</h2>

<ul>
  <li>On ne reprend pas le ballon : on rend des cases inutilisables.</li>
  <li>Décalez vos pions en quinconce plutôt que de les aligner.</li>
  <li>Le gardien ne couvre rien : laissez toujours un pion de champ devant lui.</li>
  <li>Posez vos pions sur les trajectoires qui mènent à votre but, pas autour du ballon.</li>
  <li>Vérifiez les diagonales : la couverture ne les ferme jamais.</li>
  <li>Dégager le ballon vous-même est souvent la seule vraie interception.</li>
</ul>
`;

export const CHOISIR_SON_PALIER = `
<p>Tactic Master propose trois paliers de règles : Découverte, Classique et
Expert. Ce ne sont pas des niveaux de difficulté — la difficulté de l'ordinateur
se règle séparément — mais des <strong>jeux légèrement différents</strong>. Choisir
le mauvais est la façon la plus sûre de trouver le jeu soit confus, soit plat.</p>

<h2>Ce que les paliers changent réellement</h2>

<p>Quatre mécaniques de passe s'activent ou non. Le reste du jeu — déplacements,
poussée du ballon, gardien, buts — est identique dans les trois cas.</p>

<div class="table-scroll">
<table class="rules-table">
  <thead>
    <tr><th scope="col">Palier</th><th scope="col">Couverture</th>
        <th scope="col">Une-deux</th><th scope="col">Centres</th>
        <th scope="col">Point de penalty</th><th scope="col">Pions</th>
        <th scope="col">Pouvoirs</th></tr>
  </thead>
  <tbody>
    <tr><th scope="row">Découverte</th><td>non</td><td>non</td><td>non</td><td>non</td><td>6</td><td>non</td></tr>
    <tr><th scope="row">Classique</th><td>oui</td><td>oui</td><td>non</td><td>non</td><td>6</td><td>oui</td></tr>
    <tr><th scope="row">Expert</th><td>oui</td><td>oui</td><td>oui</td><td>oui</td><td>8</td><td>oui</td></tr>
  </tbody>
</table>
</div>

<h2>Découverte : le jeu réduit à son os</h2>

<p>Aucune interception. Une passe n'est arrêtée que par un pion physiquement
présent sur sa trajectoire, ou par le bord du terrain. Pas de une-deux, pas de
cases spéciales, pas de pouvoirs.</p>

<p>Le résultat est un jeu qu'on comprend en une partie, littéralement : on
déplace un pion, on pousse le ballon, on marque. Rien ne peut arriver qu'on
n'ait pas vu venir, ce qui est exactement ce qu'il faut pour un premier contact.</p>

<p><strong>Choisissez Découverte si :</strong> c'est votre première partie ; vous
expliquez le jeu à quelqu'un ; vous jouez avec un enfant de sept ou huit ans ;
vous voulez montrer le jeu à quelqu'un en trois minutes.</p>

<p><strong>Sa limite :</strong> sans couverture, la défense se réduit à poser des
pions sur les lignes. Les parties deviennent vite prévisibles entre deux joueurs
qui ont compris. C'est le palier des puzzles quotidiens, pas celui des soirées.</p>

<h2>Classique : le réglage par défaut, et le bon</h2>

<p>La couverture défensive et la une-deux s'activent. C'est peu dit comme ça, et
c'est en réalité un changement complet : à partir du moment où chaque pion de
champ interdit ses quatre cases voisines, le placement devient plus important que
la possession.</p>

<p>La une-deux, en récompensant les passes qui trouvent un appui, pousse dans le
même sens : jouer court et soutenu plutôt que long et isolé.</p>

<p><strong>Choisissez Classique si :</strong> vous avez joué une ou deux parties ;
vous jouez contre l'ordinateur ; vous jouez à deux avec quelqu'un qui connaît les
règles. C'est le palier prévu pour l'immense majorité des parties.</p>

<p><strong>Sa limite :</strong> sans les centres ni le point de penalty, un joueur
qui défend très bien devient difficile à percer. Les fins de match serrées peuvent
se figer.</p>

<h2>Expert : quand la défense doit pouvoir être punie</h2>

<p>Expert ajoute les deux mécaniques qui annulent la couverture — les centres
depuis l'aile et le point de penalty — sur une formation à huit pions par
camp.</p>

<p>La logique est cohérente : plus de pions signifie plus de couverture, donc une
défense potentiellement imperméable. Les deux règles offensives supplémentaires
rétablissent l'équilibre, mais elles exigent de la construction — élargir jusqu'à
l'aile, ou amener le ballon sur la case centrale à deux lignes du but.</p>

<p><strong>Choisissez Expert si :</strong> vos parties en Classique se terminent
souvent sur des scores bloqués ; vous jouez régulièrement contre la même
personne ; vous voulez que le jeu récompense la préparation sur plusieurs
tours.</p>

<p><strong>Sa limite :</strong> quatre mécaniques simultanées, c'est beaucoup à
tenir en tête. Un joueur qui n'a pas encore intégré la couverture y verra surtout
des passes qui échouent sans raison apparente.</p>

<h2>Palier et niveau d'ordinateur ne sont pas la même chose</h2>

<p>Confusion fréquente, qui gâche des parties : le palier décide
<strong>quelles règles existent</strong>, le niveau de l'ordinateur décide
<strong>à quel point il joue bien</strong>. Les deux se règlent séparément et se
combinent librement.</p>

<p>Trois combinaisons ont des effets très différents :</p>

<ul>
  <li><strong>Découverte + Difficile</strong> — sans doute le duo le plus
      instructif pour progresser. Les règles sont limpides, mais l'ordinateur
      anticipe votre meilleure réponse avant de jouer. Vous perdez sur du
      placement pur, sans pouvoir accuser une règle mal comprise.</li>
  <li><strong>Expert + Facile</strong> — l'inverse : un terrain de jeu pour
      essayer les centres et le point de penalty sans être puni pendant que vous
      cherchez. Le niveau Facile n'utilise d'ailleurs jamais ses pouvoirs.</li>
  <li><strong>Classique + Moyen</strong> — l'équilibre, et la configuration à
      laquelle la plupart des joueurs reviennent.</li>
</ul>

<h2>Un parcours en quatre étapes</h2>

<p>Si vous découvrez le jeu, cet ordre évite les deux écueils habituels — se
décourager sur des passes refusées sans comprendre pourquoi, ou s'ennuyer sur un
jeu qu'on croit plus pauvre qu'il n'est :</p>

<ol>
  <li><strong>Une partie en Découverte</strong>, contre l'ordinateur en Facile.
      Objectif : comprendre qu'on choisit où le ballon s'arrête.</li>
  <li><strong>Passez en Classique</strong>, toujours en Facile. Objectif :
      encaisser la couverture défensive. Vos passes vont commencer à être
      refusées ; c'est le moment de regarder les cases marquées sur le plateau
      avant de choisir.</li>
  <li><strong>Montez l'ordinateur en Moyen.</strong> Objectif : ne plus jamais lui
      laisser un but immédiat. C'est sa seule vraie arme, et elle est
      systématique.</li>
  <li><strong>Passez en Expert</strong> quand vos parties en Classique se
      terminent régulièrement sur des scores serrés et bloqués.</li>
</ol>

<p>Compter une dizaine de parties pour l'ensemble du parcours est réaliste.</p>

<h2>Le tableau de décision</h2>

<ul>
  <li>Vous n'avez jamais joué → <strong>Découverte</strong>, une partie, puis passez à Classique.</li>
  <li>Vous jouez seul contre l'ordinateur → <strong>Classique</strong>.</li>
  <li>Vous initiez quelqu'un → <strong>Découverte</strong> pour la première partie, <strong>Classique</strong> pour la seconde.</li>
  <li>Vous jouez avec un enfant → <strong>Découverte</strong>, sans pouvoirs.</li>
  <li>Vos parties se figent à 1-1 → <strong>Expert</strong>.</li>
  <li>Vous voulez la version la plus riche → <strong>Expert</strong>, en acceptant deux ou trois parties d'adaptation.</li>
</ul>

<h2>Et les réglages fins</h2>

<p>Les paliers ne sont qu'un raccourci. Les options avancées permettent d'activer
ou de désactiver <strong>chaque mécanique individuellement</strong>, par-dessus le
palier choisi.</p>

<p>Deux combinaisons valent le détour :</p>

<ul>
  <li><strong>Classique + centres depuis l'aile.</strong> Une seule règle de plus,
      et les fins de match bloquées disparaissent, sans la complexité du point de
      penalty ni la densité de la formation à huit pions. C'est probablement le
      meilleur réglage du jeu pour deux joueurs réguliers.</li>
  <li><strong>Découverte + une-deux.</strong> Aucune interception, mais le
      déplacement bonus : idéal pour faire sentir la notion d'appui à un débutant
      avant d'introduire la couverture.</li>
</ul>

<p>Le détail exact de chaque mécanique est sur la page
<a href="/regles">règles complètes</a>.</p>
`;

export const COMMENT_FONCTIONNE_L_IA = `
<p>L'ordinateur de Tactic Master propose trois niveaux. Contrairement à beaucoup
de jeux, ce ne sont pas trois versions du même algorithme auquel on aurait ajouté
du hasard : ce sont trois façons différentes de choisir un coup. Les connaître
change la manière de jouer contre elles.</p>

<p>Voici, sans enjoliver, comment chacune décide.</p>

<h2>Le socle commun : l'énumération des coups</h2>

<p>Avant tout choix, le jeu dresse la liste complète des coups légaux de l'équipe
au trait. Trois familles :</p>

<ul>
  <li>déplacer un pion ;</li>
  <li>pousser le ballon avec un pion déjà à son contact ;</li>
  <li>déplacer un pion <em>puis</em> pousser le ballon, quand le déplacement
      amène ce pion au contact.</li>
</ul>

<p>Sur la position de départ, cela fait 92 possibilités. Aucun niveau ne « voit »
plus de coups qu'un autre : ils voient tous exactement les mêmes. Ce qui les
distingue, c'est ce qu'ils en font.</p>

<h2>Facile : du hasard, volontairement bridé</h2>

<p>Le niveau Facile joue au hasard six fois sur dix. Les quatre autres fois, il
préfère un coup qui touche le ballon, sans chercher plus loin.</p>

<p>Une contrainte supplémentaire mérite d'être connue : le niveau Facile
<strong>ne pousse jamais le ballon de plus de deux cases</strong>. Ce plafond
n'est pas là pour le rendre faible mais pour le rendre supportable. Sans lui, un
ordinateur « facile » pouvait traverser le plateau et marquer dès son premier
tour sur une erreur de placement, ce qui punit exactement les joueurs qui
apprennent.</p>

<p>Il n'utilise jamais ses pouvoirs.</p>

<p><strong>Comment le battre :</strong> jouez normalement. Il ne construit rien,
donc toute progression régulière suffit. C'est le niveau pour se familiariser avec
la couverture sans être sanctionné.</p>

<h2>Moyen : l'occasion immédiate, puis la distance au but</h2>

<p>Le niveau Moyen procède en deux temps.</p>

<p><strong>D'abord</strong>, il vérifie s'il existe un coup qui marque
immédiatement. S'il y en a un, il le joue, sans réfléchir davantage. Cette règle
seule explique la majorité des buts qu'il inscrit : il ne rate jamais une
occasion posée devant lui.</p>

<p><strong>Ensuite</strong>, à défaut, il évalue chaque coup selon deux critères :
l'écart de buts, qui pèse massivement, et la distance du ballon à votre cage.
Puis il garde le tiers le mieux classé et en tire un au hasard — ce qui le rend
imprévisible sans le rendre mauvais.</p>

<p><strong>Sa faiblesse est structurelle</strong> et vaut la peine d'être
comprise : son évaluation <em>ne tient aucun compte de sa propre défense</em>.
Ni la position de ses pions, ni la couverture qu'ils exercent, ni les
trajectoires ouvertes vers son but n'entrent dans son calcul. Seule compte la
distance du ballon à votre cage.</p>

<p><strong>Comment le battre :</strong> ne lui laissez jamais un coup gagnant
immédiat — vérifiez avant chaque coup qu'aucune de ses passes ne peut atteindre
votre but. Cela fait, exploitez son désintérêt pour sa propre défense : il monte
ses pions vers l'avant et laisse des diagonales ouvertes derrière lui.</p>

<h2>Difficile : un coup d'avance, et l'usage des pouvoirs</h2>

<p>Le niveau Difficile commence comme le Moyen : s'il peut marquer, il marque.</p>

<p>Sinon, il fait quelque chose de nettement plus coûteux. Pour
<strong>chacun</strong> de ses coups possibles, il simule la position obtenue,
puis explore <strong>jusqu'à douze réponses</strong> que vous pourriez y apporter
et retient <em>la pire pour lui</em>. Il joue ensuite le coup dont le pire
scénario est le moins mauvais.</p>

<p>C'est une recherche à deux demi-coups, prudente par construction : il choisit
en supposant que vous trouverez votre meilleure réplique. En pratique, cela
signifie qu'il <strong>ne s'expose plus</strong> — les coups qui ouvrent une
trajectoire vers son but sont éliminés, puisqu'ils apparaissent dans la
simulation.</p>

<p>Il utilise en plus ses pouvoirs, selon des déclencheurs simples : Tir Puissant
uniquement s'il marque, Relais sur une passe qui progresse, Repli adverse sur un
pion qui conteste le ballon, Sprint quand aucun de ses pions n'est au contact,
Mur quand le ballon est dans sa moitié défensive.</p>

<p><strong>Deux limites exploitables.</strong> D'une part, il n'échantillonne que
douze de vos réponses possibles quand il y en a davantage : une menace peut lui
échapper dans une position très ouverte. D'autre part, son évaluation reste la
même que celle du niveau Moyen — écart de buts et distance du ballon. Il défend
mieux parce qu'il anticipe, pas parce qu'il comprend sa propre structure.</p>

<p><strong>Comment le battre :</strong> jouez des menaces à deux tours. Une
position d'où <em>deux</em> passes gagnantes différentes existent au tour suivant
le met en difficulté : il ne peut en désamorcer qu'une. Et privilégiez les
positions denses, où le nombre de réponses possibles dépasse ce qu'il
échantillonne.</p>

<h2>Ce que l'ordinateur ne fait pas</h2>

<p>Par honnêteté, et parce que c'est utile à savoir :</p>

<ul>
  <li>Il ne s'adapte pas à vous. Aucun apprentissage, aucune mémoire d'une partie
      à l'autre.</li>
  <li>Il ne triche pas. Il joue à partir du même état de jeu que vous, avec les
      mêmes règles, et n'a accès à aucune information supplémentaire.</li>
  <li>Il n'évalue pas le placement défensif ni la couverture, à aucun niveau.</li>
  <li>Il ne planifie pas au-delà de la réponse adverse immédiate.</li>
</ul>

<p>Autrement dit : contre le niveau Difficile, vous n'affrontez pas un joueur
qui comprend le jeu mieux que vous. Vous affrontez un joueur qui ne fait
jamais de gaffe évidente, et qui vérifie systématiquement une chose que vous
oubliez parfois — ce qui se passe juste après.</p>

<h2>Pourquoi c'est écrit ici</h2>

<p>Un adversaire artificiel dont on ignore le fonctionnement finit toujours par
sembler injuste : on lui prête de la triche quand il gagne et de la bêtise quand
il perd. Décrire ses règles de décision règle la question — et rend, au passage,
la victoire contre le niveau Difficile plus intéressante à chercher.</p>
`;

export const JOUER_AVEC_DES_ENFANTS = `
<p>Tactic Master n'a pas été conçu comme un jeu pour enfants, mais il en a
plusieurs propriétés : aucun réflexe, aucun hasard, des règles qui tiennent en
trois phrases, et un vocabulaire — le ballon, le but, le gardien — que tout le
monde possède déjà à six ans.</p>

<p>Voici comment l'introduire sans le rendre frustrant, et ce qu'on peut en
attendre selon l'âge.</p>

<h2>Commencez par le palier Découverte</h2>

<p>C'est le point le plus important, et le plus facile à rater : le palier par
défaut est Classique, qui inclut la couverture défensive.</p>

<p>La couverture est la seule règle du jeu qui demande un effort d'abstraction —
il faut se représenter des cases interdites qui ne sont pas occupées. Pour un
enfant, elle transforme le jeu en série de coups refusés sans explication
visible.</p>

<p>Le palier <strong>Découverte</strong> supprime toute interception. Le ballon
part en ligne droite et s'arrête quand il rencontre un pion. C'est tout, et c'est
compréhensible à sept ans en une partie.</p>

<p>Désactivez aussi les pouvoirs pour les premières parties. Cinq capacités
spéciales à mémoriser en plus des règles, c'est une couche de trop.</p>

<h2>Les trois phrases qui suffisent à expliquer le jeu</h2>

<p>Testées, dans cet ordre :</p>

<ol>
  <li>« À ton tour, tu bouges <strong>un</strong> pion, d'<strong>une</strong>
      case, dans la direction que tu veux. »</li>
  <li>« Si ton pion touche le ballon, tu peux le pousser tout droit : il file
      jusqu'à ce qu'il rencontre quelqu'un, et tu choisis où il s'arrête. »</li>
  <li>« Tu marques en envoyant le ballon dans les trois cases du but d'en
      face. »</li>
</ol>

<p>N'expliquez rien d'autre au départ. Ni le gardien, ni la une-deux, ni la
possession. Le reste se découvre en jouant, ce qui est infiniment plus efficace
qu'un exposé de règles avant la première partie.</p>

<h2>Ce qui accroche vraiment, selon l'âge</h2>

<h3>Vers 6-7 ans</h3>

<p>Le jeu fonctionne, à condition d'accepter qu'il s'agisse surtout de pousser le
ballon vers le but. Les notions de placement défensif n'apparaissent pas encore.
Jouez en Découverte, ne comptez pas les points de trop près, et acceptez que la
partie ressemble à un aller-retour.</p>

<p>Le vrai apport à cet âge est ailleurs : le jeu est
<strong>entièrement au tour par tour</strong> et sans chronomètre. Il n'y a
aucune pression, aucun geste à réussir, aucune sanction du temps de réflexion.
C'est reposant, pour l'enfant comme pour l'adulte.</p>

<h3>Vers 8-10 ans</h3>

<p>L'âge où le jeu devient réellement intéressant. Deux idées passent bien :</p>

<ul>
  <li><strong>« Ne pousse pas le ballon plus loin que ton pion ne peut
      suivre. »</strong> C'est la première vraie stratégie du jeu, elle se
      démontre en une partie, et l'enfant la vérifie tout seul.</li>
  <li><strong>« Laisse quelqu'un devant ton but. »</strong> La notion de dernier
      défenseur est intuitive, et prépare la couverture.</li>
</ul>

<p>C'est le moment de passer au palier Classique, en expliquant la couverture avec
les mots du terrain : « tes pions surveillent la case en haut, en bas, à gauche
et à droite — mais pas les coins. » Le jeu marque d'ailleurs les cases surveillées
sur le plateau au moment de passer, ce qui rend l'explication visuelle.</p>

<h3>À partir de 10-11 ans</h3>

<p>Plus besoin d'adapter quoi que ce soit. Les parties deviennent disputées, et
l'avantage de l'adulte s'évapore plus vite qu'il ne l'imagine : le jeu ne
récompense ni la culture, ni la vitesse, seulement la lecture du plateau.</p>

<h2>Comment perdre honnêtement</h2>

<p>La tentation, contre un enfant, est de jouer mal en le cachant. Le jeu offre
mieux : des façons transparentes de s'handicaper, qui laissent l'adulte jouer
sérieusement.</p>

<ul>
  <li><strong>Ne poussez jamais le ballon de plus de deux cases.</strong> C'est
      exactement la contrainte que le jeu s'impose à lui-même en niveau Facile,
      et elle suffit à équilibrer une partie.</li>
  <li><strong>Jouez sans votre gardien</strong> — au sens où vous ne le déplacez
      jamais. Deux cases de but restent alors ouvertes en permanence.</li>
  <li><strong>Annoncez vos intentions à voix haute.</strong> « Je vais essayer de
      passer par la gauche. » L'enfant apprend à lire les menaces, et vous jouez
      à visage découvert.</li>
</ul>

<p>Ces handicaps ont un avantage sur le fait de jouer mal : ils sont explicables,
donc l'enfant sait qu'il joue contre quelqu'un qui essaie, et sa victoire compte.</p>

<h2>Le puzzle du jour, en solo</h2>

<p>Le puzzle quotidien propose une position à résoudre en un nombre de coups
imposé. Il se joue au palier Découverte, ce qui le rend limpide, et chaque puzzle
a une solution garantie.</p>

<p>C'est un excellent format pour un enfant qui joue seul : court, sans
adversaire, sans possibilité de perdre, et renouvelé tous les jours. Le même
puzzle est proposé à tout le monde le même jour, ce qui permet de le chercher à
plusieurs.</p>

<h2>Quelques précisions pratiques pour les parents</h2>

<ul>
  <li><strong>Aucune inscription n'est nécessaire</strong> pour jouer en solo, à
      deux sur le même appareil, ou au puzzle du jour.</li>
  <li>Le jeu s'ouvre dans le navigateur et peut être ajouté à l'écran d'accueil
      sur téléphone ou tablette ; les modes locaux
      <strong>fonctionnent sans connexion</strong>.</li>
  <li>La boutique est <strong>strictement cosmétique</strong> : thèmes de terrain
      et packs de joueurs à collectionner, sans aucun effet sur les règles ni sur
      l'issue d'un match.</li>
  <li>Le détail des données traitées figure dans la
      <a href="/privacy">politique de confidentialité</a>.</li>
</ul>

<h2>En résumé</h2>

<ul>
  <li>Palier Découverte, pouvoirs désactivés, pour les premières parties.</li>
  <li>Trois phrases d'explication, pas une de plus.</li>
  <li>Vers 8 ans, deux idées suffisent : ne pas pousser trop loin, laisser un défenseur.</li>
  <li>Handicapez-vous de façon visible plutôt que de jouer mal en secret.</li>
  <li>Le puzzle du jour est le meilleur format en solo.</li>
</ul>
`;
