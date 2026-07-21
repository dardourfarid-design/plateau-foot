// ===================== NIVEAUX D'IA (constantes) =====================
// Extrait de ai.js (#324) pour découpler les CONSTANTES de la LOGIQUE.
//
// L'UI (main.js, settingsUI.js) a besoin de connaître les trois niveaux dès le
// démarrage — pour l'état initial et le menu de difficulté — mais pas du moteur
// de décision, qui pèse 14 Ko et ne sert qu'au tour de l'ordinateur. Séparer
// les deux permet d'importer ai.js à la demande sans que ces constantes
// n'entraînent tout le module dans le graphe de boot.
export const AI_LEVELS = Object.freeze({
  FACILE: 'facile',
  MOYEN: 'moyen',
  DIFFICILE: 'difficile'
});
