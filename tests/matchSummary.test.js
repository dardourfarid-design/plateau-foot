import { describe, test, expect } from './test-utils.js';
import { createGame } from '../public/src/engine/gameEngine.js';
import { buildMatchSummary } from '../public/src/ui/matchSummary.js';
import { TEAMS } from '../public/src/engine/constants.js';

// #211 — carte-bilan : dérivation pure des stats de fin de match.
describe('buildMatchSummary (#211)', () => {
  function ended(scoreBleu, scoreRouge, extra = {}) {
    return { ...createGame({ goalsToWin: 3 }),
      score: { [TEAMS.BLEU]: scoreBleu, [TEAMS.ROUGE]: scoreRouge },
      gameOver: true, ...extra };
  }

  test('victoire du point de vue du gagnant', () => {
    const s = buildMatchSummary(ended(3, 1), TEAMS.BLEU);
    expect(s.result).toBe('win');
    expect(s.myGoals).toBe(3);
    expect(s.oppGoals).toBe(1);
  });

  test('défaite du point de vue du perdant (mêmes données, autre PDV)', () => {
    const s = buildMatchSummary(ended(3, 1), TEAMS.ROUGE);
    expect(s.result).toBe('loss');
    expect(s.myGoals).toBe(1);
    expect(s.oppGoals).toBe(3);
  });

  test('match nul', () => {
    expect(buildMatchSummary(ended(2, 2, { isDraw: true }), TEAMS.BLEU).result).toBe('draw');
  });

  test('meilleur momentum et pouvoirs utilisés remontés par équipe', () => {
    const s = ended(3, 0, {
      bestPassStreak: { [TEAMS.BLEU]: 4, [TEAMS.ROUGE]: 1 },
      tokens: [
        { id: 'b1', team: TEAMS.BLEU, powerUsed: true },
        { id: 'b2', team: TEAMS.BLEU, powerUsed: false },
        { id: 'r1', team: TEAMS.ROUGE, powerUsed: true }
      ]
    });
    const bleu = buildMatchSummary(s, TEAMS.BLEU);
    expect(bleu.bestMomentum).toBe(4);
    expect(bleu.powersUsed).toBe(1);
    const rouge = buildMatchSummary(s, TEAMS.ROUGE);
    expect(rouge.bestMomentum).toBe(1);
    expect(rouge.powersUsed).toBe(1);
  });

  test('robuste sur un état minimal', () => {
    const s = buildMatchSummary({ score: { [TEAMS.BLEU]: 1, [TEAMS.ROUGE]: 0 } }, TEAMS.BLEU);
    expect(s).toEqual({ result: 'win', myGoals: 1, oppGoals: 0, bestMomentum: 0, powersUsed: 0, povTeam: TEAMS.BLEU });
  });
});
