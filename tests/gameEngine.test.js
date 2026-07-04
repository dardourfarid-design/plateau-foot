import { describe, test, expect } from './test-utils.js';
import {
  createGame, selectToken, moveSelectedToken, passBall, passTurn,
  resetBallAfterGoal, getMoveDestinations, getPassDestinations,
  tokenAt, isAdjacent, PHASES, listLegalMoves, applyMove,
  isCellCoveredBy, isWingPass, applyBallMovement, STALL_LIMIT,
  penaltySpotFor, isPenaltyShot
} from '../src/engine/gameEngine.js';
import { TEAMS, CENTER } from '../src/engine/constants.js';

describe('createGame', () => {
  test('crée un état initial cohérent', () => {
    const state = createGame();
    expect(state.turn).toBe(TEAMS.BLEU);
    expect(state.score[TEAMS.BLEU]).toBe(0);
    expect(state.score[TEAMS.ROUGE]).toBe(0);
    expect(state.gameOver).toBe(false);
    expect(state.ball).toEqual({ row: CENTER.row, col: CENTER.col });
  });

  test('respecte le nombre de buts pour gagner fourni en option', () => {
    const state = createGame({ goalsToWin: 1 });
    expect(state.goalsToWin).toBe(1);
  });
});

describe('selectToken', () => {
  test('sélectionne un pion appartenant au joueur actif', () => {
    const state = createGame();
    const next = selectToken(state, 'b-att1');
    expect(next.selectedTokenId).toBe('b-att1');
  });

  test('refuse de sélectionner un pion adverse', () => {
    const state = createGame();
    const next = selectToken(state, 'r-att1'); // c'est au tour de bleu
    expect(next.selectedTokenId).toBeNull();
  });

  test('refuse de sélectionner un pion inexistant', () => {
    const state = createGame();
    const next = selectToken(state, 'inexistant');
    expect(next).toEqual(state); // état inchangé
  });
});

describe('moveSelectedToken', () => {
  test('déplace le pion vers une case adjacente libre', () => {
    let state = createGame();
    const token = state.tokens.find(t => t.id === 'b-def1'); // (9,3)
    state = selectToken(state, 'b-def1');
    const next = moveSelectedToken(state, token.row - 1, token.col - 1);
    const moved = next.tokens.find(t => t.id === 'b-def1');
    expect(moved.row).toBe(token.row - 1);
    expect(moved.col).toBe(token.col - 1);
  });

  test('termine le tour si le déplacement ne touche pas le ballon', () => {
    let state = createGame();
    state = selectToken(state, 'b-def1'); // (7,5), loin du ballon en (4,3)
    const next = moveSelectedToken(state, 6, 4); // déplacement adjacent réel (-1,-1)
    expect(next.turn).toBe(TEAMS.ROUGE);
    expect(next.phase).toBe(PHASES.SELECT);
  });

  test('passe en phase MOVED_CAN_PASS si le pion arrive adjacent au ballon', () => {
    let state = createGame();
    // b-att1 est en (row attaque bleue, col 4), juste sous le centre où est le ballon
    const att = state.tokens.find(t => t.id === 'b-att1');
    state = selectToken(state, 'b-att1');
    // Déplacement d'une case vers le ballon pour devenir adjacent
    const dest = getMoveDestinations(state, att).find(([r, c]) =>
      isAdjacent(r, c, state.ball.row, state.ball.col)
    );
    expect(dest).toBeTruthy();
    const next = moveSelectedToken(state, dest[0], dest[1]);
    expect(next.phase).toBe(PHASES.MOVED_CAN_PASS);
    expect(next.turn).toBe(TEAMS.BLEU); // le tour n'a pas encore changé
  });

  test('ignore un déplacement vers une case non valide', () => {
    let state = createGame();
    state = selectToken(state, 'b-def1');
    const farAway = moveSelectedToken(state, 0, 0); // bien trop loin pour 1 case
    expect(farAway).toEqual(state);
  });

  test('un pion ne peut pas se déplacer sur une case déjà occupée', () => {
    let state = createGame();
    state = selectToken(state, 'b-def1');
    const otherToken = state.tokens.find(t => t.id === 'b-gk');
    const moves = getMoveDestinations(state, state.tokens.find(t => t.id === 'b-def1'));
    const collidesWithGk = moves.some(([r, c]) => r === otherToken.row && c === otherToken.col);
    expect(collidesWithGk).toBeFalsy();
  });
});

