// ===================== CARTE-BILAN DE FIN DE MATCH (#211) =====================
// Dérive un récapitulatif de partie depuis l'état du moteur (fonction pure,
// sans DOM), du point de vue d'une équipe donnée. Sert à la fois à l'affichage
// de fin de match et, à terme, aux cartes de partage de résultat (#111) — la
// structure retournée est volontairement plate et réutilisable telle quelle.

import { TEAMS } from '../engine/constants.js';

/**
 * @param {object} state    état de partie (terminée) du moteur.
 * @param {string} povTeam  équipe du point de vue de laquelle on résume.
 * @returns {{result:'win'|'loss'|'draw', myGoals:number, oppGoals:number,
 *            bestMomentum:number, powersUsed:number, povTeam:string}}
 */
export function buildMatchSummary(state, povTeam) {
  const opp = povTeam === TEAMS.BLEU ? TEAMS.ROUGE : TEAMS.BLEU;
  const myGoals = state.score?.[povTeam] ?? 0;
  const oppGoals = state.score?.[opp] ?? 0;

  let result;
  if (state.isDraw || myGoals === oppGoals) result = 'draw';
  else result = myGoals > oppGoals ? 'win' : 'loss';

  const bestMomentum = (state.bestPassStreak && state.bestPassStreak[povTeam]) || 0;
  const powersUsed = (state.tokens || []).filter(t => t.team === povTeam && t.powerUsed).length;

  return { result, myGoals, oppGoals, bestMomentum, powersUsed, povTeam };
}
