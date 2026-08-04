// Articles consacrés aux MÉCANIQUES du jeu (couverture, une-deux, point de
// penalty, pouvoirs, gardien). Séparés de strategies.mjs pour la même raison que
// celui-ci l'est d'articles.mjs : c'est de la relecture que dépend l'exactitude
// des règles annoncées, et on ne relit pas un fichier de 2 000 lignes.
//
// Chaque affirmation de ces articles a été relue dans public/src/engine/
// (gameEngine.js, constants.js, powers.js) le 2026-08-04.

export const LA_COUVERTURE_DEFENSIVE = `
<p>Il y a un moment, dans l'apprentissage de Tactic Master, où l'on cesse de
jouer au ballon pour commencer à jouer aux cases. Ce moment, c'est celui où l'on
comprend la couverture défensive. C'est la seule règle du jeu qui demande un
véritable effort de compréhension — et de très loin celle qui décide du plus
grand nombre de parties.</p>

<h2>La règle, en une phrase</h2>

<p>Une case est <strong>couverte</strong> par une équipe si un pion de champ de
cette équipe occupe une case directement au-dessus, en dessous, à gauche ou à
droite. Une passe adverse ne peut <strong>ni s'arrêter sur une case couverte, ni
la traverser</strong>.</p>

<p>Autrement dit, chaque pion projette une croix d'interdiction autour de lui.
Pas une zone, pas un cercle : une croix de quatre cases.</p>

<h2>Trois précisions qui changent tout</h2>

<h3>La couverture est strictement orthogonale</h3>

<p>Les quatre cases en diagonale d'un pion ne sont pas couvertes. Jamais. C'est
le choix de conception le plus lourd de conséquences du jeu, et il est
délibéré : si la couverture était circulaire, deux pions bien placés fermeraient
un couloir entier et les parties deviendraient des sièges.</p>

<p>Concrètement, cela signifie qu'<strong>une défense parfaitement alignée reste
poreuse en biais</strong>. Trois pions côte à côte sur une ligne bloquent tout ce
qui passe verticalement entre eux et laissent passer autant de trajectoires
diagonales. Avant de conclure qu'un angle est fermé, comptez les diagonales : il
y a presque toujours un couloir que personne ne surveille.</p>

<h3>Le gardien ne couvre rien</h3>

<p>Le gardien est le seul pion du jeu à ne projeter aucune couverture. Il défend
uniquement en occupant physiquement une case de sa cage.</p>

<p>Cette exception n'est pas un oubli. Un gardien qui couvrirait ses quatre cases
voisines rendrait la cage mathématiquement imprenable : les trois cases du but
plus leurs abords immédiats seraient toutes interdites, et aucun tir ne pourrait
jamais aboutir. Le gardien bouche un trou, un seul, celui sur lequel il se
tient.</p>

<p>Cela a une conséquence pratique très concrète : <strong>les abords de la cage
adverse sont beaucoup moins protégés qu'ils n'en ont l'air</strong>. Si aucun
défenseur de champ n'est descendu, la ligne devant le but est une autoroute.</p>

<h3>Vos propres pions ne vous gênent jamais par leur couverture</h3>

<p>Seule la couverture de l'adversaire bloque vos passes. Vos pions à vous
n'interdisent aucune case — ils arrêtent le ballon uniquement s'ils se trouvent
physiquement sur sa trajectoire.</p>

<p>Beaucoup de joueurs hésitent à masser leurs pions autour du ballon par crainte
de se gêner. C'est infondé. Le seul risque est l'obstruction physique, et elle se
voit d'un coup d'œil.</p>

<h2>Ce que la règle implique quand vous attaquez</h2>

<p>La question à se poser avant chaque passe n'est pas « jusqu'où puis-je
envoyer le ballon ? » mais « quelles cases sont encore libres de couverture
adverse ? ».</p>

<p>Trois habitudes payent immédiatement :</p>

<ol>
  <li><strong>Chercher la diagonale avant l'orthogonale.</strong> À position
      égale, une trajectoire en biais a statistiquement plus de chances d'être
      ouverte, puisque la couverture ne s'exerce pas en diagonale.</li>
  <li><strong>Compter les pions de champ adverses proches de la trajectoire, pas
      les pions adverses tout court.</strong> Un gardien sur le chemin est un
      obstacle physique ; il n'interdit rien autour de lui.</li>
  <li><strong>Se rappeler qu'une case couverte est aussi infranchissable.</strong>
      Ce n'est pas seulement qu'on ne peut pas s'y arrêter : la trajectoire s'y
      interrompt. Une seule case couverte au milieu d'un couloir ferme tout ce
      qui se trouve derrière.</li>
</ol>

<h2>Ce que la règle implique quand vous défendez</h2>

<p>C'est ici que le jeu devient réellement tactique, parce qu'il n'y a pas de
capture : <strong>on ne défend jamais en prenant le ballon, seulement en
occupant des cases</strong>.</p>

<p>Un pion posé sur l'axe qui mène à votre cage vaut souvent plus qu'une passe
supplémentaire. Et comme la couverture est orthogonale, la géométrie de votre
défense compte davantage que le nombre de pions engagés :</p>

<ul>
  <li><strong>Deux pions en diagonale l'un de l'autre</strong> couvrent huit
      cases distinctes et forment un filet en quinconce, difficile à traverser
      dans les deux orientations.</li>
  <li><strong>Deux pions côte à côte</strong> couvrent six cases seulement — leurs
      croix se chevauchent — et laissent la diagonale entièrement ouverte.</li>
</ul>

<p>À nombre de pions égal, la disposition en quinconce vaut donc nettement mieux
que la ligne. C'est contre-intuitif pour qui vient du football : on a envie
d'aligner un mur, alors qu'il faut décaler.</p>

<h2>Les deux façons d'annuler la couverture</h2>

<p>Le palier Expert ajoute deux mécaniques qui percent une défense trop
disciplinée. Elles existent précisément parce qu'une couverture bien posée serait
sinon insurmontable.</p>

<p><strong>Le centre depuis une aile.</strong> Quand le ballon se trouve sur la
première ou la septième colonne, la passe qui en part ignore complètement la
couverture adverse. Si le milieu est verrouillé, la solution n'est pas de forcer
l'axe : c'est d'élargir, puis de centrer.</p>

<p><strong>Le tir du point de penalty.</strong> Depuis la case centrale située à
deux lignes de la cage adverse, le tir ignore la couverture et transperce en plus
un défenseur de champ. Amener le ballon jusque-là demande de la construction —
c'est l'intention.</p>

<p>Notez que ces deux exceptions ne sont pas actives au palier Classique. Si vous
jouez avec le réglage par défaut, une défense correctement décalée ne se perce
que par la géométrie.</p>

<h2>Le repère visuel</h2>

<p>Le jeu marque les cases couvertes sur le plateau, mais seulement au moment
utile : quand un pion adjacent au ballon est sélectionné, ou juste après un
déplacement qui rend une passe possible. Le reste du temps, l'affichage reste
propre.</p>

<p>Prenez l'habitude de sélectionner votre pion <em>avant</em> de décider où
envoyer le ballon, uniquement pour lire la carte des interdictions. C'est
gratuit, cela n'engage à rien — un clic sur une case vide se contente de
désélectionner — et cela évite l'essentiel des passes perdues.</p>

<h2>En résumé</h2>

<ul>
  <li>Chaque pion de champ interdit les quatre cases orthogonalement voisines.</li>
  <li>Les diagonales restent ouvertes : c'est là que se joue l'attaque.</li>
  <li>Le gardien ne couvre rien ; les abords du but sont plus fragiles qu'ils n'en ont l'air.</li>
  <li>Vos propres pions ne gênent jamais vos passes autrement qu'en les bloquant physiquement.</li>
  <li>En défense, décalez vos pions en quinconce plutôt que de les aligner.</li>
  <li>Au palier Expert, les ailes et le point de penalty annulent la couverture.</li>
</ul>

<p>La règle complète, avec tous ses cas limites, est détaillée sur la page
<a href="/regles">règles complètes</a>.</p>
`;

