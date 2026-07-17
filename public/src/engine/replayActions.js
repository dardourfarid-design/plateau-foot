// ===================== REJEU D'ACTIONS EN LIGNE (#260) =====================
// Cœur de la validation serveur des coups du multijoueur : rejoue un journal
// d'actions client sur l'état AUTORITAIRE (celui stocké en base), avec les
// mêmes fonctions pures du moteur que le client. Le résultat du rejeu — jamais
// l'état envoyé par un navigateur — est ce qui est persisté.
//
// Ce module est volontairement portable (aucune API navigateur, aucun import
// de service) : il est importé par l'Edge Function Deno
// supabase/functions/push-game-state/ ET par les tests unitaires Node. Il ne
// fait PAS partie du bundle client (ni modulepreload ni précache sw.js).
//
// Sûreté intrinsèque : les fonctions du moteur retournent l'état INCHANGÉ
// (même référence) sur toute entrée illégale. Un journal truqué ne peut donc
// produire qu'un état légal — et le rejet strict des no-ops ci-dessous
// transforme toute tentative en erreur explicite plutôt qu'en silence.

import {
  selectToken, moveSelectedToken, passBall, passTurn, deselect, resetBallAfterGoal
} from './gameEngine.js';

// Seules primitives atteignables dans une partie en ligne (créée via
// createGame({ goalsToWin: 3 }) : pas de pouvoirs, pas de limite de tours).
// `needsTurn` : l'action n'est valable que si c'est le tour de l'appelant.
// resetBallAfterGoal fait exception : après un but, les DEUX clients ferment
// leur overlay « BUT ! » et poussent la remise en jeu (idempotente).
const HANDLERS = Object.freeze({
  selectToken:        { fn: selectToken,        arity: 1, needsTurn: true },
  moveSelectedToken:  { fn: moveSelectedToken,  arity: 2, needsTurn: true },
  passBall:           { fn: passBall,           arity: 2, needsTurn: true },
  passTurn:           { fn: passTurn,           arity: 0, needsTurn: true },
  deselect:           { fn: deselect,           arity: 0, needsTurn: true },
  resetBallAfterGoal: { fn: resetBallAfterGoal, arity: 0, needsTurn: false }
});

// Un tour ne génère qu'une poignée d'actions (select/move/passe/fin + une-deux) ;
// la marge couvre plusieurs tours accumulés hors-ligne bref, jamais un flood.
export const MAX_ACTIONS_PER_PUSH = 24;

// Actions dont le no-op est bénin (déjà fait / état déjà conforme), à ne pas
// traiter comme une tentative de triche.
const BENIGN_NOOPS = new Set(['deselect', 'resetBallAfterGoal']);

/**
 * Rejoue `actions` (journal [{ fn, args }]) depuis `startState` pour l'équipe
 * `team` ('bleu' | 'rouge').
 * @returns {{ state: object } | { error: string }}
 */
export function replayActions(startState, actions, team) {
  if (!startState || typeof startState !== 'object') return { error: 'état de départ absent' };
  if (team !== 'bleu' && team !== 'rouge') return { error: 'équipe inconnue' };
  if (!Array.isArray(actions) || actions.length === 0) return { error: 'journal d’actions vide' };
  if (actions.length > MAX_ACTIONS_PER_PUSH) return { error: 'journal d’actions trop long' };

  let state = startState;
  for (const action of actions) {
    const spec = action && HANDLERS[action.fn];
    if (!spec) return { error: `action inconnue : ${action && action.fn}` };

    const args = Array.isArray(action.args) ? action.args : [];
    if (args.length !== spec.arity || !args.every(a => typeof a === 'number' || typeof a === 'string')) {
      return { error: `arguments invalides pour ${action.fn}` };
    }

    if (state.gameOver) return { error: 'la partie est terminée' };
    if (spec.needsTurn && state.turn !== team) return { error: 'ce n’est pas ton tour' };

    const next = spec.fn(state, ...args);
    if (next === state && !BENIGN_NOOPS.has(action.fn)) {
      // Le moteur a refusé le coup (destination hors liste, mauvaise phase…).
      return { error: `coup illégal : ${action.fn}` };
    }
    state = next;
  }
  return { state };
}
