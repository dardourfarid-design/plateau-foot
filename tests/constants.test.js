import { describe, test, expect } from './test-utils.js';
import { buildStartingFormation, validateNoOverlap, BOARD_COLS, BOARD_ROWS, TEAMS } from '../public/src/engine/constants.js';

describe('constants - formation initiale', () => {
  test('génère exactement 6 pions par équipe', () => {
    const tokens = buildStartingFormation();
    const bleus = tokens.filter(t => t.team === TEAMS.BLEU);
    const rouges = tokens.filter(t => t.team === TEAMS.ROUGE);
    expect(bleus).toHaveLength(6);
    expect(rouges).toHaveLength(6);
  });

  test('chaque équipe a exactement un gardien', () => {
    const tokens = buildStartingFormation();
    const gkBleu = tokens.filter(t => t.team === TEAMS.BLEU && t.isGK);
    const gkRouge = tokens.filter(t => t.team === TEAMS.ROUGE && t.isGK);
    expect(gkBleu).toHaveLength(1);
    expect(gkRouge).toHaveLength(1);
  });

  // Ce test reproduit précisément le bug rencontré en session manuelle :
  // les pions des deux équipes occupaient les mêmes cases (lignes 4 et 6
  // calculées en dur étaient partagées par erreur entre Bleu et Rouge).
  test('RÉGRESSION : aucun chevauchement de position entre tous les pions', () => {
    const tokens = buildStartingFormation();
    const collisions = validateNoOverlap(tokens);
    expect(collisions).toHaveLength(0);
  });

  test('tous les pions sont dans les limites du plateau', () => {
    const tokens = buildStartingFormation();
    const allInBounds = tokens.every(
      t => t.row >= 0 && t.row < BOARD_ROWS && t.col >= 0 && t.col < BOARD_COLS
    );
    expect(allInBounds).toBeTruthy();
  });

  test('la formation est symétrique verticalement entre les deux équipes', () => {
    const tokens = buildStartingFormation();
    // Pour chaque pion bleu, son miroir rouge doit exister à la ligne symétrique
    // (BOARD_ROWS - 1 - row) avec la même colonne et le même rôle.
    const bleus = tokens.filter(t => t.team === TEAMS.BLEU);
    bleus.forEach(b => {
      const mirrorRow = BOARD_ROWS - 1 - b.row;
      const mirrorRouge = tokens.find(
        t => t.team === TEAMS.ROUGE && t.row === mirrorRow && t.col === b.col && t.isGK === b.isGK
      );
      expect(mirrorRouge).toBeTruthy();
    });
  });
});