export const MAITRISER_LA_UNE_DEUX = `
<p>La une-deux est la mécanique la plus discrète de Tactic Master, et
probablement la plus sous-exploitée. Elle ne s'active pas, ne se choisit pas, ne
coûte rien : elle se déclenche toute seule quand une passe se termine au bon
endroit. Et elle transforme un tour en un tour et demi.</p>

<h2>Ce qui la déclenche exactement</h2>

<p>Après votre passe, si le ballon s'immobilise sur une case
<strong>orthogonalement adjacente à l'un de vos pions de champ</strong> — au-dessus,
en dessous, à gauche ou à droite — votre équipe rejoue immédiatement.</p>

<p>Quatre points à retenir, parce que chacun est une source d'erreur :</p>

<ul>
  <li>L'adjacence est <strong>orthogonale</strong>, pas diagonale. Un ballon qui
      finit en biais de votre pion ne déclenche rien.</li>
  <li>Le pion d'appui doit être un <strong>pion de champ</strong>. Votre gardien
      ne déclenche jamais de une-deux.</li>
  <li>Le bonus est un <strong>déplacement, jamais une seconde passe</strong>.
      Pendant ce mouvement bonus, le ballon est intouchable.</li>
  <li>Le bonus n'est <strong>pas cumulable</strong> : une une-deux n'en déclenche
      pas une autre, et elle ne se combine pas avec le pouvoir Relais.</li>
</ul>

<p>Ajoutons le cas limite qui surprend : une passe qui marque ne déclenche pas de
une-deux. Le but est enregistré, la partie repart du centre.</p>

<p>Enfin, la une-deux n'existe pas au palier Découverte. Elle est active en
Classique et en Expert.</p>

<h2>Pourquoi elle vaut plus qu'elle n'en a l'air</h2>

<p>Un tour ordinaire vous donne une action : un déplacement, ou une passe. La
une-deux vous en donne deux — une passe <em>et</em> un déplacement — dans le même
tour, avant que l'adversaire ne reprenne la main.</p>

<p>Le gain n'est pas seulement quantitatif. Le vrai bénéfice est un
<strong>problème de tempo pour l'adversaire</strong>. Après une passe normale,
votre adversaire replace ses pions en sachant exactement où est le ballon. Après
une une-deux, il découvre une position dans laquelle vous avez déjà réagi à votre
propre passe.</p>

<p>C'est particulièrement brutal en attaque : vous poussez le ballon vers la
surface, puis vous amenez immédiatement un second pion à son contact. À son tour,
votre adversaire fait face à un ballon avancé <em>et</em> soutenu.</p>

<h2>Comment la provoquer</h2>

<p>La une-deux ne se cherche pas au moment de la passe : elle se prépare un tour
plus tôt, en plaçant un pion là où le ballon a vocation à s'arrêter.</p>

<h3>1. Passer court vers un appui</h3>

<p>Le réflexe qui rapporte le plus. Plutôt que d'envoyer le ballon loin dans
l'espace, cherchez la case libre <em>collée</em> à l'un de vos pions. Vous gagnez
moins de terrain, mais vous gagnez un déplacement — et vous gardez le ballon dans
une zone que vous contrôlez.</p>

<p>Souvenez-vous que chaque case de la trajectoire est une destination valable.
Il n'est jamais obligatoire d'envoyer le ballon au bout. Une poussée d'une seule
case qui déclenche une une-deux vaut souvent mieux qu'une poussée de quatre cases
dans le vide.</p>

<h3>2. Poser l'appui avant de passer</h3>

<p>Quand vous voyez où votre passe va s'arrêter au tour suivant, utilisez le tour
courant pour amener un pion à côté de cette case. Le tour d'après, la passe
rapporte automatiquement son bonus.</p>

<p>C'est le geste qui distingue un joueur qui réagit d'un joueur qui construit —
et c'est, très concrètement, ce qui rend la mécanique intéressante.</p>

<h3>3. Enchaîner le long d'une chaîne de pions</h3>

<p>Deux pions espacés de deux cases en ligne créent une zone où presque toute
passe intermédiaire trouve un appui. Vous ne pouvez pas enchaîner deux une-deux
d'affilée, mais vous pouvez utiliser le déplacement bonus pour reformer la chaîne
un cran plus haut — et récupérer la une-deux au tour suivant.</p>

<h2>Que faire du déplacement bonus</h2>

<p>C'est là que la plupart des joueurs gaspillent le gain. Trois usages, du plus
au moins fréquent :</p>

<ol>
  <li><strong>Amener un second pion au contact du ballon.</strong> Au tour
      suivant, vous aurez deux options de passe au lieu d'une, et votre
      adversaire devra couvrir deux angles.</li>
  <li><strong>Boucher la case de couverture qui vous manquait.</strong> Si votre
      passe a exposé une trajectoire vers votre propre cage, le déplacement bonus
      est le moment de la fermer, avant que l'adversaire ne l'emprunte.</li>
  <li><strong>Décaler un pion en quinconce.</strong> Un déplacement d'une case
      qui transforme une ligne en quinconce augmente immédiatement la surface
      couverte, sans rien céder.</li>
</ol>

<p>L'erreur classique consiste à avancer un pion lointain « pour préparer la
suite ». Le bonus est un tempo : il se dépense là où la partie se joue, pas à
l'autre bout du terrain.</p>

<h2>La une-deux en défense</h2>

<p>On l'oublie souvent : la mécanique fonctionne aussi quand vous dégagez. Si
vous repoussez le ballon vers une case voisine de l'un de vos pions restés en
retrait, vous obtenez un déplacement gratuit pour remonter votre bloc. C'est
souvent la façon la plus économique de sortir d'une situation de siège.</p>

<h2>Et le momentum ?</h2>

<p>Le jeu compte les passes consécutives de l'équipe en possession. Un but marqué
au terme d'au moins trois passes d'affilée est signalé comme un bonus de
momentum, et le meilleur enchaînement de chaque équipe est retenu jusqu'à la fin
du match.</p>

<p>La une-deux favorise mécaniquement ces séries : elle récompense les passes
courtes vers un appui, exactement le genre de jeu qui garde la possession. Jouer
pour la une-deux et jouer pour le momentum, c'est jouer de la même façon.</p>

<h2>En résumé</h2>

<ul>
  <li>Ballon immobilisé orthogonalement à côté d'un de vos pions de champ = un déplacement bonus.</li>
  <li>Jamais une seconde passe, jamais deux fois de suite, jamais avec le gardien.</li>
  <li>Elle se prépare un tour à l'avance, en posant l'appui.</li>
  <li>Passer court vers un appui vaut mieux que passer loin dans le vide.</li>
  <li>Le déplacement bonus se dépense près du ballon, pas à l'autre bout du terrain.</li>
</ul>
`;

