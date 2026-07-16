// ===================== PUZZLES DU JOUR (#210) =====================
// Positions prédéfinies à résoudre : « marque en ≤ N coups ». Le même puzzle
// est proposé à tous un jour donné (sélection déterministe par date), ce qui en
// fait une boucle de retour courte et partageable, distincte du replay (#106)
// et des défis quotidiens (orientés progression).
//
// Chaque puzzle embarque sa `solution` (suite de coups au format applyMove) :
// elle documente une résolution garantie et sert de test de non-régression
// (voir tests/puzzles.test.js). La condition de victoire est vérifiée par le
// moteur pur (un but marqué par l'équipe du solveur), jamais par l'UI.
//
// Les puzzles utilisent le palier « decouverte » (poussée pure, sans couverture
// ni cases spéciales) pour rester limpides et garantis solubles à la main.

import { TEAMS } from './constants.js';

export const PUZZLES = Object.freeze([
  {
    id: 'premier-tir',
    title: 'Premier tir',
    hint: 'Le ballon est déjà à ta portée : pousse-le au fond.',
    ruleset: 'decouverte',
    maxMoves: 1,
    turn: TEAMS.BLEU,
    ball: { row: 2, col: 3 },
    tokens: [
      { id: 'b-a', team: TEAMS.BLEU, row: 3, col: 3, isGK: false },
      { id: 'b-gk', team: TEAMS.BLEU, row: 8, col: 3, isGK: true },
      { id: 'r-gk', team: TEAMS.ROUGE, row: 0, col: 1, isGK: true }
    ],
    solution: [
      { type: 'pass', tokenId: 'b-a', passTo: [0, 3] }
    ]
  },
  {
    id: 'rapproche-et-marque',
    title: 'Rapproche puis marque',
    hint: 'Amène d’abord ton pion contre le ballon, puis pousse.',
    ruleset: 'decouverte',
    maxMoves: 2,
    turn: TEAMS.BLEU,
    ball: { row: 2, col: 3 },
    tokens: [
      { id: 'b-a', team: TEAMS.BLEU, row: 4, col: 3, isGK: false },
      { id: 'b-gk', team: TEAMS.BLEU, row: 8, col: 3, isGK: true },
      { id: 'r-gk', team: TEAMS.ROUGE, row: 0, col: 1, isGK: true }
    ],
    solution: [
      { type: 'move', tokenId: 'b-a', to: [3, 3] },
      { type: 'pass', tokenId: 'b-a', passTo: [0, 3] }
    ]
  },
  {
    id: 'contourne-le-gardien',
    title: 'Contourne le gardien',
    hint: 'Le gardien tient l’axe : vise un coin de la cage.',
    ruleset: 'decouverte',
    maxMoves: 1,
    turn: TEAMS.BLEU,
    ball: { row: 2, col: 2 },
    tokens: [
      { id: 'b-a', team: TEAMS.BLEU, row: 3, col: 2, isGK: false },
      { id: 'b-gk', team: TEAMS.BLEU, row: 8, col: 3, isGK: true },
      { id: 'r-gk', team: TEAMS.ROUGE, row: 0, col: 3, isGK: true } // pile dans l'axe central
    ],
    solution: [
      { type: 'pass', tokenId: 'b-a', passTo: [0, 2] }
    ]
  }
]);

// Sélection déterministe du puzzle du jour à partir d'une date (même puzzle
// pour tous ce jour-là). Accepte une Date ou une chaîne 'YYYY-MM-DD'.
export function getDailyPuzzleIndex(date = new Date(), count = PUZZLES.length) {
  const d = (typeof date === 'string') ? date : date.toISOString().slice(0, 10);
  let h = 0;
  for (let i = 0; i < d.length; i++) h = (h * 31 + d.charCodeAt(i)) >>> 0;
  return h % count;
}

export function getDailyPuzzle(date = new Date()) {
  return PUZZLES[getDailyPuzzleIndex(date, PUZZLES.length)];
}

// Vrai si l'équipe du solveur a marqué (le puzzle démarre 0-0, à 1 but pour
// gagner) : la condition de victoire est donc « score de l'équipe qui joue >= 1 ».
export function isPuzzleSolved(state, puzzle) {
  return (state.score?.[puzzle.turn] ?? 0) >= 1;
}
