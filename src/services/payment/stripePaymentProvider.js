// ===================== STRIPE PAYMENT PROVIDER =====================
// Implémentation réelle du contrat PaymentProvider via Stripe Checkout, en
// MODE TEST PERMANENT par décision produit explicite : ce projet reste
// gratuit, aucune carte réelle n'est jamais débitée. Les clés Stripe
// utilisées côté serveur (Edge Functions) sont sk_test_/pk_test_.
// Basculer vers Live plus tard ne demanderait qu'un changement de ces
// clés (variables d'environnement Supabase), jamais une réécriture de ce
// fichier ni du reste de l'app.
//
// Respecte exactement la même signature que mockPaymentProvider.js : pour
// activer ce provider, changer l'import dans paymentProvider.js (le
// fichier d'assemblage) — rien d'autre dans l'app n'a besoin de changer.
//
// Edge Functions associées (voir supabase/functions/) :
//   - create-checkout-session : calcule le prix côté serveur, crée la
//     session Stripe Checkout, pose une ligne `purchases` en 'pending'.
//   - stripe-webhook : vérifie la signature Stripe, finalise l'achat
//     (`purchases` -> 'completed', octroi du produit) via la
//     service_role key — jamais le front, jamais la clé anonyme.
//
// Ce découpage garantit qu'un client malveillant ne peut jamais
// s'auto-attribuer un produit gratuitement : la vérité sur "qui a payé
// quoi" vient uniquement du webhook signé par Stripe.

import { supabase } from '../supabaseClient.js';

export const isMock = false;

export async function checkoutTheme(theme, user) {
  if (!user) {
    throw new Error('Connexion requise avant achat.');
  }

  const { data, error } = await supabase.functions.invoke('create-checkout-session', {
    body: { kind: 'theme', themeId: theme.id }
  });

  if (error) {
    throw new Error(`Impossible de démarrer le paiement : ${error.message}`);
  }

  // La fonction Edge doit renvoyer { url: 'https://checkout.stripe.com/...' }
  return { redirectUrl: data.url };
}

/**
 * Équivalent bundle de checkoutTheme : la fonction Edge `create-checkout-session`
 * devra accepter soit { themeId }, soit { themeIds, bundleId } pour calculer le
 * bon prix côté serveur (jamais confiance dans un prix envoyé par le client).
 */
export async function checkoutBundle(themeIds, bundlePriceCents, user) {
  if (!user) {
    throw new Error('Connexion requise avant achat.');
  }

  const { data, error } = await supabase.functions.invoke('create-checkout-session', {
    body: { kind: 'bundle', themeIds }
  });

  if (error) {
    throw new Error(`Impossible de démarrer le paiement groupé : ${error.message}`);
  }

  return { redirectUrl: data.url };
}

export async function verifyPurchase(themeId, user) {
  // Identique au mock : la vérité est dans Supabase, écrite par le webhook,
  // jamais par le front. Cette fonction reste donc une simple lecture.
  const { data, error } = await supabase
    .from('purchases')
    .select('theme_id')
    .eq('user_id', user.id)
    .eq('theme_id', themeId)
    .eq('status', 'completed')
    .maybeSingle();

  if (error) return false;
  return !!data;
}
