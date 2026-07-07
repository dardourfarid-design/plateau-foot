// ===================== delete-account =====================
// Edge Function Supabase (Deno). Suppression complète et définitive
// du compte d'un utilisateur authentifié, en deux temps :
//
//   1. delete_my_data() (RPC security definer, migration 0007) : supprime
//      le profil et toutes les tables liées via ON DELETE CASCADE
//      (purchases, user_consents, team_lineups, friendships, etc.).
//
//   2. supabase.auth.admin.deleteUser() avec la service_role key : supprime
//      la ligne dans auth.users, qui ne peut pas être touchée avec la clé
//      anon ni par le client authentifié lui-même. C'est la seule étape
//      que main.js ne pouvait pas faire directement, d'où cette fonction.
//
// Flux côté client (src/services/consentService.js → deleteAccount()) :
//   POST /functions/v1/delete-account
//   Header : Authorization: Bearer <JWT de l'utilisateur>
//   Body   : {} (vide — l'identité vient du JWT, jamais du body)
//
// Sécurité :
//   - L'utilisateur supprimé est toujours celui du JWT — impossible de
//     cibler quelqu'un d'autre depuis le body.
//   - verify_jwt = false dans config.toml (même raison que
//     create-checkout-session : le gateway peut rejeter des JWT valides
//     de façon imprévisible ; on vérifie manuellement via getUser()).
//   - La service_role key n'est jamais exposée côté client — elle est
//     lue uniquement dans les variables d'environnement Supabase.
//
// ⚠️  Après déploiement, désactiver aussi manuellement "Verify JWT" dans
//     Dashboard → Edge Functions → delete-account → Settings (le config.toml
//     peut être ignoré selon la méthode de déploiement — déjà documenté).

import { createClient } from 'jsr:@supabase/supabase-js@2';

// CORS restreint au front de production (au lieu de '*'), cohérent avec
// create-checkout-session : cette fonction n'est appelée que par le site.
const FRONTEND_URL = Deno.env.get('FRONTEND_URL') ?? 'https://tactic-master.vercel.app';

const corsHeaders = {
  'Access-Control-Allow-Origin': FRONTEND_URL,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

Deno.serve(async (req) => {
  // Préflight CORS — le navigateur l'envoie avant la vraie requête POST
  // dès que l'appel traverse des origines différentes (Vercel → Supabase).
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // ── 1. Identifier l'utilisateur via son JWT ──────────────────────────
    // Client anon avec le JWT du header : suffit pour getUser() et pour
    // appeler delete_my_data() (security definer, vérifie auth.uid() en SQL).
    const anonClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const { data: { user }, error: authError } = await anonClient.auth.getUser();
    if (authError || !user) {
      return jsonResponse({ error: 'Authentification requise.' }, 401);
    }

    // ── 2. Supprimer les données applicatives (profiles + CASCADE) ────────
    // delete_my_data() (migration 0007) supprime le profil ; toutes les
    // tables liées suivent automatiquement via ON DELETE CASCADE déjà en
    // place : purchases, user_consents, team_lineups, player_ownership,
    // custom_players, friendships, mercato_offers, etc.
    const { error: dataError } = await anonClient.rpc('delete_my_data');
    if (dataError) {
      console.error('delete_my_data() a échoué :', dataError.message);
      return jsonResponse({ error: 'Suppression des données impossible : ' + dataError.message }, 500);
    }

    // ── 3. Supprimer le compte d'authentification (auth.users) ───────────
    // Nécessite la service_role key — jamais exposée côté client, lue
    // uniquement ici depuis les variables d'environnement Supabase.
    // On crée un second client admin pour cette seule opération.
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { error: authDeleteError } = await adminClient.auth.admin.deleteUser(user.id);
    if (authDeleteError) {
      // Les données applicatives sont déjà supprimées à ce stade. On log
      // l'erreur mais on ne bloque pas : côté RGPD, l'essentiel (données
      // personnelles identifiables) est déjà effacé. La ligne auth.users
      // résiduelle ne contient plus que l'email et des métadonnées Auth —
      // elle sera purgée manuellement si nécessaire.
      console.error('Suppression auth.users échouée :', authDeleteError.message);
      return jsonResponse({
        success: true,
        warning: 'Données supprimées mais déconnexion auth partielle. Contacte le support si nécessaire.'
      });
    }

    return jsonResponse({ success: true });

  } catch (err) {
    console.error('delete-account error inattendue :', err);
    return jsonResponse({ error: err.message || 'Erreur inattendue.' }, 500);
  }
});

function jsonResponse(body: object, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}
