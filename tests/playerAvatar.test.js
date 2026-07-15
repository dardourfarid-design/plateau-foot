import { describe, test, expect } from './test-utils.js';
import { hashSeedToAvatar, renderAvatarSvg, AVATAR_COLORS, AVATAR_PATTERNS, AVATAR_ACCESSORIES } from '../public/src/ui/playerAvatar.js';

describe('hashSeedToAvatar', () => {
  test('est déterministe : la même seed donne toujours le même avatar', () => {
    const a = hashSeedToAvatar('tv01');
    const b = hashSeedToAvatar('tv01');
    expect(a).toEqual(b);
  });

  test('retourne toujours des valeurs valides parmi les axes définis', () => {
    const avatar = hashSeedToAvatar('mi02');
    expect(AVATAR_COLORS.includes(avatar.color)).toBe(true);
    expect(AVATAR_PATTERNS.includes(avatar.pattern)).toBe(true);
    expect(AVATAR_ACCESSORIES.includes(avatar.accessory)).toBe(true);
  });

  test('des seeds différentes peuvent donner des avatars différents', () => {
    const a = hashSeedToAvatar('tv01');
    const b = hashSeedToAvatar('ak13');
    const same = a.color === b.color && a.pattern === b.pattern && a.accessory === b.accessory;
    expect(same).toBe(false);
  });
});

describe('renderAvatarSvg', () => {
  test('produit une chaîne SVG valide contenant un cercle de la bonne couleur', () => {
    const svg = renderAvatarSvg({ color: '#3A6EA5', pattern: 'plain', accessory: 'none' });
    expect(svg.includes('<svg')).toBe(true);
    expect(svg.includes('#3A6EA5')).toBe(true);
  });

  test('chaque motif produit un rendu sans erreur', () => {
    AVATAR_PATTERNS.forEach(pattern => {
      const svg = renderAvatarSvg({ color: '#C84B31', pattern, accessory: 'none' });
      expect(svg.includes('<svg')).toBe(true);
    });
  });

  test('chaque accessoire produit un rendu sans erreur', () => {
    AVATAR_ACCESSORIES.forEach(accessory => {
      const svg = renderAvatarSvg({ color: '#2E9E4F', pattern: 'plain', accessory });
      expect(svg.includes('<svg')).toBe(true);
    });
  });
});
