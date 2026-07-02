// ===================== SERVICE PIÈCES TACTIQUES =====================
// Gère la monnaie in-game : gain à la victoire, dépense en boutique,
// lecture du solde. Toutes les mutations passent par des RPCs security
// definer — le client ne peut jamais écrire directement dans user_currency
// ni dans currency_transactions.

import { supabase } from './supabaseClient.js';

function requireClient() {
  if (!supabase) throw new Error('Supabase non configuré.');
  return supabase;
}

/**
 * Retourne le solde actuel de pièces du joueur connecté.
 * Retourne 0 si pas encore de ligne (première partie pas encore jouée).
 */
export async function getCurrencyBalance() {
  if (!supabase) return 0;
  const { data, error } = await supabase.rpc('get_currency_balance');
  if (error) {
    console.error('[currency] getCurrencyBalance:', error.message);
    return 0;
  }
  return data ?? 0;
}

/**
 * Crédite p_amount pièces au joueur connecté (appelé après victoire).
 * Retourne le nouveau solde, ou null en cas d'erreur.
 */
export async function earnCoins(amount = 10) {
  const client = requireClient();
  const { data, error } = await client.rpc('earn_coins', { p_amount: amount });
  if (error) throw error;
  return data; // nouveau solde
}

/**
 * Débite p_amount pièces pour un achat.
 * Lance une exception si le solde est insuffisant (message traduit
 * dans l'UI pour l'utilisateur).
 */
export async function spendCoins(amount, description) {
  const client = requireClient();
  const { data, error } = await client.rpc('spend_coins', {
    p_amount:      amount,
    p_description: description
  });
  if (error) throw error;
  return data; // nouveau solde
}
