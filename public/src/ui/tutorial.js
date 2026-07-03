// ===================== TUTORIEL GUIDÉ =====================
// Pilote une mini-partie scriptée sur le vrai plateau de jeu, avec des
// bulles contextuelles qui mettent en valeur l'élément concerné à chaque
// étape. Ne réimplémente aucune règle : utilise le moteur de jeu réel
// (src/engine/gameEngine.js), juste avec une formation et des objectifs
// simplifiés pour que chaque étape soit garantie réalisable en un geste.
//
// Principe de progression : certaines étapes avancent sur clic du bouton
// "Suivant" (étapes d'explication pure), d'autres n'avancent que lorsque le
// joueur a fait le bon geste sur le plateau (étapes d'action) — c'est ce qui
// rend l'apprentissage actif plutôt que simplement lu.

export const TUTORIAL_STEPS = [
  {
    id: 'intro',
    text: 'Bienvenue ! Voici le plateau. Les bleus sont en bas, les rouges en haut, le ballon est au centre. Le but : pousser le ballon dans la cage adverse.',
    target: '.board-wrap',
    advanceOn: 'next'
  },
  {
    id: 'select-pawn',
    text: 'Pour commencer, touche un de tes attaquants bleus (la ligne juste sous le centre) pour le sélectionner.',
    target: '[data-token-id="b-att1"]',
    advanceOn: 'select-token',
    validTokenIds: ['b-att0', 'b-att1', 'b-att2']
  },
  {
    id: 'move-pawn',
    text: 'Les points gris montrent où il peut aller. Clique sur la case juste au-dessus du ballon pour t\'en approcher.',
    target: null, // mis en valeur dynamiquement sur la case cible une fois calculée
    advanceOn: 'move-to',
    expectedDestination: 'adjacent-to-ball'
  },
  {
    id: 'explain-pass',
    text: 'Tu touches le ballon ! Les anneaux orange montrent où tu peux le pousser, en ligne droite. Clique sur le ballon ou une case pour le pousser tout droit vers le haut.',
    target: '.ball',
    advanceOn: 'pass-ball'
  },
  {
    id: 'goal',
    text: 'Continue à pousser le ballon vers la cage rouge pour marquer ton premier but !',
    target: null,
    advanceOn: 'goal-scored'
  },
  {
    id: 'progress-xp',
    text: 'Te voici dans « Mon profil ». Chaque partie rapporte de l\'XP — victoire ou défaite. Tu montes de niveau, et les paliers offrent de vrais cadeaux : un joueur Rare au niveau 5, un Légendaire au niveau 10. Niveau, XP, série et victoires : tout se lit ici.',
    target: '.progress-summary',
    fallbackTarget: '#panelProgress',
    spotlightShape: 'rect',
    view: 'profile-progress',
    advanceOn: 'next'
  },
  {
    id: 'daily-challenges',
    text: 'L\'onglet « Défis du jour » : 3 défis quotidiens — gagner une partie, marquer des buts… Chaque défi complété rapporte +15 pièces, et ta série de connexion grimpe, sans jamais te punir si tu rates un jour.',
    target: '#challengesList',
    fallbackTarget: '#panelChallenges',
    spotlightShape: 'rect',
    view: 'profile-challenges',
    advanceOn: 'next'
  },
  {
    id: 'team',
    text: 'L\'onglet « Mon équipe » : glisse tes joueurs de la collection vers les 6 postes pour composer ta formation. Tu peux créer un joueur personnalisé (1 gratuit !), et les joueurs Rares/Légendaires portent un pouvoir spécial utilisable une fois par partie.',
    target: '#lineupSlots',
    fallbackTarget: '#panelTeam',
    spotlightShape: 'rect',
    view: 'profile-team',
    advanceOn: 'next'
  },
  {
    id: 'coins',
    text: 'Et voici la boutique ! Ton solde de pièces tactiques ⬤ s\'affiche en haut : tu en gagnes à CHAQUE partie (+10 victoire, +3 défaite, +15 par défi). Elles débloquent les « kits du jour ». Pressé ? Des packs de pièces existent aussi.',
    target: '#coinDisplay',
    fallbackTarget: '#shopBtn',
    view: 'shop',
    advanceOn: 'next'
  },
  {
    id: 'shop',
    text: 'Fais défiler pour tout voir : kits de terrain, packs de joueurs à pouvoirs, Pass Saison, Pack Fondateurs. Tout est cosmétique ou optionnel — on peut très bien gagner sans dépenser un centime.',
    target: '#shopGrid',
    fallbackTarget: '#shopScreen',
    spotlightShape: 'rect',
    view: 'shop',
    advanceOn: 'next'
  },
  {
    id: 'outro',
    text: 'Et voilà, tu sais tout ! Pousse le ballon, surveille ton adversaire, marque le premier. Prêt pour une vraie partie ?',
    target: null,
    view: 'board',
    advanceOn: 'finish'
  }
];

export function createTutorialController() {
  let currentStepIndex = 0;
  let active = false;

  return {
    start() {
      active = true;
      currentStepIndex = 0;
      return TUTORIAL_STEPS[0];
    },
    stop() {
      active = false;
    },
    isActive() {
      return active;
    },
    currentStep() {
      return TUTORIAL_STEPS[currentStepIndex];
    },
    isLastStep() {
      return currentStepIndex === TUTORIAL_STEPS.length - 1;
    },
    advance() {
      if (currentStepIndex < TUTORIAL_STEPS.length - 1) {
        currentStepIndex += 1;
      }
      return TUTORIAL_STEPS[currentStepIndex];
    },
    progressLabel() {
      return `Étape ${currentStepIndex + 1}/${TUTORIAL_STEPS.length}`;
    }
  };
}
