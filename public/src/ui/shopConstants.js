// ===================== CONSTANTES BOUTIQUE PARTAGÉES =====================
// Module volontairement SANS AUCUN import : consommé à la fois par shopUI.js
// et par des modules UI plus légers (accountUI.js pour le goal-gradient de
// fin de partie). Ne rien ajouter ici qui tire un service (voir la règle
// « pas de service dans un module UI testé en Node »).

/** Coût d'un « kit du jour » en pièces tactiques. Doit rester aligné avec le
 *  serveur (RPC unlock_theme_with_coins) : c'est lui qui fait foi au débit. */
export const COIN_KIT_COST = 100;