export const LE_POINT_DE_PENALTY = `
<p>Sur un plateau de 63 cases, il y en a une par camp qui vaut nettement plus que
les autres. Elle ne porte aucune marque particulière une fois la partie lancée, et
beaucoup de joueurs terminent des dizaines de matchs sans jamais s'en servir. Elle
s'appelle le point de penalty, et elle est faite pour débloquer les fins de match
verrouillées.</p>

<h2>Où elle se trouve</h2>

<p>Le point de penalty est la <strong>case centrale située à deux lignes de la
cage adverse</strong>. Sur un plateau numéroté de 1 à 9 du fond rouge au fond
bleu, et de 1 à 7 de gauche à droite :</p>

<ul>
  <li>pour l'équipe bleue, qui attaque vers le haut : <strong>ligne 3, colonne 4</strong> ;</li>
  <li>pour l'équipe rouge, qui attaque vers le bas : <strong>ligne 7, colonne 4</strong>.</li>
</ul>

<p>Les deux positions sont exactement symétriques. Détail amusant : chacune de
ces cases est occupée par un attaquant adverse au coup d'envoi. Le point de
penalty n'est donc jamais disponible immédiatement — il faut que la partie se
déplace.</p>

<h2>Ce que la case donne</h2>

<p>Un tir parti du point de penalty, en direction de la cage, obtient deux
avantages cumulés :</p>

<ol>
  <li>Il <strong>ignore la couverture adverse</strong>. Toutes les cases
      interdites par les pions de champ ennemis redeviennent traversables.</li>
  <li>Il <strong>transperce un défenseur de champ</strong> — un seul. Le ballon
      passe à travers lui et continue sa route.</li>
</ol>

<p>Les limites, tout aussi importantes :</p>

<ul>
  <li>Le <strong>gardien ne se transperce pas</strong>. S'il est sur l'axe, le tir
      s'arrête contre lui.</li>
  <li><strong>Vos propres pions ne se transpercent pas non plus.</strong> Un
      coéquipier mal placé devant le ballon annule tout l'intérêt de la case.</li>
  <li>Un <strong>second</strong> défenseur de champ derrière le premier arrête le
      ballon. La perforation ne vaut que pour un pion.</li>
  <li>Le privilège ne vaut que <strong>vers la cage</strong>. Depuis cette case,
      les passes latérales ou vers l'arrière suivent les règles ordinaires.</li>
</ul>

<p>Et une condition qui décide de tout : le point de penalty n'est actif
qu'<strong>au palier Expert</strong>. En Découverte et en Classique, cette case
est une case comme les autres.</p>

<h2>Pourquoi cette règle existe</h2>

<p>Sans elle, une équipe qui masse quatre pions devant sa cage devient très
difficile à battre : chaque pion interdit quatre cases, et la géométrie finit par
fermer tous les angles. Les fins de match tournaient au siège.</p>

<p>Le point de penalty rétablit l'équilibre sans rien retirer à la défense.
Il n'affaiblit pas le bloc — il offre à l'attaque un objectif de construction
précis. La bonne question passe de « comment franchir ce mur ? » à « comment
amener le ballon sur cette case ? », ce qui est un bien meilleur problème
tactique.</p>

<h2>Comment y amener le ballon</h2>

<p>Compter deux à trois tours de préparation est réaliste. Trois approches
fonctionnent.</p>

<h3>Par l'aile, puis en centrant</h3>

<p>La plus fiable au palier Expert, puisque les deux mécaniques s'y combinent.
Amenez le ballon sur une colonne de bord : de là, votre passe ignore la
couverture. Visez alors le point de penalty plutôt que le but — vous serez à un
tir du but, sur une case qui ignore à nouveau la couverture.</p>

<p>C'est l'enchaînement le plus puissant du jeu, et le plus rarement joué :
deux annulations de couverture consécutives.</p>

<h3>Par une une-deux</h3>

<p>Placez un pion d'appui juste à côté du point de penalty, orthogonalement.
Poussez le ballon jusqu'à la case : la une-deux se déclenche, et vous obtenez un
déplacement bonus pour amener un second pion au contact du ballon. Vous êtes
alors sur le point de penalty <em>avec</em> le soutien nécessaire pour tirer au
tour suivant.</p>

<h3>Par la patience</h3>

<p>La case centrale à deux lignes du but est aussi celle que la défense adverse
surveille le moins, parce qu'elle est trop avancée pour un défenseur et trop
reculée pour sembler dangereuse. Si l'adversaire s'est massé sur sa ligne de
fond, le point de penalty est souvent... libre.</p>

<h2>Comment le défendre</h2>

<p>Trois réponses, par ordre d'efficacité :</p>

<ol>
  <li><strong>Occuper la case.</strong> C'est radical et définitif : un pion posé
      dessus interdit purement et simplement le tir. Rappelez-vous qu'au coup
      d'envoi, un de vos attaquants y est déjà.</li>
  <li><strong>Aligner le gardien.</strong> Le gardien ne se transperce pas. S'il
      tient la colonne centrale, le tir depuis le point de penalty meurt contre
      lui — ce qui, entre parenthèses, est l'un des rares moments du jeu où
      positionner son gardien relève du calcul et non du réflexe.</li>
  <li><strong>Doubler le défenseur.</strong> La perforation ne vaut que pour un
      pion. Deux défenseurs de champ alignés sur l'axe arrêtent le tir.</li>
</ol>

<p>Ce qui ne sert à rien, en revanche : couvrir les abords de la case. Le tir
ignore la couverture. Placer trois pions autour du point de penalty sans occuper
ni l'axe ni la case elle-même revient à ne rien faire.</p>

<h2>En résumé</h2>

<ul>
  <li>Case centrale à deux lignes de la cage adverse, active au palier Expert seulement.</li>
  <li>Le tir vers la cage ignore la couverture et transperce un défenseur de champ.</li>
  <li>Ni le gardien ni vos propres pions ne se transpercent.</li>
  <li>Y arriver demande deux à trois tours : par l'aile, par une une-deux, ou par la patience.</li>
  <li>Se défend en occupant la case, en alignant le gardien, ou en doublant le défenseur.</li>
</ul>

<p>Le détail des règles associées est sur la page <a href="/regles">règles
complètes</a>.</p>
`;

