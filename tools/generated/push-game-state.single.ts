// ============================================================================
// push-game-state — VERSION MONO-FICHIER (GÉNÉRÉE — NE PAS ÉDITER À LA MAIN)
// ============================================================================
// Fichier prêt à coller comme "index.ts" dans le tableau de bord Supabase pour
// un déploiement 100 % manuel : le moteur du jeu est inliné, aucun import local
// (donc aucun dossier _engine/ à recréer). Source de vérité et déploiement CLI :
// supabase/functions/push-game-state/ (index.ts + _engine/).
//
// Régénérer : node tools/bundle-edge-function.mjs
// ============================================================================
// @ts-nocheck

import { createClient } from 'jsr:@supabase/supabase-js@2';


// ==================== MOTEUR (inliné depuis public/src/engine via _engine) ====================

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
export function buildStartingFormation(variant = 'standard') {
  // Deux formations possibles. 'standard' : 6 pions (promesse "simple comme
  // les dames"). 'tactique' : 8 pions par equipe, plus dense, pour les joueurs
  // qui veulent plus de duels et d'options (voir docs/team/regles-bible-v0.5.md).
  const defCols = variant === 'tactique' ? [1, 3, 5] : [1, 5];
  const attCols = variant === 'tactique' ? [0, 2, 4, 6] : [1, 3, 5];
  const tokens = [];

  // --- BLEU : attaque vers le haut (row décroissant), cage en row BOARD_ROWS-1 ---
  tokens.push({ id: 'b-gk', team: TEAMS.BLEU, row: BOARD_ROWS - 1, col: 3, isGK: true });
  defCols.forEach((c, i) =>
    tokens.push({ id: 'b-def' + i, team: TEAMS.BLEU, row: BOARD_ROWS - 2, col: c, isGK: false })
  );
  attCols.forEach((c, i) =>
    tokens.push({ id: 'b-att' + i, team: TEAMS.BLEU, row: BOARD_ROWS - 3, col: c, isGK: false })
  );

  // --- ROUGE : attaque vers le bas (row croissant), cage en row 0. Miroir exact de Bleu. ---
  tokens.push({ id: 'r-gk', team: TEAMS.ROUGE, row: 0, col: 3, isGK: true });
  defCols.forEach((c, i) =>
    tokens.push({ id: 'r-def' + i, team: TEAMS.ROUGE, row: 1, col: c, isGK: false })
  );
  attCols.forEach((c, i) =>
    tokens.push({ id: 'r-att' + i, team: TEAMS.ROUGE, row: 2, col: c, isGK: false })
  );

  return tokens;
}

// ===================== PALIERS DE RÈGLES (#206, spike #198) =====================
// La v0.5 applique couverture / une-deux / ailes / point de penalty en
// permanence. Pour réconcilier « simple comme les dames » et la profondeur
// réelle, on expose ces mécaniques comme des flags regroupés en 3 paliers.
// Voir docs/team/regles-paliers.md pour les décisions et le contrat.
//
// Ces quatre flags concernent la mécanique de PASSE (les seules mécaniques
// jusque-là non désactivables). `variant` et `powers` gardent leurs propres
// options (`options.variant` / `options.freePowers`) — les paliers ne font que
// RECOMMANDER une valeur par défaut à l'UI (voir RULESET_DEFAULTS).
export const RULE_FLAGS = Object.freeze(['coverage', 'oneTwo', 'wings', 'penaltySpot']);

// Défaut moteur = tout activé (comportement historique v0.5). Un `createGame()`
// sans `ruleset` se comporte exactement comme avant l'introduction des paliers,
// ce qui préserve la suite de tests et les appelants existants (online, tutoriel).
export const DEFAULT_RULES = Object.freeze({
  coverage: true, oneTwo: true, wings: true, penaltySpot: true
});

export const RULESETS = Object.freeze({
  decouverte: Object.freeze({ coverage: false, oneTwo: false, wings: false, penaltySpot: false }),
  classique:  Object.freeze({ coverage: true,  oneTwo: true,  wings: false, penaltySpot: false }),
  expert:     Object.freeze({ coverage: true,  oneTwo: true,  wings: true,  penaltySpot: true })
});

export const DEFAULT_RULESET = 'classique';

