// ===================== INTERFACE AD PROVIDER =====================
// Contrat que toute implémentation de régie publicitaire doit respecter.
// Même philosophie que payment/PaymentProvider.contract.js : l'app ne parle
// jamais directement à un SDK pub (AdSense, Google Ad Manager…). Elle passe
// par adService.js, qui délègue au provider actif choisi dans adProvider.js.
// Basculer de Mock vers un vrai réseau se fait dans ce seul fichier
// d'assemblage, sans toucher UI ni moteur de jeu.
//
// Ce fichier documente le contrat ; il n'est pas exécuté directement.
//
// IMPORTANT : un provider ne s'occupe QUE de parler au SDK. Il ne décide
// jamais s'il a le droit d'afficher une pub — ce gating (consentement RGPD,
// statut payant, kill switch) est centralisé dans adService.js, en amont.
// Quand une méthode d'un provider est appelée, la décision "on a le droit"
// a déjà été prise.
//
// ---------------------------------------------------------------------------
// isMock : boolean
//   true pour l'implémentation factice (aucune vraie pub, aucun argent).
//
// init(context) -> Promise<boolean>
//   Charge/initialise le SDK. `context` = { consent: true } au minimum.
//   Retourne true si le SDK est prêt. Idempotent : appelable plusieurs fois.
//
// showBanner(slot) -> Promise<boolean>
//   Affiche une bannière dans l'emplacement `slot` (id d'un conteneur DOM,
//   écran hors-jeu uniquement). Retourne true si affichée.
//
// hideBanner(slot) -> void
//   Retire la bannière de l'emplacement `slot`.
//
// showInterstitial() -> Promise<{ shown: boolean }>
//   Affiche une pub plein écran (entre deux parties). `shown:false` si aucune
//   pub disponible (no-fill) — ne doit jamais bloquer le flux de jeu.
//
// showRewarded() -> Promise<{ completed: boolean, reason?: string }>
//   Affiche une vidéo récompensée. `completed:true` UNIQUEMENT si l'utilisateur
//   a regardé jusqu'au bout (condition d'octroi de la récompense, qui elle sera
//   validée côté serveur en PR E). `reason` documente un échec éventuel.
//
// destroy() -> void
//   Libère les ressources (bannières, listeners). Appelé à la déconnexion ou
//   à la révocation du consentement.
// ---------------------------------------------------------------------------
