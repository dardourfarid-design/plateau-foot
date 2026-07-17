// ===================== DICTIONNAIRE ANGLAIS =====================
// Table Français -> Anglais. La clé est le texte français exact (tel qu'il
// apparaît dans le HTML ou dans les appels t('...') du JS). Une entrée absente
// se rabat automatiquement sur le français (voir i18n.js).
//
// Import à effet de bord : `import './i18n-en.js'` suffit à peupler le
// dictionnaire au chargement.

import { registerMessages } from './i18n.js';

registerMessages({
  // --- Topbar / global ---
  'Non connecté': 'Not signed in',
  'Mon profil': 'My profile',
  '👑 Fondateur': '👑 Founder',
  'Membre Fondateur — merci de ton soutien de la première heure': 'Founder member — thank you for your early support',
  'Boutique': 'Shop',
  'Solde de pièces tactiques': 'Tactical coins balance',

  // --- Accueil / hero ---
  'SAISON 01 — ÉDITION TACTIQUE': 'SEASON 01 — TACTICAL EDITION',
  'Le foot se joue aussi assis': 'Football, sitting down too',
  'Plateau': 'Board',
  'Pions / équipe': 'Pieces / team',
  '5min': '5min',
  'Partie': 'Match',
  'Caractéristiques du jeu': 'Game features',
  'Jouer maintenant': 'Play now',
  'Jouer': 'Play',
  'Personnaliser la partie': 'Customize the match',
  '🧩 Puzzle du jour': '🧩 Daily puzzle',
  '⚽ Tirs au but': '⚽ Penalty shootout',
  'Ambiance': 'Vibe',
  'Adversaire': 'Opponent',
  'Compte gratuit. Excuses en option.': 'Free account. Excuses optional.',
  'Pas de compte = pas de gloire': 'No account, no glory',
  'Puzzle du jour : neuf chaque matin': 'Daily puzzle: fresh every morning',
  'Nouveau maillot, même maladresse': 'New kit, same clumsy finish',
  'Pass Saison : l’XP en heures sup': 'Season Pass: XP overtime',
  'Joueurs à pouvoirs : triche légale': 'Players with powers: legal cheating',
  // « Le foot se joue aussi assis » (dernier panneau) est déjà traduit plus haut
  // avec le slogan de l'accueil : une 2e clé identique écraserait la première.
  'Ordinateur': 'Computer',
  'Toi': 'You',
  'Joueur 1': 'Player 1',
  'Joueur 2': 'Player 2',
  '{who} tire — choisis ton coin': '{who} is shooting — pick your corner',
  '{who} : à toi de plonger !': '{who}: your turn to dive!',
  'Rouge tire — devine le coin et plonge !': 'Red is shooting — guess the corner and dive!',
  'Au tour de Rouge': "Red's turn",
  'Égalité — départage aux tirs au but': 'Draw — decided by a penalty shootout',
  '{title} — {hint} (coups restants : {n})': '{title} — {hint} (moves left: {n})',
  '🎉 Puzzle résolu en {n} coup(s) !': '🎉 Puzzle solved in {n} move(s)!',
  'Raté — le puzzle recommence, réessaie !': 'Missed — the puzzle restarts, try again!',
  'Meilleure action (passes)': 'Best play (passes)',
  'Pouvoirs utilisés': 'Powers used',
  'Options avancées': 'Advanced options',
  'Conseils en jeu': 'In-game tips',
  'Sons & vibrations': 'Sound & vibration',
  'Une‑deux ! Déplace un pion pour ton mouvement bonus': 'One-two! Move a piece for your bonus move',
  'Relais ! Déplace un second pion': 'Relay! Move a second piece',
  'Comment jouer ? Lancer le tutoriel guidé →': 'How to play? Start the guided tutorial →',

  // --- Cartes de modes du hero (M11 #253) ---
  'Autres modes de jeu': 'Other game modes',
  'Tirs au but': 'Penalty shootout',
  'Duel de penaltys': 'Penalty duel',
  'Mode, règles, IA': 'Mode, rules, AI',
  'Puzzle du jour': 'Daily puzzle',
  'Le défi quotidien': 'The daily challenge',

  // --- Overlay Règles & FAQ (M11 #252) — libellés propres à l'overlay ---
  'Règles & FAQ': 'Rules & FAQ',
  'Toutes les règles & FAQ →': 'All the rules & FAQ →',

  // --- Section éditoriale (.seo-about, #181), clonée dans l'overlay FAQ ---
  // Clés normalisées (espaces simples : lookupEn tolère les retours à la
  // ligne et espaces insécables du HTML). Le <strong> découpe le paragraphe
  // d'intro en 3 nœuds texte, d'où les 3 fragments.
  'Tactic Master, le jeu de plateau de foot en ligne': 'Tactic Master, the online football board game',
  'Tactic Master est un': 'Tactic Master is a',
  'jeu de plateau de foot': 'football board game',
  "gratuit, jouable directement dans le navigateur. La prise en main est aussi simple que les dames : chaque tour, on déplace un pion d'une case, on pousse le ballon en ligne droite, et on marque en l'envoyant dans la cage adverse. Aucun dé, aucun hasard : comme aux échecs ou aux dames, tout se joue au placement et à l'anticipation. Une partie dure environ cinq minutes.":
    'that is free and playable right in the browser. It picks up as easily as checkers: each turn, move a piece one square, push the ball in a straight line, and score by sending it into the opposing goal. No dice, no luck: as in chess or checkers, everything comes down to placement and anticipation. A match lasts about five minutes.',
  'Les règles en bref': 'The rules in brief',
  'Plateau de 7×9 cases ; 6 pions par équipe (1 gardien, 2 défenseurs, 3 attaquants).':
    'A 7×9 board; 6 pieces per team (1 goalkeeper, 2 defenders, 3 forwards).',
  "À son tour : déplacer un pion d'une case, dans n'importe quelle direction.":
    'On your turn: move one piece one square, in any direction.',
  "Un pion adjacent au ballon peut le pousser en ligne droite, jusqu'au premier obstacle.":
    'A piece next to the ball can push it in a straight line, up to the first obstacle.',
  'Le gardien ne se déplace que latéralement, sur sa ligne de cage.':
    'The goalkeeper only moves sideways, along its goal line.',
  'Pas de capture : la partie se gagne aux buts, et la défense compte — un pion couvre les cases voisines et coupe les lignes de passe adverses.':
    'No captures: matches are won on goals, and defense matters — a piece covers the neighbouring squares and cuts opposing passing lanes.',
  'Questions fréquentes': 'Frequently asked questions',
  'Tactic Master est-il gratuit ?': 'Is Tactic Master free?',
  'Oui. Le jeu se joue gratuitement dans le navigateur, sans installation. Une boutique optionnelle propose des thèmes de terrain et des packs de joueurs à collectionner.':
    'Yes. The game is free to play in the browser, with nothing to install. An optional shop offers pitch themes and collectible player packs.',
  'Peut-on jouer à deux ?': 'Can two people play?',
  "Oui : face à face sur le même appareil, ou en ligne en partageant un code de partie. Un mode contre l'ordinateur à trois niveaux de difficulté est aussi disponible.":
    'Yes: face to face on the same device, or online by sharing a match code. A mode against the computer with three difficulty levels is also available.',
  'Comment marque-t-on un but ?': 'How do you score a goal?',
  "En poussant le ballon dans la cage adverse, c'est-à-dire les trois cases centrales de la ligne de fond. Le ballon se pousse en ligne droite avec un pion adjacent et s'arrête au premier obstacle.":
    'By pushing the ball into the opposing goal — the three central squares of the back line. The ball is pushed in a straight line by an adjacent piece and stops at the first obstacle.',
  'Peut-on installer Tactic Master sur mobile ?': 'Can Tactic Master be installed on mobile?',
  "Oui. C'est une application web (PWA) : ouvrez le site dans votre navigateur puis « Ajouter à l'écran d'accueil » sur iOS ou Android. Les modes locaux fonctionnent même hors connexion.":
    'Yes. It is a web app (PWA): open the site in your browser, then "Add to Home Screen" on iOS or Android. Local modes even work offline.',
  'TERRAIN OFFICIEL · 7×9': 'OFFICIAL PITCH · 7×9',
  'Stratégie pure': 'Pure strategy',
  "Un pion, une case, dans n'importe quelle direction. 6 joueurs par équipe, un ballon à pousser.":
    'One piece, one square, in any direction. 6 players per team, one ball to push.',
  'Deux joueurs, un écran': 'Two players, one screen',
  "Face à face sur le même appareil, en ligne par code, ou contre l'ordinateur en 3 niveaux.":
    'Head to head on the same device, online by code, or against the computer on 3 levels.',
  'Joueurs à pouvoirs': 'Players with powers',
  'Rares et légendaires : Sprint, Tir Puissant, Mur, Relais, Repli adverse. À collecter et aligner.':
    'Rare and legendary: Sprint, Power Shot, Wall, Relay, Push Back. Collect them and line them up.',

  // --- Config partie ---
  '← Retour': '← Back',
  'Mode de jeu': 'Game mode',
  '2 joueurs': '2 players',
  'vs IA': 'vs AI',
  'En ligne': 'Online',
  'Niveau IA': 'AI level',
  'Facile': 'Easy',
  'Moyen': 'Medium',
  'Difficile': 'Hard',
  'Style de jeu': 'Play style',
  'Classique · 6': 'Classic · 6',
  'Tactique · 8': 'Tactical · 8',
  'Pouvoirs bonus': 'Bonus powers',
  'Activés': 'On',
  'Désactivés': 'Off',
  'Buts pour gagner': 'Goals to win',
  'Lancer la partie': 'Start the match',
  'Créer une partie': 'Create a match',
  'ou': 'or',
  'Rejoindre avec un code': 'Join with a code',
  'Rejoindre': 'Join',
  'EX: A1B2C3': 'EX: A1B2C3',
  'Partie créée — invite un ami': 'Match created — invite a friend',
  'Partage ce code. La partie démarre dès que ton adversaire le saisit.':
    'Share this code. The match starts as soon as your opponent enters it.',

  // --- Écran de jeu ---
  'Annuler': 'Cancel',
  'Bleu': 'Blue',
  'Rouge': 'Red',
  'Au tour de bleu': "Blue's turn",
  'Au tour de rouge': "Red's turn",
  'Choisis un pion à déplacer': 'Pick a piece to move',
  'Annuler le coup': 'Undo move',
  'Utiliser le pouvoir': 'Use power',
  'Terminer le tour': 'End turn',
  'Nouvelle partie': 'New match',
  'Choisis un pion adverse': 'Pick an opponent piece',
  "Le pouvoir Repli adverse va le faire reculer d'une case.":
    'The Push Back power will move it back one square.',
  'Feuille de match': 'Match sheet',
  'Score': 'Score',
  'Au tour de': 'Turn:',
  'Rappel des règles': 'Rules reminder',
  "Déplace un pion d'une case, dans n'importe quelle direction.":
    'Move a piece one square, in any direction.',
  'Adjacent au ballon ? Pousse-le en ligne droite aussi loin que tu veux.':
    'Next to the ball? Push it in a straight line as far as you like.',
  'Le gardien glisse uniquement sur sa ligne de cage.':
    'The keeper only slides along its goal line.',
  'Premier arrivé au nombre de buts fixé gagne la partie.':
    'First to reach the target number of goals wins the match.',
  'Résultats de la partie': 'Match results',

  // --- Boutique ---
  'Boutique de thèmes': 'Theme shop',
  "Change l'ambiance du terrain. Un thème acheté reste débloqué pour toujours.":
    'Change the pitch mood. A purchased theme stays unlocked forever.',
  'Édition limitée': 'Limited edition',
  "5 nouveaux thèmes aux couleurs du grand tournoi — l'ambiance des stades, sur ton plateau.":
    '5 new themes in the colors of the big tournament — stadium vibes on your board.',

  // --- Profil ---
  'Progression, défis du jour, équipe et classement.':
    'Progress, daily challenges, team and leaderboard.',
  'Progression': 'Progress',
  'Défis du jour': 'Daily challenges',
  'Mon équipe': 'My team',
  'Amis & Mercato': 'Friends & Transfers',
  'Classement': 'Leaderboard',
  'Niveau': 'Level',
  'XP': 'XP',
  'Jours de suite': 'Day streak',
  'Victoires': 'Wins',
  'Joue une première partie pour démarrer ta progression.':
    'Play your first match to start your progress.',
  'Glisse un joueur de ta collection sur un poste pour composer ton équipe.':
    'Drag a player from your collection onto a slot to build your team.',
  'Enregistrer la composition': 'Save line-up',
  'Ma collection': 'My collection',
  '+ Créer un joueur': '+ Create a player',
  'Joueurs à pouvoir (boutique)': 'Players with powers (shop)',
  'Joueurs rares et légendaires avec un pouvoir spécial — obtenables aussi gratuitement en progressant (niveau 5 et 10).':
    'Rare and legendary players with a special power — also earnable for free as you progress (levels 5 and 10).',

  // --- Créer un joueur ---
  'Créer un joueur': 'Create a player',
  'Nom du joueur': 'Player name',
  'Style': 'Style',
  'Rapide': 'Fast',
  'Costaud': 'Strong',
  'Technique': 'Technical',
  'Polyvalent': 'All-round',
  'Couleur': 'Color',
  'Motif': 'Pattern',
  'Uni': 'Plain',
  'Rayures': 'Stripes',
  'Mi-mi': 'Half-half',
  'Pois': 'Dots',
  'Accessoire': 'Accessory',
  'Aucun': 'None',
  'Bandeau': 'Headband',
  'Étoile': 'Star',
  'Éclair': 'Bolt',
  'Créer ce joueur': 'Create this player',
  'Fermer': 'Close',

  // --- Amis & mercato ---
  'Ajouter un ami': 'Add a friend',
  'Ajouter': 'Add',
  'Pseudo exact de ton ami': "Your friend's exact username",
  "Copier mon lien d'invitation": 'Copy my invite link',
  'Demandes reçues': 'Requests received',
  'Demandes envoyées': 'Requests sent',
  'Mes amis': 'My friends',
  "Offres d'échange reçues": 'Trade offers received',
  'Mes offres envoyées': 'My offers sent',
  'Proposer un échange': 'Propose a trade',
  'Tu proposes': 'You offer',
  'Tu demandes': 'You request',
  "Envoyer l'offre": 'Send the offer',
  'Joueur': 'Player',

  // --- Tutoriel / overlays ---
  'Étape 1/6': 'Step 1/6',
  'Passer le tutoriel': 'Skip the tutorial',
  'Suivant →': 'Next →',
  'GOAL': 'GOAL',
  'BUT !': 'GOAL!',
  "L'équipe bleue marque": 'The blue team scores',
  "L'équipe rouge marque": 'The red team scores',
  'Continuer': 'Continue',
  'VICTOIRE': 'VICTORY',
  '← Accueil': '← Home',
  'Rejouer': 'Play again',

  // --- Compte / auth ---
  'Connexion': 'Sign in',
  'Le jeu est jouable sans compte. Crée un compte pour la boutique, ton équipe, les amis et le multijoueur.':
    'The game is playable without an account. Create one for the shop, your team, friends and multiplayer.',
  "J'accepte que mon usage du jeu soit analysé pour améliorer le produit (optionnel)":
    'I agree that my use of the game may be analyzed to improve the product (optional)',
  "J'accepte de recevoir des emails sur les nouveautés et offres (optionnel)":
    'I agree to receive emails about news and offers (optional)',
  "J'accepte que mes données soient partagées avec des partenaires sélectionnés (optionnel)":
    'I agree that my data may be shared with selected partners (optional)',
  'Lire la politique de confidentialité': 'Read the privacy policy',
  'Se connecter': 'Sign in',
  'Mot de passe oublié ?': 'Forgot password?',
  'Pas encore de compte ? Créer un compte': "No account yet? Create one",
  'Mot de passe oublié': 'Forgot password',
  "Indique ton email, on t'envoie un lien pour choisir un nouveau mot de passe.":
    "Enter your email and we'll send you a link to choose a new password.",
  'Envoyer le lien': 'Send the link',
  'Retour à la connexion': 'Back to sign in',
  'Mon compte': 'My account',
  'Gérer mes préférences de données': 'Manage my data preferences',
  'Exporter mes données': 'Export my data',
  'Supprimer mon compte': 'Delete my account',
  'Se déconnecter': 'Sign out',
  'Pseudo': 'Username',
  'Email': 'Email',
  'Mot de passe': 'Password'
});

