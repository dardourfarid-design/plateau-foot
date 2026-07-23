// ===================== CONFIGURATION =====================
// Seul fichier contenant les paramètres d'environnement côté client.
// La clé "anon" Supabase est conçue pour être publique (elle est protégée par
// les policies RLS définies en base, pas par le secret) : ce n'est pas une
// clé privée comme la "service_role", qui elle ne doit JAMAIS apparaître ici.

window.__PLATEAU_FOOT_CONFIG__ = {
  supabaseUrl: 'https://dygkovlhscmueofonhti.supabase.co',
  supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR5Z2tvdmxoc2NtdWVvZm9uaHRpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI1MzczMTMsImV4cCI6MjA5ODExMzMxM30.yFV4XMvhkx05Dy4lDgJdKyDo3m327rSuh_KOx9YjiYU',

  // ---- Publicité (épic monétisation) ----
  // Rien ne charge tant que le consentement pub n'est pas accordé (voir
  // advertisingConsentService.js). Les IDs réels et l'activation seront
  // renseignés en PR 0 (issue #25) une fois les comptes Google validés.
  ads: {
    enabled: true,        // interrupteur global (kill switch) de toute la pub
    rolloutPercent: 100,  // % de clients exposés (0=personne, 100=tous). Pour un
                          // déploiement progressif : 5 → 25 → 50 → 100. Réversible.
    // Flags par format (n'ont d'effet que si enabled=true). Absent ou true =
    // format actif ; false = format désactivé (rollout progressif, A/B).
    banner: true,         // bannières AdSense hors-jeu (PR C / #28) — ACTIF
    interstitial: false,  // ⚠️ COUPÉ : en prod le SDK n'obtient AUCUNE pub
                          // (aucune chaîne de consentement TCF — le CMP Google
                          // dépend d'AdSense, non validé — et domaine pas encore
                          // approuvé par GameMonetize). Il laissait alors un
                          // conteneur plein écran NOIR qui ne disparaissait
                          // jamais : joueur bloqué. Un garde-fou existe
                          // désormais dans gameMonetizeProvider, mais tant
                          // qu'il n'y a pas d'inventaire, l'afficher n'apporte
                          // que du noir. Repasser à true APRÈS avoir constaté
                          // une vraie pub qui joue (consentement + domaine OK).
    rewarded: false,      // rewarded servi par GameMonetize (modèle nonce serveur,
                          // migration 0044 + REWARDED_CLIENT_ENABLED=true, déjà
                          // posés). ⚠️ EN ATTENTE de vérif : ce build de SDK
                          // n'émet SDK_REWARDED_WATCH_COMPLETE que si l'inventaire
                          // « Rewarded » est activé pour ce jeu dans le dashboard
                          // GameMonetize. Tant que non confirmé, un joueur
                          // regarderait sans être crédité. Activer « Rewarded »
                          // côté GameMonetize, tester sur le domaine déployé
                          // (localhost ne sert pas le rewarded), PUIS passer à true.
    // Routage par format (composite, voir adProvider.js). Absent = tout AdSense.
    // On garde AdSense sur la bannière et on confie interstitiel + rewarded à
    // GameMonetize (eCPM jeu supérieur, aucun seuil de trafic).
    providers: {
      banner: 'adsense',
      interstitial: 'gamemonetize',
      rewarded: 'gamemonetize'
    },
    // Régie GameMonetize : l'ID du jeu est fourni par le tableau de bord
    // GameMonetize après inscription du jeu. Vide = SDK non chargé (échec propre).
    gameMonetize: {
      gameId: 'vt4e2kq9iwdbrjjxcw3vwofibwwcch7t' // ID du jeu (dashboard GameMonetize)
    },
    // Identifiants des blocs d'annonces AdSense (data-ad-slot).
    slots: {
      banner: '2744363190' // bloc Display « accueil » (à contrôler côté AdSense)
    },
    // A/B testing (PR H). Chaque variante est choisie de façon stable par
    // client. Ex. pour tester la fréquence des interstitiels sur 2 valeurs :
    //   experiments: { interstitialEveryN: [3, 5] }
    // Laisser vide = pas d'expérience (valeurs de config/défaut utilisées).
    experiments: {},
    cmp: {
      enabled: true,      // CMP certifié Google publié (message RGPD AdSense)
      publisherId: 'ca-pub-2881855045042521' // ads.txt: pub-2881855045042521
    }
  }
};
