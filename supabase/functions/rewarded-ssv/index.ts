// ===================== rewarded-ssv =====================
// Edge Function Supabase (Deno). Point de terminaison du Server-Side
// Verification (SSV) de Google pour les vidéos récompensées.
// Épic monétisation publicitaire, PR E (issue #30).
//
// C'est LA seule voie par laquelle une récompense vidéo peut créditer des
// pièces. Le client ne crédite jamais : il regarde la vidéo, Google vérifie
// la vue et appelle CETTE fonction avec une requête SIGNÉE ; on vérifie la
// signature, puis on crédite via grant_rewarded_coins (RPC service_role,
// migration 0036).
//
// Google envoie une requête GET dont les paramètres se terminent par
// `signature` puis `key_id`. La signature (ECDSA P-256 / SHA-256) porte sur
// tout le query string situé AVANT `&signature=`. La clé publique est
// identifiée par `key_id` dans le trousseau public Google.
//
// ÉCHEC FERMÉ : tant que REWARDED_SSV_ENABLED n'est pas 'true' (compte Ad
// Manager + SSV pas encore configurés, #25), on renvoie 503 sans rien
// créditer. Aucun chemin de crédit n'est ouvert par défaut.
//
// custom_data : on y transmet l'UUID du joueur (défini côté client au moment
// de demander la vidéo). reward_item : mappé vers un reward_type connu.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { extractSignedContent, rewardTypeFromItem, verifyWithKey } from './verify.ts';

const VERIFIER_KEYS_URL = 'https://www.gstatic.com/admob/reward/verifier-keys.json';

interface GoogleKey {
  keyId: number;
  pem: string;
  base64: string;
}

let _keysCache: { fetchedAt: number; keys: GoogleKey[] } | null = null;

async function getVerifierKeys(): Promise<GoogleKey[]> {
  // Cache court : les clés Google tournent, mais pas à chaque requête.
  if (_keysCache && Date.now() - _keysCache.fetchedAt < 60 * 60 * 1000) {
    return _keysCache.keys;
  }
  const res = await fetch(VERIFIER_KEYS_URL);
  if (!res.ok) throw new Error('verifier keys unavailable');
  const json = await res.json();
  _keysCache = { fetchedAt: Date.now(), keys: json.keys };
  return json.keys;
}

// Compose la vérification : extrait le contenu signé, récupère la bonne clé
// publique Google (réseau, mise en cache), puis délègue à verifyWithKey (pur).
async function verifyGoogleSignature(rawQuery: string): Promise<boolean> {
  const signedContent = extractSignedContent(rawQuery);
  if (signedContent === null) return false;

  const params = new URLSearchParams(rawQuery);
  const signatureB64 = params.get('signature');
  const keyId = params.get('key_id');
  if (!signatureB64 || !keyId) return false;

  const keys = await getVerifierKeys();
  const key = keys.find((k) => String(k.keyId) === String(keyId));
  if (!key) return false;

  return verifyWithKey(signedContent, signatureB64, key.base64);
}

// Handler exporté (testable) ; branché sur Deno.serve en bas de fichier.
export async function handler(req: Request): Promise<Response> {
  if (req.method !== 'GET') {
    return new Response('method not allowed', { status: 405 });
  }

  // Échec fermé tant que le SSV n'est pas explicitement activé (#25).
  if (Deno.env.get('REWARDED_SSV_ENABLED') !== 'true') {
    return new Response('ssv disabled', { status: 503 });
  }

  const url = new URL(req.url);
  const rawQuery = url.search.startsWith('?') ? url.search.slice(1) : url.search;

  let valid = false;
  try {
    valid = await verifyGoogleSignature(rawQuery);
  } catch (_e) {
    valid = false;
  }
  if (!valid) {
    return new Response('invalid signature', { status: 403 });
  }

  const params = url.searchParams;
  const userId = params.get('custom_data');       // UUID du joueur (défini côté client)
  const transactionId = params.get('transaction_id');
  const rewardType = rewardTypeFromItem(params.get('reward_item'));
  if (!userId || !transactionId) {
    return new Response('missing params', { status: 400 });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin = createClient(supabaseUrl, serviceKey);

  const { data, error } = await admin.rpc('grant_rewarded_coins', {
    p_user_id: userId,
    p_reward_type: rewardType,
    p_provider_ref: transactionId
  });

  if (error) {
    console.error('grant_rewarded_coins:', error.message);
    return new Response('grant failed', { status: 500 });
  }

  // Google attend un 200 pour considérer la notification traitée.
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}

// Ne démarre le serveur que lorsque le fichier est exécuté comme module
// principal (déploiement Supabase). Un import depuis les tests (verify.test.ts)
// récupère `handler` sans ouvrir de port.
if (import.meta.main) {
  Deno.serve(handler);
}