// Valeurs recommandées de variant/pouvoirs par palier — consommées par l'UI
// (préréglages de difficulté #206), jamais par le moteur pur.
export const RULESET_DEFAULTS = Object.freeze({
  decouverte: Object.freeze({ variant: 'standard', powers: false }),
  classique:  Object.freeze({ variant: 'standard', powers: true }),
  expert:     Object.freeze({ variant: 'tactique', powers: true })
});

// Résout l'ensemble de flags de règles effectif pour une partie.
// - `options.ruleset` ('decouverte'|'classique'|'expert') choisit un palier ;
//   absent/inconnu -> DEFAULT_RULES (tout activé, rétrocompat).
// - `options.rules` surcharge finement un ou plusieurs flags par-dessus le
//   palier (utilisé par « Options avancées » #205).
export function resolveRules(options = {}) {
  const base = (options.ruleset && RULESETS[options.ruleset]) || DEFAULT_RULES;
  const merged = { ...base };
  if (options.rules) {
    for (const f of RULE_FLAGS) {
      if (typeof options.rules[f] === 'boolean') merged[f] = options.rules[f];
    }
  }
  return Object.freeze(merged);
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

// ===================== MOTEUR DE JEU =====================
// Toutes les fonctions ici sont pures (pas d'effet de bord, pas de DOM).
// L'état du jeu est traité comme immutable : chaque action retourne un nouvel état.
// Ce module est directement testable unitairement (voir tests/engine.test.js).


export const PHASES = Object.freeze({
  SELECT: 'select',
  MOVED_CAN_PASS: 'moved-can-pass'
});

// Anti-blocage v0.5 : au bout de STALL_LIMIT tours consecutifs SANS aucune
// passe (pur repositionnement de pions), on remet le ballon au centre en
// engagement neutre pour debloquer une situation figee. Volontairement eleve :
// ne se declenche qu'en cas de vraie impasse (4 tours par camp sans passe).
export const STALL_LIMIT = 8;

/**
 * Crée un nouvel état de partie initial.
 * @param {{goalsToWin?: number}} options
 */
// Pool des pouvoirs distribuables gratuitement (une occurrence par equipe et
// par match si options.freePowers). Duplique volontairement les chaines de
// POWER_TYPES (powers.js) pour eviter une dependance circulaire entre modules.
const FREE_POWER_POOL = ['tir_puissant', 'sprint', 'mur', 'relais', 'repli_adverse'];

function assignFreePowers(tokens, rng) {
  const pick = (arr) => arr[Math.floor(rng() * arr.length)];
  return [TEAMS.BLEU, TEAMS.ROUGE].reduce((toks, team) => {
    const field = toks.filter(t => t.team === team && !t.isGK);
    if (field.length === 0) return toks;
    const chosen = pick(field);
    const power = pick(FREE_POWER_POOL);
    return toks.map(t => t.id === chosen.id ? { ...t, power, powerUsed: false } : t);
  }, tokens);
}

export function createGame(options = {}) {
  const goalsToWin = options.goalsToWin ?? 3;
  const variant = options.variant === 'tactique' ? 'tactique' : 'standard';
  const rng = options.rng || Math.random;
  let tokens = buildStartingFormation(variant);
  if (options.freePowers) tokens = assignFreePowers(tokens, rng);
  return Object.freeze({
    tokens,
    variant,
    // Paliers de règles (#206) : flags de mécaniques de passe activées pour
    // cette partie. Voir constants.js/resolveRules et docs/team/regles-paliers.md.
    rules: resolveRules(options),
    ball: { row: CENTER.row, col: CENTER.col },
    turn: TEAMS.BLEU,
    score: { [TEAMS.BLEU]: 0, [TEAMS.ROUGE]: 0 },
    goalsToWin,
    selectedTokenId: null,
    phase: PHASES.SELECT,
    movedTokenPos: null, // {row, col} du pion qui vient de se déplacer ce tour, si applicable
    canUndo: false,
    gameOver: false,
    winner: null,
    lastGoalBy: null,
    // --- v0.5 : manche courte / departage ---
    turnLimit: options.turnLimit ?? null, // nb de tours avant fin de manche (null = illimite)
    turnCount: 0,
    isDraw: false,
    // --- v0.5 : possession / momentum / anti-blocage ---
    possession: TEAMS.BLEU, // derniere equipe a avoir touche (passe) le ballon
    passStreak: 0,          // passes consecutives de l'equipe en possession (momentum)
    lastGoalPassStreak: 0,  // momentum du but qui vient d'etre marque (pour bonus XP/pieces)
    // #203 : meilleur momentum (nb de passes) d'un but marque sur la partie,
    // par equipe. Sert a recompenser le "beau jeu" cote serveur en fin de partie.
    bestPassStreak: { [TEAMS.BLEU]: 0, [TEAMS.ROUGE]: 0 },
    ballIdleTurns: 0,       // tours consecutifs sans passe (anti-blocage)
    stalled: false,         // vrai le tour ou l'engagement neutre s'est declenche
    history: [] // pile d'événements pour debug / replay éventuel
  });
}

// ---------- Lecture d'état (pures, sans effet de bord) ----------

export function tokenAt(state, row, col) {
  return state.tokens.find(t => t.row === row && t.col === col) || null;
}

export function isBallAt(state, row, col) {
  return state.ball.row === row && state.ball.col === col;
}

export function inBounds(row, col) {
  return row >= 0 && row < BOARD_ROWS && col >= 0 && col < BOARD_COLS;
}

export function isAdjacent(r1, c1, r2, c2) {
  const dr = Math.abs(r1 - r2);
  const dc = Math.abs(c1 - c2);
  return dr <= 1 && dc <= 1 && !(dr === 0 && dc === 0);
}

// Directions strictement orthogonales, utilisees par la regle de couverture
// v0.5. On exclut volontairement les diagonales : un defenseur ne "coupe" que
// les cases juste a cote de lui, jamais en biais, ce qui laisse les lignes
// diagonales comme espace d'expression tactique et garde la regle lisible.
export const ORTHOGONAL_DIRS = Object.freeze([[-1, 0], [1, 0], [0, -1], [0, 1]]);

// Une case est "couverte" par une equipe si un pion de champ (non gardien) de
// cette equipe occupe une case orthogonalement adjacente. Base de
// l'interception v0.5 : l'adversaire coupe les cases juste a cote de ses pions.
// Le gardien est exclu (il defend en occupant physiquement sa cage, pas par une
// aura, sinon marquer deviendrait impossible).
export function isCellCoveredBy(state, row, col, team) {
  return ORTHOGONAL_DIRS.some(([dr, dc]) => {
    const t = tokenAt(state, row + dr, col + dc);
    return t && t.team === team && !t.isGK;
  });
}

// Une passe partant d'une aile (colonne de bord) est un "centre" : plus dur a
// couper, elle ignore la couverture adverse sur ce coup. Recompense le jeu large.
export function isWingPass(state) {
  return state.ball.col === 0 || state.ball.col === BOARD_COLS - 1;
}

// Point de penalty : case centrale a deux rangees de la cage adverse. Depuis
// cette case, un tir vers la cage transperce UN defenseur de champ (pas le
// gardien) et ignore la couverture -> recompense le fait d'amener le ballon
// jusque-la. Symetrique pour les deux equipes.
export function penaltySpotFor(team) {
  return team === TEAMS.BLEU
    ? { row: 2, col: 3 }
    : { row: BOARD_ROWS - 3, col: 3 };
}

export function isPenaltyShot(state) {
  const sp = penaltySpotFor(state.turn);
  return state.ball.row === sp.row && state.ball.col === sp.col;
}

function gkAllowedCells(team) {
  const rows = team === TEAMS.BLEU ? GK_ZONE_ROWS_BOTTOM : GK_ZONE_ROWS_TOP;
  const cells = [];
  rows.forEach(r => GOAL_COLS.forEach(c => cells.push([r, c])));
  return cells;
}

function cellInList(list, row, col) {
  return list.some(([r, c]) => r === row && c === col);
}

/**
 * Cases de déplacement valides pour un pion donné (1 case, 8 directions).
 */
export function getMoveDestinations(state, token) {
  const dests = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = token.row + dr;
      const nc = token.col + dc;
      if (!inBounds(nr, nc)) continue;
      if (tokenAt(state, nr, nc)) continue;
      if (isBallAt(state, nr, nc)) continue;
      if (token.isGK && !cellInList(gkAllowedCells(token.team), nr, nc)) continue;
      dests.push([nr, nc]);
    }
  }
  return dests;
}