export const LES_CINQ_POUVOIRS = `
<p>Quand les joueurs à pouvoirs sont activés, un pion de champ tiré au sort dans
chaque équipe reçoit une capacité spéciale. Une seule, utilisable
<strong>une seule fois de tout le match</strong>. Après usage, le pion redevient
strictement ordinaire.</p>

<p>Cette rareté est le cœur du sujet. Un pouvoir n'est pas une ressource à
dépenser, c'est un coup à placer. Voici ce que chacun fait exactement, et le
moment où il vaut le plus.</p>

<h2>Tir Puissant</h2>

<p><strong>Effet :</strong> la passe traverse le premier pion rencontré au lieu de
s'arrêter contre lui.</p>

<p>C'est le pouvoir le plus directement décisif, parce qu'il attaque la seule
chose qu'une défense ne peut pas contourner : l'obstruction physique. Toute la
défense de Tactic Master repose sur des pions qui bouchent des lignes. Le Tir
Puissant en efface un.</p>

<p><strong>Quand le déclencher :</strong> face à une défense massée devant la
cage, quand un unique pion sépare le ballon du but. Pas avant. Utilisé au milieu
de terrain pour gagner trois cases, il vaut une passe ordinaire ; utilisé à
l'entrée de la surface, il vaut un but.</p>

<p><strong>À ne pas oublier :</strong> il ne traverse que le <em>premier</em> pion.
Deux pions alignés l'arrêtent. Vérifiez la ligne entière avant de le dépenser.</p>

<h2>Sprint</h2>

<p><strong>Effet :</strong> ce pion se déplace de deux cases au lieu d'une, dans
la même direction — y compris en diagonale. Les deux cases du trajet doivent être
libres : il n'y a pas de saut par-dessus un pion ni par-dessus le ballon.</p>

<p>Le Sprint résout le problème le plus frustrant du jeu : être trop loin du
ballon d'exactement une case. Comme un tour ne vaut qu'un déplacement, un pion
qui met deux tours à rejoindre le ballon arrive toujours trop tard.</p>

<p><strong>Quand le déclencher :</strong> quand aucun de vos pions n'est au
contact du ballon et que l'adversaire, lui, va y arriver au tour suivant. Le
Sprint transforme une possession perdue en possession disputée.</p>

<p><strong>Aussi valable en défense :</strong> ramener un défenseur sur l'axe du
but en un seul tour, quand une passe adverse vient d'ouvrir un couloir, sauve
plus de buts qu'on ne le croit.</p>

<h2>Relais</h2>

<p><strong>Effet :</strong> après une passe, l'équipe déplace immédiatement un
second pion. Jamais une seconde passe.</p>

<p>Le Relais est une une-deux à la demande — sans la condition d'appui. Là où la
une-deux exige que le ballon s'arrête à côté d'un de vos pions, le Relais
s'obtient sur n'importe quelle passe.</p>

<p><strong>Quand le déclencher :</strong> sur la passe qui vous fait gagner le
plus de terrain, précisément celle après laquelle vous n'avez plus personne pour
suivre. C'est l'outil qui permet d'envoyer le ballon loin sans perdre le contrôle
— alors que le reste du temps, envoyer loin sans soutien est l'erreur numéro
un.</p>

<p><strong>Ne le gaspillez pas</strong> sur une passe qui déclenchait déjà une
une-deux : les deux ne se cumulent pas.</p>

<h2>Repli adverse</h2>

<p><strong>Effet :</strong> force un pion adverse de champ à reculer d'une case
vers son propre camp. Sans effet sur les gardiens, et impossible si la case de
repli est occupée par un pion ou par le ballon.</p>

<p>C'est le seul pouvoir qui agit sur la position de l'adversaire, et son intérêt
tient entièrement à la couverture : reculer un pion d'une case, c'est déplacer
quatre cases d'interdiction. Souvent, exactement celles qui fermaient votre
angle.</p>

<p><strong>Quand le déclencher :</strong> juste avant votre passe décisive, sur le
pion qui couvre la case que vous visez. L'ordre compte — le repli s'applique
immédiatement, donc utilisez-le, vérifiez la nouvelle carte des couvertures,
puis passez.</p>

<p><strong>Le piège :</strong> le pion visé recule, il ne disparaît pas. S'il
recule vers votre trajectoire au lieu de s'en éloigner, vous avez aggravé votre
situation. Regardez où il atterrit.</p>

<h2>Mur</h2>

<p><strong>Effet :</strong> pendant le tour adverse suivant, ce pion coupe aussi
les passes diagonales qui <em>contournent</em> son coin.</p>

<p>La formulation mérite d'être précisée, parce qu'elle décrit une géométrie
particulière. Une passe diagonale ne s'arrête pas contre un pion qu'elle frôle :
elle passe <em>entre</em> deux cases. Le Mur ferme exactement ce passage — si le
pion en mode mur occupe l'une des deux cases que la diagonale contourne, la
trajectoire est coupée.</p>

<p>C'est le seul pouvoir purement défensif, et le seul qui réponde au point
faible structurel de la défense : les diagonales, que la couverture — strictement
orthogonale — ne ferme jamais.</p>

<p>Deux propriétés en font plus qu'un gadget :</p>

<ul>
  <li>Il <strong>ne gêne jamais votre propre camp</strong> : vos passes traversent
      normalement pendant que le mur est debout.</li>
  <li>C'est une <strong>obstruction physique, pas de la couverture</strong>. Il
      coupe donc aussi un centre parti d'une aile et un tir puissant, qui
      ignorent pourtant la couverture. C'est la seule chose du jeu qui arrête un
      centre.</li>
</ul>

<p><strong>Quand le déclencher :</strong> quand le ballon est dans votre moitié
de terrain et qu'un couloir diagonal mène à votre cage — le cas typique où une
défense correctement alignée ne sert à rien. Le pion concerné est signalé sur le
plateau par un halo pendant toute la durée de l'effet.</p>

<h2>L'erreur que tout le monde fait</h2>

<p>Dépenser ses pouvoirs dans les premiers tours pour prendre l'avantage au
milieu.</p>

<p>C'est compréhensible : le milieu de terrain est le moment où l'on hésite, et
un pouvoir donne l'impression de faire quelque chose. Mais un pouvoir dépensé
pour gagner deux cases au centre a rapporté deux cases. Le même pouvoir gardé
jusqu'à l'entrée de la surface rapporte un but.</p>

<p>La règle est simple : <strong>un pouvoir se dépense quand un seul obstacle
sépare le ballon du but</strong>, ou quand un seul obstacle sépare l'adversaire de
votre cage. Entre les deux, jouez normalement.</p>

<h2>Et l'ordinateur ?</h2>

<p>Aux niveaux Moyen et Difficile, l'ordinateur utilise ses pouvoirs — et selon
une logique assez lisible, qu'il est utile de connaître :</p>

<ul>
  <li>Il joue le <strong>Tir Puissant</strong> uniquement s'il marque
      immédiatement. Jamais pour gagner du terrain.</li>
  <li>Il joue le <strong>Relais</strong> quand une passe rapproche le ballon de
      votre cage.</li>
  <li>Il joue le <strong>Repli adverse</strong> sur un de vos pions qui conteste
      le ballon, pour dégager le jeu.</li>
  <li>Il joue le <strong>Sprint</strong> quand aucun de ses pions n'est encore au
      contact du ballon.</li>
  <li>Il joue le <strong>Mur</strong> quand le ballon est dans sa moitié
      défensive.</li>
</ul>

<p>Le niveau Facile, lui, n'utilise jamais de pouvoir : c'est le niveau prévu pour
apprendre sans être puni.</p>

<p>Conséquence pratique : contre l'ordinateur, si le ballon arrive à portée de but
et que son pion à pouvoir est encore intact, considérez que le tir perforant est
déjà joué. Bouchez la ligne avec deux pions, pas un.</p>

<h2>En résumé</h2>

<ul>
  <li>Un pion par équipe, un pouvoir, un usage par match.</li>
  <li>Tir Puissant contre un mur ; Sprint pour arriver à temps ; Relais pour suivre une longue passe ; Repli adverse pour ouvrir un angle ; Mur pour fermer une diagonale.</li>
  <li>Gardez-les pour la surface. Un pouvoir dépensé au milieu est un pouvoir perdu.</li>
  <li>L'ordinateur ne joue le Tir Puissant que s'il marque : anticipez-le.</li>
</ul>
`;

