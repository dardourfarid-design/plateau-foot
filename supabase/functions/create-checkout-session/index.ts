// ===================== create-checkout-session =====================
// Edge Function Supabase (Deno). Reçoit une demande d'achat depuis le
// client authentifié, calcule le prix CÔTÉ SERVEUR (jamais transmis ni
// fait confiance depuis le navigateur), crée une session Stripe Checkout
// en mode Test, et retourne son URL.
//
// IMPORTANT — décision produit explicite : ce projet reste gratuit.
// Stripe tourne uniquement avec des clés sk_test_/pk_test_ (variable
// d'environnement STRIPE_SECRET_KEY côté Supabase). Aucune carte réelle
// n'est jamais débitée. Basculer vers Live plus tard ne demande qu'un
// changement de cette variable — ce code n'a pas besoin d'être réécrit.
//
// Types de produits acceptés (body JSON) :
//   { kind: 'theme', themeId }
//   { kind: 'bundle', themeIds: [...] }
//   { kind: 'player', playerId }
//   { kind: 'custom-slot' }

import { createClient } from 'jsr:@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@17.4.0?target=deno';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2024-06-20',
  httpClient: Stripe.createFetchHttpClient()
});

const FRONTEND_URL = Deno.env.get('FRONTEND_URL') ?? 'https://tactic-master.vercel.app';

Deno.serve(async (req) => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return jsonResponse({ error: 'Authentification requise.' }, 401);
    }

    const body = await req.json();
    const { themeId, priceCents, productName } = await resolveProduct(supabase, body);

    // Pose une ligne `purchases` en 'pending' AVANT la redirection Stripe,
    // pour garder une trace même si l'utilisateur abandonne en route.
    const tempSessionId = `pending-${crypto.randomUUID()}`;
    const { error: pendingError } = await supabase.rpc('create_pending_purchase', {
      p_theme_id: themeId,
      p_amount_cents: priceCents,
      p_stripe_session_id: tempSessionId
    });
    if (pendingError) {
      return jsonResponse({ error: pendingError.message }, 400);
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'eur',
          product_data: { name: productName },
          unit_amount: priceCents
        },
        quantity: 1
      }],
      success_url: `${FRONTEND_URL}/?checkout=success`,
      cancel_url: `${FRONTEND_URL}/?checkout=cancelled`,
      client_reference_id: user.id,
      metadata: { theme_id: themeId }
    });

    // Remplace l'id temporaire par le vrai id de session Stripe, pour que
    // le webhook puisse retrouver cette ligne précise à la confirmation.
    await supabase
      .from('purchases')
      .update({ stripe_session_id: session.id })
      .eq('stripe_session_id', tempSessionId);

    return jsonResponse({ url: session.url });
  } catch (err) {
    console.error('create-checkout-session error:', err);
    return jsonResponse({ error: err.message || 'Erreur inattendue.' }, 500);
  }
});

/**
 * Détermine le theme_id factice et le prix réel en centimes pour le
 * produit demandé, en lisant toujours la base de vérité côté serveur
 * (jamais le prix envoyé par le client, qui n'est ici qu'un identifiant).
 *
 * Note : il n'y a pas de mode 'player' séparé ici — l'achat d'un joueur
 * passe par prepare_player_purchase() (0018) côté client AVANT d'appeler
 * cette fonction, qui crée déjà la ligne `themes` factice correspondante
 * (id 'player-<uuid>'). Cette fonction la traite alors simplement comme
 * un thème normal (mode 'theme'), sans dupliquer cette logique de calcul.
 */
async function resolveProduct(supabase, body) {
  if (body.kind === 'theme') {
    const { data: theme, error } = await supabase
      .from('themes').select('id, name, price_cents').eq('id', body.themeId).eq('is_active', true).single();
    if (error || !theme) throw new Error('Thème introuvable.');
    return { themeId: theme.id, priceCents: theme.price_cents, productName: theme.name };
  }

  if (body.kind === 'bundle') {
    const { data: themes, error } = await supabase
      .from('themes').select('id, price_cents').in('id', body.themeIds).eq('is_active', true);
    if (error || !themes || themes.length === 0) throw new Error('Bundle introuvable.');
    return { themeId: themes[0].id, priceCents: 699, productName: 'Pack Mondial complet' };
  }

  throw new Error('Type de produit inconnu.');
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}
