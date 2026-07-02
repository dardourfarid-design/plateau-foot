// ===================== SERVICE PASSES & FONDATEURS =====================
// Vérifie si l'utilisateur a un pass actif et lit le compteur Fondateurs.

import { supabase } from './supabaseClient.js';

/**
 * Retourne le pass actif de l'utilisateur, ou null s'il n'en a pas.
 * Exemple de retour : { pass_type: 'monthly', current_period_end: '2026-08-01T...' }
 */
export async function getMyActivePass() {
  if (!supabase) return null;
  const { data, error } = await supabase.rpc('get_my_active_pass');
  if (error) {
    console.error('[pass] getMyActivePass:', error.message);
    return null;
  }
  return data?.[0] ?? null;
}

/**
 * Retourne le nombre de places Fondateurs restantes.
 * Lisible publiquement (RLS : select pour anon).
 */
export async function getFoundersRemaining() {
  if (!supabase) return 200;
  const { data, error } = await supabase.rpc('get_founders_remaining');
  if (error) {
    console.error('[pass] getFoundersRemaining:', error.message);
    return 200;
  }
  return data ?? 200;
}
