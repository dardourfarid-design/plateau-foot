// Articles de stratégie et de fond (#301). Séparés de articles.mjs, qui reste
// l'index : un seul fichier de 2 000 lignes de HTML deviendrait impossible à
// relire, et c'est justement de la relecture que dépend l'exactitude des règles
// annoncées.

export const STRATEGIES_POUR_GAGNER = `
<p>Si tu enchaînes les défaites, ce n'est probablement pas une question de
réflexes : Tactic Master n'en demande aucun. C'est presque toujours l'un de ces
cinq points. Ils sont classés du plus rentable au plus subtil.</p>

<h2>1. Arrête d'envoyer le ballon au maximum</h2>

<p>L'erreur numéro un, et de loin. Quand tu fais une passe, chaque case libre de
la trajectoire est une destination valable : <strong>c'est toi qui décides où le
ballon s'arrête</strong>. Beaucoup de débutants cliquent instinctivement sur la
case la plus lointaine.</p>

<p>Le problème est simple : un ballon envoyé loin est un ballon que tu ne contrôles
plus. Ton pion, lui, est resté en arrière. Le camp qui aura un pion à côté du
ballon au tour suivant, c'est celui qui jouera.</p>

<p>Règle de pouce : <strong>ne pousse jamais le ballon plus loin que ton propre
soutien</strong>. Deux cases avec un pion capable de suivre valent mieux que cinq
cases dans le vide.</p>

<h2>2. Les diagonales sont ouvertes — sers-t'en</h2>

<p>La couverture défensive est <strong>orthogonale</strong> : un pion de champ
bloque les quatre cases directement au-dessus, en dessous, à gauche et à droite
de lui. Pas les diagonales.</p>

<p>C'est la conséquence la plus exploitable de tout le jeu. Une défense qui paraît
solide de face est presque toujours perméable en biais. Avant de conclure qu'un
angle est fermé, regarde les quatre diagonales : il y a souvent un couloir que
personne ne surveille.</p>

<p>Symétriquement, quand tu défends, souviens-toi que tes pions ne ferment
<em>rien</em> en diagonale. Une ligne de trois pions côte à côte laisse passer
autant de trajectoires biaises qu'elle en bloque de droites.</p>

<h2>3. Occupe les cases, pas le ballon</h2>

<p>Comme il n'y a pas de capture, on croit d'abord que les pions adverses sont de
simples décors. C'est l'inverse : puisqu'une passe s'arrête au premier pion
rencontré et ne peut pas traverser une case couverte, <strong>chaque pion est un
mur qui projette une zone d'interdiction</strong>.</p>

<p>Un joueur qui court en permanence derrière le ballon perd contre un joueur qui
place ses pions. Poser un défenseur sur l'axe de la cage vaut souvent mieux
qu'une passe de plus.</p>

<p>Le gardien est l'exception : il ne couvre aucune case. Il défend uniquement en
occupant physiquement sa ligne de but. Ne compte pas sur lui pour fermer les
alentours de la cage — il ne le fait pas.</p>

<h2>4. Passe par les ailes quand la défense est dense</h2>

<p>Cette stratégie ne s'applique qu'au palier Expert, où les centres sont actifs.
Elle est alors décisive.</p>

<p>Une passe qui part d'une <strong>colonne de bord</strong> ignore complètement
la couverture adverse. Autrement dit : quand ton adversaire a verrouillé l'axe
central, ne t'acharne pas dessus. Amène le ballon sur une aile, et de là, ta
passe traversera ce qui aurait été infranchissable au centre.</p>

<p>C'est le contre direct d'une défense compacte, et beaucoup de joueurs
l'ignorent longtemps.</p>

<h2>5. Vise le point de penalty</h2>

<p>Toujours au palier Expert : la case centrale située à deux rangées de la cage
adverse est un point de penalty. Un tir lancé de là vers le but
<strong>transperce un défenseur de champ</strong> — un seul, et pas le gardien.</p>

<p>Amener le ballon jusque-là demande souvent deux ou trois tours de préparation.
C'est précisément l'idée : le jeu récompense la construction, pas le coup de
chance. Si tu ne sais pas quoi faire d'un ballon en milieu de terrain, le
ramener vers cette case est rarement une mauvaise décision.</p>

<h2>Le piège classique, pour finir</h2>

<p>Ton tour se déroule en deux temps : tu déplaces un pion d'une case, et
<em>seulement si ce pion arrive au contact du ballon</em>, tu peux enchaîner par
une passe. Un pion déjà collé au ballon en début de tour ne peut pas le pousser
sans avoir bougé.</p>

<p>Beaucoup de joueurs perdent un tour entier à comprendre pourquoi « ça ne marche
pas ». Anticipe-le : le pion que tu prépares doit <strong>arriver</strong> à côté
du ballon, pas y être déjà.</p>

<h2>Bonus : les pouvoirs, et quand les garder</h2>

<p>Si tu joues avec les joueurs à pouvoirs, chaque pion concerné dispose d'une
capacité <strong>utilisable une seule fois par partie</strong>. C'est peu, et c'est
justement ce qui rend le moment du déclenchement important. Les cinq pouvoirs :</p>

<ul>
  <li><strong>Tir Puissant</strong> — le ballon traverse le premier pion adverse
      rencontré au lieu de s'arrêter contre lui. À garder pour une défense massée
      devant la cage : c'est là qu'il vaut un but.</li>
  <li><strong>Sprint</strong> — ce pion se déplace de 2 cases en ligne droite au
      lieu d'1. Le meilleur outil pour arriver au contact d'un ballon que tu
      croyais hors de portée.</li>
  <li><strong>Mur</strong> — pendant ce tour, ce pion bloque aussi les
      trajectoires diagonales qui le traversent. Le seul moyen de fermer une
      diagonale, donc le contre direct de la stratégie n° 2 quand c'est
      l'adversaire qui l'emploie.</li>
  <li><strong>Relais</strong> — après une passe, tu déplaces immédiatement un
      second pion. Sert à récupérer le contrôle d'un ballon que tu viens
      d'envoyer loin.</li>
  <li><strong>Repli adverse</strong> — force un pion adverse à reculer d'une case.
      Une case de couverture en moins, souvent celle qui bloquait ton angle.</li>
</ul>

<p>L'erreur habituelle est de tout dépenser dans les premiers tours pour prendre
l'avantage au milieu. Ces pouvoirs valent bien plus près de la cage, quand un
seul angle sépare le ballon du but.</p>

<h2>Et si la partie se fige ?</h2>

<p>Elle ne peut pas. Si les deux camps se contentent de déplacer leurs pions sans
jamais toucher au ballon, celui-ci est automatiquement remis au centre au bout de
huit tours sans la moindre passe.</p>

<p>Ça a une conséquence tactique : <strong>refuser le jeu n'est pas une stratégie
viable</strong>. Un joueur en avance qui essaierait de geler la partie pour
conserver son score se fera ramener le ballon au centre, en position neutre. Mieux
vaut construire.</p>
`;