// --- Chaînes dynamiques (JS) : jeu, overlays, auth, données, pouvoirs ---
registerMessages({
  'Partie terminée': 'Game over',
  "L'ordinateur réfléchit…": 'The computer is thinking…',
  'En attente du coup de ton adversaire…': "Waiting for your opponent's move…",
  'Clique une case pour bouger, ou directement le ballon pour le pousser':
    'Click a square to move, or the ball directly to push it',
  'Touche un de tes pions pour le jouer': 'Tap one of your pieces to play it',
  'Tu touches le ballon : pousse-le, ou clique « Terminer le tour »':
    'You are next to the ball: push it, or click “End turn”',
  'BLEU GAGNE': 'BLUE WINS',
  'ROUGE GAGNE': 'RED WINS',
  'Buts marqués': 'Goals scored',
  'Buts encaissés': 'Goals conceded',

  // Pouvoirs (libellés + messages)
  'Tir Puissant': 'Power Shot',
  'Sprint': 'Sprint',
  'Mur': 'Wall',
  'Relais': 'Relay',
  'Repli adverse': 'Push Back',
  'Utiliser : {power}': 'Use: {power}',
  '{power} : choisis une case.': '{power}: pick a square.',
  'Relais activé : pousse le ballon, tu pourras ensuite déplacer un second pion.':
    'Relay active: push the ball, then you can move a second piece.',

  // Célébrations de but
  'BUUUT !': 'GOOOAL!',
  'MAGNIFIQUE !': 'MAGNIFICENT!',
  'QUEL BUT !': 'WHAT A GOAL!',
  'GOLAZO !': 'GOLAZO!',
  'Frappe imparable': 'Unstoppable strike',
  'Le gardien battu': 'The keeper beaten',
  'En pleine lucarne': 'Top corner',
  'Ça fait mouche': 'Right on target',
  'Le public exulte': 'The crowd goes wild',
  '{who} — action à {n} passes !': '{who} — a {n}-pass move!',

  // Online / auth / données
  'Entre le code complet de la partie.': 'Enter the full match code.',
  'Email et mot de passe requis.': 'Email and password required.',
  "Compte créé ! Un email de confirmation t'a été envoyé — clique sur le lien qu'il contient puis connecte-toi (pense aux spams).":
    'Account created! A confirmation email has been sent — click the link inside, then sign in (check your spam).',
  'Indique ton email.': 'Enter your email.',
  "Si un compte existe avec cet email, un lien de réinitialisation vient d'être envoyé.":
    'If an account exists for this email, a reset link has just been sent.',
  'Export impossible pour le moment.': 'Export unavailable right now.',
  'Supprimer définitivement ton compte et toutes tes données (achats, parties, préférences) ? Cette action est irréversible.':
    'Permanently delete your account and all your data (purchases, matches, preferences)? This action cannot be undone.',
  'Supprimer définitivement': 'Delete permanently',
  'Tes données ont été supprimées.': 'Your data has been deleted.',
  'Suppression impossible pour le moment.': 'Deletion unavailable right now.',
  'Tes préférences ont été mises à jour.': 'Your preferences have been updated.',
  'Mise à jour impossible pour le moment.': 'Update unavailable right now.',
  'Aperçu — crée un compte (gratuit) pour suivre ta vraie progression.':
    'Preview — create a (free) account to track your real progress.',
  'Tutoriel terminé ! Configure ta première vraie partie.':
    'Tutorial complete! Set up your first real match.',

  // Toasts de paiement
  'Achat confirmé ! Ton nouveau contenu est débloqué.': 'Purchase confirmed! Your new content is unlocked.',
  'Pass Saison activé ! (quelques secondes de délai possibles)':
    'Season Pass activated! (a few seconds of delay possible)',
  "Achat annulé — aucun montant n'a été débité.": 'Purchase cancelled — you were not charged.'
});