/**
 * Cases atteignables par une passe depuis la position actuelle du ballon,
 * dans les 8 directions, en ligne droite, jusqu'au premier obstacle ou bord.
 * Chaque case libre du trajet est une destination valide (le joueur choisit où s'arrêter).
 */
export function getPassDestinations(state, options = {}) {
  // Couverture adverse (interception v0.5) : une passe ne peut ni s'arreter
  // sur, ni traverser une case couverte par l'equipe adverse. Ignoree si l'on
  // part d'une aile ("centre") ou si l'appelant force ignoreCoverage (pouvoirs,
  // sequences internes).
  // Paliers de regles (#206) : ailes et point de penalty ne s'appliquent que si
  // le palier les active ; si la couverture elle-meme est desactivee (palier
  // Decouverte), toute passe ignore la couverture.
  const rules = state.rules || DEFAULT_RULES;
  const penalty = rules.penaltySpot && isPenaltyShot(state);
  const wing = rules.wings && isWingPass(state);
  const ignoreCoverage = options.ignoreCoverage ?? (!rules.coverage || wing || penalty);
  const opponent = state.turn === TEAMS.BLEU ? TEAMS.ROUGE : TEAMS.BLEU;

  const dests = [];
  const directions = [
    [-1, 0], [1, 0], [0, -1], [0, 1],
    [-1, -1], [-1, 1], [1, -1], [1, 1]
  ];
  directions.forEach(([dr, dc]) => {
    let r = state.ball.row + dr;
    let c = state.ball.col + dc;
    while (inBounds(r, c) && !tokenAt(state, r, c)) {
      if (!ignoreCoverage && isCellCoveredBy(state, r, c, opponent)) break;
      dests.push([r, c, dr, dc]);
      r += dr;
      c += dc;
    }
  });

  // Tir de penalty : dans la direction de la cage, on transperce UN seul
  // defenseur de champ. Le gardien et nos propres pions restent infranchissables.
  if (penalty && options.ignoreCoverage !== false) {
    const dr = state.turn === TEAMS.BLEU ? -1 : 1;
    let r = state.ball.row + dr;
    let c = state.ball.col;
    let pierced = false;
    while (inBounds(r, c)) {
      const occ = tokenAt(state, r, c);
      if (occ) {
        if (occ.isGK || occ.team === state.turn || pierced) break;
        pierced = true;
        r += dr;
        continue;
      }
      if (!dests.some(([rr, cc]) => rr === r && cc === c)) dests.push([r, c, dr, 0]);
      r += dr;
    }
  }

  return dests;
}

