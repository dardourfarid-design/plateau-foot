// ===================== rewarded-ssv : primitives de vérification =====================
// Fonctions PURES (aucun réseau, aucun Deno.env) extraites de index.ts pour
// être testables (verify.test.ts). La sécurité du crédit rewarded repose sur
// la vérification de la signature Google — ces primitives sont donc les plus
// critiques du flux.

/** base64url → octets. */
export function b64urlToBytes(b64url: string): Uint8Array {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/').padEnd(
    b64url.length + ((4 - (b64url.length % 4)) % 4),
    '=',
  );
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

/**
 * Signature ECDSA au format DER (SEQUENCE{ INTEGER r, INTEGER s }) → format
 * brut r||s (64 octets) attendu par Web Crypto. Retire un éventuel octet de
 * bourrage 0x00 en tête d'un entier.
 */
export function derToRaw(der: Uint8Array): Uint8Array {
  let offset = 2;
  if (der[1] & 0x80) offset = 2 + (der[1] & 0x7f);
  const readInt = (pos: number): { bytes: Uint8Array; next: number } => {
    const len = der[pos + 1];
    let start = pos + 2;
    let l = len;
    while (l > 32 && der[start] === 0x00) {
      start++;
      l--;
    }
    return { bytes: der.slice(start, start + l), next: pos + 2 + len };
  };
  const r = readInt(offset);
  const s = readInt(r.next);
  const raw = new Uint8Array(64);
  raw.set(r.bytes, 32 - r.bytes.length);
  raw.set(s.bytes, 64 - s.bytes.length);
  return raw;
}

/** Importe une clé publique EC P-256 depuis son SPKI base64 (fourni par Google). */
export function importEcKey(base64Der: string): Promise<CryptoKey> {
  const der = Uint8Array.from(atob(base64Der), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey(
    'spki',
    // Cast : TS 5.7/Deno 2 paramètre Uint8Array<ArrayBufferLike>, que WebCrypto
    // (BufferSource) n'accepte plus sans assertion — inoffensif à l'exécution.
    der as BufferSource,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['verify'],
  );
}

/** Contenu signé = tout ce qui précède `&signature=` dans le query string. */
export function extractSignedContent(rawQuery: string): string | null {
  const i = rawQuery.indexOf('&signature=');
  return i === -1 ? null : rawQuery.substring(0, i);
}

/**
 * Vérifie une signature (DER base64url) contre un contenu et une clé publique
 * (SPKI base64). Pur : la clé est fournie par l'appelant (pas de réseau).
 */
export async function verifyWithKey(
  signedContent: string,
  signatureB64url: string,
  keyBase64: string,
): Promise<boolean> {
  const pubKey = await importEcKey(keyBase64);
  const signature = derToRaw(b64urlToBytes(signatureB64url));
  const data = new TextEncoder().encode(signedContent);
  return crypto.subtle.verify(
    { name: 'ECDSA', hash: 'SHA-256' },
    pubKey,
    signature as BufferSource,
    data as BufferSource,
  );
}

/** Mappe l'item de récompense Google vers un reward_type connu (migration 0036). */
export function rewardTypeFromItem(_rewardItem: string | null): string {
  return 'coins_small';
}
