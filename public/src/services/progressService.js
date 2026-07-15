// ===================== SERVICE PROGRESSION & DÉFIS =====================
// Encapsule la progression du joueur (XP, niveau, streak), les défis
// quotidiens, et le classement. Toute la logique de calcul (XP gagné,
// progression de streak, complétion de défi) vit côté serveur
// (record_game_result, voir 0009_daily_challenges_progress.sql) — ce
// module ne fait que déclencher l'appel et lire le résultat, jamais de
// calcul de score en local.

import { supabase } from './supabaseClient.js';

function requireClient() {
  if (!supabase) {
    throw new Error('Supabase non configuré.');
  }
  return supabase;
}

export async function fetchMyProgress() {
  const client = requireClient();
  const { data, error } = await client
    .from('player_progress')
    .select('*')
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function fetchTodayChallenges() {
  const client = requireClient();
  const { data, error } = await client.rpc('get_or_create_daily_challenges');
  if (error) throw error;
  return data;
}

/**
 * Enregistre le résultat d'une partie réelle (appelé une fois en fin de
 * partie côté UI). C'est le seul point d'entrée qui fait progresser XP,
 * niveau, streak et défis du jour — jamais de mise à jour directe de ces
 * compteurs depuis le client.
 */
export async function recordGameResult(won, goalsScored, bestMomentum = 0) {
  const client = requireClient();
  const { error } = await client.rpc('record_game_result', {
    p_won: won,
    p_goals_scored: goalsScored,
    // #203 : meilleur momentum (nb de passes d'un but) de la partie. Le bonus
    // éventuel est décidé côté serveur (jamais par le client), voir 0037.
    p_best_momentum: bestMomentum
  });
  if (error) throw error;
}

export async function fetchLeaderboard(limit = 20) {
  const client = requireClient();
  const { data, error } = await client
    .from('leaderboard')
    .select('*')
    .limit(limit);
  if (error) throw error;
  return data;
}