export function canSelectToken(state, token) {
  if (state.gameOver) return false;
  if (state.phase !== PHASES.SELECT) return false;
  return token.team === state.turn;
}

function checkGoalCell(row, col) {
  if (row === GOAL_ROW_TOP && GOAL_COLS.includes(col)) return TEAMS.BLEU; // Bleu attaque vers le haut
  if (row === GOAL_ROW_BOTTOM && GOAL_COLS.includes(col)) return TEAMS.ROUGE; // Rouge attaque vers le bas
  return null;
}

// ---------- Actions (retournent un nouvel état, jamais de mutation) ----------

/**
 * Sélectionne un pion pour le joueur actif.
 */
export function selectToken(state, tokenId) {
  const token = state.tokens.find(t => t.id === tokenId);
  if (!token || !canSelectToken(state, token)) return state;

  return Object.freeze({
    ...state,
    selectedTokenId: tokenId,
    canUndo: false // un nouveau coup commence : on verrouille l'annulation du tour précédent
  });
}

/**
 * Déplace le pion sélectionné vers (row, col), si la case est une destination valide.
 * Si le pion arrive adjacent au ballon, la phase passe en MOVED_CAN_PASS (passe optionnelle).
 * Sinon, le tour se termine immédiatement.
 */
export function moveSelectedToken(state, row, col) {
  if (state.phase !== PHASES.SELECT || !state.selectedTokenId) return state;
  const token = state.tokens.find(t => t.id === state.selectedTokenId);
  if (!token) return state;

  const validMoves = getMoveDestinations(state, token);
  if (!cellInList(validMoves, row, col)) return state;

  const newTokens = state.tokens.map(t =>
    t.id === token.id ? { ...t, row, col } : t
  );

  const nextState = { ...state, tokens: newTokens };

  if (isAdjacent(row, col, state.ball.row, state.ball.col)) {
    return Object.freeze({
      ...nextState,
      phase: PHASES.MOVED_CAN_PASS,
      movedTokenPos: { row, col },
      selectedTokenId: null
    });
  }

  return endTurn(nextState);
}

