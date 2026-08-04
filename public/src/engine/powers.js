// ===================== POUVOIRS DE PION (MERCATO) =====================
// Pouvoirs spéciaux réservés aux pions obtenus par mercato (jamais sur la
// formation de départ standard, voir docs/team/game-designer.md pour la
// discussion d'équilibre qui a précédé ce sprint). Chaque pouvoir est
// activable une seule fois par partie, par pion — au-delà, il redevient un
// pion strictement normal pour le reste de la partie.
//
// Représentation dans l'état : chaque token peut porter deux champs
// optionnels, absents sur un pion normal :
//   power      : 'tir_puissant' | 'sprint' | 'mur' | 'relais' | 'repli_adverse'
//   powerUsed  : boolean (false par défaut dès qu'un power est présent)
//
// Comme pour le reste du moteur, toutes les fonctions ici sont pures : elles
// ne mutent jamais l'état, elles en retournent un nouveau.

import { TEAMS } from './constants.js';
import {
  inBounds, tokenAt, isBallAt, isAdjacent, isBlockedByWall, PHASES
} from './gameEngine.js';

export const POWER_TYPES = Object.freeze({
  TIR_PUISSANT: 'tir_puissant',
  SPRINT: 'sprint',
  MUR: 'mur',
  RELAIS: 'relais',
  REPLI_ADVERSE: 'repli_adverse'
});

export const POWER_LABELS = Object.freeze({
  [POWER_TYPES.TIR_PUISSANT]: 'Tir Puissant',
  [POWER_TYPES.SPRINT]: 'Sprint',
  [POWER_TYPES.MUR]: 'Mur',
  [POWER_TYPES.RELAIS]: 'Relais',
  [POWER_TYPES.REPLI_ADVERSE]: 'Repli adverse'
});

export const POWER_DESCRIPTIONS = Object.freeze({
  [POWER_TYPES.TIR_PUISSANT]: 'Pousse le ballon à travers le premier pion adverse rencontré, sans s\'arrêter contre lui.',
  [POWER_TYPES.SPRINT]: 'Ce pion se déplace de 2 cases au lieu d\'1, en ligne droite.',
  [POWER_TYPES.MUR]: 'Pendant le tour adverse suivant, ce pion coupe les passes diagonales qui contournent son coin.',
  [POWER_TYPES.RELAIS]: 'Après une passe, déplace immédiatement un second pion (sans nouvelle passe).',
  [POWER_TYPES.REPLI_ADVERSE]: 'Force un pion adverse choisi à reculer d\'une case avant son prochain tour.'
});

/**
 * Un pion peut activer son pouvoir s'il en a un, qu'il n'a pas déjà été
 * utilisé, et que c'est bien le tour de son équipe.
 */
export function canActivatePower(state, token) {
  if (!token.power || token.powerUsed) return false;
  if (state.gameOver) return false;
  if (token.team !== state.turn) return false;
  return true;
}

function markPowerUsed(state, tokenId) {
  return {
    ...state,
    tokens: state.tokens.map(t => t.id === tokenId ? { ...t, powerUsed: true } : t)
  };
}

// ---------------------------------------------------------------
// TIR PUISSANT — calcule les destinations de passe en ignorant le premier
// pion rencontré sur la trajectoire (au lieu de s'arrêter avant lui).
// Ne modifie pas getPassDestinations() du moteur principal : c'est une
// variante utilisée uniquement quand ce pouvoir est explicitement activé,
// pour ne jamais changer le comportement par défaut d'une passe normale.
// ---------------------------------------------------------------
export function getPowerShotDestinations(state) {
  const dests = [];
  const directions = [
    [-1, 0], [1, 0], [0, -1], [0, 1],
    [-1, -1], [-1, 1], [1, -1], [1, 1]
  ];
  directions.forEach(([dr, dc]) => {
    let fromR = state.ball.row;
    let fromC = state.ball.col;
    let r = fromR + dr;
    let c = fromC + dc;
    let piercedOnce = false;

    while (inBounds(r, c)) {
      // Un mur adverse coupe la diagonale même pour un tir puissant : le tir
      // traverse UN pion, il ne franchit pas un passage fermé.
      if (isBlockedByWall(state, fromR, fromC, dr, dc)) break;
      const occupant = tokenAt(state, r, c);
      if (occupant) {
        if (piercedOnce) break;
        piercedOnce = true;
        fromR = r; fromC = c;
        r += dr; c += dc;
        continue;
      }
      dests.push([r, c]);
      fromR = r; fromC = c;
      r += dr; c += dc;
    }
  });
  return dests;
}

