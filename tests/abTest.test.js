// Tests de l'A/B testing pub (épic pub, PR H / issue #33).
// Invariants : assignation DÉTERMINISTE (même client + même expérience =>
// même variante) et répartition sur l'ensemble des options.

import { describe, test, expect } from './test-utils.js';

if (typeof globalThis.window === 'undefined') globalThis.window = {};

const { pick, bucket } = await import('../public/src/services/ads/abTest.js');

describe('abTest', () => {
  test('pick est déterministe pour un même client et une même expérience', () => {
    const a = pick('exp1', ['A', 'B', 'C'], 'client-123');
    const b = pick('exp1', ['A', 'B', 'C'], 'client-123');
    expect(a).toBe(b);
  });

  test('des clients différents peuvent tomber sur des variantes différentes', () => {
    const seen = new Set();
    for (let i = 0; i < 50; i++) seen.add(pick('exp2', ['A', 'B'], 'client-' + i));
    // Sur 50 clients, on doit voir les deux variantes (répartition non dégénérée).
    expect(seen.size).toBe(2);
  });

  test('bucket reste dans 0..99 et est stable', () => {
    const x = bucket('exp3', 'client-xyz');
    expect(x).toBe(bucket('exp3', 'client-xyz'));
    expect(x >= 0 && x < 100).toBeTruthy();
  });

  test('pick sur une liste vide renvoie undefined', () => {
    expect(pick('exp', [], 'c')).toBe(undefined);
  });
});
