// Page de référence : /regles. Contenu vérifié ligne à ligne dans
// public/src/engine/gameEngine.js, constants.js et powers.js (2026-08-04).
// Toute modification du moteur qui touche une règle doit repasser ici.
//
// Distinction avec /blog/regles-du-jeu : l'article est une initiation lisible
// en cinq minutes ; cette page est la référence exhaustive, cas limites inclus.

export const REGLES = `
<p class="page-lead">Tactic Master se joue comme les dames et se gagne comme un
match de football : on déplace un pion d'une case, on pousse le ballon en ligne
droite, on marque dans la cage adverse. Aucun dé, aucune carte, aucun réflexe.
Cette page est la référence complète — le déroulement d'un tour, les cas limites,
les trois paliers de règles et les cinq pouvoirs.</p>

<p>Pour une première partie, la <a href="/blog/regles-du-jeu">version courte des
règles</a> suffit largement. Revenez ici quand une situation précise pose
question.</p>

<h2>Le plateau</h2>

<p>Le terrain fait <strong>7 colonnes sur 9 lignes</strong>, soit 63 cases. Il est
volontairement plus étroit qu'un damier : avec six pions par équipe, un plateau
plus grand donnerait des parties molles où personne ne se croise.</p>

<p>Chaque camp défend une <strong>cage de trois cases</strong> : les trois cases
centrales de sa ligne de fond (colonnes 3, 4 et 5). L'équipe bleue occupe le bas
du terrain et attaque vers le haut ; l'équipe rouge fait l'inverse. Les deux
moitiés sont des miroirs exacts l'une de l'autre — aucune équipe ne bénéficie
d'un avantage de position.</p>

<p>Le <strong>ballon démarre au centre</strong>, ligne 5, colonne 4. Les bleus
engagent.</p>

<h3>La position de départ</h3>

<p>En numérotant les lignes de 1 (fond rouge) à 9 (fond bleu) et les colonnes de
1 à 7 de gauche à droite :</p>

<div class="table-scroll">
<table class="rules-board">
  <caption>Formation standard au coup d'envoi. G = gardien, D = défenseur,
  A = attaquant, ● = ballon.</caption>
  <thead>
    <tr><th scope="col">Ligne</th><th scope="col">1</th><th scope="col">2</th>
        <th scope="col">3</th><th scope="col">4</th><th scope="col">5</th>
        <th scope="col">6</th><th scope="col">7</th></tr>
  </thead>
  <tbody>
    <tr><th scope="row">1</th><td></td><td></td><td class="cage">cage</td><td class="cage">G</td><td class="cage">cage</td><td></td><td></td></tr>
    <tr><th scope="row">2</th><td></td><td>D</td><td></td><td></td><td></td><td>D</td><td></td></tr>
    <tr><th scope="row">3</th><td></td><td>A</td><td></td><td>A</td><td></td><td>A</td><td></td></tr>
    <tr><th scope="row">4</th><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>
    <tr><th scope="row">5</th><td></td><td></td><td></td><td>●</td><td></td><td></td><td></td></tr>
    <tr><th scope="row">6</th><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>
    <tr><th scope="row">7</th><td></td><td>A</td><td></td><td>A</td><td></td><td>A</td><td></td></tr>
    <tr><th scope="row">8</th><td></td><td>D</td><td></td><td></td><td></td><td>D</td><td></td></tr>
    <tr><th scope="row">9</th><td></td><td></td><td class="cage">cage</td><td class="cage">G</td><td class="cage">cage</td><td></td><td></td></tr>
  </tbody>
</table>
</div>

<p>Les lignes 1 à 3 sont rouges, les lignes 7 à 9 sont bleues. Les trois lignes
du milieu sont vides : c'est l'espace où se joue la partie.</p>

<h2>Les pions</h2>

<p>Chaque équipe aligne <strong>six pions</strong> : un gardien, deux défenseurs
et trois attaquants. Ces appellations décrivent leur position de départ, pas
leurs capacités — un défenseur et un attaquant se déplacent exactement de la
même manière et peuvent tous deux marquer. Seul le gardien a des règles
propres.</p>

<p>La variante <strong>tactique</strong> ajoute deux pions par camp (un défenseur
et un attaquant), soit huit contre huit. Le terrain devient plus dense, les
lignes de passe plus difficiles à ouvrir, et les parties nettement plus
disputées. C'est la formation par défaut du palier Expert.</p>

<h3>Le gardien</h3>

<p>Le gardien obéit à deux règles particulières, et c'est tout :</p>

<ul>
  <li>Il ne se déplace que sur <strong>les trois cases de sa ligne de cage</strong>.
      Il glisse latéralement, jamais vers l'avant. Il ne quitte donc jamais sa
      ligne de fond de toute la partie.</li>
  <li>Il ne <strong>couvre aucune case</strong> (voir la couverture défensive
      plus bas). Il défend uniquement en occupant physiquement une case de sa
      cage.</li>
</ul>

<p>Cette seconde règle surprend, et elle est délibérée : si le gardien projetait
une zone d'interception comme les autres pions, il rendrait la cage
mathématiquement imprenable et le jeu n'aurait plus d'intérêt. Un gardien bouche
un trou de la cage — un seul, celui sur lequel il se tient.</p>

<h2>Le déroulement d'un tour</h2>

<p>Les bleus commencent, puis les équipes alternent. À son tour, un joueur
effectue <strong>une</strong> action, et une seule, parmi celles-ci :</p>

<ol>
  <li><strong>Déplacer un pion.</strong> Le tour s'arrête là — sauf si le pion
      arrive au contact du ballon, auquel cas une passe devient possible dans la
      foulée (elle reste facultative).</li>
  <li><strong>Pousser le ballon avec un pion déjà au contact.</strong> Sélectionner
      ce pion et cliquer une case de la trajectoire suffit : il n'est pas
      nécessaire de le déplacer d'abord.</li>
</ol>

<p>Autrement dit, un tour vaut soit un déplacement, soit une passe, soit un
déplacement <em>suivi</em> d'une passe quand le pion déplacé finit à côté du
ballon. Il n'est jamais possible de faire deux passes dans le même tour.</p>

<h2>Le déplacement</h2>

<p>Un pion se déplace d'<strong>une case dans les huit directions</strong> :
orthogonales et diagonales. La case d'arrivée doit être libre.</p>

<p>« Libre » veut dire vide de tout : ni pion allié, ni pion adverse,
<strong>ni ballon</strong>. On ne se déplace pas sur le ballon, on ne le
capture pas, on ne le porte pas. On vient se placer à côté de lui pour le
pousser.</p>

<p>Il n'existe <strong>aucune prise</strong> dans Tactic Master. Les pions ne se
mangent pas, ne se bloquent pas définitivement, ne sortent jamais du terrain.
Les seize (ou vingt) pions de la partie sont encore là au coup de sifflet
final.</p>

<h2>La passe</h2>

<p>Un pion <strong>adjacent au ballon</strong> — dans l'une des huit directions,
diagonales comprises — peut le pousser. Le ballon part alors en ligne droite dans
la direction choisie et glisse jusqu'au premier obstacle : un pion, quel que soit
son camp, ou le bord du terrain.</p>

<p>Point capital et souvent mal compris : <strong>chaque case libre de la
trajectoire est une destination valable</strong>. Le ballon ne file pas
obligatoirement jusqu'au bout. C'est le joueur qui décide où il s'arrête. Une
poussée d'une seule case est un coup parfaitement légal, et souvent le meilleur.</p>

<p>Le ballon ne traverse jamais un pion. C'est la raison pour laquelle un pion
adverse bien placé vaut un mur : il n'a pas besoin d'intercepter quoi que ce
soit, il suffit qu'il soit sur la ligne.</p>

<h2>La couverture défensive</h2>

<p>C'est la mécanique qui transforme le jeu en jeu tactique, et la seule dont la
compréhension demande un peu d'attention.</p>

<p>Une case est <strong>couverte</strong> par une équipe si un pion de champ de
cette équipe occupe une case <strong>orthogonalement adjacente</strong> :
directement au-dessus, en dessous, à gauche ou à droite. Une passe adverse ne
peut ni s'arrêter sur une case couverte, ni la traverser.</p>

<p>Trois précisions décident de beaucoup de parties :</p>

<ul>
  <li>La couverture est <strong>strictement orthogonale</strong>. Les quatre
      cases en diagonale d'un pion ne sont pas couvertes. Une défense qui semble
      hermétique de face est presque toujours perméable en biais — c'est
      l'espace d'expression tactique du jeu.</li>
  <li>Le <strong>gardien ne couvre rien</strong>, comme indiqué plus haut.</li>
  <li>La couverture n'appartient qu'à l'adversaire : vos propres pions ne gênent
      jamais vos passes par leur couverture. Ils les arrêtent seulement s'ils se
      trouvent physiquement sur la trajectoire.</li>
</ul>

<p>Conséquence pratique : on ne défend pas en courant derrière le ballon, on
défend en plaçant des pions sur les axes que l'adversaire veut emprunter.</p>

<h2>Les deux cases spéciales</h2>

<h3>Le centre depuis une aile</h3>

<p>Quand le ballon se trouve sur une <strong>colonne de bord</strong> (la 1 ou la
7), la passe qui en part <strong>ignore complètement la couverture adverse</strong>.
C'est le « centre » du jeu : le contre direct d'une défense massée dans l'axe.
Si le milieu est verrouillé, l'élargissement paie.</p>

<h3>Le point de penalty</h3>

<p>Le point de penalty est la <strong>case centrale située à deux lignes de la
cage adverse</strong> : ligne 3 colonne 4 pour les bleus, ligne 7 colonne 4 pour
les rouges. Un tir parti de cette case vers la cage bénéficie de deux effets :</p>

<ul>
  <li>il <strong>ignore la couverture</strong> adverse ;</li>
  <li>il <strong>transperce un défenseur de champ</strong> — un seul, et jamais
      le gardien, ni l'un de vos propres pions.</li>
</ul>

<p>Amener le ballon jusque-là coûte en général deux ou trois tours de
construction. C'est exactement l'intention : le jeu récompense la préparation,
pas le coup de chance.</p>

<h2>La une-deux</h2>

<p>Après une passe, si le ballon s'immobilise <strong>orthogonalement adjacent à
l'un de vos pions de champ</strong>, votre équipe rejoue immédiatement — mais
seulement un <strong>déplacement</strong>, jamais une seconde passe.</p>

<p>Le bonus n'est pas cumulable : une une-deux ne peut pas en déclencher une
autre, et elle ne se combine ni avec le pouvoir Relais ni avec un mouvement
bonus déjà en cours. C'est un tempo gagné, pas une machine à enchaînements.</p>

<p>Bien utilisée, cette règle change la façon de passer : viser une case
soutenue par un coéquipier vaut souvent mieux que gagner deux cases de terrain.</p>

<h2>Marquer</h2>

<p>Un but est marqué dès que le ballon s'arrête sur <strong>l'une des trois cases
de la cage adverse</strong>. Rien d'autre n'est requis : ni distance minimale, ni
nombre de passes, ni pion présent dans la surface.</p>

<p>Après un but, la partie repart comme au coup d'envoi : <strong>ballon au
centre et tous les pions à leur position de départ</strong>. C'est
<strong>l'équipe qui vient d'encaisser qui engage</strong>.</p>

<p>La première équipe à <strong>trois buts</strong> gagne le match (valeur par
défaut ; certains modes courts la modifient).</p>

<h2>Fin de partie, match nul et départage</h2>

<p>Dans les formats à durée limitée, la partie s'arrête au terme d'un nombre de
tours fixé à l'avance. Si les scores sont alors à égalité, le match est
<strong>nul</strong> et se départage par une <strong>séance de tirs au but</strong>,
un mode arcade distinct où interviennent la visée et la puissance.</p>

<p>En partie libre, il n'y a pas de limite de tours : on joue jusqu'au troisième
but.</p>

<h2>L'anti-blocage</h2>

<p>Deux joueurs prudents peuvent en théorie repositionner leurs pions
indéfiniment sans jamais toucher au ballon. Le moteur tranche : après
<strong>huit tours consécutifs sans la moindre passe</strong> — quatre par camp —
le ballon est remis au centre en engagement neutre, si la case centrale est
libre. Les pions, eux, ne bougent pas.</p>

<p>Le seuil est volontairement élevé. Il ne se déclenche jamais dans une partie
qui avance, seulement dans une vraie impasse.</p>

<h2>Les trois paliers de règles</h2>

<p>Quatre mécaniques de passe sont activables indépendamment. Plutôt que de
laisser chacun composer, le jeu propose trois paliers cohérents :</p>

<div class="table-scroll">
<table class="rules-table">
  <thead>
    <tr><th scope="col">Palier</th><th scope="col">Couverture</th>
        <th scope="col">Une-deux</th><th scope="col">Centres depuis l'aile</th>
        <th scope="col">Point de penalty</th><th scope="col">Formation</th>
        <th scope="col">Pouvoirs</th></tr>
  </thead>
  <tbody>
    <tr><th scope="row">Découverte</th><td>non</td><td>non</td><td>non</td><td>non</td><td>6 pions</td><td>non</td></tr>
    <tr><th scope="row">Classique</th><td>oui</td><td>oui</td><td>non</td><td>non</td><td>6 pions</td><td>oui</td></tr>
    <tr><th scope="row">Expert</th><td>oui</td><td>oui</td><td>oui</td><td>oui</td><td>8 pions</td><td>oui</td></tr>
  </tbody>
</table>
</div>

<p>Le palier <strong>Classique</strong> est celui par défaut. En
<strong>Découverte</strong>, aucune passe n'est jamais interceptée : le ballon ne
s'arrête que contre un pion ou un bord, ce qui rend le jeu immédiatement
compréhensible pour un enfant ou un premier essai. En <strong>Expert</strong>,
les quatre mécaniques sont actives sur un plateau à huit pions.</p>

<p>Les options avancées permettent d'activer ou de désactiver chaque mécanique
individuellement, par-dessus le palier choisi.</p>

<h2>Les pouvoirs</h2>

<p>Quand les joueurs à pouvoirs sont activés, un pion de champ tiré au sort dans
chaque équipe reçoit une capacité, <strong>utilisable une seule fois par
match</strong>. Après usage, il redevient un pion strictement ordinaire.</p>

<div class="table-scroll">
<table class="rules-table">
  <thead>
    <tr><th scope="col">Pouvoir</th><th scope="col">Effet exact</th></tr>
  </thead>
  <tbody>
    <tr><th scope="row">Tir Puissant</th><td>Le ballon traverse le premier pion rencontré au lieu de s'arrêter contre lui.</td></tr>
    <tr><th scope="row">Sprint</th><td>Ce pion se déplace de deux cases en ligne droite au lieu d'une. Les deux cases du trajet doivent être libres — pas de saut.</td></tr>
    <tr><th scope="row">Mur</th><td>Pendant le tour adverse suivant, ce pion coupe aussi les passes diagonales qui contournent son coin — les seules trajectoires que la couverture ne ferme jamais.</td></tr>
    <tr><th scope="row">Relais</th><td>Après une passe, déplace immédiatement un second pion. Jamais une seconde passe.</td></tr>
    <tr><th scope="row">Repli adverse</th><td>Force un pion adverse de champ à reculer d'une case vers son propre camp. Sans effet sur les gardiens.</td></tr>
  </tbody>
</table>
</div>

<p>Le guide détaillé, avec le bon moment pour déclencher chacun, est dans
l'article <a href="/blog/les-cinq-pouvoirs">Les cinq pouvoirs et quand les
utiliser</a>.</p>

<h2>Ce qui n'existe pas dans Tactic Master</h2>

<p>Une liste utile, parce que ces règles-là sont celles que les joueurs
cherchent instinctivement :</p>

<ul>
  <li><strong>Pas de capture</strong> : aucun pion ne sort du terrain.</li>
  <li><strong>Pas de hors-jeu</strong>, pas de faute, pas de carton, pas de corner
      ni de touche.</li>
  <li><strong>Pas de hasard</strong> : ni dé, ni carte, ni jet. Les deux joueurs
      voient tout, en permanence — information complète, comme aux échecs.</li>
  <li><strong>Pas de chronomètre</strong> : le jeu est au tour par tour, on
      réfléchit aussi longtemps qu'on veut.</li>
  <li><strong>Pas de pions aux déplacements différenciés</strong> : hormis le
      gardien, tous les pions bougent de la même façon.</li>
</ul>

<h2>Récapitulatif en dix lignes</h2>

<ol>
  <li>Plateau de 7 × 9 cases, cage de 3 cases au fond de chaque camp.</li>
  <li>Six pions par équipe : 1 gardien, 2 défenseurs, 3 attaquants.</li>
  <li>Les bleus engagent, ballon au centre.</li>
  <li>Un tour = un déplacement d'une case, dans les huit directions, sur une case libre.</li>
  <li>Un pion au contact du ballon peut le pousser en ligne droite ; on choisit la case d'arrêt.</li>
  <li>Le ballon s'arrête au premier pion ou au bord ; il ne traverse jamais.</li>
  <li>Une case orthogonalement voisine d'un pion de champ adverse est infranchissable pour votre passe.</li>
  <li>Un pion qui arrive au contact du ballon peut enchaîner par une passe dans le même tour.</li>
  <li>On marque en amenant le ballon sur une case de la cage adverse.</li>
  <li>Premier à trois buts.</li>
</ol>

<p>Les questions qui reviennent le plus souvent ont leur réponse dans la
<a href="/faq">FAQ</a>, et le vocabulaire du jeu est défini dans le
<a href="/glossaire">glossaire</a>.</p>
`;