describe('règle du gardien', () => {
  test('le gardien ne peut pas sortir de sa zone de cage', () => {
    const state = createGame();
    const gk = state.tokens.find(t => t.id === 'b-gk');
    const moves = getMoveDestinations(state, gk);
    // Toutes les destinations doivent rester dans les 3 dernières lignes du plateau
    const allWithinZone = moves.every(([r]) => r >= 8);
    expect(allWithinZone).toBeTruthy();
  });
});

describe('passBall', () => {
  function setupAdjacentToBall(state, tokenId) {
    // Utilitaire de test : place artificiellement un pion juste sous le ballon
    const newTokens = state.tokens.map(t =>
      t.id === tokenId ? { ...t, row: state.ball.row + 1, col: state.ball.col } : t
    );
    return { ...state, tokens: newTokens };
  }

  test('pousse le ballon en ligne droite jusqu’à la case choisie', () => {
    let state = createGame();
    state = setupAdjacentToBall(state, 'b-att1');
    state = selectToken(state, 'b-att1');
    const next = passBall(state, state.ball.row, state.ball.col - 3);
    expect(next.ball).toEqual({ row: state.ball.row, col: state.ball.col - 3 });
  });

  test('la passe s’arrête avant le premier pion rencontré', () => {
    let state = createGame();
    state = setupAdjacentToBall(state, 'b-att1');
    state = selectToken(state, 'b-att1');
    const passes = getPassDestinations(state);
    // Aucune destination de passe ne doit être une case occupée
    const anyOccupied = passes.some(([r, c]) => tokenAt(state, r, c) !== null);
    expect(anyOccupied).toBeFalsy();
  });

  test('un but bleu incrémente le score et fait passer le tour à rouge', () => {
    let state = createGame({ goalsToWin: 99 });
    // Placer le ballon juste devant la cage rouge, sur une colonne libre (pas le gardien en col 3)
    state = { ...state, ball: { row: 1, col: 2 } };
    state = setupAdjacentToBall(state, 'b-att1'); // ne sert qu'à neutraliser, on resélectionne ensuite
    const tokens = state.tokens.map(t =>
      t.id === 'b-att1' ? { ...t, row: 2, col: 2 } : t
    );
    state = { ...state, tokens };
    state = selectToken(state, 'b-att1');
    const next = passBall(state, 0, 2); // case de cage rouge libre
    expect(next.score[TEAMS.BLEU]).toBe(1);
    expect(next.turn).toBe(TEAMS.ROUGE); // l'équipe qui encaisse engage
    expect(next.lastGoalBy).toBe(TEAMS.BLEU);
  });

  test('le tir est bloqué si le gardien occupe la case de but visée', () => {
    let state = createGame({ goalsToWin: 99 });
    state = { ...state, ball: { row: 1, col: 3 } }; // colonne du gardien rouge (r-gk en (0,3))
    const tokens = state.tokens.map(t =>
      t.id === 'b-att1' ? { ...t, row: 2, col: 3 } : t
    );
    state = { ...state, tokens };
    state = selectToken(state, 'b-att1');
    const passes = getPassDestinations(state);
    const goalCellReachable = passes.some(([r, c]) => r === 0 && c === 3);
    expect(goalCellReachable).toBeFalsy(); // le gardien bloque l'accès à sa propre case
  });

  test('atteindre exactement goalsToWin déclenche la fin de partie avec le bon vainqueur', () => {
    let state = createGame({ goalsToWin: 1 });
    state = { ...state, ball: { row: 1, col: 2 } };
    const tokens = state.tokens.map(t =>
      t.id === 'b-att1' ? { ...t, row: 2, col: 2 } : t
    );
    state = { ...state, tokens };
    state = selectToken(state, 'b-att1');
    const next = passBall(state, 0, 2);
    expect(next.gameOver).toBe(true);
    expect(next.winner).toBe(TEAMS.BLEU);
  });
});

