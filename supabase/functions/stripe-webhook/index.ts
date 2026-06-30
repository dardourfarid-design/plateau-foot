// ===================== stripe-webhook =====================
// Edge Function Supabase (Deno). Reçoit les événements Stripe (toujours en
// mode Test pour ce projet — voir create-checkout-session pour le détail
// de cette décision produit). Vérifie la signature avant tout traitement.
//
// Utilise la clé service_role (jamais exposée au client) pour pouvoir
// écrire dans purchases/player_ownership en contournant la RLS de façon
// contrôlée — c'est le seul endroit du projet où cette clé doit exister.
//
// Configuration requise côté Supabase (config.toml) : cette fonction doit
// avoir verify_jwt = false, puisque Stripe ne peut pas fournir de JWT
// Supabase — la sécurité vient de la vérification de signature Stripe,
// pas de l'authentification Supabase standard.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@17.4.0?target=deno';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2024-06-20',
  httpClient: Stripe.createFetchHttpClient()
});

const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')!;

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

Deno.serve(async (req) => {
  const signature = req.headers.get('stripe-signature');
  if (!signature) {
    return new Response('Signature manquante.', { status: 400 });
  }

  const body = await req.text();
  let event;

  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
  } catch (err) {
    console.error('Signature webhook invalide :', err.message);
    return new Response(`Signature invalide : ${err.message}`, { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;

    const { error } = await supabaseAdmin.rpc('complete_stripe_purchase', {
      p_stripe_session_id: session.id
    });

    if (error) {
      console.error('complete_stripe_purchase a échoué :', error.message);
      return new Response('Erreur de traitement.', { status: 500 });
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' }
  });
});
