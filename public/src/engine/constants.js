// ===================== CONSTANTES DU JEU =====================
// Configuration centralisée : toute valeur de règle du jeu vit ici,
// jamais en dur ailleurs dans le moteur ou l'UI.

export const BOARD_COLS = 9;
export const BOARD_ROWS = 11;

// Colonnes formant la largeur de chaque cage (centrée sur 9 colonnes : indices 3,4,5)
export const GOAL_COLS = [3, 4, 5];

export const GOAL_ROW_TOP = 0;
export const GOAL_ROW_BOTTOM = BOARD_ROWS - 1;

// Zone dans laquelle le gardien peut se déplacer (3 lignes de profondeur x largeur de cage)
export const GK_ZONE_ROWS_TOP = [0, 1, 2];
export const GK_ZONE_ROWS_BOTTOM = [BOARD_ROWS - 1, BOARD_ROWS - 2, BOARD_ROWS - 3];

export const TEAMS = Object.freeze({
  BLEU: 'bleu',
  ROUGE: 'rouge'
});

export const CENTER = Object.freeze({
  row: Math.floor(BOARD_ROWS / 2), // 5
  col: Math.floor(BOARD_COLS / 2)  // 4
});

// Position de départ standard des 11 pions par équipe (formation 4-3-3).
// Les lignes sont exprimées en valeurs "miroir" pour garantir une symétrie
// parfaite et donc l'absence de chevauchement entre les deux équipes.
export function buildStartingFormation() {
  const tokens = [];

  // --- BLEU : attaque vers le haut (row décroissant), cage en row BOARD_ROWS-1 ---
  tokens.push({ id: 'b-gk', team: TEAMS.BLEU, row: BOARD_ROWS - 1, col: 4, isGK: true });
  [1, 3, 5, 7].forEach((c, i) =>
    tokens.push({ id: 'b-def' + i, team: TEAMS.BLEU, row: BOARD_ROWS - 2, col: c, isGK: false })
  );
  [2, 4, 6].forEach((c, i) =>
    tokens.push({ id: 'b-mid' + i, team: TEAMS.BLEU, row: BOARD_ROWS - 4, col: c, isGK: false })
  );
  [2, 4, 6].forEach((c, i) =>
    tokens.push({ id: 'b-att' + i, team: TEAMS.BLEU, row: BOARD_ROWS - 5, col: c, isGK: false })
  );

  // --- ROUGE : attaque vers le bas (row croissant), cage en row 0. Miroir exact de Bleu. ---
  tokens.push({ id: 'r-gk', team: TEAMS.ROUGE, row: 0, col: 4, isGK: true });
  [1, 3, 5, 7].forEach((c, i) =>
    tokens.push({ id: 'r-def' + i, team: TEAMS.ROUGE, row: 1, col: c, isGK: false })
  );
  [2, 4, 6].forEach((c, i) =>
    tokens.push({ id: 'r-mid' + i, team: TEAMS.ROUGE, row: 3, col: c, isGK: false })
  );
  [2, 4, 6].forEach((c, i) =>
    tokens.push({ id: 'r-att' + i, team: TEAMS.ROUGE, row: 4, col: c, isGK: false })
  );

  return tokens;
}

// Garde-fou structurel : si jamais quelqu'un modifie buildStartingFormation()
// sans faire attention, cette fonction permet de vérifier qu'aucun chevauchement
// n'est réintroduit (le bug qui a coûté cher en debug manuel la dernière fois).
export function validateNoOverlap(tokens) {
  const seen = new Map();
  const collisions = [];
  for (const t of tokens) {
    const key = `${t.row},${t.col}`;
    if (seen.has(key)) {
      collisions.push({ a: seen.get(key), b: t.id, at: key });
    }
    seen.set(key, t.id);
  }
  return collisions;
}