describe('passTurn', () => {
  test('termine le tour sans déplacer le ballon depuis la phase MOVED_CAN_PASS', () => {
    let state = createGame();
    const att = state.tokens.find(t => t.id === 'b-att1');
    state = selectToken(state, 'b-att1');
    const dest = getMoveDestinations(state, att).find(([r, c]) =>
      isAdjacent(r, c, state.ball.row, state.ball.col)
    );
    state = moveSelectedToken(state, dest[0], dest[1]);
    expect(state.phase).toBe(PHASES.MOVED_CAN_PASS);
    const next = passTurn(state);
    expect(next.turn).toBe(TEAMS.ROUGE);
    expect(next.ball).toEqual({ row: CENTER.row, col: CENTER.col }); // ballon non déplacé
  });
});

describe('resetBallAfterGoal', () => {
  test('remet le ballon au centre exact', () => {
    let state = createGame({ goalsToWin: 99 });
    state = { ...state, ball: { row: 0, col: 3 }, lastGoalBy: TEAMS.BLEU };
    const next = resetBallAfterGoal(state);
    expect(next.ball).toEqual({ row: CENTER.row, col: CENTER.col });
  });

  test('remet aussi tous les pions à leur formation de départ', () => {
    let state = createGame({ goalsToWin: 99 });
    const original = JSON.parse(JSON.stringify(state.tokens));
    // Simule des pions déplacés n'importe où, comme en fin de séquence de jeu
    const movedTokens = state.tokens.map(t => ({ ...t, row: 4, col: 3 }));
    state = { ...state, tokens: movedTokens, lastGoalBy: TEAMS.BLEU };
    const next = resetBallAfterGoal(state);
    expect(next.tokens).toEqual(original);
  });

  test('ne fait rien si la partie est terminée', () => {
    let state = createGame({ goalsToWin: 1 });
    state = { ...state, gameOver: true, winner: TEAMS.BLEU, ball: { row: 0, col: 3 } };
    const next = resetBallAfterGoal(state);
    expect(next.ball).toEqual({ row: 0, col: 3 }); // inchangé
  });
});

describe('immutabilité de l’état', () => {
  test('moveSelectedToken ne mute pas l’état original', () => {
    const state = createGame();
    const original = JSON.parse(JSON.stringify(state));
    let s2 = selectToken(state, 'b-def1');
    s2 = moveSelectedToken(s2, 8, 2);
    expect(state.tokens).toEqual(original.tokens);
    expect(state.turn).toEqual(original.turn);
  });
});

describe('listLegalMoves', () => {
  test('retourne une liste non vide en début de partie', () => {
    const state = createGame();
    const moves = listLegalMoves(state);
    expect(moves.length > 0).toBe(true);
  });

  test('ne propose que des coups pour l’équipe au tour', () => {
    const state = createGame(); // tour de bleu
    const moves = listLegalMoves(state);
    const allBleu = moves.every(m => {
      const tok = state.tokens.find(t => t.id === m.tokenId);
      return tok.team === TEAMS.BLEU;
    });
    expect(allBleu).toBe(true);
  });

  test('retourne un tableau vide si la partie est terminée', () => {
    let state = createGame({ goalsToWin: 1 });
    state = { ...state, gameOver: true, winner: TEAMS.BLEU };
    const moves = listLegalMoves(state);
    expect(moves).toEqual([]);
  });

  test('inclut des coups move_and_pass quand un déplacement amène au contact du ballon', () => {
    const state = createGame();
    const moves = listLegalMoves(state);
    const hasMoveAndPass = moves.some(m => m.type === 'move_and_pass');
    expect(hasMoveAndPass).toBe(true);
  });

  test('chaque coup move référence une destination réellement valide', () => {
    const state = createGame();
    const moves = listLegalMoves(state).filter(m => m.type === 'move');
    const allValid = moves.every(m => {
      const tok = state.tokens.find(t => t.id === m.tokenId);
      const validDests = getMoveDestinations(state, tok);
      return validDests.some(([r, c]) => r === m.to[0] && c === m.to[1]);
    });
    expect(allValid).toBe(true);
  });
});

