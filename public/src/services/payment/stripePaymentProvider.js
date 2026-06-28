// ===================== STRIPE PAYMENT PROVIDER (À COMPLÉTER) =====================
// Implémentation réelle du contrat PaymentProvider via Stripe Checkout.
// Respecte exactement la même signature que mockPaymentProvider.js : pour activer
// Stripe en production, il suffit de changer l'import dans paymentProvider.js
// (le fichier d'assemblage), rien d'autre dans l'app n'a besoin de changer.
//
// PRÉREQUIS AVANT DE COMPLÉTER CE FICHIER :
//   1. Compte Stripe créé, mode Test activé
//   2. Clé publique Stripe (pk_test_...) ajoutée à la config front
//   3. Une Supabase Edge Function `create-checkout-session` qui :
//      - reçoit { themeId } depuis le front
//      - vérifie le prix côté serveur (jamais confiance dans un prix client)
//      - crée une session Stripe Checkout et renvoie son URL
//   4. Une Supabase Edge Function `stripe-webhook` qui :
//      - vérifie la signature Stripe (stripe.webhooks.constructEvent)
//      - sur `checkout.session.completed`, insère la ligne dans `purchases`
//        avec la service_role key (jamais avec la clé anonyme)
//
// Ce découpage garantit qu'un client malveillant ne peut jamais s'auto-attribuer
// un thème gratuitement : la vérité sur "qui a payé quoi" vient uniquement du
// webhook signé par Stripe, jamais du navigateur.

import { supabase } from '../supabaseClient.js';

export const isMock = false;

export async function checkoutTheme(theme, user) {
  if (!user) {
    throw new Error('Connexion requise avant achat.');
  }

  const { data, error } = await supabase.functions.invoke('create-checkout-session', {
    body: { themeId: theme.id }
  });

  if (error) {
    throw new Error(`Impossible de démarrer le paiement : ${error.message}`);
  }

  // La fonction Edge doit renvoyer { url: 'https://checkout.stripe.com/...' }
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
