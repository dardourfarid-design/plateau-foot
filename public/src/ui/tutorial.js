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
    id: 'outro',
    text: 'Et voilà, tu sais tout ! Pousse le ballon, surveille ton adversaire, marque le premier. Prêt pour une vraie partie ?',
    target: null,
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
