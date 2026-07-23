// ===================== rewarded-complete =====================
// Edge Function Supabase (Deno). Étape 2/2 du modèle nonce des récompenses
// vidéo GameMonetize (migration 0044). Monétisation « en attendant AdSense ».
//
// Appelée par le client APRÈS que le SDK GameMonetize a émis
// SDK_REWARDED_WATCH_COMPLETE (vidéo regardée jusqu'au bout). On revalide côté
// serveur : l'utilisateur est celui du JWT, et le nonce fourni lui appartient,
// n'est pas déjà consommé et n'est pas expiré (consume_rewarded_nonce). Le
// crédit passe par grant_rewarded_coins — le montant est décidé serveur, jamais
// transmis par le client, et le plafond de 10/j s'applique.
//
// Flux client (rewardedGrant.js) :
//   POST /functions/v1/rewarded-complete
//   Header : Authorization: Bearer <JWT de l'utilisateur>
//   Body   : { nonce } (le nonce émis par rewarded-begin)
//   → { granted: boolean, coins?, reason? } | { error }
//
// ÉCHEC FERMÉ : 503 tant que REWARDED_CLIENT_ENABLED n'est pas 'true'.
// verify_jwt = false (vérification manuelle via getUser()).

import { createClient } from 'jsr:@supabase/supabase-js@2';

const FRONTEND_URL = Deno.env.get('FRONTEND_URL') ?? 'https://tactic-master.vercel.app';

const corsHeaders = {
  'Access-Control-Allow-Origin': FRONTEND_URL,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'method not allowed' }, 405);
  }

  if (Deno.env.get('REWARDED_CLIENT_ENABLED') !== 'true') {
    return jsonResponse({ error: 'rewarded disabled' }, 503);
  }

  try {
    // ── 1. Identité via JWT ────────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return jsonResponse({ error: 'Authentification requise.' }, 401);

    const anonClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: authError } = await anonClient.auth.getUser();
    if (authError || !user) {
      return jsonResponse({ error: 'Authentification requise.' }, 401);
    }

    // ── 2. Lire le nonce du corps ──────────────────────────────────────────
    let nonce: string | null = null;
    try {
      const body = await req.json();
      nonce = typeof body?.nonce === 'string' ? body.nonce : null;
    } catch {
      nonce = null;
    }
    if (!nonce) return jsonResponse({ error: 'missing_nonce' }, 400);

    // ── 3. Valider + créditer (service_role : consume_rewarded_nonce) ──────
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    const { data, error } = await adminClient.rpc('consume_rewarded_nonce', {
      p_user_id: user.id,
      p_nonce: nonce
    });
    if (error) {
      console.error('consume_rewarded_nonce:', error.message);
      return jsonResponse({ error: 'Crédit impossible.' }, 500);
    }

    // data = { granted, coins? , reason? } tel que renvoyé par la RPC.
    return jsonResponse(data);
  } catch (err) {
    console.error('rewarded-complete error inattendue :', err);
    return jsonResponse({ error: (err as Error).message || 'Erreur inattendue.' }, 500);
  }
});

function jsonResponse(body: object, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}
