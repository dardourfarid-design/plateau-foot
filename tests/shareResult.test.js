import { describe, test, expect } from './test-utils.js';
import { buildShareContent, shareResult } from '../public/src/ui/shareResult.js';

// #111 — partage du résultat de match. La composition est pure ; shareResult()
// reçoit un faux navigator par injection (pas de DOM sous Node).
describe('buildShareContent (#111)', () => {
  const ORIGIN = 'https://tactic-master.test';
  const base = { result: 'win', myGoals: 3, oppGoals: 1, bestMomentum: 0, powersUsed: 0 };

  test('victoire : score et page de partage correspondante', () => {
    const c = buildShareContent(base, ORIGIN);
    expect(c.text.includes('3–1')).toBe(true);
    expect(c.url).toBe('https://tactic-master.test/partage/victoire?utm_source=partage');
  });

  test('défaite et match nul ont leur propre page', () => {
    expect(buildShareContent({ ...base, result: 'loss' }, ORIGIN).url.includes('/partage/defaite')).toBe(true);
    expect(buildShareContent({ ...base, result: 'draw', myGoals: 2, oppGoals: 2 }, ORIGIN).url.includes('/partage/match-nul')).toBe(true);
  });

  test('la meilleure action n\'est citée qu\'à partir de 3 passes', () => {
    expect(buildShareContent({ ...base, bestMomentum: 2 }, ORIGIN).text.includes('passes')).toBe(false);
    expect(buildShareContent({ ...base, bestMomentum: 4 }, ORIGIN).text.includes('4')).toBe(true);
  });

  // Garde-fou de confidentialité : un lien de partage est public et durable.
  test('aucune donnée personnelle dans l\'URL partagée', () => {
    const c = buildShareContent({ ...base, userId: 'abc-123', pseudo: 'farid' }, ORIGIN);
    expect(c.url.includes('abc-123')).toBe(false);
    expect(c.url.includes('farid')).toBe(false);
  });

  test('un résultat inattendu ne produit pas une URL cassée', () => {
    const c = buildShareContent({ ...base, result: 'inconnu' }, ORIGIN);
    expect(c.url.includes('undefined')).toBe(false);
  });
});

describe('shareResult (#111)', () => {
  const summary = { result: 'win', myGoals: 2, oppGoals: 0, bestMomentum: 0 };
  const io = origin => ({ origin, navigator: null });

  test('utilise le partage natif quand il existe', async () => {
    let received = null;
    const nav = { share: async c => { received = c; } };
    const r = await shareResult(summary, { navigator: nav, origin: 'https://x.test' });
    expect(r).toBe('shared');
    expect(received.url.includes('/partage/victoire')).toBe(true);
  });

  test('repli sur le presse-papiers sans partage natif', async () => {
    let copied = null;
    const nav = { clipboard: { writeText: async txt => { copied = txt; } } };
    const r = await shareResult(summary, { navigator: nav, origin: 'https://x.test' });
    expect(r).toBe('copied');
    expect(copied.includes('https://x.test/partage/victoire')).toBe(true);
  });

  // L'utilisateur qui ferme la feuille de partage n'a pas demandé une copie :
  // enchaîner sur le presse-papiers serait une action qu'il n'a pas voulue.
  test('annulation du partage natif : aucune copie de repli', async () => {
    let copied = false;
    const abort = Object.assign(new Error('abort'), { name: 'AbortError' });
    const nav = {
      share: async () => { throw abort; },
      clipboard: { writeText: async () => { copied = true; } }
    };
    const r = await shareResult(summary, { navigator: nav, origin: 'https://x.test' });
    expect(r).toBe('cancelled');
    expect(copied).toBe(false);
  });

  test('échec du partage natif (hors annulation) : repli sur la copie', async () => {
    const nav = {
      share: async () => { throw new Error('not allowed'); },
      clipboard: { writeText: async () => {} }
    };
    expect(await shareResult(summary, { navigator: nav, origin: 'https://x.test' })).toBe('copied');
  });

  test('ni partage ni presse-papiers : échec explicite, pas d\'exception', async () => {
    const nav = { clipboard: { writeText: async () => { throw new Error('denied'); } } };
    expect(await shareResult(summary, { navigator: nav, origin: 'https://x.test' })).toBe('failed');
  });
});