/**
 * Pousse le ballon vers (row, col) si c'est une destination de passe valide
 * depuis l'état courant. Gère but / fin de tour ensuite.
 */
export function passBall(state, row, col) {
  // Le mouvement bonus accordé par le pouvoir Relais n'autorise qu'un
  // déplacement de pion, jamais une seconde passe — sinon un même joueur
  // pourrait enchaîner deux poussées de ballon en un seul tour, ce qui
  // dépasse largement l'intention du pouvoir tel que conçu.
  if (state.relaisBonusMoveAvailable || state.comboMoveAvailable) return state;

  const inSelectPhaseAdjacent =
    state.phase === PHASES.SELECT &&
    state.selectedTokenId &&
    (() => {
      const tok = state.tokens.find(t => t.id === state.selectedTokenId);
      return tok && isAdjacent(tok.row, tok.col, state.ball.row, state.ball.col);
    })();

  const inMovedCanPassPhase = state.phase === PHASES.MOVED_CAN_PASS;

  if (!inSelectPhaseAdjacent && !inMovedCanPassPhase) return state;

  const validPasses = getPassDestinations(state);
  if (!cellInList(validPasses.map(p => [p[0], p[1]]), row, col)) return state;

  return applyBallMovement(state, row, col);
}

/**
 * Applique un déplacement de ballon déjà validé (but, fin de tour) sans
 * revérifier la liste des destinations normales — utilisée par passBall()
 * ci-dessus pour le cas normal, et par les pouvoirs (Tir Puissant) qui
 * autorisent des destinations qu'une passe normale n'autoriserait pas
 * (traverser un pion). La validité du coup doit être garantie par
 * l'appelant AVANT d'appeler cette fonction — elle ne fait que matérialiser
 * un mouvement déjà jugé légal dans son contexte.
 */
export function applyBallMovement(state, row, col) {
  const passingTeam = state.turn;
  // Momentum : suite de passes de l'equipe en possession. Repart a 1 quand la
  // possession change de camp.
  const sameOwner = state.possession === passingTeam;
  const passStreak = sameOwner ? (state.passStreak || 0) + 1 : 1;

  const newState = {
    ...state,
    ball: { row, col },
    selectedTokenId: null,
    movedTokenPos: null,
    possession: passingTeam,
    passStreak,
    ballIdleTurns: 0
  };

  const scoringTeam = checkGoalCell(row, col);
  if (scoringTeam) {
    return registerGoal(newState, scoringTeam);
  }

  // UNE-DEUX (combo) : si le ballon arrive a cote d'un appui allie (un pion de
  // champ orthogonalement adjacent), l'equipe rejoue immediatement un
  // deplacement bonus (jamais une 2e passe). Non cumulable, jamais pendant un
  // bonus deja en cours ou un Relais.
  // Palier de regles (#206) : la une-deux n'est offerte que si le palier
  // l'active (desactivee en Decouverte).
  const rules = state.rules || DEFAULT_RULES;
  const eligibleForCombo =
    rules.oneTwo &&
    !state.comboMoveAvailable &&
    !state.relaisBonusMoveAvailable &&
    !state.relaisPendingForTeam &&
    isCellCoveredBy(newState, row, col, passingTeam);

  if (eligibleForCombo) {
    return Object.freeze({
      ...newState,
      phase: PHASES.SELECT,
      comboMoveAvailable: true,
      canUndo: false
      // turn inchange : la meme equipe joue son mouvement bonus une-deux
    });
  }

  return endTurn(newState, { passed: true });
}

/**
 * Termine le tour sans action supplémentaire (utilisé quand un joueur, en phase
 * MOVED_CAN_PASS, décide de ne pas faire de passe).
 */
export function passTurn(state) {
  if (state.phase !== PHASES.MOVED_CAN_PASS && !(state.phase === PHASES.SELECT && state.selectedTokenId)) {
    return state;
  }
  return endTurn({ ...state, selectedTokenId: null, movedTokenPos: null });
}