describe('applyMove', () => {
  test('applique correctement un coup de type move', () => {
    const state = createGame();
    const moves = listLegalMoves(state).filter(m => m.type === 'move');
    const move = moves[0];
    const next = applyMove(state, move);
    const movedToken = next.tokens.find(t => t.id === move.tokenId);
    expect(movedToken.row).toBe(move.to[0]);
    expect(movedToken.col).toBe(move.to[1]);
  });

  test('applique correctement un coup de type move_and_pass, y compris un but', () => {
    let state = createGame({ goalsToWin: 99 });
    state = { ...state, ball: { row: 1, col: 2 } };
    const tokens = state.tokens.map(t =>
      t.id === 'b-att1' ? { ...t, row: 2, col: 1 } : t
    );
    state = { ...state, tokens };
    const move = { type: 'move_and_pass', tokenId: 'b-att1', to: [2, 2], passTo: [0, 2] };
    const next = applyMove(state, move);
    expect(next.score[TEAMS.BLEU]).toBe(1);
  });

  test('un coup move qui ne touche pas le ballon termine le tour', () => {
    const state = createGame();
    const moves = listLegalMoves(state).filter(m => m.type === 'move');
    // b-def* sont loin du ballon en début de partie
    const farMove = moves.find(m => m.tokenId.startsWith('b-def'));
    const next = applyMove(state, farMove);
    expect(next.turn).toBe(TEAMS.ROUGE);
  });

  test('appliquer chaque coup listé par listLegalMoves ne lève jamais d’erreur', () => {
    const state = createGame();
    const moves = listLegalMoves(state);
    let allOk = true;
    moves.forEach(m => {
      try {
        applyMove(state, m);
      } catch (e) {
        allOk = false;
      }
    });
    expect(allOk).toBe(true);
  });
});

// ===================== v0.5 : COUVERTURE / INTERCEPTION =====================
describe('couverture / interception (v0.5)', () => {
  function bare(ball, tokens, turn = TEAMS.BLEU) {
    return { ...createGame({ goalsToWin: 99 }), ball, tokens, turn };
  }

  test('un pion adverse coupe la case orthogonalement adjacente et le reste de la ligne', () => {
    const state = bare({ row: 6, col: 3 }, [
      { id: 'r-x', team: TEAMS.ROUGE, row: 3, col: 3, isGK: false }
    ]);
    const passes = getPassDestinations(state).map(([r, c]) => [r, c]);
    // (5,3) reste libre et non couverte -> atteignable
    expect(passes.some(([r, c]) => r === 5 && c === 3)).toBeTruthy();
    // (4,3) est couverte par le pion rouge en (3,3) -> interceptee, injouable
    expect(passes.some(([r, c]) => r === 4 && c === 3)).toBeFalsy();
    // et rien au-dela non plus
    expect(passes.some(([r, c]) => r <= 3 && c === 3)).toBeFalsy();
  });

  test('une passe partant d une aile (centre) ignore la couverture', () => {
    const state = bare({ row: 6, col: 0 }, [
      { id: 'r-x', team: TEAMS.ROUGE, row: 3, col: 0, isGK: false }
    ]);
    const passes = getPassDestinations(state).map(([r, c]) => [r, c]);
    // (4,0) serait couverte par (3,0), mais le centre l ignore -> atteignable
    expect(passes.some(([r, c]) => r === 4 && c === 0)).toBeTruthy();
  });

  test('le gardien adverse ne couvre pas (il defend en occupant sa cage)', () => {
    const state = bare({ row: 6, col: 3 }, [
      { id: 'r-gk', team: TEAMS.ROUGE, row: 3, col: 3, isGK: true }
    ]);
    const passes = getPassDestinations(state).map(([r, c]) => [r, c]);
    expect(passes.some(([r, c]) => r === 4 && c === 3)).toBeTruthy();
  });

  test('nos propres pions ne couvrent jamais nos passes', () => {
    const state = bare({ row: 6, col: 3 }, [
      { id: 'b-x', team: TEAMS.BLEU, row: 3, col: 3, isGK: false }
    ]);
    const passes = getPassDestinations(state).map(([r, c]) => [r, c]);
    expect(passes.some(([r, c]) => r === 4 && c === 3)).toBeTruthy();
  });

  test('isCellCoveredBy et isWingPass exposees et coherentes', () => {
    const state = bare({ row: 6, col: 0 }, [
      { id: 'r-x', team: TEAMS.ROUGE, row: 5, col: 1, isGK: false }
    ]);
    expect(isWingPass(state)).toBeTruthy();
    expect(isCellCoveredBy(state, 5, 0, TEAMS.ROUGE)).toBeTruthy();
    expect(isCellCoveredBy(state, 5, 0, TEAMS.BLEU)).toBeFalsy();
  });
});

