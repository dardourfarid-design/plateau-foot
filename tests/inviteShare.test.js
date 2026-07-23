import { describe, test, expect } from './test-utils.js';
import { buildInviteShareContent, copyInviteCode, shareInvite } from '../public/src/ui/inviteShare.js';

// #264 — copier / partager le code d'invitation de la salle d'attente en ligne.
// Composition pure ; copyInviteCode/shareInvite reçoivent un faux navigator par
// injection (pas de DOM sous Node). Même forme que shareResult.test.js.

describe('buildInviteShareContent (#264)', () => {
  test('le message contient le code et pointe vers le site', () => {
    const c = buildInviteShareContent('A1B2C3', 'https://tactic-master.test');
    expect(c.text.includes('A1B2C3')).toBe(true);
    expect(c.url).toBe('https://tactic-master.test');
  });

  test('sans origine : url vide, pas de "undefined"', () => {
    const c = buildInviteShareContent('A1B2C3', '');
    expect(c.url).toBe('');
    expect(c.text.includes('undefined')).toBe(false);
  });
});

describe('copyInviteCode (#264)', () => {
  test('copie le code BRUT (pas le message) — il se colle dans « Rejoindre »', async () => {
    let copied = null;
    const nav = { clipboard: { writeText: async v => { copied = v; } } };
    const r = await copyInviteCode('A1B2C3', { navigator: nav });
    expect(r).toBe('copied');
    expect(copied).toBe('A1B2C3');
  });

  test('sans presse-papiers : échec propre', async () => {
    const r = await copyInviteCode('A1B2C3', { navigator: {} });
    expect(r).toBe('failed');
  });
});

describe('shareInvite (#264)', () => {
  test('partage natif quand il existe', async () => {
    let received = null;
    const nav = { share: async c => { received = c; } };
    const r = await shareInvite('A1B2C3', { navigator: nav, origin: 'https://x.test' });
    expect(r).toBe('shared');
    expect(received.text.includes('A1B2C3')).toBe(true);
  });

  test('repli sur le presse-papiers sans partage natif', async () => {
    let copied = null;
    const nav = { clipboard: { writeText: async v => { copied = v; } } };
    const r = await shareInvite('A1B2C3', { navigator: nav, origin: 'https://x.test' });
    expect(r).toBe('copied');
    expect(copied.includes('A1B2C3')).toBe(true);
  });

  test('annulation de la feuille de partage : ni copie ni échec', async () => {
    let copied = false;
    const nav = {
      share: async () => { const e = new Error('abort'); e.name = 'AbortError'; throw e; },
      clipboard: { writeText: async () => { copied = true; } }
    };
    const r = await shareInvite('A1B2C3', { navigator: nav, origin: 'https://x.test' });
    expect(r).toBe('cancelled');
    expect(copied).toBe(false);
  });

  test('échec du partage natif (non-abort) : repli copie', async () => {
    let copied = false;
    const nav = {
      share: async () => { throw new Error('boom'); },
      clipboard: { writeText: async () => { copied = true; } }
    };
    const r = await shareInvite('A1B2C3', { navigator: nav, origin: 'https://x.test' });
    expect(r).toBe('copied');
    expect(copied).toBe(true);
  });
});