export const BATTRE_IA_DIFFICILE = `
<p>L'IA difficile de Tactic Master n'est pas un moteur d'échecs. Elle a une
méthode précise, et donc des angles morts précis. Voici comment elle décide
réellement, et ce que tu peux en faire.</p>

<h2>Comment elle raisonne</h2>

<p>À chaque tour, elle procède ainsi :</p>

<ol>
  <li>Si un coup lui fait marquer immédiatement, elle le joue. Sans hésitation,
      sans rien examiner d'autre.</li>
  <li>Sinon, elle évalue chacun de ses coups possibles, puis regarde
      <strong>un tour plus loin</strong> : pour chaque coup, elle échantillonne
      tes réponses possibles et retient la pire pour elle.</li>
  <li>Elle choisit le coup dont la pire suite reste la meilleure.</li>
</ol>

<p>C'est une recherche à deux niveaux. Suffisant pour punir toute erreur grossière,
et pour te prendre le ballon si tu le laisses traîner.</p>

<h2>Son angle mort principal : elle ne valorise que deux choses</h2>

<p>Voilà l'information utile. Sa fonction d'évaluation ne tient compte que de
<strong>l'écart de buts</strong>, très largement dominant, et de la
<strong>distance du ballon à ta cage</strong>, avec un poids faible.</p>

<p>C'est tout. Elle n'attribue <em>aucune</em> valeur à la position de ses propres
pions, à sa structure défensive, ni aux zones qu'elle couvre.</p>

<p>Conséquence directe et exploitable : <strong>elle démantèle volontiers sa propre
défense pour rapprocher le ballon de ta cage.</strong> Elle avancera un défenseur
qui tenait un axe, simplement parce que le coup gagne un dixième de point de
proximité.</p>

<p>La contre-stratégie tient en une phrase : <strong>laisse-la venir</strong>. Plus
elle pousse, plus elle se découvre. Une défense patiente, qui garde ses pions sur
les axes plutôt que de courir après le ballon, la met en difficulté toute seule.</p>

<h2>Son deuxième angle mort : elle ne regarde pas toutes tes réponses</h2>

<p>Pour rester rapide, elle plafonne le nombre de tes ripostes examinées, et les
tire au hasard quand il y en a trop.</p>

<p>Autrement dit : <strong>plus la position est ouverte, plus elle est susceptible
de rater ta meilleure réponse.</strong> Dans une position fermée avec peu de coups
légaux, elle voit tout. Dans une position aérée où tu disposes de trente
possibilités, il y a de fortes chances qu'elle n'ait pas examiné celle que tu
prépares.</p>

<p>Joue donc large. Garde les lignes ouvertes. C'est exactement l'inverse de ce
qu'on ferait contre un moteur d'échecs, et c'est ce qui marche ici.</p>

<h2>Le piège du coup gagnant immédiat</h2>

<p>Elle prend toujours un but immédiat quand il est disponible. Cette priorité est
absolue et ne se discute pas — donc elle est prévisible.</p>

<p>Vérifie systématiquement, avant de valider ton coup, si tu ne viens pas de lui
ouvrir une trajectoire vers ta cage. Elle ne la manquera jamais. À l'inverse, tant
qu'aucune trajectoire directe n'existe, elle revient à son évaluation myope, et
redevient exploitable.</p>

<h2>Ce que les niveaux inférieurs changent</h2>

<p>Pour situer, si tu veux t'entraîner progressivement :</p>

<ul>
  <li><strong>Facile</strong> joue de façon largement aléatoire, avec une
      préférence pour les coups qui rapprochent le ballon. Elle ne pousse jamais
      le ballon de plus de deux cases, et n'utilise jamais de pouvoir.</li>
  <li><strong>Moyen</strong> évalue tous ses coups, garde les 30 % meilleurs et en
      tire un au hasard. Solide, mais elle ne regarde jamais ta réponse : elle ne
      voit donc pas les pièges à un coup.</li>
  <li><strong>Difficile</strong> ajoute la recherche d'un tour supplémentaire
      décrite plus haut.</li>
</ul>

<p>Le saut de difficulté réel se situe entre Moyen et Difficile : c'est le moment
où tendre un piège en un coup cesse de fonctionner.</p>

<h2>En résumé</h2>

<ul>
  <li>Défends en plaçant, pas en poursuivant : elle se découvrira d'elle-même.</li>
  <li>Garde la position ouverte : elle échantillonne, elle ratera des réponses.</li>
  <li>Ne lui laisse jamais une trajectoire directe : c'est sa seule certitude.</li>
</ul>

<h2>Comment elle utilise ses pouvoirs</h2>

<p>Si les joueurs à pouvoirs sont activés, l'IA s'en sert — sauf au niveau Facile,
qui n'en déclenche jamais aucun. Ses règles de déclenchement sont simples, donc
prévisibles :</p>

<ul>
  <li><strong>Tir Puissant</strong> : dès qu'elle est au contact du ballon et qu'un
      tir devient possible à travers un pion.</li>
  <li><strong>Relais</strong> : quand elle est au contact du ballon et qu'une passe
      le rapproche de ta cage.</li>
  <li><strong>Repli adverse</strong> : pour repousser un de tes pions qui conteste
      le ballon.</li>
  <li><strong>Sprint</strong> : quand aucun de ses pions n'est encore à côté du
      ballon — c'est son geste pour rattraper une situation.</li>
</ul>

<p>Retiens surtout le dernier : <strong>si aucun de ses pions n'est au contact du
ballon, attends-toi à un Sprint.</strong> Un pion qui semblait à deux cases de
distance peut arriver au contact dans le même tour. Compte cette portée quand tu
crois avoir mis le ballon à l'abri.</p>

<h2>Une partie contre elle n'est jamais deux fois la même</h2>

<p>Un détail qui a son importance si tu veux t'entraîner sur une position : ni le
niveau Moyen ni le niveau Difficile ne sont totalement déterministes. Le premier
tire au sort parmi ses meilleurs coups, le second échantillonne tes réponses au
hasard.</p>

<p>Rejouer exactement la même ouverture ne produira donc pas exactement la même
partie. C'est délibéré — une IA parfaitement prévisible devient un puzzle à
mémoriser plutôt qu'un adversaire. Mais ça veut aussi dire qu'un piège qui a
fonctionné une fois n'est pas garanti la suivante.</p>
`;

