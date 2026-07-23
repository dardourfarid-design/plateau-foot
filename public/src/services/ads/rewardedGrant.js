// ===================== ORCHESTRATION RÉCOMPENSE VIDÉO (client) =====================
// Enchaîne les trois temps d'une récompense vidéo GameMonetize « en attendant
// AdSense », sans jamais créditer côté client (invariant 0026/0036) :
//
//   1. rewarded-begin  : le serveur émet un nonce à usage unique, lié au JWT.
//   2. adService.showRewarded : le SDK GameMonetize joue la vidéo ; completed
//      n'est true que sur SDK_REWARDED_WATCH_COMPLETE (vue jusqu'au bout).
//   3. rewarded-complete : le serveur valide le nonce et crédite (migration
//      0044 → grant_rewarded_coins). Le client ne fait que rafraîchir son solde.
//
// Le nonce n'est PAS transmis au SDK (GameMonetize n'a pas de S2S) : il ne
// circule qu'entre le client et NOTRE serveur. Tout échec dégrade proprement en
// « pas de récompense » sans jamais bloquer l'écran de fin de partie.

import { showRewarded } from './adService.js';
import { getAccessToken } from '../supabaseClient.js';

function functionsBase() {
  const url = (typeof window !== 'undefined' && window.__PLATEAU_FOOT_CONFIG__?.supabaseUrl) || '';
  return `${url}/functions/v1`;
}

async function postFn(path, token, body) {
  const res = await fetch(`${functionsBase()}/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify(body || {})
  });
  // 503 (échec fermé), 429 (quota), 4xx : on renvoie un objet exploitable
  // plutôt que de lever, pour que l'appelant dégrade sans casser le flux.
  let data = {};
  try { data = await res.json(); } catch { /* corps vide/non-JSON */ }
  return { ok: res.ok, status: res.status, data };
}

/**
 * Déroule une récompense vidéo complète. Retourne un état résumé :
 *   { completed, granted, coins, reason }
 * - completed : la vidéo a été regardée jusqu'au bout (signal SDK).
 * - granted   : le serveur a effectivement crédité (après validation du nonce).
 * - coins     : nombre de pièces créditées si granted.
 * @param {{ userId?: string }} [ctx]
 */
export async function runRewardedGrant(ctx = {}) {
  const token = await getAccessToken();
  if (!token) return { completed: false, granted: false, reason: 'not-authenticated' };

  // 1. Nonce serveur (identité = JWT). 429 = quota journalier atteint.
  const begin = await postFn('rewarded-begin', token, {});
  const nonce = begin.data?.nonce;
  if (!begin.ok || !nonce) {
    return { completed: false, granted: false, reason: begin.data?.error || 'begin-failed' };
  }

  // 2. Lecture de la vidéo. On transmet le userId (utile au futur chemin AdMob) ;
  // le nonce reste côté serveur et n'est pas passé au SDK.
  const { completed } = await showRewarded({ nonce, userId: ctx.userId });
  if (!completed) return { completed: false, granted: false, reason: 'not-completed' };

  // 3. Crédit serveur (valide le nonce, applique le plafond, décide le montant).
  const done = await postFn('rewarded-complete', token, { nonce });
  return {
    completed: true,
    granted: !!done.data?.granted,
    coins: done.data?.coins,
    reason: done.data?.reason
  };
}
