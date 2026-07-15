// ===================== SERVICE PASSES & FONDATEURS =====================
// Vérifie si l'utilisateur a un pass actif et lit le compteur Fondateurs.

import { hasLocalSession, supabase } from './supabaseClient.js';

/**
 * Indique si l'utilisateur connecté est Fondateur (a acheté le Pack Fondateurs).
 * Lecture directe de profiles.is_founder, autorisée par la RLS « lecture de son
 * propre profil » (migration 0001). Sert à afficher le badge doré (#61).
 */
export async function getMyFounderStatus() {
  if (!supabase) return false;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data, error } = await supabase
    .from('profiles')
    .select('is_founder')
    .eq('id', user.id)
    .maybeSingle();
  if (error) {
    console.error('[pass] getMyFounderStatus:', error.message);
    return false;
  }
  return !!data?.is_founder;
}

/**
 * Retourne le pass actif de l'utilisateur, ou null s'il n'en a pas.
 * Exemple de retour : { pass_type: 'monthly', current_period_end: '2026-08-01T...' }
 */
export async function getMyActivePass() {
  if (!supabase) return null;
  // Sans session locale, le RPC ne peut que répondre « aucun pass » — on
  // évite l'aller-retour backend pour chaque visiteur anonyme (et tout
  // trafic Supabase dans les E2E publics).
  if (!(await hasLocalSession())) return null;
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
