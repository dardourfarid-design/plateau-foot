// ===================== Tests rewarded-ssv (Deno) =====================
// Épic pub / issue #134. Verrouille la partie SÉCURITÉ du crédit rewarded :
//   1. primitives de vérification de signature (verify.ts, pures) — round-trip
//      cryptographique réel avec une paire de clés P-256 générée dans le test ;
//   2. handler HTTP : échec fermé (503 tant que REWARDED_SSV_ENABLED != 'true'),
//      méthode refusée (405), signature manquante → 403.
//
// Lancés en CI par le job `edge` : `deno test --allow-env supabase/functions/`.

import {
  assEq,
  assert,
} from './test-asserts.ts';
import {
  b64urlToBytes,
  derToRaw,
  extractSignedContent,
  rewardTypeFromItem,
  verifyWithKey,
} from './verify.ts';
import { handler } from './index.ts';

// ---------- helpers de test ----------

function bytesToB64(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function b64ToB64url(b64: string): string {
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// L'inverse de derToRaw : encode r||s (64 octets) au format DER, avec l'octet
// de bourrage 0x00 quand le bit de poids fort est à 1 (entier DER signé).
function rawToDer(raw: Uint8Array): Uint8Array {
  const encodeInt = (bytes: Uint8Array): number[] => {
    let i = 0;
    while (i < bytes.length - 1 && bytes[i] === 0) i++; // retire les zéros de tête
    let body = Array.from(bytes.slice(i));
    if (body[0] & 0x80) body = [0x00, ...body]; // bourrage si négatif apparent
    return [0x02, body.length, ...body];
  };
  const r = encodeInt(raw.slice(0, 32));
  const s = encodeInt(raw.slice(32));
  return new Uint8Array([0x30, r.length + s.length, ...r, ...s]);
}

async function makeKeyPair() {
  const kp = await crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['sign', 'verify'],
  );
  const spki = new Uint8Array(await crypto.subtle.exportKey('spki', kp.publicKey));
  return { kp, keyBase64: bytesToB64(spki) };
}

async function signContent(privateKey: CryptoKey, content: string): Promise<string> {
  const raw = new Uint8Array(
    await crypto.subtle.sign(
      { name: 'ECDSA', hash: 'SHA-256' },
      privateKey,
      new TextEncoder().encode(content),
    ),
  );
  return b64ToB64url(bytesToB64(rawToDer(raw)));
}

// ---------- primitives pures ----------

Deno.test('b64urlToBytes décode le base64url (sans padding)', () => {
  // 'SGVsbG8' = "Hello" sans '='
  const bytes = b64urlToBytes('SGVsbG8');
  assEq(new TextDecoder().decode(bytes), 'Hello');
});

Deno.test('extractSignedContent : tout ce qui précède &signature=', () => {
  assEq(
    extractSignedContent('ad_network=1&transaction_id=abc&signature=SIG&key_id=42'),
    'ad_network=1&transaction_id=abc',
  );
  assEq(extractSignedContent('pas_de_signature=1'), null);
});

Deno.test('derToRaw : DER → r||s 64 octets, bourrage 0x00 retiré', () => {
  const r = new Uint8Array(32).fill(0x11);
  const s = new Uint8Array(32).fill(0x22);
  // r avec bit fort : DER le préfixe de 0x00 ; derToRaw doit le retirer.
  r[0] = 0xff;
  const der = rawToDer(new Uint8Array([...r, ...s]));
  const raw = derToRaw(der);
  assEq(raw.length, 64);
  assEq(raw[0], 0xff);
  assEq(raw[63], 0x22);
});

Deno.test('rewardTypeFromItem : mappe toujours vers un type connu de 0036', () => {
  assEq(rewardTypeFromItem(null), 'coins_small');
  assEq(rewardTypeFromItem('anything'), 'coins_small');
});

// ---------- round-trip cryptographique réel ----------

Deno.test('verifyWithKey accepte une signature valide et rejette toute altération', async () => {
  const { kp, keyBase64 } = await makeKeyPair();
  const content = 'ad_network=5450213213286189855&ad_unit=123&custom_data=user-uuid&transaction_id=tx-1';
  const sig = await signContent(kp.privateKey, content);

  // Signature authentique → acceptée.
  assert(await verifyWithKey(content, sig, keyBase64), 'signature valide refusée');

  // Contenu altéré (ex. un attaquant change le user à créditer) → rejeté.
  const tampered = content.replace('user-uuid', 'attacker-uuid');
  assert(!(await verifyWithKey(tampered, sig, keyBase64)), 'contenu altéré accepté');

  // Signature d'une AUTRE clé → rejetée.
  const other = await makeKeyPair();
  const otherSig = await signContent(other.kp.privateKey, content);
  assert(!(await verifyWithKey(content, otherSig, keyBase64)), 'mauvaise clé acceptée');
});

// ---------- handler HTTP : échec fermé ----------

Deno.test('handler : 503 tant que REWARDED_SSV_ENABLED n\'est pas "true" (échec fermé)', async () => {
  Deno.env.delete('REWARDED_SSV_ENABLED');
  const res = await handler(new Request('http://x/functions/v1/rewarded-ssv?transaction_id=t'));
  assEq(res.status, 503);
});

Deno.test('handler : 405 pour toute méthode autre que GET', async () => {
  const res = await handler(
    new Request('http://x/functions/v1/rewarded-ssv', { method: 'POST' }),
  );
  assEq(res.status, 405);
});

Deno.test('handler : 403 si la signature est absente (aucun crédit possible)', async () => {
  Deno.env.set('REWARDED_SSV_ENABLED', 'true');
  try {
    // Pas de &signature= → extractSignedContent null → rejet AVANT tout réseau.
    const res = await handler(
      new Request('http://x/functions/v1/rewarded-ssv?transaction_id=t&custom_data=u'),
    );
    assEq(res.status, 403);
  } finally {
    Deno.env.delete('REWARDED_SSV_ENABLED');
  }
});
