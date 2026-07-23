import { describe, test, expect } from './test-utils.js';
import { describeQuickPlay } from '../public/src/ui/settingsUI.js';

// #261 — le sous-texte du CTA « Jouer » doit annoncer ce que le clic va
// RÉELLEMENT lancer, coercitions comprises. describeQuickPlay est pur : on peut
// en couvrir toute la table de vérité sans DOM ni stockage.

describe('describeQuickPlay (#261)', () => {
  test('1re visite (aucun réglage mémorisé) → solo vs IA, difficulté par défaut', () => {
    // Même sans stockage, le mode brut peut valoir 'local' (défaut module) :
    // le CTA retombe pourtant sur l'IA, le sous-texte doit le refléter.
    expect(describeQuickPlay({ hasStoredConfig: false, gameMode: 'local', aiLevel: 'moyen' }))
      .toBe('Solo vs IA — Moyen');
  });

  test('IA mémorisée → mode + niveau exacts', () => {
    expect(describeQuickPlay({ hasStoredConfig: true, gameMode: 'ai', aiLevel: 'facile' }))
      .toBe('Solo vs IA — Facile');
    expect(describeQuickPlay({ hasStoredConfig: true, gameMode: 'ai', aiLevel: 'difficile' }))
      .toBe('Solo vs IA — Difficile');
  });

  test('2 joueurs locaux mémorisés → « 2 joueurs, même écran » (pas de difficulté)', () => {
    expect(describeQuickPlay({ hasStoredConfig: true, gameMode: 'local', aiLevel: 'difficile' }))
      .toBe('2 joueurs, même écran');
  });

  test('online mémorisé → coercé en solo vs IA (l\'online exige un code)', () => {
    // C'est exactement la coercition du handler quickPlay : online n\'est pas
    // lançable en un clic, donc on annonce le repli IA.
    expect(describeQuickPlay({ hasStoredConfig: true, gameMode: 'online', aiLevel: 'moyen' }))
      .toBe('Solo vs IA — Moyen');
  });

  test('niveau d\'IA inconnu → repli sur Moyen (jamais de libellé vide)', () => {
    expect(describeQuickPlay({ hasStoredConfig: true, gameMode: 'ai', aiLevel: 'bogus' }))
      .toBe('Solo vs IA — Moyen');
  });
});