export const LE_ROLE_DU_GARDIEN = `
<p>Le gardien de Tactic Master est le pion dont on parle le moins et celui qu'on
joue le plus mal. Il a ses propres règles, il ne ressemble à aucun autre pion, et
la plupart des joueurs le laissent immobile toute la partie en espérant que ça
suffira. Ça ne suffit pas.</p>

<h2>Deux règles, et c'est tout</h2>

<p><strong>Il ne quitte jamais sa ligne de cage.</strong> Le gardien se déplace
uniquement sur les trois cases centrales de sa ligne de fond — celles de la cage.
Il glisse latéralement, jamais vers l'avant. De toute la partie, il ne verra pas
une seule fois le milieu de terrain.</p>

<p><strong>Il ne couvre aucune case.</strong> C'est la particularité qui compte le
plus, et celle que presque personne ne connaît. Tous les autres pions interdisent
les quatre cases orthogonalement voisines aux passes adverses. Le gardien,
lui, n'interdit rien du tout.</p>

<p>Ces deux règles ont une conséquence unique : le gardien défend
<strong>par occupation, et seulement par occupation</strong>. Il bouche un trou de
la cage. Un seul : celui sur lequel il se tient.</p>

<h2>Pourquoi il ne couvre rien</h2>

<p>La question mérite d'être posée, parce que l'exception paraît arbitraire.</p>

<p>Imaginez un gardien qui couvrirait ses quatre cases voisines. Placé au centre
de la cage, il interdirait les deux autres cases du but, plus la case juste
devant. La cage entière deviendrait infranchissable, et il suffirait de ne jamais
bouger le gardien pour rendre le but mathématiquement impossible.</p>

<p>Le jeu serait terminé avant d'avoir commencé. L'exception n'est donc pas un
détail d'équilibrage : c'est ce qui permet au jeu d'exister.</p>

<h2>Ce que ça change, en attaque</h2>

<p>La conclusion pratique surprend : <strong>les abords de la cage adverse sont
beaucoup moins protégés qu'ils n'en ont l'air</strong>.</p>

<p>Quand vous regardez le but adverse et que vous y voyez un gardien, votre
cerveau enregistre « zone défendue ». C'est faux. Si aucun défenseur de champ
n'est descendu, la ligne devant le but est complètement ouverte : aucune case n'y
est interdite, la trajectoire ne s'interrompt nulle part.</p>

<p>Il n'y a alors qu'une seule chose à faire : <strong>viser une case du but que
le gardien n'occupe pas</strong>. La cage fait trois cases, le gardien en tient
une. Deux sont libres, toujours.</p>

<p>D'où la seule vraie règle d'attaque : ne visez pas le but, visez le
<em>côté</em> du but où le gardien n'est pas. Un tir dans l'axe sur un gardien
centré est un tir perdu.</p>

<h2>Ce que ça change, en défense</h2>

<p>Puisque le gardien ne couvre rien, il ne remplace jamais un défenseur. Une
défense qui se résume à « mon gardien est devant mon but » n'est pas une
défense.</p>

<p>Le travail défensif réel se fait <strong>une ou deux lignes devant</strong>,
avec les pions de champ, dont la couverture ferme les angles. Le gardien est le
dernier recours quand ce travail a échoué.</p>

<p>Cela dit, il n'est pas passif pour autant. Trois habitudes valent des buts :</p>

<ol>
  <li><strong>Alignez-le sur la colonne du ballon.</strong> Quand le ballon
      approche, la case du but la plus menacée est celle qui se trouve dans son
      axe. Le gardien doit y être avant le tir, pas après.</li>
  <li><strong>Bougez-le tôt.</strong> Un tour, c'est une action. Si vous attendez
      que le tir soit imminent pour déplacer votre gardien, vous perdez un tour de
      défense de champ — et vous n'aurez peut-être pas le temps de traverser.
      Traverser la cage d'un bout à l'autre prend deux tours.</li>
  <li><strong>Ne le laissez pas au centre par défaut.</strong> Le centre n'est le
      meilleur emplacement que si le ballon est centré. Contre un ballon poussé
      sur une aile, le gardien centré couvre la case la moins menacée.</li>
</ol>

<h2>Le cas du point de penalty</h2>

<p>Le gardien a un moment de gloire, et un seul : il est le seul pion que le tir
du point de penalty ne peut pas transpercer.</p>

<p>Au palier Expert, un tir parti de la case centrale à deux lignes du but ignore
la couverture et traverse un défenseur de champ. Il ne traverse pas le gardien.
Si votre adversaire s'installe sur le point de penalty, votre gardien sur la
colonne centrale n'est plus un pis-aller : c'est la meilleure réponse
disponible.</p>

<h2>Ce que le gardien ne fait pas</h2>

<p>Une courte liste, parce que ce sont les attentes que les joueurs projettent
sur lui :</p>

<ul>
  <li>Il ne <strong>capture</strong> pas — personne ne capture dans ce jeu.</li>
  <li>Il ne <strong>dégage</strong> pas différemment des autres : s'il est adjacent
      au ballon, il le pousse exactement comme n'importe quel pion.</li>
  <li>Il ne <strong>déclenche pas de une-deux</strong> : le bonus exige un pion de
      champ.</li>
  <li>Il ne <strong>peut pas être reculé</strong> par le pouvoir Repli adverse, qui
      ne vise que les pions de champ.</li>
  <li>Il ne <strong>sort jamais</strong>, même quand la partie se joue à l'autre
      bout du terrain.</li>
</ul>

<h2>En résumé</h2>

<ul>
  <li>Trois cases, jamais plus : le gardien glisse sur sa ligne de but.</li>
  <li>Il ne couvre aucune case — c'est ce qui rend le but atteignable.</li>
  <li>En attaque : visez le côté du but qu'il n'occupe pas, il y en a toujours un.</li>
  <li>En défense : alignez-le tôt sur la colonne du ballon, et ne comptez jamais sur lui seul.</li>
  <li>Il est le seul rempart qu'un tir du point de penalty ne traverse pas.</li>
</ul>
`;