// --- Tutoriel guidé ---
registerMessages({
  'Étape': 'Step',
  'Suivant →': 'Next →',
  'Lancer une vraie partie →': 'Start a real match →',
  'Bienvenue ! Voici le plateau. Les bleus sont en bas, les rouges en haut, le ballon est au centre. Le but : pousser le ballon dans la cage adverse.':
    'Welcome! Here is the board. Blue is at the bottom, red at the top, the ball is in the center. The goal: push the ball into the opponent\'s net.',
  'Pour commencer, touche un de tes attaquants bleus (la ligne juste sous le centre) pour le sélectionner.':
    'To start, tap one of your blue forwards (the row just below the center) to select it.',
  "Les points gris montrent où il peut aller. Clique sur la case juste au-dessus du ballon pour t'en approcher.":
    'The gray dots show where it can go. Click the square just above the ball to get closer to it.',
  'Tu touches le ballon ! Les anneaux orange montrent où tu peux le pousser, en ligne droite. Clique sur le ballon ou une case pour le pousser tout droit vers le haut.':
    'You are next to the ball! The orange rings show where you can push it, in a straight line. Click the ball or a square to push it straight up.',
  'Continue à pousser le ballon vers la cage rouge pour marquer ton premier but ! Le gardien rouge garde sa ligne : contourne-le en visant un côté de la cage.':
    'Keep pushing the ball toward the red net to score your first goal! The red keeper holds its line: get around it by aiming for a side of the net.',
  "Astuce de pro : un pion adverse « couvre » les cases juste à côté de lui (haut, bas, gauche, droite). Une passe ne peut ni s'y arrêter, ni les traverser. Pour percer, cherche les diagonales ou déplace tes pions pour ouvrir un couloir.":
    'Pro tip: an opponent piece “covers” the squares right next to it (up, down, left, right). A pass can neither stop on them nor cross them. To break through, look for diagonals or move your pieces to open a lane.',
  "Le une-deux : si ta passe arrive juste à côté d'un de tes pions (un appui), tu rejoues aussitôt un déplacement bonus ! Enchaîne les passes vers tes coéquipiers pour avancer plus vite.":
    'The one-two: if your pass lands right next to one of your pieces (a support), you immediately get a bonus move! Chain passes to your teammates to advance faster.',
  "Deux zones spéciales : les ailes (colonnes de bord) permettent un « centre » que la couverture n'arrête pas, et le point lumineux devant chaque cage est le point de penalty — de là, ton tir transperce un défenseur. Le gardien, lui, reste à battre.":
    'Two special zones: the wings (edge columns) allow a “cross” that coverage cannot stop, and the glowing dot in front of each net is the penalty spot — from there, your shot pierces one defender. The keeper still has to be beaten.',
  "Enfin, chaque partie te donne un pouvoir bonus tiré au sort sur un de tes pions (éclair, sprint, mur…), utilisable une fois. Les joueurs Rares et Légendaires du mercato en portent d'encore plus forts. Repère le badge doré !":
    'Finally, each match gives you a random bonus power on one of your pieces (bolt, sprint, wall…), usable once. Rare and Legendary transfer players carry even stronger ones. Look for the golden badge!',
  "Te voici dans « Mon profil ». Chaque partie rapporte de l'XP — victoire ou défaite. Tu montes de niveau, et les paliers offrent de vrais cadeaux : un joueur Rare au niveau 5, un Légendaire au niveau 10. Niveau, XP, série et victoires : tout se lit ici.":
    'Here you are in “My profile”. Every match earns XP — win or lose. You level up, and milestones give real gifts: a Rare player at level 5, a Legendary at level 10. Level, XP, streak and wins: it\'s all here.',
  "L'onglet « Défis du jour » : 3 défis quotidiens — gagner une partie, marquer des buts… Chaque défi complété rapporte +15 pièces, et ta série de connexion grimpe, sans jamais te punir si tu rates un jour.":
    'The “Daily challenges” tab: 3 daily challenges — win a match, score goals… Each completed challenge earns +15 coins, and your login streak grows, without ever punishing you if you miss a day.',
  "L'onglet « Mon équipe » : glisse tes joueurs de la collection vers les 6 postes pour composer ta formation. Tu peux créer un joueur personnalisé (1 gratuit !), et les joueurs Rares/Légendaires portent un pouvoir spécial utilisable une fois par partie.":
    'The “My team” tab: drag your players from the collection onto the 6 slots to build your line-up. You can create a custom player (1 free!), and Rare/Legendary players carry a special power usable once per match.',
  "Et voici la boutique ! Ton solde de pièces tactiques ⬤ s'affiche en haut : tu en gagnes à CHAQUE partie (+10 victoire, +3 défaite, +15 par défi). Elles débloquent les « kits du jour ». Pressé ? Des packs de pièces existent aussi.":
    'And here is the shop! Your tactical coins balance ⬤ shows at the top: you earn some in EVERY match (+10 win, +3 loss, +15 per challenge). They unlock the “daily kits”. In a hurry? Coin packs exist too.',
  'Fais défiler pour tout voir : kits de terrain, packs de joueurs à pouvoirs, Pass Saison, Pack Fondateurs. Tout est cosmétique ou optionnel — on peut très bien gagner sans dépenser un centime.':
    'Scroll to see everything: pitch kits, powered-player packs, Season Pass, Founders Pack. Everything is cosmetic or optional — you can absolutely win without spending a cent.',
  'Et voilà, tu sais tout ! Pousse le ballon, surveille ton adversaire, marque le premier. Prêt pour une vraie partie ?':
    'That\'s it, you know everything! Push the ball, watch your opponent, score first. Ready for a real match?'
});

