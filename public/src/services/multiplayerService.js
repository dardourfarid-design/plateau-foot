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
/**
 * Clôture une session encore en attente (créateur qui annule). Passe par
 * une RPC security definer (migration 0029) : la table game_sessions n'a
 * volontairement aucune policy d'écriture directe. Sans cette clôture, la
 * session restait « waiting » indéfiniment et son code restait joignable.
 */
export async function cancelGameSession(sessionId) {
  const client = requireClient();
  const { error } = await client.rpc('cancel_game_session', { p_session_id: sessionId });
  if (error) throw error;
}

export async function pushGameState(sessionId, gameState) {
  const client = requireClient();
  const { error } = await client.rpc('update_game_session_state', {
    p_session_id: sessionId,
    p_new_state: gameState
  });
  if (error) throw error;
}

// ---------- Journal d'actions & validation serveur (#260) ----------
// Le client n'est plus cru sur parole : pendant une partie en ligne, chaque
// action moteur est journalisée ici puis rejouée PAR LE SERVEUR (Edge Function
// push-game-state) sur l'état autoritaire. pushGameState() ci-dessus reste le
// chemin de repli tant que la fonction n'est pas déployée (avant migration 0039).

let _actionQueue = [];

/** Journalise une action moteur { fn, args } à faire valider par le serveur. */
export function recordOnlineAction(fn, args = []) {
  _actionQueue.push({ fn, args });
}

/** Vide le journal (fin de session, ou état serveur adopté après rejet). */
export function clearOnlineActions() { _actionQueue = []; }

/** Y a-t-il des actions locales pas encore validées par le serveur ? */
export function hasPendingOnlineActions() { return _actionQueue.length > 0; }

/**
 * Envoie le journal à l'Edge Function push-game-state, qui rejoue les actions
 * sur l'état autoritaire et retourne l'état résultant.
 * @returns {{ state: object|null, rejected?: boolean, reason?: string }}
 *  - rejected=true : coup refusé (422/409) — `state` est l'état serveur à adopter.
 *  - erreur avec code 'FN_UNAVAILABLE' : fonction absente (repli RPC possible).
 *  - autre erreur (réseau/5xx) : le journal est conservé pour retenter.
 */
export async function pushGameActions(sessionId) {
  const client = requireClient();
  if (_actionQueue.length === 0) return { state: null };
  const actions = _actionQueue;
  _actionQueue = [];
  const { data, error } = await client.functions.invoke('push-game-state', {
    body: { sessionId, actions }
  });
  if (error) {
    const status = error.context?.status;
    if (status === 422 || status === 409) {
      let payload = null;
      try { payload = await error.context.json(); } catch (_) { /* corps illisible */ }
      return { rejected: true, state: payload?.state ?? null, reason: payload?.error };
    }
    if (status === 404 || error.name === 'FunctionsRelayError') {
      _actionQueue = actions.concat(_actionQueue);
      const e = new Error('push-game-state indisponible');
      e.code = 'FN_UNAVAILABLE';
      throw e;
    }
    _actionQueue = actions.concat(_actionQueue);
    throw error;
  }
  return { state: data?.state ?? null };
}

/**
 * S'abonne aux mises à jour temps réel d'une session de partie.
 * `onUpdate` est appelé avec le nouveau game_state à chaque changement
 * détecté côté serveur (déclenché par l'appel pushGameState() de l'adversaire).
 *
 * #264 — présence : si `presence` est fourni ({ selfId, onPresence }), le canal
 * suit aussi la PRÉSENCE Realtime des deux joueurs. `onPresence(present)` est
 * rappelé (true = l'adversaire est là, false = il a disparu) à chaque
 * synchronisation/arrivée/départ. Chaque client s'annonce sous sa propre clé
 * (`selfId`, l'équipe) ; « l'adversaire est présent » = au moins une clé ≠ selfId.
 * Sans backend Realtime, la présence reste simplement muette — le reste marche.
 *
 * Retourne une fonction de désabonnement à appeler en quittant l'écran de jeu.
 */
export function subscribeToGameSession(sessionId, onUpdate, presence = null) {
  const client = requireClient();

  const channel = client.channel(
    `game_session:${sessionId}`,
    presence ? { config: { presence: { key: presence.selfId } } } : undefined
  ).on(
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
  );

  if (presence) {
    // « Adversaire présent » = au moins une clé de présence différente de la mienne.
    const evaluate = () => {
      try {
        const state = channel.presenceState() || {};
        const opponentHere = Object.keys(state).some(k => k !== presence.selfId);
        presence.onPresence(opponentHere);
      } catch { /* présence indispo : on ne signale rien */ }
    };
    channel
      .on('presence', { event: 'sync' }, evaluate)
      .on('presence', { event: 'join' }, evaluate)
      .on('presence', { event: 'leave' }, evaluate);
  }

  channel.subscribe(async (status) => {
    // Une fois abonné, on s'annonce pour que l'adversaire nous « voie ».
    if (status === 'SUBSCRIBED' && presence) {
      try { await channel.track({ selfId: presence.selfId }); } catch { /* best effort */ }
    }
  });

  return () => {
    client.removeChannel(channel);
  };
}
