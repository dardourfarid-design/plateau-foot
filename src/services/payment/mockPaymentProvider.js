// ===================== MOCK PAYMENT PROVIDER =====================
// Implémentation factice du contrat PaymentProvider, utilisée en l'absence
// de compte Stripe configuré. Simule un achat réussi immédiatement et écrit
// directement dans Supabase via une fonction RPC dédiée (pour respecter les
// mêmes règles RLS que le futur webhook Stripe : jamais d'insertion directe
// par le client authentifié standard).
//
// IMPORTANT : ce mock ne doit jamais tourner en production réelle avec de
// l'argent réel. Il sert uniquement à valider l'UX et l'intégration Supabase
// avant que Stripe soit branché. Le flag `isMock` permet à l'UI d'afficher
// un bandeau "mode démo" si besoin.

import { supabase, getCurrentUser } from '../supabaseClient.js';

export const isMock = true;

export async function checkoutTheme(theme, user) {
  if (!user) {
    throw new Error('Connexion requise avant achat.');
  }

  // En mock, on appelle une fonction RPC Postgres (sécurisée par le serveur,
  // pas un insert direct côté client) qui simule la validation d'un paiement.
  const { error } = await supabase.rpc('mock_complete_purchase', {
    p_theme_id: theme.id,
    p_amount_cents: theme.price_cents
  });

  if (error) {
    throw new Error(`Échec de l'achat simulé : ${error.message}`);
  }

  return { immediate: true };
}

export async function verifyPurchase(themeId) {
  const user = await getCurrentUser();
  if (!user) return false;

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
