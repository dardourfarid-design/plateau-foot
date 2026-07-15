import { describe, test, expect } from './test-utils.js';
import { createGame, selectToken, passTurn, moveSelectedToken, passBall, applyBallMovement, getMoveDestinations } from '../public/src/engine/gameEngine.js';
import { TEAMS } from '../public/src/engine/constants.js';
import {
  POWER_TYPES, canActivatePower, getPowerShotDestinations, activateTirPuissant,
  getSprintDestinations, activateSprint, activateMur, isBlockedByWall, expireWallIfNeeded,
  activateRelais, confirmRelaisAfterPass, getValidRepliTargets, activateRepliAdverse
} from '../public/src/engine/powers.js';

function givePower(state, tokenId, power) {
  return {
    ...state,
    tokens: state.tokens.map(t => t.id === tokenId ? { ...t, power, powerUsed: false } : t)
  };
}

describe('canActivatePower', () => {
  test('refuse un pion sans pouvoir', () => {
    const state = createGame();
    const token = state.tokens.find(t => t.id === 'b-att1');
    expect(canActivatePower(state, token)).toBe(false);
  });

  test('refuse un pouvoir déjà utilisé', () => {
    let state = createGame();
    state = givePower(state, 'b-att1', POWER_TYPES.SPRINT);
    state = { ...state, tokens: state.tokens.map(t => t.id === 'b-att1' ? { ...t, powerUsed: true } : t) };
    const token = state.tokens.find(t => t.id === 'b-att1');
    expect(canActivatePower(state, token)).toBe(false);
  });

  test('refuse si ce n\'est pas le tour de l\'équipe du pion', () => {
    let state = createGame();
    state = givePower(state, 'r-att1', POWER_TYPES.SPRINT);
    const token = state.tokens.find(t => t.id === 'r-att1');
    expect(canActivatePower(state, token)).toBe(false);
  });

  test('accepte un pouvoir disponible au bon tour', () => {
    let state = createGame();
    state = givePower(state, 'b-att1', POWER_TYPES.SPRINT);
    const token = state.tokens.find(t => t.id === 'b-att1');
    expect(canActivatePower(state, token)).toBe(true);
  });
});

describe('Tir Puissant', () => {
  test('getPowerShotDestinations traverse un seul pion sur la trajectoire', () => {
    let state = createGame({ goalsToWin: 99 });
    state = { ...state, ball: { row: 4, col: 3 } };
    const tokens = state.tokens.map(t => {
      if (t.id === 'r-att1') return { ...t, row: 3, col: 3 };
      if (t.id === 'r-att0') return { ...t, row: 1, col: 3 };
      return t;
    });
    state = { ...state, tokens };
    const dests = getPowerShotDestinations(state);
    expect(dests.some(([r, c]) => r === 2 && c === 3)).toBe(true);
    expect(dests.some(([r, c]) => r === 0 && c === 3)).toBe(false);
  });

  test('activateTirPuissant marque le pouvoir utilisé après un tir réussi', () => {
    let state = createGame({ goalsToWin: 99 });
    state = { ...state, ball: { row: 4, col: 3 } };
    let tokens = state.tokens.map(t => t.id === 'b-att1' ? { ...t, row: 5, col: 3, power: POWER_TYPES.TIR_PUISSANT, powerUsed: false } : t);
    tokens = tokens.map(t => t.id === 'r-att1' ? { ...t, row: 3, col: 3 } : t);
    state = { ...state, tokens };

    const next = activateTirPuissant(state, 'b-att1', 2, 3, applyBallMovement);
    const updatedToken = next.tokens.find(t => t.id === 'b-att1');
    expect(updatedToken.powerUsed).toBe(true);
    expect(next.ball).toEqual({ row: 2, col: 3 });
  });

  test('refuse si le pion n\'est pas adjacent au ballon', () => {
    let state = createGame({ goalsToWin: 99 });
    state = givePower(state, 'b-att1', POWER_TYPES.TIR_PUISSANT);
    const next = activateTirPuissant(state, 'b-att1', 0, 3, applyBallMovement);
    expect(next).toBe(state);
  });
});