function endTurn(state, opts = {}) {
  const passed = opts.passed || false;

  // Si un bonus de second mouvement (Relais) est disponible, ce tour-ci ne
  // change pas de camp : on consomme juste le bonus, le déplacement qui
  // vient d'être joué EST le second mouvement accordé par le pouvoir.
  if (state.relaisBonusMoveAvailable) {
    const { relaisBonusMoveAvailable, ...rest } = state;
    return Object.freeze({
      ...rest,
      selectedTokenId: null,
      phase: PHASES.SELECT,
      movedTokenPos: null,
      canUndo: true
    });
  }

  // Consommation du bonus UNE-DEUX : le mouvement bonus vient d'etre joue. On
  // retire le flag ET on rend la main a l'adversaire (handoff propre).
  let base = state;
  if (base.comboMoveAvailable) {
    const { comboMoveAvailable, ...rest } = base;
    base = rest;
  }

  // Anti-blocage : compteur de tours sans passe (remis a 0 par une passe).
  const nextIdle = passed ? 0 : (base.ballIdleTurns || 0) + 1;

  const turnCount = (base.turnCount || 0) + 1;
  const switched = {
    ...base,
    selectedTokenId: null,
    phase: PHASES.SELECT,
    movedTokenPos: null,
    turn: base.turn === TEAMS.BLEU ? TEAMS.ROUGE : TEAMS.BLEU,
    canUndo: true,
    ballIdleTurns: nextIdle,
    stalled: false,
    turnCount
  };

  // Fin de manche courte : a la limite de tours, la partie s'arrete. Score
  // egal => match nul (isDraw), a departager (tirs au but cote UI).
  if (base.turnLimit && turnCount >= base.turnLimit) {
    const b = base.score[TEAMS.BLEU];
    const r = base.score[TEAMS.ROUGE];
    const draw = b === r;
    return Object.freeze({
      ...switched,
      gameOver: true,
      isDraw: draw,
      winner: draw ? null : (b > r ? TEAMS.BLEU : TEAMS.ROUGE)
    });
  }

  if (nextIdle >= STALL_LIMIT) {
    // Engagement neutre : ballon au centre s'il est libre, compteurs remis a
    // zero. On ne touche jamais aux pions (pas de reset de formation ici, pour
    // ne pas effacer une composition mercato/perso en cours de partie).
    const centerFree = !tokenAt(base, CENTER.row, CENTER.col);
    return Object.freeze({
      ...switched,
      ball: centerFree ? { row: CENTER.row, col: CENTER.col } : switched.ball,
      ballIdleTurns: 0,
      possession: null,
      passStreak: 0,
      stalled: true
    });
  }

  return Object.freeze(switched);
}

function registerGoal(state, scoringTeam) {
  const newScore = { ...state.score, [scoringTeam]: state.score[scoringTeam] + 1 };
  const isGameOver = newScore[scoringTeam] >= state.goalsToWin;
  const goalStreak = state.passStreak || 0;

  // #203 : on garde le meilleur momentum de but de chaque equipe sur la partie.
  const prevBest = state.bestPassStreak || { [TEAMS.BLEU]: 0, [TEAMS.ROUGE]: 0 };
  const bestPassStreak = {
    ...prevBest,
    [scoringTeam]: Math.max(prevBest[scoringTeam] || 0, goalStreak)
  };

  return Object.freeze({
    ...state,
    score: newScore,
    selectedTokenId: null,
    phase: PHASES.SELECT,
    movedTokenPos: null,
    canUndo: false,
    lastGoalBy: scoringTeam,
    lastGoalPassStreak: goalStreak, // momentum du but (bonus si >= 3)
    bestPassStreak,
    possession: null,
    passStreak: 0,
    ballIdleTurns: 0,
    stalled: false,
    // L'équipe qui encaisse engage le ballon
    turn: scoringTeam === TEAMS.BLEU ? TEAMS.ROUGE : TEAMS.BLEU,
    gameOver: isGameOver,
    winner: isGameOver ? scoringTeam : null
  });
}

/**
 * Remet le ballon au centre ET tous les pions à leur formation de départ
 * après confirmation visuelle d'un but (appelé par l'UI une fois l'overlay
 * "BUT !" fermé). Comme au coup d'envoi : on ne garde que le score et le
 * tour (déjà mis à jour par registerGoal), tout le reste de la disposition
 * de jeu redémarre à zéro pour que chaque reprise reste claire et lisible.
 */
