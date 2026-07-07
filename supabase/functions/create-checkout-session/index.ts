// ===================== create-checkout-session =====================
// Gère 4 types de produits :
//   { kind: 'theme',   themeId }                  → paiement unique
//   { kind: 'bundle',  themeIds: [...] }           → paiement unique
//   { kind: 'pass',    passType: 'monthly'|'quarterly' } → abonnement Stripe récurrent
//   { kind: 'pack',    packId }                    → paiement unique (pack joueurs/kits)
//
// Pour les passes, on utilise mode:'subscription' + un Stripe Price récurrent
// créé à la volée si les env vars STRIPE_PRICE_MONTHLY / STRIPE_PRICE_QUARTERLY
// ne sont pas renseignées (comportement de secours sandbox).
//
// STRIPE_PRICE_MONTHLY   : Stripe Price ID mensuel  (ex: price_xxxxx)
// STRIPE_PRICE_QUARTERLY : Stripe Price ID trimestriel
// Ces deux variables doivent être créées dans le Dashboard Stripe :
//   Products → Add product → "Pass Mensuel" → €1,99/mois récurrent
//   puis copiez le Price ID dans Supabase Edge Functions → Secrets.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@17.4.0?target=deno';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2024-06-20',
  httpClient: Stripe.createFetchHttpClient()
});

const FRONTEND_URL = Deno.env.get('FRONTEND_URL') ?? 'https://tactic-master.vercel.app';