describe('Sprint', () => {
  test('getSprintDestinations retourne les cases à distance 2 en ligne droite', () => {
    const state = createGame();
    const token = state.tokens.find(t => t.id === 'b-att1'); // (6,3)
    const dests = getSprintDestinations(state, token);
    // Diagonale haut-gauche : (6,3) -> (5,2) -> (4,1), toutes deux libres
    // (contrairement à la ligne droite vers le haut qui croise le ballon en (4,3))
    expect(dests.some(([r, c]) => r === 4 && c === 1)).toBe(true);
  });

  test('ne propose pas une case si le trajet est bloqué par un pion intermédiaire', () => {
    let state = createGame();
    const tokens = state.tokens.map(t => t.id === 'b-def0' ? { ...t, row: 5, col: 3 } : t);
    state = { ...state, tokens };
    const token = state.tokens.find(t => t.id === 'b-att1');
    const dests = getSprintDestinations(state, token);
    expect(dests.some(([r, c]) => r === 4 && c === 3)).toBe(false);
  });

  test('activateSprint déplace le pion de 2 cases et marque le pouvoir utilisé', () => {
    let state = createGame();
    state = givePower(state, 'b-att1', POWER_TYPES.SPRINT);
    const next = activateSprint(state, 'b-att1', 4, 1, moveSelectedToken);
    const moved = next.tokens.find(t => t.id === 'b-att1');
    expect(moved.row).toBe(4);
    expect(moved.col).toBe(1);
    expect(moved.powerUsed).toBe(true);
  });
});

describe('Mur', () => {
  test('activateMur place le pion en mode mur actif jusqu\'au tour adverse suivant', () => {
    let state = createGame();
    state = givePower(state, 'b-att1', POWER_TYPES.MUR);
    const next = activateMur(state, 'b-att1');
    expect(next.activeWallTokenId).toBe('b-att1');
    const updated = next.tokens.find(t => t.id === 'b-att1');
    expect(updated.powerUsed).toBe(true);
  });

  test('isBlockedByWall détecte une trajectoire diagonale qui traverse le mur', () => {
    let state = createGame();
    state = givePower(state, 'b-att1', POWER_TYPES.MUR);
    state = activateMur(state, 'b-att1');
    expect(isBlockedByWall(state, 6, 3, 1, 1)).toBe(true);
    expect(isBlockedByWall(state, 6, 3, 1, 0)).toBe(false);
  });

  test('expireWallIfNeeded retire l\'effet une fois le tour concerné atteint', () => {
    let state = createGame();
    state = givePower(state, 'b-att1', POWER_TYPES.MUR);
    state = activateMur(state, 'b-att1');
    expect(state.activeWallTokenId).toBeTruthy();
    expect(expireWallIfNeeded(state).activeWallTokenId).toBeTruthy();

    const stateAtRougeTurn = { ...state, turn: TEAMS.ROUGE };
    expect(expireWallIfNeeded(stateAtRougeTurn).activeWallTokenId).toBe(undefined);
  });
});

