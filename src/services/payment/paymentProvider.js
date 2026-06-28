// ===================== ASSEMBLAGE DU PAYMENT PROVIDER =====================
// Seul fichier de l'app qui décide quelle implémentation de paiement est active.
// Pour passer en production avec Stripe : décommenter l'import Stripe, retirer
// l'import mock. Rien d'autre dans l'app n'a besoin d'être modifié, car les deux
// implémentations respectent rigoureusement le même contrat
// (voir PaymentProvider.contract.js).

import * as mockProvider from './mockPaymentProvider.js';
// import * as stripeProvider from './stripePaymentProvider.js'; // décommenter quand Stripe est prêt

const activeProvider = mockProvider; // <- remplacer par stripeProvider en production

export const isMockPaymentActive = activeProvider.isMock;
export const checkoutTheme = activeProvider.checkoutTheme;
export const checkoutBundle = activeProvider.checkoutBundle;
export const verifyPurchase = activeProvider.verifyPurchase;
