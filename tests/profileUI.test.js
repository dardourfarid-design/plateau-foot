import { describe, test, expect } from './test-utils.js';
import { toOwnedShape, avatarForOwned } from '../public/src/ui/profileUI.js';

// ===================== TESTS profileUI.js =====================
// Couvre les fonctions pures exportées qui ne dépendent ni du DOM ni de
// l'état global du module. Toutes les autres fonctions (load*, render*,
// wire*) nécessitent un vrai DOM ou des appels réseau — elles sont
// vérifiées manuellement via Playwright en session de dev.

// ---------- toOwnedShape ----------

describe('toOwnedShape', () => {
  const customPlayer = {
    id: 'cp-abc',
    name: 'Zara Flash',
    style: 'rapide',
    avatar_color: '#E63946',
    avatar_pattern: 'stripes',
    avatar_accessory: 'headband'
  };

  test('retourne un objet avec isCustom = true', () => {
    const result = toOwnedShape(customPlayer);
    expect(result.isCustom).toBe(true);
  });

  test('conserve l\'id du joueur custom', () => {
    const result = toOwnedShape(customPlayer);
    expect(result.id).toBe('cp-abc');
  });

  test('custom_name est null (jamais de surnom sur les joueurs custom)', () => {
    const result = toOwnedShape(customPlayer);
    expect(result.custom_name).toBeNull();
  });

  test('copie correctement les propriétés avatar', () => {
    const result = toOwnedShape(customPlayer);
    expect(result.avatar_color).toBe('#E63946');
    expect(result.avatar_pattern).toBe('stripes');
    expect(result.avatar_accessory).toBe('headband');
  });

  test('copie correctement name et style', () => {
    const result = toOwnedShape(customPlayer);
    expect(result.name).toBe('Zara Flash');
    expect(result.style).toBe('rapide');
  });

  test('ne propage pas de propriétés inattendues depuis le joueur source', () => {
    const customWithExtra = { ...customPlayer, created_at: '2026-01-01', user_id: 'u-xyz' };
    const result = toOwnedShape(customWithExtra);
    // Les champs internes de la table custom_players ne doivent pas
    // se retrouver dans la forme owned — seuls les champs de la forme
    // player_ownership-like sont attendus par les renderers.
    expect(result.created_at).toBe(undefined);
    expect(result.user_id).toBe(undefined);
  });

  test('deux appels successifs produisent des objets indépendants', () => {
    const a = toOwnedShape(customPlayer);
    const b = toOwnedShape({ ...customPlayer, id: 'cp-xyz', name: 'Marco Brio' });
    expect(a.id).toBe('cp-abc');
    expect(b.id).toBe('cp-xyz');
    expect(a.name).toBe('Zara Flash');
    expect(b.name).toBe('Marco Brio');
  });
});

// ---------- avatarForOwned ----------

describe('avatarForOwned', () => {
  const fakeHashSeedToAvatar = (seed) => ({
    color: `#derived-from-${seed}`,
    pattern: 'plain',
    accessory: 'none'
  });
  const deps = { hashSeedToAvatar: fakeHashSeedToAvatar };

  test('un joueur custom retourne ses props avatar directement, sans appeler hashSeedToAvatar', () => {
    let hashCalled = false;
    const strictDeps = {
      hashSeedToAvatar: () => { hashCalled = true; return {}; }
    };
    const owned = {
      isCustom: true,
      avatar_color: '#FF0000',
      avatar_pattern: 'dots',
      avatar_accessory: 'cap'
    };
    const result = avatarForOwned(owned, strictDeps);
    expect(hashCalled).toBe(false);
    expect(result.color).toBe('#FF0000');
    expect(result.pattern).toBe('dots');
    expect(result.accessory).toBe('cap');
  });

  test('un joueur catalogue délègue à hashSeedToAvatar avec le bon seed', () => {
    let receivedSeed = null;
    const trackingDeps = {
      hashSeedToAvatar: (seed) => { receivedSeed = seed; return { color: '#aaa', pattern: 'plain', accessory: 'none' }; }
    };
    const owned = {
      isCustom: false,
      fictional_players: { avatar_seed: 42 }
    };
    avatarForOwned(owned, trackingDeps);
    expect(receivedSeed).toBe(42);
  });

  test('un joueur catalogue retourne la valeur de hashSeedToAvatar', () => {
    const owned = {
      isCustom: false,
      fictional_players: { avatar_seed: 7 }
    };
    const result = avatarForOwned(owned, deps);
    expect(result.color).toBe('#derived-from-7');
    expect(result.pattern).toBe('plain');
  });

  test('un joueur custom avec accessory none retourne bien none', () => {
    const owned = {
      isCustom: true,
      avatar_color: '#123456',
      avatar_pattern: 'stripes',
      avatar_accessory: 'none'
    };
    const result = avatarForOwned(owned, deps);
    expect(result.accessory).toBe('none');
  });
});
