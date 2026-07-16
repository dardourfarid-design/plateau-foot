// ===================== SÉANCE DE TIRS AU BUT — MOTEUR v2 =====================
// Refonte du mini-jeu de tirs au but pour le design "Penalty" (6 zones + jauge
// de puissance/timing), portée fidèlement de la maquette. Remplacera à terme
// l'ancien moteur 3-directions (penaltyShootout.js) une fois l'UI basculée.
//
// Comme le reste du moteur, toutes les fonctions sont PURES : aucune mutation,
// on retourne toujours un nouvel état. Les aléas (lecture du gardien, position
// du "sweet spot" de la jauge, réussite du CPU) sont isolés dans des fonctions
// à RNG injectable, pour que la résolution d'un tir et la décision de fin de
// séance soient 100 % déterministes et testables.
//
// Modèle d'un tir joueur (Bleu) :
//   - le tireur choisit une ZONE (un des 6 coins) puis stoppe une jauge :
//     `power` ∈ [0,100], à rapprocher du `sweet` (centre de la zone verte).
//   - si |power - sweet| > WIDE_THRESHOLD → tir trop puissant/imprécis = RATÉ.
//   - sinon le tir est cadré : ARRÊT si le gardien a plongé dans la bonne zone
//     (il "lit" juste avec une proba croissante avec la difficulté), sinon BUT.

import { TEAMS } from './constants.js';

// Les 6 coins visés (haut/bas × gauche/centre/droite). L'UI leur associe des
// coordonnées pixel ; le moteur ne manipule que les identifiants.
export const SHOT_ZONES = Object.freeze(['tl', 'tc', 'tr', 'bl', 'bc', 'br']);

// Écart de timing au-delà duquel le tir part à côté (repris de la maquette).
export const WIDE_THRESHOLD = 33;

// ---------- Résolution PURE d'un tir ----------

/**
 * Résout un tir cadré/raté à partir d'entrées entièrement fournies (aucun
 * aléa ici). Retourne 'goal' | 'save' | 'miss'.
 *   zone       : coin visé par le tireur (SHOT_ZONES)
 *   power/sweet: position de la jauge et centre de la zone verte (0..100)
 *   keeperZone : coin dans lequel le gardien a plongé
 */
export function resolveShot({ zone, power, sweet, keeperZone }) {
  if (!SHOT_ZONES.includes(zone)) return 'miss';
  const wide = Math.abs(power - sweet) > WIDE_THRESHOLD;
  if (wide) return 'miss';
  return keeperZone === zone ? 'save' : 'goal';
}

// ---------- Aléas isolés (RNG injectable) ----------

/**
 * Le gardien plonge dans la bonne zone avec une proba croissante avec la
 * difficulté (0..100), sinon dans une zone au hasard. Repris de la maquette :
 * p(lecture juste) = 0.10 + difficulté * 0.004.
 */
export function readKeeperZone(zone, difficulty, rng = Math.random) {
  const readCorrect = rng() < (0.10 + difficulty * 0.004);
  if (readCorrect) return zone;
  return SHOT_ZONES[Math.floor(rng() * SHOT_ZONES.length)];
}

/** Centre de la zone verte de la jauge, dans [28, 72] (comme la maquette). */
export function randomSweet(rng = Math.random) {
  return 28 + rng() * 44;
}

/**
 * Probabilité de but d'un tir CPU — RÉFÉRENCE D'ÉQUILIBRAGE historique
 * (p = 0.52 + difficulté * 0.0022). Sert à calibrer le tir adverse joué à
 * l'écran (#227) pour ne pas déséquilibrer la séance en la rendant jouable.
 */
export function cpuGoalProbability(difficulty) {
  return 0.52 + difficulty * 0.0022;
}

/** Zone visée par le CPU : uniforme sur les 6 coins. */
export function cpuPickZone(rng = Math.random) {
  return SHOT_ZONES[Math.floor(rng() * SHOT_ZONES.length)];
}

/**
 * Le tir CPU part-il cadré ? Calibré pour CONSERVER l'équilibre historique :
 * face à un plongeon « à l'aveugle » (le joueur ne connaît pas la zone visée,
 * soit 1 chance sur 6 d'arrêter), on a p(but) = p(cadré) × 5/6. On pose donc
 * p(cadré) = p(but historique) × 6/5, borné à 1.
 */
export function cpuOnTarget(difficulty, rng = Math.random) {
  const n = SHOT_ZONES.length;
  return rng() < Math.min(1, cpuGoalProbability(difficulty) * n / (n - 1));
}

/**
 * Plan de tir adverse, décidé AVANT que le joueur ne plonge : l'UI a besoin de
 * la zone pour animer le tir, mais l'issue ne peut être connue qu'une fois le
 * plongeon choisi (voir resolveCpuShot).
 */
