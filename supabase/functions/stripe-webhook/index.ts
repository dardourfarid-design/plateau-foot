// ===================== stripe-webhook =====================
// Gère les événements Stripe pour les paiements uniques ET les abonnements.
//
// Événements traités :
//   checkout.session.completed       → thèmes, packs, joueurs (one-time)
//   customer.subscription.created    → activation pass (abonnement récurrent)
//   customer.subscription.updated    → mise à jour statut/période
//   customer.subscription.deleted    → annulation pass
//   invoice.payment_succeeded        → renouvellement abonnement (met à jour la période)
//   invoice.payment_failed           → pass en statut past_due

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
  if (!signature) return new Response('Signature manquante.', { status: 400 });

  const body = await req.text();
  let event: Stripe.Event;

  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
  } catch (err) {
    console.error('Signature webhook invalide :', err.message);
    return new Response(`Signature invalide : ${err.message}`, { status: 400 });
  }

  try {
    switch (event.type) {

      // ── Paiements uniques (thèmes, packs, joueurs) ─────────────────
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;

        if (session.mode === 'payment') {
          // Débloque l'achat dans purchases (+ fulfillment packs, voir 0025).
          // complete_stripe_purchase est IDEMPOTENTE (garde pending→completed) :
          // en cas d'erreur on renvoie 5xx pour que Stripe RÉ-ESSAYE, plutôt que
          // de renvoyer 200 et laisser le client débité sans produit livré.
          const { error } = await supabaseAdmin.rpc('complete_stripe_purchase', {
            p_stripe_session_id: session.id
          });
          if (error) {
            console.error('complete_stripe_purchase:', error.message);
            return new Response('Fulfillment échoué, nouvelle tentative attendue.', { status: 500 });
          }

          // Bundle : metadata.theme_ids contient TOUS les thèmes du lot —
          // on octroie chacun (avant l'audit, seul le premier était livré).
          // L'upsert onConflict est idempotent → 5xx sûr pour retry Stripe.
          if (session.metadata?.theme_ids && session.client_reference_id) {
            const themeIds = session.metadata.theme_ids.split(',');
            const rows = themeIds.map((id: string) => ({
              user_id: session.client_reference_id,
              theme_id: id,
              amount_cents: 0,
              status: 'completed',
              stripe_session_id: `${session.id}-${id}`
            }));
            const { error: bundleError } = await supabaseAdmin
              .from('purchases')
              .upsert(rows, { onConflict: 'user_id,theme_id' });
            if (bundleError) {
              console.error('octroi bundle:', bundleError.message);
              return new Response('Octroi bundle échoué, nouvelle tentative attendue.', { status: 500 });
            }
          }

          // Le décrément du compteur Fondateurs est désormais fait DANS
          // complete_stripe_purchase (une seule fois par session, migration
          // 0031) — plus ici, pour éviter le double décrément sur redélivraison.
        }

        // Mode subscription : le pass est activé via customer.subscription.created
        break;
      }

      // ── Abonnements : création ──────────────────────────────────────
      case 'customer.subscription.created': {
        const sub = event.data.object as Stripe.Subscription;
        await upsertPass(sub, 'active');
        // "1 joueur Rare offert" — promesse de la boutique, octroyée une seule
        // fois par utilisateur (fonction idempotente, voir migration 0025).
        if (sub.metadata?.user_id) {
          const { error } = await supabaseAdmin.rpc('grant_pass_rare_reward', {
            p_user_id: sub.metadata.user_id
          });
          if (error) console.error('grant_pass_rare_reward:', error.message);
        }
        break;
      }

      // ── Abonnements : mise à jour (ex: changement de plan) ──────────
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription;
        const status = sub.status === 'active' ? 'active'
                     : sub.status === 'past_due' ? 'past_due'
                     : 'cancelled';
        await upsertPass(sub, status);
        break;
      }

      // ── Abonnements : annulation ────────────────────────────────────
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        await supabaseAdmin
          .from('user_passes')
          .update({ status: 'cancelled', updated_at: new Date().toISOString() })
          .eq('stripe_subscription_id', sub.id);
        break;
      }

      // ── Facture payée (renouvellement mensuel/trimestriel) ──────────
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        if (invoice.subscription) {
          const sub = await stripe.subscriptions.retrieve(invoice.subscription as string);
          await upsertPass(sub, 'active');
        }
        break;
      }

      // ── Facture impayée ─────────────────────────────────────────────
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        if (invoice.subscription) {
          await supabaseAdmin
            .from('user_passes')
            .update({ status: 'past_due', updated_at: new Date().toISOString() })
            .eq('stripe_subscription_id', invoice.subscription as string);
        }
        break;
      }
    }
  } catch (err) {
    console.error(`Erreur traitement ${event.type}:`, err.message);
    return new Response('Erreur de traitement.', { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' }
  });
});

/**
 * Crée ou met à jour une ligne user_passes depuis un objet Stripe.Subscription.
 * Le user_id est extrait des métadonnées de la session checkout d'origine,
 * stockées dans sub.metadata lors de la création de l'abonnement.
 */
async function upsertPass(sub: Stripe.Subscription, status: string) {
  const userId = sub.metadata?.user_id;
  if (!userId) {
    console.error('upsertPass: user_id manquant dans sub.metadata', sub.id);
    return;
  }

  const passType = sub.metadata?.pass_type ?? 'monthly';
  const periodEnd = sub.current_period_end
    ? new Date(sub.current_period_end * 1000).toISOString()
    : null;

  const { error } = await supabaseAdmin
    .from('user_passes')
    .upsert({
      user_id:               userId,
      pass_type:             passType,
      stripe_subscription_id: sub.id,
      status,
      current_period_end:    periodEnd,
      updated_at:            new Date().toISOString()
    }, { onConflict: 'stripe_subscription_id' });

  if (error) console.error('upsertPass error:', error.message);
}
