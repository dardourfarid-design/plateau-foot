// ===================== ASSEMBLAGE DU PAYMENT PROVIDER =====================
// Seul fichier de l'app qui décide quelle implémentation de paiement est active.
//
// AUDIT COMMERCIALISATION : le provider actif est désormais Stripe (Checkout
// réel, en mode Test tant que les clés sk_test_/pk_test_ sont en place côté
// Supabase — passer en Live ne demande qu'un changement de clés, voir README).
// Le mock reste dans le dépôt à titre de référence, mais ses fonctions SQL
// (mock_complete_purchase / mock_complete_bundle_purchase) sont SUPPRIMÉES en
// base par la migration 0025 : tant qu'elles existaient, n'importe quel client
// authentifié pouvait s'attribuer n'importe quel produit gratuitement.

import * as stripeProvider from './stripePaymentProvider.js';

const activeProvider = stripeProvider;

export const isMockPaymentActive = activeProvider.isMock;
export const checkoutTheme = activeProvider.checkoutTheme;
export const checkoutBundle = activeProvider.checkoutBundle;
export const verifyPurchase = activeProvider.verifyPurchase;