export function cpuPlanShot(difficulty, rng = Math.random) {
  return Object.freeze({ zone: cpuPickZone(rng), onTarget: cpuOnTarget(difficulty, rng) });
}

/** Issue d'un tir adverse planifié face au plongeon `keeperZone` du joueur. */
export function resolveCpuShot(plan, keeperZone) {
  if (!plan.onTarget) return 'miss';
  return keeperZone === plan.zone ? 'save' : 'goal';
}

// ---------- État & transitions ----------

/**
 * Crée une séance vierge. bestOf = nombre de tirs par équipe en temps
 * réglementaire (5 par défaut) ; difficulty ∈ [0,100] pilote gardien et CPU.
 */
export function createShootout(options = {}) {
  const bestOf = options.bestOf ?? 5;
  const difficulty = options.difficulty ?? 55;
  return Object.freeze({
    bestOf,
    difficulty,
    taker: TEAMS.BLEU,                                   // qui tire le prochain penalty
    score: { [TEAMS.BLEU]: 0, [TEAMS.ROUGE]: 0 },
    shots: { [TEAMS.BLEU]: [], [TEAMS.ROUGE]: [] },      // 'goal' | 'save' | 'miss'
    history: [],                                         // { taker, outcome }
    over: false,
    winner: null
  });
}

function other(team) {
  return team === TEAMS.BLEU ? TEAMS.ROUGE : TEAMS.BLEU;
}

export function goalsOf(shots) {
  return shots.filter(o => o === 'goal').length;
}

/**
 * Applique un résultat de tir ('goal'|'save'|'miss') au tireur courant :
 * enregistre le tir, met à jour le score, passe la main, et calcule la fin de
 * séance. Fonction pure (retourne un nouvel état gelé).
 */
export function applyShot(state, outcome) {
  if (state.over) return state;
  const taker = state.taker;
  const scored = outcome === 'goal';

  const next = {
    ...state,
    score: { ...state.score, [taker]: state.score[taker] + (scored ? 1 : 0) },
    shots: { ...state.shots, [taker]: [...state.shots[taker], outcome] },
    history: [...state.history, { taker, outcome }],
    taker: other(taker)
  };

  const verdict = decide(next);
  return Object.freeze({ ...next, over: verdict.over, winner: verdict.winner });
}

/**
 * Tir du joueur (Bleu) : résout puis applique. keeperZone et sweet sont
 * générés en amont par l'UI (via readKeeperZone/randomSweet) pour que cette
 * fonction reste déterministe.
 */
export function playerShoot(state, shot) {
  return applyShot(state, resolveShot(shot));
}

/**
 * Tir adverse (Rouge) JOUÉ à l'écran (#227) : le joueur plonge dans
 * `keeperZone`, le plan de tir ayant été décidé en amont par cpuPlanShot().
 * Remplace l'ancien `cpuShoot()` (tirage de dé invisible, jamais mis en scène).
 */
export function cpuShootAgainstDive(state, plan, keeperZone) {
  return applyShot(state, resolveCpuShot(plan, keeperZone));
}

/**
 * Détermine si la séance est finie et qui a gagné (clinch anticipé en temps
 * réglementaire, puis mort subite par paires). Suppose l'alternance Bleu→Rouge
 * à chaque manche (Bleu tire en premier).
 */
function decide(state) {
  const you = state.shots[TEAMS.BLEU];
  const cpu = state.shots[TEAMS.ROUGE];
  const base = state.bestOf;
  const ys = goalsOf(you), cs = goalsOf(cpu);
  const yn = you.length, cn = cpu.length;

  if (yn <= base && cn <= base) {
    const yMax = ys + (base - yn);   // max de buts encore atteignable
    const cMax = cs + (base - cn);
    if (ys > cMax) return { over: true, winner: TEAMS.BLEU };
    if (cs > yMax) return { over: true, winner: TEAMS.ROUGE };
    if (yn === base && cn === base) {
      if (ys > cs) return { over: true, winner: TEAMS.BLEU };
      if (cs > ys) return { over: true, winner: TEAMS.ROUGE };
    }
    return { over: false, winner: null };
  }

  // Mort subite : on ne tranche que quand les deux ont tiré autant de fois.
  if (yn === cn && ys !== cs) {
    return { over: true, winner: ys > cs ? TEAMS.BLEU : TEAMS.ROUGE };
  }
  return { over: false, winner: null };
}

export function isShootoutOver(state) {
  return state.over;
}

export function shootoutWinner(state) {
  return state.winner;
}

/** True dès qu'une des équipes a dépassé bestOf tirs (affichage "mort subite"). */
export function isSuddenDeath(state) {
  return state.shots[TEAMS.BLEU].length > state.bestOf
      || state.shots[TEAMS.ROUGE].length > state.bestOf;
}
