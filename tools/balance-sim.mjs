// ===================== OUTIL D'EQUILIBRAGE (dev) =====================
// Simule des parties IA vs IA pour verifier que les regles v0.5 (couverture,
// une-deux, anti-blocage, variantes) laissent les buts possibles et que les
// parties se terminent (pas de stalemate). Repond au chantier "equilibrage"
// de docs/team/game-designer.md.
//
// Lancer :  node tools/balance-sim.mjs
//
// Ce n'est PAS un test unitaire (resultats stochastiques) : c'est un banc de
// mesure a relancer apres tout changement de regle pour garder un oeil sur le
// nombre de buts/partie et le taux de parties terminees.

import { createGame, applyMove } from '../public/src/engine/gameEngine.js';
import { chooseAiMove, AI_LEVELS } from '../public/src/engine/ai.js';

function playGame(variant, freePowers, maxTurns = 400) {
  let s = createGame({ goalsToWin: 3, variant, freePowers, rng: Math.random });
  let turns = 0, passes = 0, stalls = 0;
  while (!s.gameOver && turns < maxTurns) {
    const before = s;
    const move = chooseAiMove(s, AI_LEVELS.MOYEN);
    if (!move) break;
    s = applyMove(s, move);
    if (s.ball.row !== before.ball.row || s.ball.col !== before.ball.col) passes++;
    if (s.stalled) stalls++;
    turns++;
  }
  return { goals: s.score, turns, passes, stalls, over: s.gameOver };
}

const N = Number(process.argv[2] || 40);
console.log(`Simulation d'equilibrage v0.5 — ${N} parties par configuration\n`);
for (const [variant, fp] of [['standard', false], ['standard', true], ['tactique', false]]) {
  let totGoals = 0, totTurns = 0, finished = 0, totStalls = 0;
  for (let i = 0; i < N; i++) {
    const r = playGame(variant, fp);
    totGoals += r.goals.bleu + r.goals.rouge;
    totTurns += r.turns;
    totStalls += r.stalls;
    if (r.over) finished++;
  }
  console.log(
    `variant=${variant} freePowers=${fp}: ` +
    `${finished}/${N} terminees, buts/partie=${(totGoals / N).toFixed(1)}, ` +
    `tours/partie=${(totTurns / N).toFixed(0)}, stalls/partie=${(totStalls / N).toFixed(1)}`
  );
}