// --- Boutique / Profil / Mercato (panneaux dynamiques) ---
registerMessages({
  // Boutique
  'ACCÈS ILLIMITÉ': 'UNLIMITED ACCESS',
  'Pass Saison S1': 'Season Pass S1',
  "KITS À L'UNITÉ": 'INDIVIDUAL KITS',
  'Kits': 'Kits',
  'PACKS': 'PACKS',
  'Packs': 'Packs',
  'Groupes de contenu — meilleur rapport qualité/prix.': 'Content bundles — best value for money.',
  'PIÈCES TACTIQUES': 'TACTICAL COINS',
  'Pièces': 'Coins',
  'Pack Fondateurs': 'Founders Pack',
  'Acheter': 'Buy',
  'Débloquer': 'Unlock',
  'Sélectionner': 'Select',
  'Pas assez de pièces': 'Not enough coins',
  '🎟 Utiliser 1 crédit': '🎟 Use 1 credit',
  'Achat impossible pour le moment.': 'Purchase unavailable right now.',
  '1 emplacement gratuit disponible.': '1 free slot available.',

  // Profil — progression / défis
  'Jours de suite': 'Day streak',
  'Jour de suite': 'Day streak',
  'Progression non chargée :': 'Progress not loaded:',
  "Aucun défi disponible aujourd'hui.": 'No challenges available today.',
  'Défis indisponibles pour le moment.': 'Challenges unavailable right now.',
  'Chargement…': 'Loading…',

  // Profil — équipe / collection / postes
  'Gardien': 'Goalkeeper',
  'Défenseur 1': 'Defender 1',
  'Défenseur 2': 'Defender 2',
  'Attaquant 1': 'Forward 1',
  'Attaquant 2': 'Forward 2',
  'Attaquant 3': 'Forward 3',
  'MIL': 'MID',
  'Aligné': 'Lined up',
  'PERSO': 'CUSTOM',
  'Glisse un joueur ici': 'Drag a player here',
  'Aucun joueur dans ta collection pour le moment.': 'No players in your collection yet.',
  'Les 6 postes sont déjà pourvus. Glisse ce joueur directement sur un poste pour remplacer son occupant, ou retire un joueur avec le ✕.':
    'All 6 slots are already filled. Drag this player straight onto a slot to replace its occupant, or remove a player with the ✕.',
  "Composition enregistrée ! Elle s'appliquera à ta prochaine partie.":
    'Line-up saved! It will apply to your next match.',
  "Impossible d'enregistrer la composition pour le moment.": 'Unable to save the line-up right now.',
  'Équipe indisponible pour le moment.': 'Team unavailable right now.',
  'Tu possèdes déjà tous les joueurs à pouvoir disponibles.': 'You already own all available powered players.',
  'Boutique indisponible pour le moment.': 'Shop unavailable right now.',
  'Aucun classement disponible pour le moment.': 'No leaderboard available right now.',

  // Profil — création de joueur
  'Donne un nom à ton joueur.': 'Give your player a name.',
  'Acheter un emplacement supplémentaire pour créer un joueur personnalisé (1,49€) ?':
    'Buy an extra slot to create a custom player (€1.49)?',
  'Limite gratuite atteinte. Achète un emplacement supplémentaire pour créer ce joueur.':
    'Free limit reached. Buy an extra slot to create this player.',
  'Emplacement débloqué ! Tu peux maintenant créer ce joueur.':
    'Slot unlocked! You can now create this player.',

  // Mercato / amis
  'Accepter': 'Accept',
  'Refuser': 'Decline',
  'Proposer un échange': 'Propose a trade',
  'Aucune demande en attente.': 'No pending requests.',
  'Aucune demande envoyée en attente.': 'No pending sent requests.',
  'Aucune offre reçue.': 'No offers received.',
  'Aucune offre envoyée.': 'No offers sent.',
  "Aucun ami pour le moment. Ajoute quelqu'un par son pseudo ci-dessus.":
    'No friends yet. Add someone by their username above.',
  'Amis indisponibles pour le moment.': 'Friends unavailable right now.',
  'Offres indisponibles pour le moment.': 'Offers unavailable right now.',
  "Cet ami n'a aucun joueur.": 'This friend has no players.',
  'Aucun joueur disponible.': 'No players available.',
  'Choisis un joueur de chaque côté.': 'Pick a player on each side.',
  "Offre envoyée ! Ton ami doit l'accepter pour que l'échange se fasse.":
    'Offer sent! Your friend must accept it for the trade to happen.',
  'Offre impossible pour le moment.': 'Offer unavailable right now.',
  "Lien copié ! Colle-le où tu veux pour inviter quelqu'un.":
    'Link copied! Paste it anywhere to invite someone.',
  'Impossible de copier le lien automatiquement.': 'Could not copy the link automatically.',

  // Noms de kits (français uniquement)
  'Classique': 'Classic',
  'Néon': 'Neon',
  'Tokyo Minuit': 'Tokyo Midnight',
  'Savane': 'Savanna',
  'Arctique': 'Arctic',
  'Volcan': 'Volcano',
  'Terre battue': 'Clay',
  'Crépuscule': 'Dusk',
  'Jungle': 'Jungle',
  'Nuit de stade': 'Stadium Night',
  'Rétro 8-bit': 'Retro 8-bit',
  'Or Mondial': 'World Gold',
  'Tricolore': 'Tricolor',
  'Nuit Américaine': 'American Night'
});

