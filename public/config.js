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
    // Flags par format (n'ont d'effet que si enabled=true). Absent ou true =
    // format actif ; false = format désactivé (rollout progressif, A/B).
    banner: true,         // bannières AdSense hors-jeu (PR C / #28) — ACTIF
    interstitial: false,  // interstitiels : pas d'unité AdSense encore (PR D)
    rewarded: false,      // rewarded : nécessite Ad Manager + SSV (PR E / #30)
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
