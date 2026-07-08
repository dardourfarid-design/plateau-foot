// ===================== SERVICE CONSENTEMENT (RGPD) =====================
// Encapsule l'enregistrement du consentement par finalité, l'export et la
// suppression des données personnelles. Ne contient aucune logique de jeu —
// uniquement des appels vers les fonctions RPC Supabase dédiées (voir
// supabase/migrations/0007_gdpr_consent.sql) et l'Edge Function delete-account.
//
// Principe respecté partout dans ce fichier : chaque finalité est un
// consentement séparé, jamais une case unique "tout accepter". C'est une
// exigence du RGPD (art. 7), pas un choix de design arbitraire.

import { supabase } from './supabaseClient.js';

export const CONSENT_PURPOSES = Object.freeze({
  ANALYTICS: 'analytics',
  EMAIL_MARKETING: 'email_marketing',
  DATA_SHARING: 'data_sharing',
  // Affichage et personnalisation de publicités (bannières, interstitiels,
  // vidéos récompensées). Finalité séparée, jamais impliquée par une autre.
  // Le gating effectif du chargement des SDK pub vit dans
  // advertisingConsentService.js ; ici on ne fait que tracer/prouver le choix
  // côté serveur pour les utilisateurs connectés (voir migration 0035).
  ADVERTISING: 'advertising'
});

export const CURRENT_POLICY_VERSION = '2026-07-08';

function requireClient() {
  if (!supabase) {
    throw new Error('Supabase non configuré.');
  }
  return supabase;
}

/**
 * Enregistre un consentement (accordé ou refusé) pour une finalité donnée.
 * Toujours appelé une fois par finalité, jamais en bloc.
 */
export async function recordConsent(purpose, granted) {
  const client = requireClient();
  const { error } = await client.rpc('record_consent', {
    p_purpose: purpose,
    p_granted: granted,
    p_policy_version: CURRENT_POLICY_VERSION
  });
  if (error) throw error;
}

/**
 * Enregistre plusieurs consentements d'un coup (utilisé à l'inscription,
 * où l'utilisateur fait ses choix sur un seul écran). Chaque finalité reste
 * tracée séparément en base malgré l'appel groupé côté UI.
 */
export async function recordConsents(consentMap) {
  const entries = Object.entries(consentMap);
  for (const [purpose, granted] of entries) {
    await recordConsent(purpose, granted);
  }
}

export async function exportMyData() {
  const client = requireClient();
  const { data, error } = await client.rpc('export_my_data');
  if (error) throw error;
  return data;
}

/**
 * Suppression complète et définitive du compte (RGPD, art. 17).
 *
 * Passe par l'Edge Function delete-account plutôt qu'un simple RPC :
 * la RPC delete_my_data() (migration 0007) ne supprimait que les données
 * applicatives (profiles + CASCADE), mais laissait la ligne auth.users
 * intacte — car la supprimer nécessite la service_role key, jamais
 * disponible côté client. L'Edge Function fait les deux étapes dans le
 * bon ordre, avec la bonne clé, sans exposer celle-ci au navigateur.
 */
export async function deleteMyData() {
  const client = requireClient();

  // Récupérer le JWT de la session active pour l'envoyer dans le header
  // Authorization de la requête à l'Edge Function (celle-ci vérifie
  // l'identité via getUser() avec ce JWT — jamais depuis le body).
  const { data: { session } } = await client.auth.getSession();
  if (!session) throw new Error('Aucune session active.');

  // L'URL Supabase est dans la config globale (voir public/config.js et
  // supabaseClient.js). On la lit ici directement plutôt que depuis le
  // client instancié, car le SDK Supabase n'expose pas de propriété .supabaseUrl
  // accessible sur l'instance dans cette version CDN du SDK.
  const supabaseUrl = window.__PLATEAU_FOOT_CONFIG__?.supabaseUrl;
  if (!supabaseUrl) throw new Error('URL Supabase non disponible.');

  const url = `${supabaseUrl}/functions/v1/delete-account`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`
    },
    body: JSON.stringify({})
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error || 'Suppression du compte impossible.');
  }

  // Un warning signifie que les données sont supprimées mais que la ligne
  // auth.users n'a pas pu être retirée (log côté Edge Function, pas bloquant
  // pour le joueur — ses données personnelles identifiables sont déjà effacées).
  if (result.warning) {
    console.warn('delete-account :', result.warning);
  }
}
