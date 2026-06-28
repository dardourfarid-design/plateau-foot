import { describe, test, expect } from './test-utils.js';
import { isThemeUnlocked, formatPrice } from '../src/ui/themeManager.js';

describe('isThemeUnlocked', () => {
  test('un thème gratuit est toujours débloqué', () => {
    const theme = { id: 'classique', price_cents: 0 };
    expect(isThemeUnlocked(theme, [])).toBe(true);
  });

  test('un thème payant non acheté est verrouillé', () => {
    const theme = { id: 'neon', price_cents: 199 };
    expect(isThemeUnlocked(theme, [])).toBe(false);
  });

  test('un thème payant acheté est débloqué', () => {
    const theme = { id: 'neon', price_cents: 199 };
    expect(isThemeUnlocked(theme, ['neon', 'neige'])).toBe(true);
  });

  test('la liste des achats d’un autre thème ne débloque pas celui-ci', () => {
    const theme = { id: 'neon', price_cents: 199 };
    expect(isThemeUnlocked(theme, ['neige', 'terre-battue'])).toBe(false);
  });
});

describe('formatPrice', () => {
  test('formate des centimes en euros lisibles', () => {
    const formatted = formatPrice(199, 'eur');
    // On vérifie le contenu numérique plutôt que le symbole exact (espace insécable variable selon locale)
    expect(formatted.includes('1,99')).toBeTruthy();
  });

  test('un prix de 0 est formaté correctement', () => {
    const formatted = formatPrice(0, 'eur');
    expect(formatted.includes('0,00')).toBeTruthy();
  });
});
