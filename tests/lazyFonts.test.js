import { describe, test, expect } from './test-utils.js';
import { ensureThemeFonts, THEME_FONTS_URL } from '../public/src/ui/lazyFonts.js';
import { readFileSync } from 'node:fs';

// #309 — polices chargées à la demande. Faux DOM minimal : le module ne fait
// que créer un <link> et l'ajouter au <head>.
function fakeDoc() {
  const head = { children: [], appendChild(el) { this.children.push(el); } };
  return {
    head,
    createElement: () => ({}),
    getElementById(id) { return head.children.find(c => c.id === id) || null; }
  };
}

describe('ensureThemeFonts (#309)', () => {
  test('injecte un <link> stylesheet vers les polices d\'habillage', () => {
    const doc = fakeDoc();
    expect(ensureThemeFonts(doc)).toBe(true);
    expect(doc.head.children.length).toBe(1);
    expect(doc.head.children[0].rel).toBe('stylesheet');
    expect(doc.head.children[0].href).toBe(THEME_FONTS_URL);
  });

  // Appelé à chaque ouverture de l'écran de tirs au but : doit rester sans
  // effet à partir du 2e appel, sinon on empile les <link> identiques.
  test('idempotent : un seul <link> même après plusieurs appels', () => {
    const doc = fakeDoc();
    ensureThemeFonts(doc);
    expect(ensureThemeFonts(doc)).toBe(false);
    expect(ensureThemeFonts(doc)).toBe(false);
    expect(doc.head.children.length).toBe(1);
  });

  test('sans document (contexte non navigateur) : ne jette pas', () => {
    expect(ensureThemeFonts(null)).toBe(false);
  });

  test('les 4 familles différées sont bien toutes demandées', () => {
    for (const family of ['Anton', 'Archivo', 'Fredoka', 'Space+Mono']) {
      expect(THEME_FONTS_URL.includes(family)).toBe(true);
    }
  });
});

// Garde-fou : le gain de #309 disparaîtrait silencieusement si quelqu'un
// remettait une de ces familles dans le <head> de l'accueil. Ce test échoue
// alors immédiatement, avec le nom de la famille fautive.
describe('chemin critique des polices (#309)', () => {
  const head = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8')
    .split('</head>')[0];
  const fontLink = head.split('\n').find(l => l.includes('fonts.googleapis.com/css2')) || '';

  test('l\'accueil ne charge que Barlow Condensed et Space Grotesk', () => {
    expect(fontLink.includes('Barlow+Condensed')).toBe(true);
    expect(fontLink.includes('Space+Grotesk')).toBe(true);
    for (const family of ['Anton', 'Archivo', 'Fredoka', 'Space+Mono']) {
      expect(fontLink.includes(family)).toBe(false);
    }
  });
});