describe('Relais', () => {
  function givePowerAdjacentToBall(state, tokenId, power) {
    // Place le pion juste au-dessus du ballon (4,3) pour qu'il soit adjacent,
    // condition requise pour activer Relais (comme pour une vraie passe).
    return {
      ...state,
      tokens: state.tokens.map(t => t.id === tokenId ? { ...t, row: 5, col: 3, power, powerUsed: false } : t)
    };
  }

  test('activateRelais pose le drapeau en attente sans encore marquer le pouvoir utilisé', () => {
    let state = createGame();
    state = givePowerAdjacentToBall(state, 'b-att1', POWER_TYPES.RELAIS);
    const next = activateRelais(state, 'b-att1');
    expect(next.relaisPendingForTeam).toBe(TEAMS.BLEU);
    const token = next.tokens.find(t => t.id === 'b-att1');
    expect(token.powerUsed).toBe(false);
  });

  test('confirmRelaisAfterPass active le bonus de mouvement et marque le pouvoir utilisé', () => {
    let state = createGame();
    state = givePowerAdjacentToBall(state, 'b-att1', POWER_TYPES.RELAIS);
    state = activateRelais(state, 'b-att1');
    // Simule le changement de tour qu'une vraie passe aurait déjà appliqué
    state = { ...state, turn: TEAMS.ROUGE };
    const next = confirmRelaisAfterPass(state);
    expect(next.relaisBonusMoveAvailable).toBe(true);
    expect(next.relaisPendingForTeam).toBe(undefined);
    expect(next.turn).toBe(TEAMS.BLEU); // le tour est restauré à l'équipe qui a le bonus
    const token = next.tokens.find(t => t.id === 'b-att1');
    expect(token.powerUsed).toBe(true);
  });

  test('ne fait rien si aucun relais n\'est en attente', () => {
    const state = createGame();
    const next = confirmRelaisAfterPass(state);
    expect(next).toBe(state);
  });

  test('scénario complet : activer, passer, déplacer un second pion, puis le tour change enfin', () => {
    let state = createGame({ goalsToWin: 99 });
    state = givePowerAdjacentToBall(state, 'b-att1', POWER_TYPES.RELAIS); // (5,3), adjacent au ballon (4,3)

    // 1. Active le Relais
    state = activateRelais(state, 'b-att1');
    expect(state.relaisPendingForTeam).toBe(TEAMS.BLEU);

    // 2. Joue la passe normale (le moteur change le tour comme d'habitude)
    state = selectToken({ ...state, selectedTokenId: null, relaisPendingForTeam: undefined, phase: 'select' }, 'b-att1');
    // Note : on ne peut pas re-déclencher relaisPendingForTeam ici sans le moteur complet ;
    // on simule directement l'état juste après une passe réussie avec relais en attente.
    state = { ...state, relaisPendingForTeam: TEAMS.BLEU, relaisSourceTokenId: 'b-att1', turn: TEAMS.ROUGE };

    // 3. Le flux applicatif confirme le relais après la passe (restaure le tour, pose le bonus)
    state = confirmRelaisAfterPass(state);
    expect(state.turn).toBe(TEAMS.BLEU);
    expect(state.relaisBonusMoveAvailable).toBe(true);

    // 4. Une tentative de passe est refusée pendant le bonus (seul un déplacement est permis)
    const passAttempt = passBall(state, 0, 2);
    expect(passAttempt).toBe(state);

    // 5. Un déplacement normal consomme le bonus — c'est CE déplacement qui
    // constitue le tour gratuit accordé par Relais, donc le tour ne change
    // pas encore à cette étape précise (le bonus vient d'être "dépensé").
    state = selectToken(state, 'b-def0');
    const moves = getMoveDestinations(state, state.tokens.find(t => t.id === 'b-def0'));
    expect(moves.length > 0).toBe(true);
    const [mr, mc] = moves[0];
    state = moveSelectedToken(state, mr, mc);
    expect(state.relaisBonusMoveAvailable).toBe(undefined);
    expect(state.turn).toBe(TEAMS.BLEU); // le tour gratuit vient d'être consommé, toujours à Bleu

    // 6. Un troisième mouvement, cette fois sans bonus, termine vraiment le tour
    state = selectToken(state, 'b-def1');
    const moves2 = getMoveDestinations(state, state.tokens.find(t => t.id === 'b-def1'));
    expect(moves2.length > 0).toBe(true);
    const [mr2, mc2] = moves2[0];
    state = moveSelectedToken(state, mr2, mc2);
    expect(state.turn).toBe(TEAMS.ROUGE); // cette fois le tour change vraiment
  });
});

describe('Repli adverse', () => {
  test('getValidRepliTargets exclut les gardiens et la propre équipe', () => {
    const state = createGame();
    const targets = getValidRepliTargets(state, TEAMS.BLEU);
    expect(targets.every(t => t.team === TEAMS.ROUGE)).toBe(true);
    expect(targets.every(t => !t.isGK)).toBe(true);
  });

  test('activateRepliAdverse fait reculer le pion ciblé dans sa propre moitié', () => {
    let state = createGame();
    state = givePower(state, 'b-att1', POWER_TYPES.REPLI_ADVERSE);
    const targetBefore = state.tokens.find(t => t.id === 'r-att1');
    const next = activateRepliAdverse(state, 'b-att1', 'r-att1');
    const targetAfter = next.tokens.find(t => t.id === 'r-att1');
    expect(targetAfter.row).toBe(targetBefore.row - 1);
    const activator = next.tokens.find(t => t.id === 'b-att1');
    expect(activator.powerUsed).toBe(true);
  });

  test('refuse de cibler un pion de sa propre équipe', () => {
    let state = createGame();
    state = givePower(state, 'b-att1', POWER_TYPES.REPLI_ADVERSE);
    const next = activateRepliAdverse(state, 'b-att1', 'b-def0');
    expect(next).toBe(state);
  });
});