// CORS restreint au front de production (au lieu de '*') : ces fonctions ne
// sont appelées que par le site lui-même.
const corsHeaders = {
  'Access-Control-Allow-Origin': FRONTEND_URL,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

// Prix des passes en centimes (utilisés pour créer un Price Stripe à la volée
// si les env vars ne sont pas encore renseignées — sandbox uniquement)
const PASS_PRICES = {
  monthly:   { cents: 199,  interval: 'month' as const,  label: 'Pass Mensuel Tactic Master' },
  quarterly: { cents: 399,  interval: 'month' as const,  label: 'Pass Trimestriel Tactic Master',
               intervalCount: 3 }
};

// Packs de pièces tactiques (one-time). Le CRÉDIT de pièces est décidé côté
// SQL (complete_stripe_purchase, migration 0026) — jamais par le client.
const COIN_CATALOG: Record<string, { cents: number; label: string }> = {
  'coins-100': { cents: 199, label: '100 Pièces Tactiques' },
  'coins-250': { cents: 399, label: '250 Pièces Tactiques' },
  'coins-600': { cents: 799, label: '600 Pièces Tactiques' }
};

// Bundle Mondial : ENSEMBLE FIXE défini côté serveur (les 5 thèmes Mondial
// de la migration 0006), au prix groupé de 6,99 €. On n'utilise JAMAIS la
// liste de thèmes envoyée par le client : sinon un client malveillant pouvait
// passer `themeIds: [<tous les thèmes>]` et débloquer le catalogue entier
// pour 6,99 € (le webhook octroie chaque id présent dans metadata.theme_ids).
const MONDIAL_BUNDLE_THEME_IDS = ['or-mondial', 'samba', 'tricolore', 'albiceleste', 'nuit-americaine'];
const BUNDLE_PRICE_CENTS = 699;

// Prix des packs (one-time)
const PACK_CATALOG: Record<string, { cents: number; label: string; kind: string }> = {
  'pack-3-kits':   { cents: 549,  label: 'Pack 3 Kits',              kind: 'pack' },
  'pack-academie': { cents: 499,  label: 'Pack Académie — 3 Rares',  kind: 'pack' },
  'pack-legendes': { cents: 799,  label: 'Pack Légendes — 2 Légendaires', kind: 'pack' },
  'pack-fondateurs':{ cents: 999, label: 'Pack Fondateurs',          kind: 'pack' }
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

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

    // ── PASSES (abonnements récurrents) ─────────────────────────────────
    if (body.kind === 'pass') {
      const passType = body.passType as 'monthly' | 'quarterly';
      if (!PASS_PRICES[passType]) {
        return jsonResponse({ error: 'Type de pass invalide.' }, 400);
      }
      const pass = PASS_PRICES[passType];

      // Récupérer le Price Stripe depuis les secrets, ou le créer à la volée
      let priceId = passType === 'monthly'
        ? Deno.env.get('STRIPE_PRICE_MONTHLY')
        : Deno.env.get('STRIPE_PRICE_QUARTERLY');

      if (!priceId) {
        // Création à la volée en sandbox — idempotent grâce au lookup_key
        const lookupKey = `tactic-master-pass-${passType}`;
        const existing = await stripe.prices.list({ lookup_keys: [lookupKey], limit: 1 });
        if (existing.data.length > 0) {
          priceId = existing.data[0].id;
        } else {
          const product = await stripe.products.create({ name: pass.label });
          const price = await stripe.prices.create({
            product: product.id,
            unit_amount: pass.cents,
            currency: 'eur',
            recurring: {
              interval: pass.interval,
              ...(pass.intervalCount ? { interval_count: pass.intervalCount } : {})
            },
            lookup_key: lookupKey
          });
          priceId = price.id;
        }
      }

      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        payment_method_types: ['card'],
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${FRONTEND_URL}/?checkout=pass_success&pass_type=${passType}`,
        cancel_url: `${FRONTEND_URL}/?checkout=cancelled`,
        client_reference_id: user.id,
        metadata: { user_id: user.id, pass_type: passType },
        // INDISPENSABLE : les metadata de session ne sont pas propagées à la
        // Subscription par Stripe. Sans ce bloc, le webhook
        // customer.subscription.created reçoit sub.metadata vide et le pass
        // n'est JAMAIS activé (bug corrigé par l'audit).
        subscription_data: {
          metadata: { user_id: user.id, pass_type: passType }
        }
      });

      return jsonResponse({ url: session.url });
    }

    // ── PIÈCES TACTIQUES (one-time) ─────────────────────────────────────
    if (body.kind === 'coins') {
      const coinPack = COIN_CATALOG[body.packId];
      if (!coinPack) return jsonResponse({ error: 'Pack de pièces introuvable.' }, 400);

      const tempSessionId = `pending-${crypto.randomUUID()}`;
      const { error: coinPendingError } = await supabase.rpc('create_pending_purchase', {
        p_theme_id:          body.packId,
        p_amount_cents:      coinPack.cents,
        p_stripe_session_id: tempSessionId
      });
      if (coinPendingError) {
        console.error('create_pending_purchase (coins):', coinPendingError.message);
        return jsonResponse({ error: 'Achat momentanément indisponible.' }, 500);
      }

      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        payment_method_types: ['card'],
        line_items: [{
          price_data: {
            currency: 'eur',
            product_data: { name: coinPack.label },
            unit_amount: coinPack.cents
          },
          quantity: 1
        }],
        success_url: `${FRONTEND_URL}/?checkout=success`,
        cancel_url: `${FRONTEND_URL}/?checkout=cancelled`,
        client_reference_id: user.id,
        metadata: { theme_id: body.packId, coin_pack: body.packId }
      });

      const { error: coinUpdateError } = await supabase.rpc('update_pending_purchase_session_id', {
        p_old_session_id: tempSessionId,
        p_new_session_id: session.id
      });
      if (coinUpdateError) {
        console.error('update_pending_purchase_session_id (coins):', coinUpdateError.message);
        return jsonResponse({ error: 'Achat momentanément indisponible.' }, 500);
      }

      return jsonResponse({ url: session.url });
    }

    // ── PACKS (one-time) ────────────────────────────────────────────────
    if (body.kind === 'pack') {
      const pack = PACK_CATALOG[body.packId];
      if (!pack) return jsonResponse({ error: 'Pack introuvable.' }, 400);

      // Édition limitée : refuse la vente si le compteur Fondateurs est épuisé.
      if (body.packId === 'pack-fondateurs') {
        const { data: remaining } = await supabase.rpc('get_founders_remaining');
        if ((remaining ?? 0) <= 0) {
          return jsonResponse({ error: 'Le Pack Fondateurs est épuisé.' }, 409);
        }
      }

      const tempSessionId = `pending-${crypto.randomUUID()}`;
      // ERREUR VÉRIFIÉE (audit) : avant, un échec silencieux ici laissait
      // l'utilisateur payer sans qu'aucune ligne pending n'existe → paiement
      // encaissé, produit jamais livré par le webhook.
      const { error: pendingError } = await supabase.rpc('create_pending_purchase', {
        p_theme_id:          body.packId,
        p_amount_cents:      pack.cents,
        p_stripe_session_id: tempSessionId
      });
      if (pendingError) {
        console.error('create_pending_purchase (pack):', pendingError.message);
        return jsonResponse({ error: 'Achat momentanément indisponible.' }, 500);
      }

      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        payment_method_types: ['card'],
        line_items: [{
          price_data: {
            currency: 'eur',
            product_data: { name: pack.label },
            unit_amount: pack.cents
          },
          quantity: 1
        }],
        success_url: `${FRONTEND_URL}/?checkout=success`,
        cancel_url: `${FRONTEND_URL}/?checkout=cancelled`,
        client_reference_id: user.id,
        metadata: { theme_id: body.packId, pack_id: body.packId }
      });

      const { error: updateError } = await supabase.rpc('update_pending_purchase_session_id', {
        p_old_session_id: tempSessionId,
        p_new_session_id: session.id
      });
      if (updateError) {
        console.error('update_pending_purchase_session_id (pack):', updateError.message);
        return jsonResponse({ error: 'Achat momentanément indisponible.' }, 500);
      }

      return jsonResponse({ url: session.url });
    }

    // ── THÈMES & BUNDLE (comportement inchangé) ──────────────────────────
    const { themeId, priceCents, productName, allThemeIds } = await resolveProduct(supabase, body);

    const tempSessionId = `pending-${crypto.randomUUID()}`;
    const { error: pendingError } = await supabase.rpc('create_pending_purchase', {
      p_theme_id: themeId,
      p_amount_cents: priceCents,
      p_stripe_session_id: tempSessionId
    });
    if (pendingError) {
      console.error('create_pending_purchase:', pendingError.message);
      return jsonResponse({ error: 'Achat momentanément indisponible.' }, 500);
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
      // theme_ids : liste complète pour un bundle — le webhook octroie CHAQUE
      // thème (avant, seul le premier du bundle était livré).
      metadata: { theme_id: themeId, ...(allThemeIds ? { theme_ids: allThemeIds } : {}) }
    });

    const { error: updateError } = await supabase.rpc('update_pending_purchase_session_id', {
      p_old_session_id: tempSessionId,
      p_new_session_id: session.id
    });
    if (updateError) {
      console.error('update_pending_purchase_session_id:', updateError.message);
      return jsonResponse({ error: 'Achat momentanément indisponible.' }, 500);
    }

    return jsonResponse({ url: session.url });

  } catch (err) {
    // On journalise le détail côté serveur mais on ne renvoie JAMAIS err.message
    // au client : il peut contenir des détails internes (SQL, Stripe, etc.).
    console.error('create-checkout-session error:', err);
    return jsonResponse({ error: 'Erreur inattendue.' }, 500);
  }
});

async function resolveProduct(supabase: any, body: any) {
  if (body.kind === 'theme') {
    const { data: theme, error } = await supabase
      .from('themes').select('id, name, price_cents')
      .eq('id', body.themeId).eq('is_active', true).single();
    if (error || !theme) throw new Error('Thème introuvable.');
    return { themeId: theme.id, priceCents: theme.price_cents, productName: theme.name, allThemeIds: null };
  }
  if (body.kind === 'bundle') {
    // On IGNORE body.themeIds : le contenu du bundle est fixé côté serveur.
    const { data: themes, error } = await supabase
      .from('themes').select('id, price_cents').in('id', MONDIAL_BUNDLE_THEME_IDS).eq('is_active', true);
    if (error || !themes?.length) throw new Error('Bundle introuvable.');
    return {
      themeId: themes[0].id,
      priceCents: BUNDLE_PRICE_CENTS,
      productName: 'Pack Mondial complet',
      allThemeIds: themes.map((t: { id: string }) => t.id).join(',')
    };
  }
  throw new Error('Type de produit inconnu.');
}

function jsonResponse(body: object, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}
