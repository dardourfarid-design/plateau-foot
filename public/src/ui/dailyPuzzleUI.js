// ===================== PUZZLE DU JOUR (UI) =====================
// Défi quotidien : une position fixe à résoudre en un nombre de coups borné.
// Ni IA ni adversaire — le joueur enchaîne les coups des deux camps depuis le
// point de vue du solveur, jusqu'à marquer ou épuiser son quota.
//
// Extrait de main.js (#311). Même pattern que initShop() / initOverlays() :
// initDailyPuzzle(deps) reçoit ses dépendances explicitement et retourne les
// points d'entrée que main.js orchestre.
//
// L'ÉTAT DU PUZZLE VIT ICI (puzzleActive, currentPuzzle, puzzleMoves) : il
// n'intéresse aucun autre module, et le laisser dans main.js était précisément
// ce qui rendait le fichier illisible. main.js interroge isPuzzleActive() au
// lieu de lire une variable partagée.
//
// Ne pas importer de service ici : un module UI testé sous Node casse toute la
// suite avec « window is not defined ». Tout passe par `deps`.

import { t } from './i18n.js';
import { getDailyPuzzle } from '../engine/puzzles.js';
import { createGame } from '../engine/gameEngine.js';
import { showToast } from './dialogs.js';

/**
 * @param {object} deps
 * @param {object} deps.els                  références DOM partagées.
 * @param {(s: object) => void} deps.setGameState  remplace l'état de jeu.
 * @param {() => object} deps.getGameState    état de jeu courant.
 * @param {(m: string) => void} deps.setGameMode   fixe le mode de jeu.
 * @param {(team: string) => void} deps.setMyTeam  fixe l'équipe du joueur.
 * @param {() => void} deps.clearUndoSnapshot      annule l'historique d'annulation.
 * @param {() => void} deps.clearLineup       oublie la composition (le puzzle
 *                                            impose ses propres pions).
 * @param {() => void} deps.buildBoard        (re)construit la grille du plateau.
 * @param {() => void} deps.render            re-render du plateau.
 * @param {() => void} deps.goToLanding       retour à l'accueil.
 * @returns {{ startPuzzle, handlePuzzleProgress, updatePuzzleHint,
 *             isPuzzleActive }}
 */
export function initDailyPuzzle({
  els, setGameState, getGameState, setGameMode, setMyTeam,
  clearUndoSnapshot, clearLineup, buildBoard, render, goToLanding
}) {
  let puzzleActive = false;
  let currentPuzzle = null;
  let puzzleMoves = 0;

  function startPuzzle() {
    currentPuzzle = getDailyPuzzle();
    puzzleActive = true;
    puzzleMoves = 0;
    // Ni IA ni online : maybeTriggerAiTurn() (garde !== 'ai') ne se déclenche pas.
    setGameMode('puzzle');
    clearUndoSnapshot();
    els.setupScreen.classList.add('hidden');
    els.configScreen.classList.add('hidden');
    els.shootoutScreen?.classList.add('hidden');
    els.gameScreen.classList.remove('hidden');
    setMyTeam(currentPuzzle.turn);
    setGameState({
      ...createGame({ goalsToWin: 1, ruleset: currentPuzzle.ruleset }),
      tokens: currentPuzzle.tokens.map(tok => ({ ...tok })),
      ball: { ...currentPuzzle.ball },
      turn: currentPuzzle.turn
    });
    buildBoard();
    clearLineup();
    render();
    updatePuzzleHint();
  }

  function handlePuzzleProgress(previousState) {
    const solver = currentPuzzle.turn;
    render();

    // Résolu : l'équipe du solveur a marqué (objectif à 1 but -> gameOver).
    const gameState = getGameState();
    if (gameState.score[solver] > previousState.score[solver]) {
      endPuzzle(true);
      return;
    }

    // Un coup du solveur s'est terminé (le tour a basculé) : on le compte et on
    // garde la main sur le solveur — il n'y a pas d'adversaire en mode puzzle.
    if (!gameState.gameOver && gameState.turn !== solver) {
      puzzleMoves += 1;
      setGameState({ ...gameState, turn: solver });
      render();
    }

    updatePuzzleHint();

    // Échec : plus de coups disponibles sans avoir marqué.
    if (getGameState().score[solver] === 0 && puzzleMoves >= currentPuzzle.maxMoves) {
      endPuzzle(false);
    }
  }

  function updatePuzzleHint() {
    if (!puzzleActive || !els.hintBar) return;
    const left = Math.max(0, currentPuzzle.maxMoves - puzzleMoves);
    els.hintBar.textContent = t('{title} — {hint} (coups restants : {n})', {
      title: currentPuzzle.title, hint: currentPuzzle.hint, n: left
    });
  }

  function endPuzzle(solved) {
    puzzleActive = false;
    const wasPuzzle = currentPuzzle;
    if (solved) {
      render();
      showToast(t('🎉 Puzzle résolu en {n} coup(s) !', { n: puzzleMoves || wasPuzzle.maxMoves }));
      setTimeout(() => { setGameMode('local'); goToLanding(); }, 1800);
    } else {
      showToast(t('Raté — le puzzle recommence, réessaie !'));
      setTimeout(() => startPuzzle(), 1200); // rejoue le même puzzle du jour
    }
  }

  return {
    startPuzzle,
    handlePuzzleProgress,
    updatePuzzleHint,
    isPuzzleActive: () => puzzleActive,
    // Sortie sans conclusion : appelé quand une vraie partie démarre par-dessus
    // un puzzle en cours. Ne déclenche ni toast ni retour à l'accueil.
    exitPuzzle() { puzzleActive = false; }
  };
}
