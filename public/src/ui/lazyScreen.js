// ===================== ÉCRANS CHARGÉS À LA DEMANDE (#324) =====================
// Mesuré sur la production le 2026-07-21 : l'accueil téléchargeait 57 fichiers
// JS (395 Ko) et n'était interactif qu'au bout de 3,9 s lors d'une PREMIÈRE
// visite — celle d'un joueur qui arrive de Reddit ou Product Hunt, donc sans
// service worker pour masquer le coût. Or la boutique, le profil, le mercato
// et la séance de tirs au but ne servent qu'après un clic explicite.
//
// COMMENT ÇA MARCHE, ET POURQUOI C'EST SÛR ICI
// Chacun de ces modules câble LUI-MÊME son bouton d'ouverture dans son init()
// (`els.shopBtn?.addEventListener(...)` dans shopUI, etc.), et tout le reste du
// code ouvre ces écrans en simulant un clic (`els.shopBtn?.click()`, 7 endroits
// entre main.js, accountUI et tutorialUI). Il suffit donc d'intercepter le
// PREMIER clic, de charger le module, puis de rejouer le clic : le module a
// alors posé son propre écouteur et le parcours reprend normalement. Aucun
// appelant n'a besoin de savoir que le chargement est différé.
//
// Ce module n'importe RIEN volontairement (pas même dialogs/i18n) : il est
// chargé au boot, et le signalement d'erreur lui est injecté. Même raison que
// pour profileUI — un module UI testable sous Node ne doit pas tirer de
// dépendances qui touchent `window`.

/**
 * Charge un écran au premier clic sur son bouton d'ouverture, puis rejoue le clic.
 *
 * L'écouteur d'amorçage est posé en phase de CAPTURE et coupe la propagation :
 * sans ça, les écouteurs déjà en place (markRoute, masquage de l'écran des tirs
 * au but) tourneraient dans le vide sur ce premier clic. Ils s'exécuteront au
 * rejeu. L'amorçage se retire avant de rejouer — pas de boucle possible.
 *
 * @param {HTMLElement|null} btn        bouton d'ouverture (peut être absent du DOM)
 * @param {() => Promise<any>} load     charge ET initialise le module
 * @param {(err: Error) => void} [onError]  prévient le joueur ; l'amorçage est
 *        remis en place pour qu'un simple reclic retente, plutôt que de laisser
 *        un bouton mort après une coupure réseau.
 * @returns {() => void} retire l'amorçage (utile en test)
 */
export function lazyScreen(btn, load, onError) {
  if (!btn) return () => {};
  const bootstrap = async (ev) => {
    btn.removeEventListener('click', bootstrap, true);
    ev.stopImmediatePropagation();
    try {
      await load();
    } catch (err) {
      btn.addEventListener('click', bootstrap, true);
      onError?.(err);
      return;
    }
    btn.click();
  };
  btn.addEventListener('click', bootstrap, true);
  return () => btn.removeEventListener('click', bootstrap, true);
}
