// ============ CHARGEMENT À LA DEMANDE DU MOTEUR IA (#324, lot 3) ============
// ai.js (14 Ko : choix de coup aux trois niveaux) n'est utile qu'au tour de
// l'ordinateur. Ni l'accueil, ni une partie à deux, ni le premier coup humain
// d'une partie contre l'IA n'en ont besoin au chargement. Ce module isole le
// point de chargement : main.js appelle ensureAiEngine() au premier tour de
// l'ordinateur, en parallèle du délai visuel de 550 ms déjà présent, si bien
// que le téléchargement ne se voit pas.
//
// La promesse est mémorisée : les tours suivants réutilisent le module déjà
// chargé. En cas d'échec réseau au tout premier tour, on remet la promesse à
// zéro pour pouvoir retenter, et on résout à null — l'appelant relâche alors
// le verrou « réflexion » plutôt que de figer la partie.
let _promise = null;

export function ensureAiEngine() {
  if (!_promise) {
    _promise = import('../engine/ai.js').catch(err => {
      _promise = null;
      console.error('Moteur IA non chargé :', err);
      return null;
    });
  }
  return _promise;
}