export function resetBallAfterGoal(state) {
  if (state.gameOver) return state;
  return Object.freeze({
    ...state,
    ball: { row: CENTER.row, col: CENTER.col },
    tokens: buildStartingFormation(state.variant || 'standard')
  });
}

export function deselect(state) {
  if (state.phase !== PHASES.SELECT) return state;
  return Object.freeze({ ...state, selectedTokenId: null });
}

/**
 * Énumère tous les coups légaux pour l'équipe au tour, dans l'état donné.
 * Un coup est soit un déplacement simple { type: 'move', tokenId, to: [r,c] },
 * soit un déplacement suivi d'une passe { type: 'move_and_pass', tokenId, to, passTo },
 * soit une passe directe sans déplacement { type: 'pass', tokenId, passTo }.
 *
 * Cette fonction ne s'appuie que sur l'état et les règles déjà testées du moteur
 * (getMoveDestinations, getPassDestinations) — elle ne fait qu'énumérer, jamais
 * elle ne mute quoi que ce soit. Utilisée par le module IA (voir ai.js) pour
 * choisir un coup, mais reste indépendante de toute notion de "joueur artificiel" :
 * elle décrit simplement l'espace des coups légaux, ce qui est une propriété du jeu.
 */
export function listLegalMoves(state) {
  if (state.gameOver || state.phase !== PHASES.SELECT) return [];

  const moves = [];
  const myTokens = state.tokens.filter(t => t.team === state.turn);

  // Pendant un mouvement bonus (une-deux ou Relais), seul un DEPLACEMENT est
  // autorise, jamais une passe : on n'enumere alors que les coups 'move'.
  const bonusMoveOnly = !!(state.comboMoveAvailable || state.relaisBonusMoveAvailable);

  for (const token of myTokens) {
    // Cas 1 : le pion est déjà adjacent au ballon sans bouger -> passe directe possible
    if (!bonusMoveOnly && isAdjacent(token.row, token.col, state.ball.row, state.ball.col)) {
      const passes = getPassDestinations(state);
      passes.forEach(([pr, pc]) => {
        moves.push({ type: 'pass', tokenId: token.id, passTo: [pr, pc] });
      });
    }

    // Cas 2 : déplacements simples, certains menant à une passe possible ensuite
    const destinations = getMoveDestinations(state, token);
    destinations.forEach(([dr, dc]) => {
      moves.push({ type: 'move', tokenId: token.id, to: [dr, dc] });

      if (!bonusMoveOnly && isAdjacent(dr, dc, state.ball.row, state.ball.col)) {
        // Simuler l'état juste après ce déplacement pour énumérer les passes
        // réellement disponibles depuis cette nouvelle position du pion.
        const simulatedTokens = state.tokens.map(t =>
          t.id === token.id ? { ...t, row: dr, col: dc } : t
        );
        const simulatedState = { ...state, tokens: simulatedTokens };
        const passesAfterMove = getPassDestinations(simulatedState);
        passesAfterMove.forEach(([pr, pc]) => {
          moves.push({ type: 'move_and_pass', tokenId: token.id, to: [dr, dc], passTo: [pr, pc] });
        });
      }
    });
  }

  return moves;
}

/**
 * Applique un coup décrit par listLegalMoves() à un état, et retourne le nouvel
 * état résultant. Centralise la logique d'exécution pour que l'IA n'ait jamais
 * à connaître les détails de selectToken/moveSelectedToken/passBall/passTurn.
 */
export function applyMove(state, move) {
  let next = selectToken(state, move.tokenId);

  if (move.type === 'pass') {
    return passBall(next, move.passTo[0], move.passTo[1]);
  }

  if (move.type === 'move') {
    next = moveSelectedToken(next, move.to[0], move.to[1]);
    // Le déplacement seul peut amener en phase MOVED_CAN_PASS si adjacent au
    // ballon ; comme ce coup ne prévoit pas de passe, on termine le tour.
    if (next.phase === PHASES.MOVED_CAN_PASS) {
      next = passTurn(next);
    }
    return next;
  }

  if (move.type === 'move_and_pass') {
    next = moveSelectedToken(next, move.to[0], move.to[1]);
    return passBall(next, move.passTo[0], move.passTo[1]);
  }

  return state;
}

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