export function activateTirPuissant(state, tokenId, row, col, applyBallMovementFn) {
  const token = state.tokens.find(t => t.id === tokenId);
  if (!token || !canActivatePower(state, token) || token.power !== POWER_TYPES.TIR_PUISSANT) return state;
  if (!isAdjacent(token.row, token.col, state.ball.row, state.ball.col)) return state;

  const valid = getPowerShotDestinations(state).some(([r, c]) => r === row && c === col);
  if (!valid) return state;

  const afterShot = applyBallMovementFn(state, row, col);
  return markPowerUsed(afterShot, tokenId);
}

// ---------------------------------------------------------------
// SPRINT — le pion se déplace de 2 cases en ligne droite (pas en diagonale
// longue ni en L) au lieu d'1, à condition que les deux cases du trajet
// soient libres (pas de saut par-dessus un pion ou le ballon).
// ---------------------------------------------------------------
export function getSprintDestinations(state, token) {
  const dests = [];
  const directions = [
    [-1, 0], [1, 0], [0, -1], [0, 1],
    [-1, -1], [-1, 1], [1, -1], [1, 1]
  ];
  directions.forEach(([dr, dc]) => {
    const r1 = token.row + dr, c1 = token.col + dc;
    const r2 = token.row + dr * 2, c2 = token.col + dc * 2;
    if (!inBounds(r1, c1) || !inBounds(r2, c2)) return;
    if (tokenAt(state, r1, c1) || isBallAt(state, r1, c1)) return;
    if (tokenAt(state, r2, c2) || isBallAt(state, r2, c2)) return;
    dests.push([r2, c2]);
  });
  return dests;
}

export function activateSprint(state, tokenId, row, col, moveSelectedTokenFn) {
  const token = state.tokens.find(t => t.id === tokenId);
  if (!token || !canActivatePower(state, token) || token.power !== POWER_TYPES.SPRINT) return state;

  const valid = getSprintDestinations(state, token).some(([r, c]) => r === row && c === col);
  if (!valid) return state;

  const stateWithSelection = { ...state, selectedTokenId: tokenId };
  const movedTokens = state.tokens.map(t => t.id === tokenId ? { ...t, row, col } : t);
  const stateAfterMove = moveSelectedTokenFn({ ...stateWithSelection, tokens: movedTokens }, row, col, true);

  return markPowerUsed(stateAfterMove, tokenId);
}

// ---------------------------------------------------------------
// MUR — marque le pion comme actif en mode "mur" pour le tour adverse
// suivant uniquement. L'effet réel (couper les trajectoires diagonales qui
// contournent le pion) est vérifié par isBlockedByWall(), définie dans
// gameEngine.js — powers.js importe déjà gameEngine, la vérification vit donc
// là-bas pour éviter un cycle, et est réexportée ici pour les appelants
// historiques.
//
// DURÉE DE VIE — le point délicat
// Le mur doit protéger pendant LE TOUR ADVERSE, puis disparaître. La version
// précédente le retirait dès que `state.turn` devenait celui de l'adversaire,
// c'est-à-dire au moment précis où il aurait dû agir : il n'a donc jamais eu le
// moindre effet. On distingue maintenant deux étapes explicites :
//   1. le tour passe à l'adversaire  -> on ARME l'expiration (le mur agit) ;
//   2. la main revient à l'activateur -> on retire le mur.
// Le drapeau intermédiaire évite de dépendre du moment exact où l'appelant
// invoque expireWallIfNeeded() : activateMur() ne termine pas le tour, donc
// l'appel qui suit immédiatement l'activation se fait encore du côté de
// l'activateur et ne doit rien retirer.
// ---------------------------------------------------------------
export { isBlockedByWall };