// ===================== v0.5 : UNE-DEUX / MOMENTUM / ANTI-BLOCAGE =============
describe('une-deux (combo v0.5)', () => {
  function bare(ball, tokens, extra = {}) {
    return { ...createGame({ goalsToWin: 99 }), ball, tokens, turn: TEAMS.BLEU, ...extra };
  }

  test('une passe qui arrive a cote d un appui allie offre un mouvement bonus (meme camp)', () => {
    let state = bare({ row: 6, col: 3 }, [
      { id: 'b-p', team: TEAMS.BLEU, row: 7, col: 3, isGK: false }, // passeur, adjacent au ballon
      { id: 'b-a', team: TEAMS.BLEU, row: 4, col: 3, isGK: false }  // appui : (5,3) sera a cote de lui
    ]);
    state = selectToken(state, 'b-p');
    const after = passBall(state, 5, 3);
    expect(after.ball).toEqual({ row: 5, col: 3 });
    expect(after.comboMoveAvailable).toBe(true);
    expect(after.turn).toBe(TEAMS.BLEU); // meme equipe rejoue
    expect(after.phase).toBe(PHASES.SELECT);
  });

  test('le mouvement bonus une-deux rend ensuite la main a l adversaire', () => {
    let state = bare({ row: 6, col: 3 }, [
      { id: 'b-p', team: TEAMS.BLEU, row: 7, col: 3, isGK: false },
      { id: 'b-a', team: TEAMS.BLEU, row: 4, col: 3, isGK: false }
    ]);
    state = selectToken(state, 'b-p');
    state = passBall(state, 5, 3); // combo arme
    state = selectToken(state, 'b-p');
    state = moveSelectedToken(state, 7, 2); // deplacement bonus, loin du ballon
    expect(state.turn).toBe(TEAMS.ROUGE); // handoff propre
    expect(state.comboMoveAvailable).toBeFalsy();
  });

  test('pas de seconde passe pendant le bonus une-deux', () => {
    let state = bare({ row: 6, col: 3 }, [
      { id: 'b-p', team: TEAMS.BLEU, row: 7, col: 3, isGK: false },
      { id: 'b-a', team: TEAMS.BLEU, row: 4, col: 3, isGK: false }
    ]);
    state = selectToken(state, 'b-p');
    state = passBall(state, 5, 3);
    const blocked = passBall(state, 5, 2); // tentative de 2e passe
    expect(blocked).toBe(state); // refusee
  });
});

describe('momentum (v0.5)', () => {
  test('les passes consecutives de la meme possession incrementent passStreak', () => {
    const state = { ...createGame({ goalsToWin: 99 }), ball: { row: 5, col: 3 },
      turn: TEAMS.BLEU, possession: TEAMS.BLEU, passStreak: 2, tokens: [] };
    const after = applyBallMovement(state, 4, 3);
    expect(after.passStreak).toBe(3);
    expect(after.possession).toBe(TEAMS.BLEU);
  });

  test('la possession qui change remet passStreak a 1', () => {
    const state = { ...createGame({ goalsToWin: 99 }), ball: { row: 5, col: 3 },
      turn: TEAMS.ROUGE, possession: TEAMS.BLEU, passStreak: 4, tokens: [] };
    const after = applyBallMovement(state, 6, 3);
    expect(after.possession).toBe(TEAMS.ROUGE);
    expect(after.passStreak).toBe(1);
  });

  test('un but expose lastGoalPassStreak pour le bonus', () => {
    const state = { ...createGame({ goalsToWin: 99 }), ball: { row: 1, col: 2 },
      turn: TEAMS.BLEU, possession: TEAMS.BLEU, passStreak: 3, tokens: [] };
    const after = applyBallMovement(state, 0, 2); // cage rouge
    expect(after.score[TEAMS.BLEU]).toBe(1);
    expect(after.lastGoalPassStreak).toBe(4); // 3 + la passe du but
  });
});

