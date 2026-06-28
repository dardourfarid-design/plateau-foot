// ===================== SERVICE COLLECTION & MERCATO =====================
// Encapsule l'accès au catalogue de joueurs fictifs, à la collection d'un
// compte, à la composition d'équipe, et aux échanges (mercato).
// Aucune logique de jeu ici : ce module ne fait que transporter des
// données entre Supabase et l'UI.

import { supabase } from './supabaseClient.js';

function requireClient() {
  if (!supabase) {
    throw new Error('Supabase non configuré.');
  }
  return supabase;
}

export async function fetchPlayerCatalog() {
  const client = requireClient();
  const { data, error } = await client
    .from('fictional_players')
    .select('*')
    .eq('is_active', true)
    .order('rarity', { ascending: true });
  if (error) throw error;
  return data;
}

/**
 * Garantit qu'un nouveau compte a bien reçu son pack de démarrage (6 joueurs
 * communs aléatoires). Idempotent côté serveur : ne fait rien si déjà fait.
 */
export async function ensureStarterPack() {
  const client = requireClient();
  const { error } = await client.rpc('grant_starter_pack');
  if (error) throw error;
}

/**
 * Renvoie la collection complète de l'utilisateur, avec les infos du
 * catalogue jointes (nom, style, rareté) pour éviter un second aller-retour.
 */
export async function fetchMyCollection() {
  const client = requireClient();
  const { data, error } = await client
    .from('player_ownership')
    .select('*, fictional_players(*)');
  if (error) throw error;
  return data;
}

export async function renamePlayer(ownershipId, customName) {
  const client = requireClient();
  const { error } = await client
    .from('player_ownership')
    .update({ custom_name: customName })
    .eq('id', ownershipId);
  if (error) throw error;
}

export async function fetchMyLineup() {
  const client = requireClient();
  const { data, error } = await client
    .from('team_lineups')
    .select('*')
    .maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * Enregistre la composition d'équipe (upsert : crée la ligne si elle
 * n'existe pas encore pour ce compte).
 */
export async function saveLineup(slots) {
  const client = requireClient();
  const user = (await client.auth.getUser()).data.user;
  if (!user) throw new Error('Connexion requise.');

  const { error } = await client
    .from('team_lineups')
    .upsert({ user_id: user.id, ...slots, updated_at: new Date().toISOString() });
  if (error) throw error;
}

/**
 * Exécute un échange mercato direct entre deux comptes. Les deux
 * ownershipId doivent appartenir respectivement à l'utilisateur courant et
 * à `theirUserId` — vérifié côté serveur (voir 0008_fictional_players.sql),
 * jamais fait confiance au client pour cette validation.
 */
export async function executeTrade(myOwnershipId, theirOwnershipId, theirUserId) {
  const client = requireClient();
  const { error } = await client.rpc('execute_mercato_trade', {
    p_my_ownership_id: myOwnershipId,
    p_their_ownership_id: theirOwnershipId,
    p_their_user_id: theirUserId
  });
  if (error) throw error;
}