// --- Chaines interpolees / descriptions boutique ---
registerMessages({
  '🎯 {n} défi du jour à relever (+15 pièces chacun)': '🎯 {n} daily challenge to complete (+15 coins each)',
  '🎯 {n} défis du jour à relever (+15 pièces chacun)': '🎯 {n} daily challenges to complete (+15 coins each)',
  '🎯 Connecte-toi pour tes défis du jour (+15 pièces chacun)': '🎯 Sign in for your daily challenges (+15 coins each)',
  'Accès complet à tous les kits actuels + 1 joueur Légendaire exclusif "Fondateur" introuvable nulle part ailleurs + badge doré permanent sur ton profil + ton nom dans les crédits du jeu.': 'Full access to all current kits + 1 exclusive Legendary "Founder" player found nowhere else + a permanent golden badge on your profile + your name in the game credits.',
  'Tous les kits Saison 1 débloqués pendant l\'abonnement + 1 joueur Rare offert + bonus XP +20% sur chaque partie. Annulable à tout moment.': 'All Season 1 kits unlocked while subscribed + 1 free Rare player + a +20% XP bonus on every match. Cancellable at any time.',
});

// --- Séance de tirs au but ---
registerMessages({
  'Séance de tirs au but': 'Penalty shootout',
  '⚽ Séance de tirs au but': '⚽ Penalty shootout',
  '◀ Gauche': '◀ Left',
  'Centre': 'Center',
  'Droite ▶': 'Right ▶',
  'À toi de tirer : choisis un côté': 'Your shot: pick a side',
  'Arrête le tir : choisis où plonger': 'Save it: pick where to dive',
  'Tu gagnes la séance !': 'You win the shootout!',
  'Séance perdue…': 'Shootout lost…',
  'Arrêt !': 'Saved!',
});

// --- Départage / manche courte ---
registerMessages({
  'Format': 'Format',
  'Au score': 'By score',
  'Manche courte': 'Short match',
  'Départage aux tirs au but': 'Penalty shootout tiebreaker',
  'Bleu remporte le match !': 'Blue wins the match!',
  'Rouge remporte le match !': 'Red wins the match!',
});