describe('anti-blocage (v0.5)', () => {
  test('STALL_LIMIT tours sans passe declenchent un engagement neutre au centre', () => {
    let state = { ...createGame({ goalsToWin: 99 }), ball: { row: 6, col: 0 },
      turn: TEAMS.BLEU, ballIdleTurns: STALL_LIMIT - 1,
      tokens: [{ id: 'b-p', team: TEAMS.BLEU, row: 8, col: 6, isGK: false }] };
    state = selectToken(state, 'b-p');
    state = moveSelectedToken(state, 7, 6); // deplacement seul, aucune passe
    expect(state.stalled).toBe(true);
    expect(state.ball).toEqual({ row: CENTER.row, col: CENTER.col });
    expect(state.ballIdleTurns).toBe(0);
  });

  test('une passe remet le compteur d inactivite a zero', () => {
    const state = { ...createGame({ goalsToWin: 99 }), ball: { row: 5, col: 3 },
      turn: TEAMS.BLEU, ballIdleTurns: 5, tokens: [] };
    const after = applyBallMovement(state, 4, 3);
    expect(after.ballIdleTurns).toBe(0);
  });
});

// ===================== v0.5 : POINT DE PENALTY ==============================
describe('point de penalty (v0.5)', () => {
  function bare(ball, tokens) {
    return { ...createGame({ goalsToWin: 99 }), ball, tokens, turn: TEAMS.BLEU };
  }

  test('depuis le point de penalty, le tir transperce un defenseur de champ jusqu a la cage', () => {
    const sp = penaltySpotFor(TEAMS.BLEU); // (2,3)
    let state = bare({ row: sp.row, col: sp.col }, [
      { id: 'b-p', team: TEAMS.BLEU, row: 3, col: 3, isGK: false }, // passeur adjacent
      { id: 'r-d', team: TEAMS.ROUGE, row: 1, col: 3, isGK: false }, // defenseur devant la cage
      { id: 'r-gk', team: TEAMS.ROUGE, row: 0, col: 1, isGK: true }  // gardien decale
    ]);
    expect(isPenaltyShot(state)).toBeTruthy();
    const dests = getPassDestinations(state).map(([r, c]) => [r, c]);
    expect(dests.some(([r, c]) => r === 0 && c === 3)).toBeTruthy(); // cage atteignable
    state = selectToken(state, 'b-p');
    const scored = passBall(state, 0, 3);
    expect(scored.score[TEAMS.BLEU]).toBe(1);
  });

  test('le gardien sur la case visee arrete quand meme le penalty', () => {
    const sp = penaltySpotFor(TEAMS.BLEU);
    const state = bare({ row: sp.row, col: sp.col }, [
      { id: 'b-p', team: TEAMS.BLEU, row: 3, col: 3, isGK: false },
      { id: 'r-gk', team: TEAMS.ROUGE, row: 0, col: 3, isGK: true } // pile dans l axe
    ]);
    const dests = getPassDestinations(state).map(([r, c]) => [r, c]);
    expect(dests.some(([r, c]) => r === 0 && c === 3)).toBeFalsy(); // stoppe par le gardien
  });

  test('hors du point de penalty, pas de tir perforant', () => {
    let state = bare({ row: 3, col: 3 }, [ // ballon ailleurs
      { id: 'b-p', team: TEAMS.BLEU, row: 4, col: 3, isGK: false },
      { id: 'r-d', team: TEAMS.ROUGE, row: 2, col: 3, isGK: false }
    ]);
    const dests = getPassDestinations(state).map(([r, c]) => [r, c]);
    expect(dests.some(([r, c]) => r <= 1 && c === 3)).toBeFalsy(); // rien ne traverse r-d
  });
});

