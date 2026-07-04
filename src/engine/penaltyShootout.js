// ===================== SEANCE DE TIRS AU BUT =====================
// Mini-jeu de depart des egalites (mode "mort subite" ou fin de match nul).
// Chaque tir oppose une direction choisie par le tireur a une direction
// choisie par le gardien : but si les deux different, arret sinon. Regles de
// foot classiques : 5 tirs chacun, clinch anticipe, puis mort subite par paires.
//
// Comme le moteur principal, toutes les fonctions sont pures : elles ne mutent
// jamais l'etat, elles en retournent un nouveau. Le tir au but comporte une
// part de "je te vois / tu me vois" (choix simultane cache) : c'est assume,
// un penalty EST par nature un duel de lecture, pas une position d'echecs.

import { TEAMS } from './constants.js';

export const SHOT_DIRECTIONS = Object.freeze(['gauche', 'centre', 'droite']);

/**
 * Cree une seance vierge. bestOf = nombre de tirs par equipe en temps
 * reglementaire (5 par defaut).
 */
export function createShootout(options = {}) {
  const bestOf = options.bestOf ?? 5;
  return Object.freeze({
    bestOf,
    taker: TEAMS.BLEU,                 // qui tire le prochain penalty
    score: { [TEAMS.BLEU]: 0, [TEAMS.ROUGE]: 0 },
    shotsTaken: { [TEAMS.BLEU]: 0, [TEAMS.ROUGE]: 0 },
    history: [],                       // { taker, shooterDir, keeperDir, scored }
    over: false,
    winner: null
  });
}

function other(team) {
  return team === TEAMS.BLEU ? TEAMS.ROUGE : TEAMS.BLEU;
}

/**
 * Determine si la seance est finie et qui a gagne, a partir des scores et du
 * nombre de tirs deja pris. Gere le clinch anticipe en temps reglementaire et
 * la mort subite par paires ensuite.
 */
function decide(state) {
  const b = state.score[TEAMS.BLEU];
  const r = state.score[TEAMS.ROUGE];
  const tb = state.shotsTaken[TEAMS.BLEU];
  const tr = state.shotsTaken[TEAMS.ROUGE];
  const remB = Math.max(0, state.bestOf - tb);
  const remR = Math.max(0, state.bestOf - tr);

  const inRegulation = tb < state.bestOf || tr < state.bestOf;
  if (inRegulation) {
    // Une equipe a gagne si son avance depasse ce qu'il reste a l'autre.
    if (b > r + remR) return { over: true, winner: TEAMS.BLEU };
    if (r > b + remB) return { over: true, winner: TEAMS.ROUGE };
    return { over: false, winner: null };
  }
  // Mort subite : decide seulement quand les deux ont tire le meme nombre de
  // fois et que les scores different.
  if (tb === tr && b !== r) {
    return { over: true, winner: b > r ? TEAMS.BLEU : TEAMS.ROUGE };
  }
  return { over: false, winner: null };
}

/**
 * Joue un penalty. shooterDir / keeperDir dans SHOT_DIRECTIONS. But si les deux
 * directions different. Retourne un nouvel etat (tour du tireur suivant, score
 * et fin de seance mis a jour).
 */
export function shoot(state, shooterDir, keeperDir) {
  if (state.over) return state;
  if (!SHOT_DIRECTIONS.includes(shooterDir) || !SHOT_DIRECTIONS.includes(keeperDir)) {
    return state;
  }

  const scored = shooterDir !== keeperDir;
  const taker = state.taker;

  const next = {
    ...state,
    score: { ...state.score, [taker]: state.score[taker] + (scored ? 1 : 0) },
    shotsTaken: { ...state.shotsTaken, [taker]: state.shotsTaken[taker] + 1 },
    history: [...state.history, { taker, shooterDir, keeperDir, scored }],
    taker: other(taker)
  };

  const verdict = decide(next);
  return Object.freeze({ ...next, over: verdict.over, winner: verdict.winner });
}

export function isShootoutOver(state) {
  return state.over;
}

export function shootoutWinner(state) {
  return state.winner;
}

/**
 * Choix aleatoire de direction (pour un gardien/tireur IA). rng injectable
 * pour les tests deterministes.
 */
export function randomDirection(rng = Math.random) {
  return SHOT_DIRECTIONS[Math.floor(rng() * SHOT_DIRECTIONS.length)];
}
