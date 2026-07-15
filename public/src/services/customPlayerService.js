// ===================== SERVICE JOUEURS CUSTOM =====================
// Encapsule la création de joueurs personnalisés. Le quota freemium (1
// gratuit, le reste payant) est entièrement vérifié côté serveur
// (create_custom_player(), voir 0012_custom_players.sql) — ce module ne
// fait que transporter la demande, jamais de logique de quota en local.

import { hasLocalSession, supabase } from './supabaseClient.js';

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
  if (!(await hasLocalSession())) return []; // anonyme : pas d'aller-retour backend
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

// ---------- Acquisition de joueurs rares/légendaires ----------

/**
 * Réclame les récompenses de palier de niveau (rare au niveau 5, légendaire
 * au niveau 10) non encore obtenues. Idempotent côté serveur : ne redonne
 * jamais une même récompense deux fois.
 */
export async function claimLevelRewards() {
  const client = requireClient();
  const { data, error } = await client.rpc('claim_level_rewards');
  if (error) throw error;
  return data; // [{ reward_key, player_name }, ...] des récompenses nouvellement obtenues
}

/**
 * Achète un joueur rare/légendaire en réutilisant exactement le même
 * chemin de paiement que les thèmes (checkoutTheme, voir
 * services/payment/paymentProvider.js) — jamais un raccourci SQL qui
 * déciderait lui-même du provider actif. Découpé en 2 étapes :
 *   1. prepare_player_purchase() : prépare le thème factice côté serveur,
 *      retourne son id et son prix.
 *   2. checkoutTheme() : suit le chemin générique (mock aujourd'hui,
 *      Stripe demain — le choix se fait uniquement dans paymentProvider.js).
 *   3. grant_player_if_purchased() : n'accorde le joueur qu'après avoir
 *      vérifié qu'un achat réellement complété existe en base.
 */
export async function purchasePlayer(playerId, user, checkoutThemeFn) {
  const client = requireClient();
  const { data, error } = await client.rpc('prepare_player_purchase', { p_player_id: playerId });
  if (error) throw error;

  const prepared = Array.isArray(data) ? data[0] : data;
  const fakeTheme = { id: prepared.theme_id, price_cents: prepared.price_cents };

  const result = await checkoutThemeFn(fakeTheme, user);

  if (result.redirectUrl) {
    // Paiement Stripe : la redirection part vers Checkout, l'octroi du
    // joueur se fera après confirmation du webhook (ou au prochain appel
    // de grant_player_if_purchased, en filet de sécurité).
    return result;
  }

  // Paiement immédiat (mock) : l'achat est déjà 'completed' en base, on
  // peut accorder le joueur tout de suite.
  const { data: granted, error: grantError } = await client.rpc('grant_player_if_purchased', { p_player_id: playerId });
  if (grantError) throw grantError;
  if (!granted) {
    throw new Error('Le paiement a réussi mais le joueur n\'a pas pu être attribué. Réessaie depuis ton profil.');
  }
  return { immediate: true };
}
