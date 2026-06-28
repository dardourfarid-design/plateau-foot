// ===================== CONSTANTES DU JEU =====================
// Configuration centralisée : toute valeur de règle du jeu vit ici,
// jamais en dur ailleurs dans le moteur ou l'UI.
//
// Règles simplifiées (v2) : moins de pions (6 par équipe au lieu de 11),
// plateau plus compact pour garder une vraie densité de jeu malgré la
// réduction du nombre de pions, et zone de gardien réduite à la seule ligne
// de cage (plus facile à retenir que l'ancienne zone profonde de 3 lignes).

export const BOARD_COLS = 7;
export const BOARD_ROWS = 9;

// Colonnes formant la largeur de chaque cage (centrée sur 7 colonnes : indices 2,3,4)
export const GOAL_COLS = [2, 3, 4];

export const GOAL_ROW_TOP = 0;
export const GOAL_ROW_BOTTOM = BOARD_ROWS - 1;

// Le gardien ne peut se déplacer que sur sa propre ligne de cage (glisse
// latéralement), pas en profondeur — règle plus simple à retenir et à voir
// d'un coup d'œil sur le plateau que l'ancienne zone 3x3.
export const GK_ZONE_ROWS_TOP = [0];
export const GK_ZONE_ROWS_BOTTOM = [BOARD_ROWS - 1];

export const TEAMS = Object.freeze({
  BLEU: 'bleu',
  ROUGE: 'rouge'
});

export const CENTER = Object.freeze({
  row: Math.floor(BOARD_ROWS / 2), // 4
  col: Math.floor(BOARD_COLS / 2)  // 3
});

// Position de départ simplifiée : 1 gardien + 2 défenseurs + 3 attaquants
// par équipe (6 pions), au lieu des 11 pions et 3 lignes de la v1. Assez
// pour garder de vrais choix tactiques, largement plus lisible d'un regard.
export function buildStartingFormation() {
  const tokens = [];

  // --- BLEU : attaque vers le haut (row décroissant), cage en row BOARD_ROWS-1 ---
  tokens.push({ id: 'b-gk', team: TEAMS.BLEU, row: BOARD_ROWS - 1, col: 3, isGK: true });
  [1, 5].forEach((c, i) =>
    tokens.push({ id: 'b-def' + i, team: TEAMS.BLEU, row: BOARD_ROWS - 2, col: c, isGK: false })
  );
  [1, 3, 5].forEach((c, i) =>
    tokens.push({ id: 'b-att' + i, team: TEAMS.BLEU, row: BOARD_ROWS - 3, col: c, isGK: false })
  );

  // --- ROUGE : attaque vers le bas (row croissant), cage en row 0. Miroir exact de Bleu. ---
  tokens.push({ id: 'r-gk', team: TEAMS.ROUGE, row: 0, col: 3, isGK: true });
  [1, 5].forEach((c, i) =>
    tokens.push({ id: 'r-def' + i, team: TEAMS.ROUGE, row: 1, col: c, isGK: false })
  );
  [1, 3, 5].forEach((c, i) =>
    tokens.push({ id: 'r-att' + i, team: TEAMS.ROUGE, row: 2, col: c, isGK: false })
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
