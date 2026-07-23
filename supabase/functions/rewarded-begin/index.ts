// ===================== rewarded-begin =====================
// Edge Function Supabase (Deno). Étape 1/2 du modèle nonce des récompenses
// vidéo GameMonetize (migration 0044). Monétisation « en attendant AdSense ».
//
// GameMonetize (SDK HTML5) ne fournit pas de postback S2S signé : on ne peut
// pas reproduire le SSV Google (rewarded-ssv). Pour NE PAS réintroduire le farm
// auto-déclaré fermé par 0026, l'identité à créditer ne vient JAMAIS du client :
// on l'établit ici à partir du JWT, puis create_rewarded_nonce émet un nonce
// aléatoire à usage unique, lié à cet utilisateur. Le client renverra ce nonce
// à rewarded-complete APRÈS avoir regardé la vidéo.
//
// Flux client (rewardedGrant.js) :
//   POST /functions/v1/rewarded-begin
//   Header : Authorization: Bearer <JWT de l'utilisateur>
//   Body   : {} (vide — l'identité vient du JWT)
//   → { nonce } | { error }
//
// ÉCHEC FERMÉ : tant que REWARDED_CLIENT_ENABLED n'est pas 'true' (rewarded
// GameMonetize pas encore activé), on renvoie 503 sans émettre de nonce.
// verify_jwt = false dans config.toml (même raison que delete-account : on
// vérifie manuellement via getUser()). ⚠️ Désactiver aussi « Verify JWT » dans
// le dashboard après déploiement.

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

  // Échec fermé tant que le rewarded client n'est pas explicitement activé.
  if (Deno.env.get('REWARDED_CLIENT_ENABLED') !== 'true') {
    return jsonResponse({ error: 'rewarded disabled' }, 503);
  }

  try {
    // ── 1. Identifier l'utilisateur via son JWT (jamais via le corps) ──────
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

    // ── 2. Émettre un nonce (service_role : create_rewarded_nonce) ─────────
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    const { data: nonce, error } = await adminClient.rpc('create_rewarded_nonce', {
      p_user_id: user.id
    });
    if (error) {
      console.error('create_rewarded_nonce:', error.message);
      return jsonResponse({ error: 'Récompense indisponible.' }, 500);
    }
    // null = quota journalier atteint : rien à réclamer aujourd'hui.
    if (!nonce) {
      return jsonResponse({ error: 'daily_quota_reached' }, 429);
    }

    return jsonResponse({ nonce });
  } catch (err) {
    console.error('rewarded-begin error inattendue :', err);
    return jsonResponse({ error: (err as Error).message || 'Erreur inattendue.' }, 500);
  }
});

function jsonResponse(body: object, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}
