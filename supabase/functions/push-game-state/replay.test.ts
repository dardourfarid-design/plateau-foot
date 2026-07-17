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
  const res = replayActions(s0, firstLegalMoveActions(s0), 'bleu');
  assert(!('error' in res), 'le journal légal ne doit pas être rejeté');
  assert(res.state !== s0, 'le rejeu doit produire un nouvel état');
  assert(res.state.turn === 'rouge' || res.state.phase === PHASES.MOVED_CAN_PASS);
});

Deno.test('téléportation rejetée (destination hors coups légaux)', () => {
  const s0 = start();
  const move = listLegalMoves(s0).find((m: { type: string }) => m.type === 'move');
  const res = replayActions(s0, [
    { fn: 'selectToken', args: [move.tokenId] },
    { fn: 'moveSelectedToken', args: [0, 3] }
  ], 'bleu');
  assEq(res.error, 'coup illégal : moveSelectedToken');
});

Deno.test('jouer hors de son tour rejeté', () => {
  const s0 = start(); // au trait : bleu
  assEq(replayActions(s0, firstLegalMoveActions(s0), 'rouge').error, 'ce n’est pas ton tour');
});

Deno.test('action hors liste blanche rejetée', () => {
  assEq(replayActions(start(), [{ fn: 'registerGoal', args: ['bleu'] }], 'bleu').error,
    'action inconnue : registerGoal');
});

Deno.test('journal vide, flood et partie terminée rejetés', () => {
  assEq(replayActions(start(), [], 'bleu').error, 'journal d’actions vide');
  const flood = Array.from({ length: MAX_ACTIONS_PER_PUSH + 1 }, () => ({ fn: 'deselect', args: [] as [] }));
  assEq(replayActions(start(), flood, 'bleu').error, 'journal d’actions trop long');
  assEq(replayActions({ ...start(), gameOver: true }, [{ fn: 'deselect', args: [] }], 'bleu').error,
    'la partie est terminée');
});
