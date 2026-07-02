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
 * Crédite les pièces de victoire au joueur connecté.
 * Le MONTANT est décidé côté serveur (10, fixe — migration 0025) : le client
 * ne transmet plus jamais de montant, il ne fait que déclencher l'événement.
 * Retourne le nouveau solde.
 */
export async function earnCoins() {
  const client = requireClient();
  const { data, error } = await client.rpc('earn_coins');
  if (error) throw error;
  return data; // nouveau solde
}

/**
 * Débloque un kit contre des pièces, de façon ATOMIQUE et PERSISTÉE :
 * débit des pièces + ligne d'achat créés dans la même transaction SQL
 * (unlock_theme_with_coins, migration 0025). Avant l'audit, seules les
 * pièces étaient débitées — le kit disparaissait au rechargement.
 * Retourne le nouveau solde.
 */
expor