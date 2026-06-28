// ===================== SERVICE JOUEURS CUSTOM =====================
// Encapsule la création de joueurs personnalisés. Le quota freemium (1
// gratuit, le reste payant) est entièrement vérifié côté serveur
// (create_custom_player(), voir 0012_custom_players.sql) — ce module ne
// fait que transporter la demande, jamais de logique de quota en local.

import { supabase } from './supabaseClient.js';

export const FREE_CUSTOM_PLAYER_SLOTS = 1;
export const CUSTOM_PLAYER_SLOT_THEME_ID = 'custom-player-slot';

function requireClient() {
  if (!supabase) {
    throw new Error('Supabase non configuré.');
  }
  return supabase;
}

export async function fetchMyCustomPlayers() {
  const client = requireClient();
  const { data, error } = await client
    .from('custom_players')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data;
}

/**
 * Crée un nouveau joueur personnalisé. Lève une erreur explicite si le
 * quota gratuit est atteint et qu'aucun slot payant n'est disponible —
 * l'appelant doit alors proposer l'achat d'un slot avant de réessayer.
 */
export async function createCustomPlayer({ name, style, avatarColor, avatarPattern, avatarAccessory }) {
  const client = requireClient();
  const { data, error } = await client.rpc('create_custom_player', {
    p_name: name,
    p_style: style,
    p_avatar_color: avatarColor,
    p_avatar_pattern: avatarPattern,
    p_avatar_accessory: avatarAccessory
  });
  if (error) throw error;
  return data;
}

export async function deleteCustomPlayer(customPlayerId) {
  const client = requireClient();
  const { error } = await client
    .from('custom_players')
    .delete()
    .eq('id', customPlayerId);
  if (error) throw error;
}
