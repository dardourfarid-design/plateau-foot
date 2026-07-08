// ===================== STUB PLAUSIBLE (événements custom) =====================
// Épic monétisation publicitaire, PR G (issue #32) — fiabilisation.
//
// Le script Plausible (script.js) est chargé en `defer`. Sans ce stub,
// window.plausible n'existe pas tant que le script n'a pas fini de charger :
// tout événement custom émis avant (ex. un clic rewarded très tôt) serait
// silencieusement perdu — adAnalytics.track() no-op si window.plausible est
// absent.
//
// Ce stub, recommandé par Plausible, définit immédiatement window.plausible
// comme une file d'attente : les événements sont mis en file puis rejoués
// dès que script.js est prêt. Fichier EXTERNE (pas d'inline) pour rester
// compatible avec la CSP stricte (script-src sans 'unsafe-inline').
window.plausible = window.plausible || function () {
  (window.plausible.q = window.plausible.q || []).push(arguments);
};
