// ===================== SERVICE AMIS & MERCATO =====================
// Encapsule le système d'amis (ajout par pseudo, acceptation) et les
// offres de mercato à deux temps (proposition puis acceptation explicite
// par le destinataire — jamais d'échange direct sans consentement, voir
// 0014_friends_and_mercato_offers.sql pour le détail de cette garantie
// appliquée côté serveur).

import { supabase } from './supabaseClient.js';

function requireClient() {
  if (!supabase) {
    throw new Error('Supabase non configuré.');
  }
  return supabase;
}

// ---------- Amis ----------

export async function sendFriendRequest(pseudo) {
  const client = requireClient();
  const { error } = await client.rpc('send_friend_request', { p_friend_pseudo: pseudo });
  if (error) throw error;
}

/**
 * Annule une demande d'ami envoyée (encore en attente). Passe par une RPC
 * (migration 0029) car la table friendships n'expose pas de policy DELETE.
 */
export async function cancelFriendRequest(friendId) {
  const client = requireClient();
  const { error } = await client.rpc('cancel_friend_request', { p_friend_id: friendId });
  if (error) throw error;
}

export async function respondFriendRequest(requesterId, accept) {
  const client = requireClient();
  const { error } = await client.rpc('respond_friend_request', {
    p_requester_id: requesterId,
    p_accept: accept
  });
  if (error) throw error;
}

/**
 * Renvoie { friends, pendingReceived, pendingSent } pour l'utilisateur
 * courant, avec le pseudo de l'autre personne déjà joint. Passe par
 * fetch_my_friendships() (jointure faite en SQL côté serveur) plutôt que
 * par une requête PostgREST avec noms de contraintes explicites — plus
 * fiable, ne dépend pas d'une convention de nommage qui peut varier.
 */
export async function fetchMyFriendships() {
  const client = requireClient();
  const { data, error } = await client.rpc('fetch_my_friendships');
  if (error) throw error;

  const friends = data.filter(f => f.status === 'accepted');
  const pendingSent = data.filter(f => f.status === 'pending' && f.direction === 'sent');
  const pendingReceived = data.filter(f => f.status === 'pending' && f.direction === 'received');

  return { friends, pendingSent, pendingReceived };
}

// ---------- Offres de mercato ----------

export async function createMercatoOffer(toUserId, offeredOwnershipId, requestedOwnershipId) {
  const client = requireClient();
  const { data, error } = await client.rpc('create_mercato_offer', {
    p_to_user_id: toUserId,
    p_offered_ownership_id: offeredOwnershipId,
    p_requested_ownership_id: requestedOwnershipId
  });
  if (error) throw error;
  return data;
}

export async function respondMercatoOffer(offerId, accept) {
  const client = requireClient();
  const { error } = await client.rpc('respond_mercato_offer', {
    p_offer_id: offerId,
    p_accept: accept
  });
  if (error) throw error;
}

export async function cancelMercatoOffer(offerId) {
  const client = requireClient();
  const { error } = await client.rpc('cancel_mercato_offer', { p_offer_id: offerId });
  if (error) throw error;
}

/**
 * Renvoie { received, sent } : les offres en attente reçues (à traiter)
 * et envoyées (annulables) par l'utilisateur courant.
 */
export async function fetchMyMercatoOffers() {
  const client = requireClient();

  // Version enrichie (migration 0029) : pseudos et noms de joueurs joints
  // côté serveur, pour que l'UI puisse dire QUI propose QUOI contre QUOI.
  const { data: detailed, error: detailedError } = await client.rpc('fetch_my_mercato_offers_detailed');
  if (!detailedError && Array.isArray(detailed)) {
    return {
      received: detailed.filter(o => o.direction === 'received'),
      sent: detailed.filter(o => o.direction === 'sent')
    };
  }

  // Repli sur l'ancienne requête brute si la RPC n'est pas encore déployée.
  const user = (await client.auth.getUser()).data.user;
  if (!user) return { received: [], sent: [] };

  const { data, error } = await client
    .from('mercato_offers')
    .select('*')
    .eq('status', 'pending')
    .or(`from_user_id.eq.${user.id},to_user_id.eq.${user.id}`);
  if (error) throw error;

  const received = data.filter(o => o.to_user_id === user.id);
  const sent = data.filter(o => o.from_user_id === user.id);
  return { received, sent };
}

/**
 * Récupère la collection d'un ami (nom, style, rareté déjà joints côté
 * serveur), pour choisir quel joueur lui proposer en échange. Repose sur
 * fetch_friend_collection(), qui vérifie elle-même l'amitié — jamais
 * d'accès à la collection de quelqu'un d'autre.
 */
export async function fetchFriendCollection(friendUserId) {
  const client = requireClient();
  const { data, error } = await client.rpc('fetch_friend_collection', {
    p_friend_user_id: friendUserId
  });
  if (error) throw error;
  return data;
}