// ==================== HANDLER (depuis index.ts) ====================

// ===================== push-game-state =====================
// Edge Function Supabase (Deno). Validation serveur des coups du multijoueur
// en ligne (#260) : le client n'envoie plus un état de jeu complet mais un
// JOURNAL D'ACTIONS ({ fn, args }). La fonction rejoue ces actions sur l'état
// AUTORITAIRE stocké en base, avec le même moteur pur que le client
// (public/src/engine/, importé en relatif — source unique, zéro duplication),
// et persiste le résultat du rejeu. Un coup illégal, un mauvais tour ou une
// action hors liste blanche ⇒ 422 avec l'état serveur (le client resynchronise).
//
// Rollout : tant que la migration 0039 n'est pas appliquée, l'ancienne RPC
// update_game_session_state reste appelable (chemin de repli du client).
// Ordre sûr : déployer CETTE fonction d'abord, constater, PUIS appliquer 0039
// pour fermer le chemin non validé.

// Le moteur est importé depuis ./_engine/ — DANS le dossier de la fonction,
// seule zone garantie embarquée au déploiement (CLI comme dashboard). Un import
// vers ../_shared/ (dossier frère) OU vers public/src/engine/ échoue :
// « Module not found » (hors du bundle de la fonction). Les copies sont
// maintenues identiques à la source par tools/sync-edge-engine.mjs et vérifiées
// par le test tests/edgeEngineSync.test.js. Voir ./_engine/README.md.

const FRONTEND_URL = Deno.env.get('FRONTEND_URL') ?? 'https://tactic-master.vercel.app';

// CORS restreint au front de production (même politique que create-checkout-session).
const corsHeaders = {
  'Access-Control-Allow-Origin': FRONTEND_URL,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

function jsonResponse(body: object, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

// Handler exporté (testable) ; branché sur Deno.serve en bas de fichier.
export async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'method not allowed' }, 405);
  }

  let body: { sessionId?: string; actions?: unknown[] };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'corps JSON invalide' }, 400);
  }
  const { sessionId, actions } = body;
  if (!sessionId || !Array.isArray(actions) || actions.length === 0 || actions.length > MAX_ACTIONS_PER_PUSH) {
    return jsonResponse({ error: 'sessionId et actions (1..' + MAX_ACTIONS_PER_PUSH + ') requis' }, 400);
  }

  // Identité de l'appelant : le JWT du joueur, vérifié par Supabase Auth.
  const authHeader = req.headers.get('Authorization') ?? '';
  const userClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  );
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData?.user) {
    return jsonResponse({ error: 'authentification requise' }, 401);
  }
  const userId = userData.user.id;

  // Accès service role : lecture de l'état autoritaire + écriture validée.
  const service = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );
  const { data: row, error: rowError } = await service
    .from('game_sessions')
    .select('id, game_state, status, host_user_id, guest_user_id, host_team')
    .eq('id', sessionId)
    .single();
  if (rowError || !row) {
    return jsonResponse({ error: 'partie introuvable' }, 404);
  }
  if (row.status !== 'active') {
    return jsonResponse({ error: 'partie non active', state: row.game_state }, 409);
  }
  if (userId !== row.host_user_id && userId !== row.guest_user_id) {
    return jsonResponse({ error: 'accès refusé' }, 403);
  }
  const team = userId === row.host_user_id
    ? row.host_team
    : (row.host_team === 'bleu' ? 'rouge' : 'bleu');

  const result = replayActions(row.game_state, actions as { fn: string; args: unknown[] }[], team);
  if ('error' in result) {
    // L'état serveur fait foi : le client le reprend tel quel.
    return jsonResponse({ error: result.error, state: row.game_state }, 422);
  }

  const { error: updateError } = await service
    .from('game_sessions')
    .update({
      game_state: result.state,
      last_activity_at: new Date().toISOString(),
      // Même transition que l'ancienne RPC : une partie finie est close.
      ...(result.state.gameOver ? { status: 'finished' } : {})
    })
    .eq('id', sessionId);
  if (updateError) {
    return jsonResponse({ error: 'écriture impossible : ' + updateError.message }, 500);
  }

  return jsonResponse({ state: result.state });
}

Deno.serve(handler);