// ===================== v0.5 : VARIANTE + POUVOIRS GRATUITS ===================
describe('variante Tactique et pouvoirs gratuits (v0.5)', () => {
  test('la variante tactique cree 8 pions par equipe', () => {
    const state = createGame({ variant: 'tactique' });
    expect(state.variant).toBe('tactique');
    expect(state.tokens.filter(t => t.team === TEAMS.BLEU)).toHaveLength(8);
    expect(state.tokens.filter(t => t.team === TEAMS.ROUGE)).toHaveLength(8);
  });

  test('la partie standard reste a 6 pions par equipe', () => {
    const state = createGame();
    expect(state.variant).toBe('standard');
    expect(state.tokens.filter(t => t.team === TEAMS.BLEU)).toHaveLength(6);
  });

  test('freePowers distribue exactement un pouvoir par equipe, sur un pion de champ', () => {
    const state = createGame({ freePowers: true, rng: () => 0.42 });
    const withPower = state.tokens.filter(t => t.power);
    expect(withPower).toHaveLength(2);
    expect(withPower.every(t => !t.isGK)).toBeTruthy();
    expect(withPower.every(t => t.powerUsed === false)).toBeTruthy();
    const teams = withPower.map(t => t.team).sort();
    expect(teams).toEqual([TEAMS.BLEU, TEAMS.ROUGE]);
  });

  test('sans freePowers, aucun pouvoir sur la formation de depart', () => {
    const state = createGame();
    expect(state.tokens.some(t => t.power)).toBeFalsy();
  });

  test('apres un but, la variante est preservee au replacement des pions', () => {
    let state = createGame({ variant: 'tactique', goalsToWin: 99 });
    state = { ...state, ball: { row: 1, col: 2 }, lastGoalBy: TEAMS.BLEU };
    const reset = resetBallAfterGoal(state);
    expect(reset.tokens.filter(t => t.team === TEAMS.BLEU)).toHaveLength(8);
  });
});

// ===================== v0.5 : MANCHE COURTE / DEPARTAGE =====================
describe('manche courte (turnLimit) et depart au nul (v0.5)', () => {
  test('turnCount s incremente a chaque tour joue', () => {
    let state = createGame({ turnLimit: 10, goalsToWin: 99 });
    expect(state.turnCount).toBe(0);
    state = selectToken(state, 'b-att0');
    state = moveSelectedToken(state, 5, 1); // deplacement simple, loin du ballon -> fin de tour
    expect(state.turnCount).toBe(1);
    expect(state.turn).toBe(TEAMS.ROUGE);
  });

  test('atteindre la limite de tours a egalite termine sur un match nul', () => {
    let state = createGame({ turnLimit: 1, goalsToWin: 99 });
    state = selectToken(state, 'b-att0');
    state = moveSelectedToken(state, 5, 1);
    expect(state.gameOver).toBe(true);
    expect(state.isDraw).toBe(true);
    expect(state.winner).toBeNull();
  });

  test('atteindre la limite avec un score different designe le vainqueur (pas de nul)', () => {
    let state = { ...createGame({ turnLimit: 1, goalsToWin: 99 }), score: { [TEAMS.BLEU]: 1, [TEAMS.ROUGE]: 0 } };
    state = selectToken(state, 'b-att0');
    state = moveSelectedToken(state, 5, 1);
    expect(state.gameOver).toBe(true);
    expect(state.isDraw).toBe(false);
    expect(state.winner).toBe(TEAMS.BLEU);
  });

  test('sans turnLimit, une partie ne se termine jamais par le compteur de tours', () => {
    let state = createGame({ goalsToWin: 99 });
    for (let i = 0; i < 5; i++) {
      const myAtt = state.turn === TEAMS.BLEU ? 'b-att0' : 'r-att0';
      state = selectToken(state, myAtt);
      const dests = getMoveDestinations(state, state.tokens.find(t => t.id === myAtt));
      state = moveSelectedToken(state, dests[0][0], dests[0][1]);
    }
    expect(state.gameOver).toBe(false);
    expect(state.turnLimit).toBeNull();
  });
});

