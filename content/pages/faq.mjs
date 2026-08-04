// Page /faq. Deux exports :
//   FAQ_GROUPS — la source de vérité (rubriques → questions/réponses) ;
//   FAQ        — le corps HTML, dérivé de FAQ_GROUPS.
// Le JSON-LD FAQPage de la page est construit à partir de FAQ_GROUPS par
// tools/build-pages.mjs : impossible qu'une question visible manque au balisage,
// ou l'inverse — la divergence entre les deux est l'erreur classique du genre.
//
// Réponses vérifiées dans public/src/engine/ (2026-08-04).

export const FAQ_GROUPS = [
  {
    title: 'Découvrir le jeu',
    items: [
      {
        q: 'Qu\'est-ce que Tactic Master ?',
        a: `Un jeu de plateau de football au tour par tour, jouable gratuitement
        dans le navigateur. On déplace ses pions d'une case comme aux dames et on
        pousse un ballon jusqu'à la cage adverse. Une partie dure environ cinq
        minutes.`
      },
      {
        q: 'Le jeu est-il vraiment gratuit ?',
        a: `Oui. L'intégralité des règles, des modes de jeu et des niveaux de
        difficulté est accessible sans payer. Une boutique optionnelle propose des
        thèmes de terrain et des packs de joueurs à collectionner : ce sont des
        éléments purement cosmétiques, qui ne donnent aucun avantage en match.`
      },
      {
        q: 'Faut-il créer un compte pour jouer ?',
        a: `Non. Les modes locaux — solo contre l'ordinateur, deux joueurs sur le
        même appareil, puzzle du jour, tirs au but — se lancent sans inscription.
        Un compte devient nécessaire pour le multijoueur en ligne, la boutique, la
        gestion de son équipe et la liste d'amis.`
      },
      {
        q: 'Faut-il installer quelque chose ?',
        a: `Non. Le jeu s'ouvre dans le navigateur, sur ordinateur comme sur
        mobile. Il peut être ajouté à l'écran d'accueil via « Ajouter à l'écran
        d'accueil » sur iOS et Android : c'est une application web (PWA), et non
        un téléchargement depuis une boutique d'applications.`
      },
      {
        q: 'Peut-on jouer hors connexion ?',
        a: `Oui pour les modes locaux, une fois la page chargée ou installée en
        PWA. Le multijoueur en ligne, lui, demande évidemment une connexion.`
      },
      {
        q: 'À partir de quel âge peut-on y jouer ?',
        a: `Le palier de règles « Découverte » se comprend dès sept ou huit ans :
        on déplace un pion, on pousse le ballon, on marque, sans aucune règle
        d'interception. Les paliers Classique et Expert ajoutent la profondeur
        tactique qui intéresse les adultes.`
      },
      {
        q: 'Combien de temps dure une partie ?',
        a: `Environ cinq minutes en configuration standard, où la victoire revient
        à la première équipe à trois buts. Les formats à nombre de tours limité
        sont plus courts encore.`
      }
    ]
  },
  {
    title: 'Les règles',
    items: [
      {
        q: 'Comment marque-t-on un but ?',
        a: `En amenant le ballon sur l'une des trois cases centrales de la ligne
        de fond adverse. Aucune autre condition : ni distance minimale, ni nombre
        de passes, ni pion présent près de la cage.`
      },
      {
        q: 'Peut-on capturer les pions adverses ?',
        a: `Jamais. C'est la différence de fond avec les dames. Aucun pion ne sort
        du terrain de toute la partie : les pions adverses se contournent, ils ne
        s'éliminent pas.`
      },
      {
        q: 'Le ballon peut-il traverser un pion ?',
        a: `Non. Une passe s'arrête au premier pion rencontré, allié ou adverse.
        Deux exceptions : le pouvoir Tir Puissant, qui traverse le premier pion,
        et un tir parti du point de penalty, qui transperce un défenseur de champ
        — jamais un gardien.`
      },
      {
        q: 'Suis-je obligé d\'envoyer le ballon le plus loin possible ?',
        a: `Non, et c'est l'erreur de débutant la plus fréquente. Chaque case libre
        de la trajectoire est une destination valable : c'est vous qui choisissez
        où le ballon s'arrête. Une poussée d'une seule case est un coup légal, et
        souvent le meilleur, parce qu'elle laisse le ballon sous votre contrôle.`
      },
      {
        q: 'Un pion déjà collé au ballon peut-il le pousser sans se déplacer ?',
        a: `Oui. Sélectionnez-le, puis cliquez la case d'arrivée souhaitée : la
        passe part directement, sans déplacement préalable. Un pion qui arrive au
        contact du ballon après un déplacement peut lui aussi enchaîner par une
        passe dans le même tour.`
      },
      {
        q: 'Peut-on déplacer un pion sur la case du ballon ?',
        a: `Non. La case du ballon compte comme occupée : on ne marche pas dessus,
        on ne porte pas le ballon. On se place à côté pour le pousser.`
      },
      {
        q: 'Qu\'est-ce que la couverture défensive ?',
        a: `Une case est couverte par une équipe si un pion de champ de cette
        équipe se trouve directement au-dessus, en dessous, à gauche ou à droite.
        Une passe adverse ne peut ni s'arrêter sur une case couverte ni la
        traverser. La couverture est strictement orthogonale : les diagonales
        restent ouvertes.`
      },
      {
        q: 'Le gardien couvre-t-il les cases autour de lui ?',
        a: `Non, et c'est délibéré. Le gardien est le seul pion qui ne couvre
        aucune case. S'il projetait une zone d'interception, la cage deviendrait
        imprenable. Il défend en occupant physiquement une case de sa cage — une
        seule à la fois.`
      },
      {
        q: 'Le gardien peut-il sortir de sa cage ?',
        a: `Non. Il glisse latéralement sur les trois cases de sa ligne de but et
        ne la quitte jamais de toute la partie.`
      },
      {
        q: 'Y a-t-il un hors-jeu ?',
        a: `Non. Pas de hors-jeu, pas de faute, pas de carton, pas de corner ni de
        touche. Le ballon ne sort jamais du terrain : il s'arrête contre le bord.`
      },
      {
        q: 'Que se passe-t-il après un but ?',
        a: `Le ballon revient au centre et tous les pions retrouvent leur position
        de départ. C'est l'équipe qui vient d'encaisser qui engage.`
      },
      {
        q: 'Combien de buts faut-il pour gagner ?',
        a: `Trois en configuration standard. Les formats courts s'arrêtent au bout
        d'un nombre de tours fixé à l'avance, et le score décide alors du
        vainqueur.`
      },
      {
        q: 'Que se passe-t-il en cas d\'égalité ?',
        a: `Dans un format à durée limitée, une égalité au terme des tours donne
        un match nul, départagé par une séance de tirs au but — un mode arcade
        distinct, avec visée et jauge de puissance.`
      },
      {
        q: 'Et si plus personne ne touche le ballon ?',
        a: `Après huit tours consécutifs sans la moindre passe, soit quatre par
        camp, le ballon est automatiquement remis au centre en engagement neutre
        si la case centrale est libre. Les pions, eux, ne bougent pas. Le seuil
        est assez élevé pour ne jamais se déclencher dans une partie qui avance.`
      },
      {
        q: 'Qu\'est-ce que la une-deux ?',
        a: `Si le ballon s'immobilise juste à côté — orthogonalement — d'un de vos
        pions de champ à l'issue de votre passe, votre équipe rejoue
        immédiatement un déplacement. Un seul, jamais une seconde passe, et sans
        cumul possible.`
      },
      {
        q: 'Qu\'est-ce que le point de penalty ?',
        a: `La case centrale située à deux lignes de la cage adverse. Un tir parti
        de là ignore la couverture et transperce un défenseur de champ, mais
        jamais le gardien. Cette règle n'est active qu'au palier Expert.`
      }
    ]
  },
  {
    title: 'Modes et difficulté',
    items: [
      {
        q: 'Quels modes de jeu existent ?',
        a: `Le solo contre l'ordinateur à trois niveaux, le deux joueurs sur un
        même appareil, le multijoueur en ligne par code de partie, le puzzle du
        jour et la séance de tirs au but.`
      },
      {
        q: 'Comment fonctionnent les trois niveaux de l\'ordinateur ?',
        a: `Le niveau Facile joue en grande partie au hasard et ne pousse jamais
        le ballon de plus de deux cases : il ne punit pas une erreur de débutant.
        Le niveau Moyen saisit toute occasion de but immédiate et privilégie les
        coups qui rapprochent le ballon de votre cage. Le niveau Difficile
        anticipe en plus votre meilleure réponse avant de choisir son coup, et
        déclenche ses pouvoirs quand ils rapportent.`
      },
      {
        q: 'Quelle différence entre les paliers Découverte, Classique et Expert ?',
        a: `Découverte désactive toute interception : les passes ne sont bloquées
        que par les pions eux-mêmes. Classique, le réglage par défaut, ajoute la
        couverture défensive et la une-deux. Expert active en plus les centres
        depuis les ailes et le point de penalty, sur une formation à huit pions
        par camp.`
      },
      {
        q: 'Peut-on personnaliser les règles ?',
        a: `Oui. Les options avancées permettent d'activer ou de désactiver
        individuellement la couverture, la une-deux, les centres et le point de
        penalty, par-dessus le palier choisi.`
      },
      {
        q: 'Comment jouer à deux ?',
        a: `Sur le même appareil, chacun joue à son tour sur le même écran. À
        distance, l'un crée une partie en ligne et transmet le code à l'autre.`
      },
      {
        q: 'Qu\'est-ce que le puzzle du jour ?',
        a: `Une position prédéfinie à résoudre en un nombre de coups donné, la
        même pour tout le monde un jour donné. Les puzzles utilisent le palier
        Découverte, ce qui les rend limpides et garantit qu'une solution existe.`
      }
    ]
  },
  {
    title: 'Compte, boutique et données',
    items: [
      {
        q: 'Que peut-on acheter dans la boutique ?',
        a: `Des thèmes de terrain et des packs de joueurs à collectionner,
        strictement cosmétiques. Aucun achat ne modifie les règles ni ne procure
        d'avantage en match.`
      },
      {
        q: 'Comment supprimer mon compte et mes données ?',
        a: `Depuis votre compte, les entrées « Exporter mes données » et
        « Supprimer mon compte » permettent respectivement d'obtenir une copie de
        vos données et de tout effacer. Le détail des traitements figure dans la
        <a href="/privacy">politique de confidentialité</a>.`
      },
      {
        q: 'Le jeu affiche-t-il des publicités ?',
        a: `Aucun script publicitaire n'est chargé tant que vous n'y avez pas
        consenti explicitement, et le consentement se retire à tout moment depuis
        « Gérer mes préférences de données ».`
      }
    ]
  },
  {
    title: 'Problèmes et contact',
    items: [
      {
        q: 'Sur quels navigateurs le jeu fonctionne-t-il ?',
        a: `Sur les versions récentes de Chrome, Firefox, Edge et Safari, sur
        ordinateur comme sur mobile. Le jeu n'utilise aucun plugin.`
      },
      {
        q: 'La page ne se met pas à jour, ou un affichage semble figé.',
        a: `Le jeu conserve une copie locale de ses fichiers pour fonctionner hors
        connexion, ce qui peut retarder l'apparition d'une nouveauté. Rechargez la
        page en forçant le rafraîchissement (Ctrl+F5, ou Cmd+Shift+R sur Mac).`
      },
      {
        q: 'J\'ai trouvé un bug, ou j\'ai une suggestion.',
        a: `Les deux sont bienvenus : la page <a href="/contact">contact</a>
        indique comment les signaler, par courriel ou directement sur le dépôt
        public du projet.`
      }
    ]
  }
];

const escapeHtml = s => String(s).replace(/&(?!amp;|lt;|gt;|quot;|#)/g, '&amp;');

// Les réponses sont écrites sur plusieurs lignes pour rester lisibles dans le
// source ; on normalise les espaces pour que le HTML produit ne charrie pas
// l'indentation du fichier.
export const squash = s => escapeHtml(s).replace(/\s+/g, ' ').trim();

export const FAQ = `
<p class="page-lead">Les questions qui reviennent le plus souvent sur Tactic
Master : la prise en main, les règles et leurs cas limites, les modes de jeu, le
compte et les données. Pour la référence exhaustive des règles, voir la page
<a href="/regles">règles complètes</a>.</p>
${FAQ_GROUPS.map(g => `
<h2>${g.title}</h2>
${g.items.map(it => `
<h3>${squash(it.q)}</h3>
<p>${squash(it.a)}</p>`).join('')}`).join('\n')}

<h2>Une question qui n'est pas ici ?</h2>

<p>Écrivez-nous : la page <a href="/contact">contact</a> donne les deux moyens de
joindre l'équipe. Les questions récurrentes finissent par rejoindre cette page.</p>
`;
