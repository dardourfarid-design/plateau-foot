// Mini-assertions locales pour les tests Deno (hermétique : évite de dépendre
// du registre std pendant les tests — seule la CI télécharge jsr pour index.ts).

export function assert(cond: unknown, msg = 'assertion échouée'): asserts cond {
  if (!cond) throw new Error(msg);
}

export function assEq<T>(actual: T, expected: T, msg?: string): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(msg ?? `attendu ${e}, reçu ${a}`);
}
