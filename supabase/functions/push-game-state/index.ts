// ===================== push-game-state =====================
// Edge Function Supabase (Deno). Validation serveur des coups du multijoueur
// en ligne (#260) : le client n'envoie plus un état de jeu complet mais un
// JOURNAL D'ACTIONS ({ fn, args }). La fonction rejoue ces actions sur l'état
// AUTORITAIRE stocké en base, avec le même moteur pur que le client
// (public/src/engine/, importé en relatif — source unique, zéro duplication),
// et persiste le résultat du rejeu. Un coup illégal, un mauvais tour ou une
// action hors liste blanche ⇒ 422 avec l'état serveur (le client resynchronise).
//
// Rollout : tant que la migration 0039 n'est pas appliquée, l'ancienne RPC
// update_game_session_state reste appelable (chemin de repli du client).
// Ordre sûr : déployer CETTE fonction d'abord, constater, PUIS appliquer 0039
// pour fermer le chemin non validé.

import { createClient } from 'jsr:@supabase/supabase-js@2';
// Le moteur est importé depuis ./_engine/ — DANS le dossier de la fonction,
// seule zone garantie embarquée au déploiement (CLI comme dashboard). Un import
// vers ../_shared/ (dossier frère) OU vers public/src/engine/ échoue :
// « Module not found » (hors du bundle de la fonction). Les copies sont
// maintenues identiques à la source par tools/sync-edge-engine.mjs et vérifiées
// par le test tests/edgeEngineSync.test.js. Voir ./_engine/README.md.
import { replayActions, MAX_ACTIONS_PER_PUSH } from './_engine/replayActions.js';

const FRONTEND_URL = Deno.env.get('FRONTEND_URL') ?? 'https://tactic-master.vercel.app';

// CORS restreint au front de production (même politique que create-checkout-session).
const corsHeaders = {
  'Access-Control-Allow-Origin': FRONTEND_URL,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

function jsonResponse(body: object, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

// Handler exporté (testable) ; branché sur Deno.serve en bas de fichier.
export async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'method not allowed' }, 405);
  }

  let body: { sessionId?: string; actions?: unknown[] };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'corps JSON invalide' }, 400);
  }
  const { sessionId, actions } = body;
  if (!sessionId || !Array.isArray(actions) || actions.length === 0 || actions.length > MAX_ACTIONS_PER_PUSH) {
    return jsonResponse({ error: 'sessionId et actions (1..' + MAX_ACTIONS_PER_PUSH + ') requis' }, 400);
  }

  // Identité de l'appelant : le JWT du joueur, vérifié par Supabase Auth.
  const authHeader = req.headers.get('Authorization') ?? '';
  const userClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  );
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData?.user) {
    return jsonResponse({ error: 'authentification requise' }, 401);
  }
  const userId = userData.user.id;

  // Accès service role : lecture de l'état autoritaire + écriture validée.
  const service = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );
  const { data: row, error: rowError } = await service
    .from('game_sessions')
    .select('id, game_state, status, host_user_id, guest_user_id, host_team')
    .eq('id', sessionId)
    .single();
  if (rowError || !row) {
    return jsonResponse({ error: 'partie introuvable' }, 404);
  }
  if (row.status !== 'active') {
    return jsonResponse({ error: 'partie non active', state: row.game_state }, 409);
  }
  if (userId !== row.host_user_id && userId !== row.guest_user_id) {
    return jsonResponse({ error: 'accès refusé' }, 403);
  }
  const team = userId === row.host_user_id
    ? row.host_team
    : (row.host_team === 'bleu' ? 'rouge' : 'bleu');

  const result = replayActions(row.game_state, actions as { fn: string; args: unknown[] }[], team);
  if ('error' in result) {
    // L'état serveur fait foi : le client le reprend tel quel.
    return jsonResponse({ error: result.error, state: row.game_state }, 422);
  }

  const { error: updateError } = await service
    .from('game_sessions')
    .update({
      game_state: result.state,
      last_activity_at: new Date().toISOString(),
      // Même transition que l'ancienne RPC : une partie finie est close.
      ...(result.state.gameOver ? { status: 'finished' } : {})
    })
    .eq('id', sessionId);
  if (updateError) {
    return jsonResponse({ error: 'écriture impossible : ' + updateError.message }, 500);
  }

  return jsonResponse({ state: result.state });
}

Deno.serve(handler);
