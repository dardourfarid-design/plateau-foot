// ===================== SERVICE CONSENTEMENT (RGPD) =====================
// Encapsule l'enregistrement du consentement par finalité, l'export et la
// suppression des données personnelles. Ne contient aucune logique de jeu —
// uniquement des appels vers les fonctions RPC Supabase dédiées (voir
// supabase/migrations/0007_gdpr_consent.sql).
//
// Principe respecté partout dans ce fichier : chaque finalité est un
// consentement séparé, jamais une case unique "tout accepter". C'est une
// exigence du RGPD (art. 7), pas un choix de design arbitraire.

import { supabase } from './supabaseClient.js';

export const CONSENT_PURPOSES = Object.freeze({
  ANALYTICS: 'analytics',
  EMAIL_MARKETING: 'email_marketing',
  DATA_SHARING: 'data_sharing'
});

export const CURRENT_POLICY_VERSION = '2026-06-28';

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

export async function deleteMyData() {
  const client = requireClient();
  const { error } = await client.rpc('delete_my_data');
  if (error) throw error;
}
