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
    enabled: false,       // interrupteur global (kill switch) de toute la pub
    cmp: {
      enabled: false,     // active le CMP certifié Google (IAB TCF v2.2)
      publisherId: null   // ex. 'ca-pub-XXXXXXXXXXXXXXXX' (AdSense/Ad Manager)
    }
  }
};