export function activateMur(state, tokenId) {
  const token = state.tokens.find(t => t.id === tokenId);
  if (!token || !canActivatePower(state, token) || token.power !== POWER_TYPES.MUR) return state;

  const stateWithWall = {
    ...state,
    activeWallTokenId: tokenId,
    activeWallTeam: token.team,
    activeWallArmed: false
  };
  return markPowerUsed(stateWithWall, tokenId);
}

export function expireWallIfNeeded(state) {
  if (!state.activeWallTokenId) return state;

  // Tour de l'adversaire : le mur agit. On note qu'il a bien vu le handoff.
  if (state.turn !== state.activeWallTeam) {
    return state.activeWallArmed ? state : { ...state, activeWallArmed: true };
  }

  // Tour de l'activateur. Si le mur n'a pas encore protégé un tour adverse,
  // c'est qu'on est entre l'activation et la fin du tour : on le laisse.
  if (!state.activeWallArmed) return state;

  const { activeWallTokenId, activeWallTeam, activeWallArmed, ...rest } = state;
  return rest;
}

// ---------------------------------------------------------------
// RELAIS — après une passe normale, autorise un second déplacement de pion
// (jamais une seconde passe) avant que le tour ne se termine réellement.
// ---------------------------------------------------------------
export function activateRelais(state, tokenId) {
  const token = state.tokens.find(t => t.id === tokenId);
  if (!token || !canActivatePower(state, token) || token.power !== POWER_TYPES.RELAIS) return state;
  if (!isAdjacent(token.row, token.col, state.ball.row, state.ball.col)) return state;

  return {
    ...state,
    relaisPendingForTeam: token.team,
    relaisSourceTokenId: tokenId
  };
}

export function confirmRelaisAfterPass(state) {
  if (!state.relaisPendingForTeam) return state;
  const tokenId = state.relaisSourceTokenId;
  const originalTeam = state.relaisPendingForTeam;
  const { relaisPendingForTeam, relaisSourceTokenId, ...rest } = state;
  // La passe normale qui vient de se jouer a déjà fait basculer state.turn
  // vers l'adversaire (comportement standard de passBall) ; le Relais
  // accorde un second mouvement à l'équipe qui vient de jouer, donc on
  // restaure le tour avant de continuer, sinon le bonus profiterait au
  // mauvais camp.
  const stateWithBonus = { ...rest, turn: originalTeam, phase: PHASES.SELECT, relaisBonusMoveAvailable: true };
  return markPowerUsed(stateWithBonus, tokenId);
}

// ---------------------------------------------------------------
// REPLI ADVERSE — force un pion adverse choisi à reculer d'une case dans sa
// propre moitié de terrain, appliqué immédiatement (pas différé), pour
// rester simple à raisonner et à synchroniser en multijoueur.
// ---------------------------------------------------------------
export function getValidRepliTargets(state, activatingTeam) {
  const opponentTeam = activatingTeam === TEAMS.BLEU ? TEAMS.ROUGE : TEAMS.BLEU;
  return state.tokens.filter(t => t.team === opponentTeam && !t.isGK);
}

export function activateRepliAdverse(state, tokenId, targetTokenId) {
  const token = state.tokens.find(t => t.id === tokenId);
  if (!token || !canActivatePower(state, token) || token.power !== POWER_TYPES.REPLI_ADVERSE) return state;

  const target = state.tokens.find(t => t.id === targetTokenId);
  if (!target || target.team === token.team) return state;

  const backRowDelta = target.team === TEAMS.BLEU ? 1 : -1;
  const newRow = target.row + backRowDelta;
  if (!inBounds(newRow, target.col)) return state;
  if (tokenAt(state, newRow, target.col) || isBallAt(state, newRow, target.col)) return state;

  const stateAfterRepli = {
    ...state,
    tokens: state.tokens.map(t => t.id === targetTokenId ? { ...t, row: newRow } : t)
  };
  return markPowerUsed(stateAfterRepli, tokenId);
}
