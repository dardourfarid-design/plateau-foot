import { describe, test, expect } from './test-utils.js';
import { createGame } from '../public/src/engine/gameEngine.js';
import { confirmRelaisAfterPass, expireWallIfNeeded } from '../public/src/engine/powers.js';
import { applyAiTurn, chooseAiPowerPlay, AI_LEVELS } from '../public/src/engine/ai.js';
import { TEAMS } from '../public/src/engine/constants.js';

// #202 — l'IA utilise désormais les pouvoirs de pion. Un scénario clair par
// pouvoir, plus une non-régression de terminaison des parties.
function scenario(ball, tokens, turn = TEAMS.BLEU) {
  return { ...createGame({ goalsToWin: 99 }), ball, tokens, turn };
}

describe('IA — usage des pouvoirs (#202)', () => {
  test('Tir Puissant : l IA transperce un défenseur pour marquer', () => {
    // Bleu attaque vers la ligne 0. Ballon en (3,3), défenseur rouge en (2,3)
    // (bloque une passe normale) ; le tir puissant le transperce jusqu à (0,3).
    const state = scenario({ row: 3, col: 3 }, [
      { id: 'b-p', team: TEAMS.BLEU, row: 4, col: 3, isGK: false, power: 'tir_puissant', powerUsed: false },
      { id: 'r-d', team: TEAMS.ROUGE, row: 2, col: 3, isGK: false },
      { id: 'r-gk', team: TEAMS.ROUGE, row: 0, col: 1, isGK: true }
    ]);
    expect(chooseAiPowerPlay(state).kind).toBe('tir_puissant');
    const after = applyAiTurn(state, AI_LEVELS.MOYEN);
    expect(after.score[TEAMS.BLEU]).toBe(1);
    expect(after.tokens.find(t => t.id === 'b-p').powerUsed).toBe(true);
  });

  test('Sprint : l IA fonce prendre possession du ballon', () => {
    // Aucun pion bleu adjacent au ballon ; le sprinteur en (6,4) file en
    // diagonale jusqu en (4,2), adjacent au ballon (4,3).
    const state = scenario({ row: 4, col: 3 }, [
      { id: 'b-s', team: TEAMS.BLEU, row: 6, col: 4, isGK: false, power: 'sprint', powerUsed: false },
      { id: 'b-gk', team: TEAMS.BLEU, row: 8, col: 3, isGK: true },
      { id: 'r-gk', team: TEAMS.ROUGE, row: 0, col: 3, isGK: true }
    ]);
    expect(chooseAiPowerPlay(state).kind).toBe('sprint');
    const after = applyAiTurn(state, AI_LEVELS.MOYEN);
    const s = after.tokens.find(t => t.id === 'b-s');
    // Le sprint (2 cases) amène le pion à côté du ballon (4,3).
    expect(Math.max(Math.abs(s.row - 4), Math.abs(s.col - 3))).toBe(1);
    expect(s.powerUsed).toBe(true);
    expect(after.turn).toBe(TEAMS.ROUGE); // le tour s est bien terminé
  });

  test('Repli adverse : l IA repousse un pion adverse qui conteste le ballon', () => {
    const state = scenario({ row: 4, col: 3 }, [
      { id: 'b-r', team: TEAMS.BLEU, row: 6, col: 3, isGK: false, power: 'repli_adverse', powerUsed: false },
      { id: 'r-x', team: TEAMS.ROUGE, row: 3, col: 3, isGK: false }, // adjacent au ballon
      { id: 'r-gk', team: TEAMS.ROUGE, row: 0, col: 3, isGK: true }
    ]);
    expect(chooseAiPowerPlay(state).kind).toBe('repli_adverse');
    const after = applyAiTurn(state, AI_LEVELS.MOYEN);
    // Rouge recule d une case vers sa propre cage (ligne 0) : (3,3) -> (2,3)
    expect(after.tokens.find(t => t.id === 'r-x').row).toBe(2);
    expect(after.tokens.find(t => t.id === 'b-r').powerUsed).toBe(true);
  });

  test('Mur : l IA érige le mur quand le ballon menace dans sa moitié', () => {
    const state = scenario({ row: 6, col: 3 }, [
      { id: 'b-m', team: TEAMS.BLEU, row: 7, col: 3, isGK: false, power: 'mur', powerUsed: false },
      { id: 'b-gk', team: TEAMS.BLEU, row: 8, col: 3, isGK: true },
      { id: 'r-gk', team: TEAMS.ROUGE, row: 0, col: 3, isGK: true }
    ]);
    expect(chooseAiPowerPlay(state).kind).toBe('mur');
    const after = applyAiTurn(state, AI_LEVELS.MOYEN);
    expect(after.activeWallTokenId).toBe('b-m');
    expect(after.tokens.find(t => t.id === 'b-m').powerUsed).toBe(true);
  });

  test('Relais : l IA passe et se garde un déplacement bonus', () => {
    // Ballon (5,3), passeur/relais en (6,3), un pion bleu en (1,3) borne la
    // colonne pour que la meilleure passe (2,3) avance sans marquer.
    const state = scenario({ row: 5, col: 3 }, [
      { id: 'b-rel', team: TEAMS.BLEU, row: 6, col: 3, isGK: false, power: 'relais', powerUsed: false },
      { id: 'b-block', team: TEAMS.BLEU, row: 1, col: 3, isGK: false },
      { id: 'r-gk', team: TEAMS.ROUGE, row: 0, col: 1, isGK: true }
    ]);
    expect(chooseAiPowerPlay(state).kind).toBe('relais');
    const after = applyAiTurn(state, AI_LEVELS.MOYEN);
    expect(after.ball).toEqual({ row: 2, col: 3 }); // la passe a avancé le ballon
    expect(after.relaisPendingForTeam).toBe(TEAMS.BLEU);
    // powerUsed n'est posé qu'à la confirmation (comportement moteur).
    const confirmed = confirmRelaisAfterPass(after);
    expect(confirmed.relaisBonusMoveAvailable).toBe(true);
    expect(confirmed.turn).toBe(TEAMS.BLEU);
    expect(confirmed.tokens.find(t => t.id === 'b-rel').powerUsed).toBe(true);
  });

  test('niveau Facile : l IA n utilise jamais de pouvoir', () => {
    const state = scenario({ row: 3, col: 3 }, [
      { id: 'b-p', team: TEAMS.BLEU, row: 4, col: 3, isGK: false, power: 'tir_puissant', powerUsed: false },
      { id: 'r-d', team: TEAMS.ROUGE, row: 2, col: 3, isGK: false },
      { id: 'r-gk', team: TEAMS.ROUGE, row: 0, col: 1, isGK: true }
    ]);
    const after = applyAiTurn(state, AI_LEVELS.FACILE);
    // Le pouvoir reste disponible (non consommé) : Facile a joué un coup normal.
    expect(after.tokens.find(t => t.id === 'b-p').powerUsed).toBe(false);
  });

  test('non-régression : les parties IA vs IA avec pouvoirs se terminent toujours', () => {
    function playAiGame() {
      let s = createGame({ goalsToWin: 1, freePowers: true });
      let guard = 0;
      while (!s.gameOver && guard++ < 3000) {
        const before = s;
        s = applyAiTurn(s, AI_LEVELS.MOYEN);
        if (s === before) break; // aucune action possible (ne devrait pas arriver)
        if (s.relaisPendingForTeam) s = confirmRelaisAfterPass(s);
        s = expireWallIfNeeded(s);
      }
      return s;
    }
    for (let i = 0; i < 8; i++) {
      expect(playAiGame().gameOver).toBe(true);
    }
  });
});