export const JOUER_A_DEUX = `
<p>Tactic Master se joue à deux de deux façons. Elles n'ont pas du tout les mêmes
contraintes, alors autant savoir laquelle choisir.</p>

<h2>Face à face, sur le même appareil</h2>

<p>C'est le mode le plus simple, et il ne demande absolument rien : pas de compte,
pas de connexion, pas de code. Tu choisis « 2 joueurs », et le même écran sert aux
deux camps, à tour de rôle.</p>

<p>Sur téléphone posé entre deux personnes, sur tablette ou sur ordinateur portable,
ça fonctionne exactement pareil. Les modes locaux marchent même
<strong>hors connexion</strong> : le jeu est une application web installable, et une
fois la page chargée une première fois, elle reste jouable sans réseau.</p>

<p>Le seul inconvénient tient à la nature du jeu : comme tout est visible, il n'y a
aucune information cachée à protéger. C'est un jeu à information complète, comme
les dames — personne ne peut tricher en regardant l'écran.</p>

<h2>À distance, avec un code de partie</h2>

<p>Le mode en ligne fonctionne par <strong>invitation</strong>. L'un des deux joueurs
crée la partie et obtient un code ; l'autre saisit ce code pour rejoindre. C'est
tout.</p>

<p>Disons-le clairement pour éviter la déception : <strong>il n'y a pas de
matchmaking automatique.</strong> On ne peut pas cliquer sur « chercher un
adversaire » pour tomber sur un inconnu. Il faut connaître la personne avec qui on
veut jouer et lui transmettre le code, par message, par messagerie ou de vive voix.</p>

<p>C'est un choix assumé pour l'instant : un système d'appariement suppose une
population de joueurs connectés simultanément, ce que le jeu n'a pas encore.</p>

<h3>Ce qu'il faut pour jouer en ligne</h3>

<ul>
  <li>Un compte, des deux côtés — c'est ce qui permet d'associer la partie à des
      joueurs et de conserver la progression.</li>
  <li>Une connexion active pendant toute la partie.</li>
  <li>Le code transmis à ton adversaire.</li>
</ul>

<h2>Les coups sont validés côté serveur</h2>

<p>Un point qui a son importance si tu joues avec quelqu'un de compétitif : en
ligne, <strong>les coups ne sont pas décidés par les navigateurs</strong>. Chaque
action est rejouée sur le serveur, sur l'état de référence de la partie, avec le
même moteur de règles.</p>

<p>Concrètement, un joueur qui modifierait le code de son navigateur pour s'accorder
un coup illégal se ferait refuser l'action, et son écran se resynchroniserait sur
l'état réel. Le résultat d'une partie en ligne ne dépend donc pas de la bonne foi
des deux camps.</p>

<h2>Contre l'ordinateur, si personne n'est disponible</h2>

<p>Le troisième mode reste l'adversaire artificiel, à trois niveaux. C'est le plus
pratique pour apprendre, parce qu'il ne demande d'attendre personne — et parce que
le niveau Facile ne cherche pas à te punir.</p>

<h2>Et les tirs au but ?</h2>

<p>La séance de tirs au but est un mode à part, jouable seule. Elle se joue soit
contre l'ordinateur, soit à deux sur le même écran. Elle sert aussi à départager
une rencontre terminée à égalité.</p>

<h2>Quel mode choisir</h2>

<ul>
  <li><strong>Vous êtes dans la même pièce</strong> : le mode local, sans hésiter.
      Rien à configurer, rien à créer.</li>
  <li><strong>Vous êtes à distance</strong> : le mode en ligne, avec le code. Prévois
      que vous soyez disponibles en même temps.</li>
  <li><strong>Tu es seul</strong> : l'ordinateur, ou le puzzle du jour.</li>
</ul>

<h2>Ce que les parties rapportent</h2>

<p>Quel que soit le mode, une partie terminée avec un compte connecté rapporte de
l'expérience et des pièces tactiques. Et pas seulement en cas de victoire :
<strong>une défaite rapporte aussi</strong>, moins qu'une victoire mais jamais
rien. Les défis du jour ajoutent un bonus par-dessus.</p>

<p>C'est un choix volontaire : perdre une partie serrée à deux ne doit pas donner
l'impression d'avoir perdu son temps. Les pièces gagnées servent à débloquer des
habillages de terrain et à étoffer sa collection de joueurs.</p>

<h2>Faut-il un compte ?</h2>

<p>Pour jouer en local ou contre l'ordinateur, non : le jeu se lance directement,
sans inscription. Le compte devient nécessaire pour le mode en ligne, et utile
partout ailleurs, puisque c'est lui qui conserve la progression, les pièces et
la collection d'un appareil à l'autre.</p>

<p>Sans compte, tu peux jouer autant que tu veux — tu repars simplement de zéro à
chaque appareil.</p>
`;

