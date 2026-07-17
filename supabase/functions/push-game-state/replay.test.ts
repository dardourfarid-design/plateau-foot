// Tests Deno de la validation serveur des coups (#260). Ils portent sur le
// cœur PUR (replayActions + moteur, importés depuis public/src/engine/ — la
// même source que le client) : c'est ce rejeu qui décide de ce qui est
// persisté. Ils prouvent au passage que la chaîne moteur se résout bien sous
// Deno (prérequis du déploiement de l'Edge Function).
// Hermétique : pas d'accès réseau ni d'env (index.ts, lui, exige jsr + env).

import { assert, assEq } from '../rewarded-ssv/test-asserts.ts';
// @ts-ignore — modules JS purs du moteur, sans types publiés.
import { createGame, listLegalMoves, PHASES } from '../../../public/src/engine/gameEngine.js';
// @ts-ignore — idem.
import { replayActions, MAX_ACTIONS_PER_PUSH } from '../../../public/src/engine/replayActions.js';

type Action = { fn: string; args: (number | string)[] };
type ReplayResult = { state: { turn: string; phase: string } } | { error: string };

// Rétrécissement du type union pour les assertions d'erreur.
const errOf = (res: ReplayResult): string | undefined =>
  'error' in res ? res.error : undefined;

const start = () => createGame({ goalsToWin: 3 }); // mêmes options que onlineUI

function firstLegalMoveActions(state: unknown): Action[] {
  const move = listLegalMoves(state).find((m: { type: string }) => m.type === 'move');
  return [
    { fn: 'selectToken', args: [move.tokenId] },
    { fn: 'moveSelectedToken', args: [move.to[0], move.to[1]] }
  ];
}

Deno.test('un déplacement légal est rejoué (état différent, tour résolu)', () => {
  const s0 = start();
  const res: ReplayResult = replayActions(s0, firstLegalMoveActions(s0), 'bleu');
  assert(!('error' in res), 'le journal légal ne doit pas être rejeté');
  const state = (res as { state: { turn: string; phase: string } }).state;
  assert(state !== s0, 'le rejeu doit produire un nouvel état');
  assert(state.turn === 'rouge' || state.phase === PHASES.MOVED_CAN_PASS);
});

Deno.test('téléportation rejetée (destination hors coups légaux)', () => {
  const s0 = start();
  const move = listLegalMoves(s0).find((m: { type: string }) => m.type === 'move');
  const res = replayActions(s0, [
    { fn: 'selectToken', args: [move.tokenId] },
    { fn: 'moveSelectedToken', args: [0, 3] }
  ], 'bleu');
  assEq(errOf(res), 'coup illégal : moveSelectedToken');
});

Deno.test('jouer hors de son tour rejeté', () => {
  const s0 = start(); // au trait : bleu
  assEq(errOf(replayActions(s0, firstLegalMoveActions(s0), 'rouge')), 'ce n’est pas ton tour');
});

Deno.test('action hors liste blanche rejetée', () => {
  assEq(errOf(replayActions(start(), [{ fn: 'registerGoal', args: ['bleu'] }], 'bleu')),
    'action inconnue : registerGoal');
});

Deno.test('journal vide, flood et partie terminée rejetés', () => {
  assEq(errOf(replayActions(start(), [], 'bleu')), 'journal d’actions vide');
  const flood = Array.from({ length: MAX_ACTIONS_PER_PUSH + 1 }, () => ({ fn: 'deselect', args: [] as [] }));
  assEq(errOf(replayActions(start(), flood, 'bleu')), 'journal d’actions trop long');
  assEq(errOf(replayActions({ ...start(), gameOver: true }, [{ fn: 'deselect', args: [] }], 'bleu')),
    'la partie est terminée');
});
