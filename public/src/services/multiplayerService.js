// ===================== SERVICE MULTIJOUEUR =====================
// Encapsule toute la communication réseau du multijoueur en ligne :
// création de partie, jonction via code d'invitation, et synchronisation
// temps réel de l'état de jeu entre les deux navigateurs via Supabase Realtime.
//
// Important : ce module ne connaît PAS les règles du jeu. Il transporte un
// `gameState` (l'objet produit par src/engine/gameEngine.js) tel quel, sans
// jamais l'interpréter. Toute validation de coup reste la responsabilité du
// moteur côté client (voir la note de sécurité dans la migration SQL
// 0005_multiplayer_sessions.sql : cette V1 fait confiance au moteur client,
// une vérification serveur est un chantier futur documenté pour le rôle
// backend, voir docs/team/developpeur-backend.md).

import { supabase } from './supabaseClient.js';

function requireClient() {
  if (!supabase) {
    throw new Error('Supabase non configuré : le multijoueur nécessite une connexion au backend.');
  }
  return supabase;
}

/**
 * Crée une nouvelle partie en attente et retourne { id, inviteCode }.
 * `initialState` est l'état de jeu initial produit par createGame() côté moteur.
 */
export async function createGameSession(initialState) {
  const client = requireClient();
  const { data, error } = await client.rpc('create_game_session', {
    p_initial_state: initialState
  });

  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return { id: row.id, inviteCode: row.invite_code };
}

/**
 * Rejoint une partie existante via son code d'invitation.
 * Retourne { id, gameState, hostTeam } pour que l'appelant initialise son
 * moteur local avec l'état déjà en cours.
 */
export async function joinGameSession(inviteCode) {
  const client = requireClient();
  const { data, error } = await client.rpc('join_game_session', {
    p_invite_code: inviteCode
  });

  if (error) throw error;
  return { id: data.id, gameState: data.game_state, hostTeam: data.host_team };
}

/**
 * Pousse un nouvel état de jeu vers la session partagée, après qu'un coup
 * a été validé localement par le moteur. L'autre joueur le recevra via
 * subscribeToGameSession().
 */
export async function pushGameState(sessionId, gameState) {
  const client = requireClient();
  const { error } = await client.rpc('update_game_session_state', {
    p_session_id: sessionId,
    p_new_state: gameState
  });
  if (error) throw error;
}

/**
 * S'abonne aux mises à jour temps réel d'une session de partie.
 * `onUpdate` est appelé avec le nouveau game_state à chaque changement
 * détecté côté serveur (déclenché par l'appel pushGameState() de l'adversaire).
 * Retourne une fonction de désabonnement à appeler en quittant l'écran de jeu.
 */
export function subscribeToGameSession(sessionId, onUpdate) {
  const client = requireClient();

  const channel = client
    .channel(`game_session:${sessionId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'game_sessions',
        filter: `id=eq.${sessionId}`
      },
      (payload) => {
        if (payload.new && payload.new.game_state) {
          onUpdate(payload.new.game_state, payload.new.status);
        }
      }
    )
    .subscribe();

  return () => {
    client.removeChannel(channel);
  };
}
