import { describe, test, expect } from './test-utils.js';
import { resolveLineup, slotFromTokenId, displayNameForToken } from '../src/ui/playerIdentity.js';

describe('slotFromTokenId', () => {
  test('extrait correctement le slot pour chaque type de pion', () => {
    expect(slotFromTokenId('b-gk')).toBe('gk');
    expect(slotFromTokenId('b-def0')).toBe('def0');
    expect(slotFromTokenId('r-att2')).toBe('att2');
  });

  test('retourne null pour un id mal formé', () => {
    expect(slotFromTokenId('inconnu')).toBeNull();
  });
});

describe('resolveLineup', () => {
  test('retourne null si aucune lineup fournie', () => {
    expect(resolveLineup(null, [])).toBeNull();
  });

  test('résout correctement les slots avec le nom personnalisé en priorité', () => {
    const lineupRow = { slot_gk: 'own-1', slot_att0: 'own-2' };
    const collection = [
      { id: 'own-1', custom_name: 'Le Mur', fictional_players: { name: 'Theo Vasquez', style: 'costaud', rarity: 'commun' } },
      { id: 'own-2', custom_name: null, fictional_players: { name: 'Diego Salaz', style: 'rapide', rarity: 'commun' } }
    ];
    const resolved = resolveLineup(lineupRow, collection);
    expect(resolved.gk.displayName).toBe('Le Mur');
    expect(resolved.att0.displayName).toBe('Diego Salaz');
  });

  test('résout correctement un joueur personnalisé (structure différente du catalogue)', () => {
    const lineupRow = { slot_att1: 'custom-1' };
    const collection = [
      { id: 'custom-1', isCustom: true, custom_name: null, name: 'Mon Joueur', style: 'technique' }
    ];
    const resolved = resolveLineup(lineupRow, collection);
    expect(resolved.att1.displayName).toBe('Mon Joueur');
    expect(resolved.att1.style).toBe('technique');
  });

  test('ignore un slot dont l’ownership référencé n’existe plus dans la collection', () => {
    const lineupRow = { slot_gk: 'own-absent' };
    const resolved = resolveLineup(lineupRow, []);
    expect(Object.keys(resolved)).toHaveLength(0);
  });
});

describe('displayNameForToken', () => {
  test('retourne le nom correct pour un pion bleu', () => {
    const lineupsByTeam = {
      bleu: { att1: { displayName: 'Mateo Rinaldi' } }
    };
    expect(displayNameForToken('b-att1', lineupsByTeam)).toBe('Mateo Rinaldi');
  });

  test('retourne null si aucune lineup n’existe pour cette équipe', () => {
    expect(displayNameForToken('r-gk', {})).toBeNull();
  });

  test('retourne null pour un tokenId invalide', () => {
    expect(displayNameForToken('xyz', { bleu: {} })).toBeNull();
  });
});
