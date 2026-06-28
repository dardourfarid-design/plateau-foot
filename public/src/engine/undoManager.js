// ===================== UNDO MANAGER =====================
// Gère la pile de snapshots permettant d'annuler le dernier coup validé.
// Séparé du moteur de jeu pour rester un simple historique, sans connaître
// les règles du jeu elles-mêmes.

export function createUndoStack() {
  return { snapshot: null };
}

export function captureSnapshot(undoStack, state) {
  return { snapshot: state };
}

export function restoreSnapshot(undoStack) {
  return undoStack.snapshot;
}

export function hasSnapshot(undoStack) {
  return undoStack.snapshot !== null;
}

export function clearSnapshot() {
  return { snapshot: null };
}