export const DAMES_ET_FOOTBALL = `
<p>Tactic Master a l'apparence d'un jeu de football et la mécanique d'un jeu
abstrait. Ce n'est pas un accident de conception : c'est le point de départ. Voici
ce que ce choix implique, et ce qu'il coûte.</p>

<h2>Le football sans le hasard</h2>

<p>La plupart des jeux de société inspirés du football cherchent à simuler
l'incertitude du sport réel : un dé pour un tir, une carte pour un tacle, une
statistique pour un joueur. L'idée se défend — le football réel est incertain.</p>

<p>Tactic Master prend le parti inverse. <strong>Aucun dé, aucune carte, aucun
tirage.</strong> Deux joueurs qui jouent les mêmes coups obtiennent exactement le
même résultat. Si tu perds, ce n'est jamais parce que le jeu en a décidé ainsi.</p>

<p>C'est un déplacement du plaisir : on ne joue pas pour voir ce qui va se passer,
on joue pour comprendre ce qui est déjà en train de se passer. Le même plaisir
qu'aux dames ou aux échecs, avec le vocabulaire du football.</p>

<h2>Pourquoi les dames plutôt que les échecs</h2>

<p>Aux échecs, chaque pièce a ses propres règles de déplacement. Il faut les
apprendre avant de pouvoir jouer, ce qui est une barrière réelle.</p>

<p>Aux dames, tous les pions sont identiques et se déplacent pareil. La règle tient
en une phrase, et la profondeur vient entièrement de la <em>position</em>, pas de
la mémorisation.</p>

<p>C'est ce modèle qui a été retenu. Tous les pions de champ sont interchangeables
et se déplacent d'une case dans n'importe quelle direction. Un joueur peut
commencer une partie trente secondes après avoir découvert le jeu.</p>

<h2>Le renoncement principal : pas de capture</h2>

<p>C'est la décision la plus lourde de conséquences, et celle qui surprend le plus.
Aux dames, l'objectif est de prendre les pièces adverses. Ici, <strong>on ne prend
jamais rien</strong> : aucun pion ne quitte jamais le terrain.</p>

<p>Cela pose un problème évident. Si les pions ne peuvent pas être éliminés et si
seuls les buts comptent, à quoi servent les pions adverses ? Sans réponse à cette
question, le jeu se réduirait à une course au ballon, et la défense n'existerait
pas.</p>

<p>La réponse est double :</p>

<ul>
  <li>Un pion <strong>bloque physiquement</strong> les trajectoires : le ballon
      s'arrête au premier pion rencontré, quel que soit son camp.</li>
  <li>Un pion de champ <strong>couvre les quatre cases orthogonalement
      adjacentes</strong> : une passe adverse ne peut ni s'y arrêter, ni les
      traverser.</li>
</ul>

<p>Autrement dit, on ne détruit pas l'adversaire : on lui prend de l'espace. Défendre
consiste à réduire le nombre de trajectoires disponibles, jusqu'à ce qu'il n'en
reste plus aucune vers la cage.</p>

<h2>Pourquoi la couverture est orthogonale et pas diagonale</h2>

<p>Ce détail décide de la respirabilité du jeu tout entier.</p>

<p>Si un pion couvrait aussi ses diagonales, il contrôlerait huit cases au lieu de
quatre. Sur un plateau de sept cases de large, six pions par camp suffiraient à
saturer l'espace, et plus aucune passe longue ne passerait. Le jeu se figerait.</p>

<p>En limitant la couverture aux quatre directions droites, <strong>les diagonales
restent ouvertes</strong>. Elles deviennent l'espace d'expression tactique : les
lignes que la défense ne peut pas fermer par simple présence, et où se jouent la
plupart des actions décisives.</p>

<h2>Le ballon dont on choisit la course</h2>

<p>Dernier parti pris, moins visible mais essentiel : quand tu pousses le ballon,
tu choisis où il s'arrête sur la trajectoire. Il aurait été plus simple de le
faire filer jusqu'au premier obstacle.</p>

<p>Ce choix crée toute la tension du jeu. Envoyer le ballon loin, c'est progresser
mais l'abandonner ; le garder court, c'est le contrôler sans avancer. Chaque passe
est un arbitrage entre le terrain gagné et le contrôle conservé. C'est de là que
vient la sensation de football, bien plus que du vocabulaire.</p>

<h2>Ce que le jeu n'essaie pas d'être</h2>

<p>Il n'y a ni hors-jeu, ni fautes, ni cartons, ni fatigue, ni météo. Ajouter ces
éléments rendrait le jeu plus ressemblant et beaucoup moins jouable.</p>

<p>Le pari est que la sensation de football ne vient pas de l'exhaustivité de la
simulation, mais d'une poignée de gestes justes : ouvrir un angle, tenir une ligne,
doser une passe. Le reste est du décor — assumé comme tel.</p>

<h2>Le problème que pose un jeu sans hasard</h2>

<p>Retirer le hasard a un coût rarement mentionné : <strong>le meilleur joueur gagne
toujours</strong>. Aux dames comme aux échecs, un débutant face à un joueur
expérimenté ne gagne jamais par accident. Il n'y a pas de mauvais dé pour égaliser
les chances.</p>

<p>C'est pour ça que le jeu propose trois paliers de règles plutôt qu'un seul.
Le palier Découverte désactive la couverture défensive : les passes traversent
tout, et l'on apprend le déplacement et le dosage sans se faire punir par une règle
qu'on n'a pas encore comprise. Le palier Classique la réactive. Le palier Expert
ajoute les centres depuis l'aile et le point de penalty.</p>

<p>La progression ne passe donc pas par la puissance des pièces, mais par la
quantité de règles en jeu. Un joueur ne devient pas plus fort parce qu'il a
débloqué quelque chose : il devient plus fort parce qu'il voit plus de choses sur
le plateau.</p>

<h2>Cinq minutes, et pourquoi c'est un choix</h2>

<p>Une partie dure environ cinq minutes. Ce n'est pas une limite technique, c'est un
paramètre : le nombre de buts à atteindre se règle avant de jouer.</p>

<p>Le format court change la nature des erreurs. Sur une partie d'une heure, une
faute se rattrape. Sur cinq minutes, une passe mal dosée coûte souvent la
rencontre — et c'est précisément ce qui pousse à rejouer immédiatement plutôt qu'à
refermer l'onglet. La revanche est à portée de clic, ce qu'un jeu de plateau
physique ne peut pas offrir.</p>

<h2>Ce qui reste ouvert</h2>

<p>Le jeu n'est pas figé. La règle de couverture, les centres et le point de penalty
sont arrivés après coup, en réponse à un défaut constaté : sans eux, les parties se
résumaient à une course au ballon, et la position ne comptait pas assez.</p>

<p>C'est le propre d'un jeu abstrait : chaque règle ajoutée doit gagner sa place en
supprimant un problème réel, pas en ajoutant du contenu. Une règle qui rendrait le
jeu plus riche mais moins lisible ne vaudrait pas la peine.</p>
`;
