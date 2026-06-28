// ===================== INTERFACE PAYMENT PROVIDER =====================
// Contrat that toute implémentation de paiement doit respecter.
// L'app appelle uniquement ces fonctions ; basculer de Mock vers Stripe
// (ou un autre PSP) se fait dans un seul fichier d'assemblage (paymentProvider.js),
// sans toucher au reste du code (UI, moteur de jeu, etc.)
//
// Ce fichier documente le contrat ; il n'est pas exécuté directement.
//
// checkoutTheme(theme, user) -> Promise<{ redirectUrl?: string, immediate?: boolean }>
//   Lance le paiement pour un thème donné. Deux modes de retour possibles :
//   - { redirectUrl } : l'app doit rediriger l'utilisateur (cas Stripe Checkout réel)
//   - { immediate: true } : l'achat a été débloqué synchrone (cas Mock pour développer sans PSP)
//
// verifyPurchase(themeId, user) -> Promise<boolean>
//   Vérifie si l'achat a bien été enregistré côté backend après retour de paiement.
