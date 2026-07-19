import { describe, test, expect } from './test-utils.js';
import { initRouter, screenForHash, hashForScreen } from '../public/src/ui/router.js';

// #310 — routeur par hash. Faux `window` : le module ne touche qu'à
// location.hash, history et addEventListener('popstate').
function makeWin(hash = '') {
  const w = {
    location: { hash, pathname: '/', search: '' },
    entries: [],
    listeners: {},
    addEventListener(evt, fn) { this.listeners[evt] = fn; },
    fire(evt) { return this.listeners[evt]?.(); }
  };
  w.history = {
    pushState(_s, _t, url) { w.entries.push({ url, kind: 'push' }); w.location.hash = String(url).startsWith('#') ? url : ''; },
    replaceState(_s, _t, url) { w.entries.push({ url, kind: 'replace' }); w.location.hash = String(url).startsWith('#') ? url : ''; }
  };
  return w;
}

describe('correspondance hash <-> écran (#310)', () => {
  test('les routes connues se traduisent dans les deux sens', () => {
    expect(screenForHash('#boutique')).toBe('boutique');
    expect(screenForHash('#tirs-au-but')).toBe('tirs-au-but');
    expect(hashForScreen('profil')).toBe('#profil');
    expect(hashForScreen('accueil')).toBe('');
  });

  // Un lien partagé mal recopié doit atterrir quelque part de sensé plutôt que
  // sur un écran vide.
  test('un hash inconnu retombe sur l\'accueil', () => {
    expect(screenForHash('#nimporte-quoi')).toBe('accueil');
    expect(screenForHash('')).toBe('accueil');
  });
});

describe('routeur — navigation (#310)', () => {
  test('go() empile une entrée d\'historique', () => {
    const w = makeWin();
    const r = initRouter({ win: w, onNavigate() {} });
    r.start();
    r.go('boutique');
    expect(r.current()).toBe('boutique');
    expect(w.entries.at(-1).url).toBe('#boutique');
    expect(w.entries.at(-1).kind).toBe('push');
  });

  test('go() vers l\'écran courant ne fait rien', () => {
    const w = makeWin();
    const r = initRouter({ win: w, onNavigate() {} });
    r.start();
    const before = w.entries.length;
    r.go('accueil');
    expect(w.entries.length).toBe(before);
  });

  test('un lien profond affiche l\'écran demandé au démarrage', () => {
    const w = makeWin('#profil');
    const seen = [];
    const r = initRouter({ win: w, onNavigate: s => seen.push(s) });
    r.start();
    expect(r.current()).toBe('profil');
    expect(seen).toEqual(['profil']);
  });

  // Sinon un Retour depuis l'accueil enverrait vers l'accueil lui-même.
  test('la route initiale remplace au lieu d\'empiler', () => {
    const w = makeWin();
    initRouter({ win: w, onNavigate() {} }).start();
    expect(w.entries.every(e => e.kind === 'replace')).toBe(true);
  });

  test('le Retour du navigateur rejoue la navigation', async () => {
    const w = makeWin();
    const seen = [];
    const r = initRouter({ win: w, onNavigate: s => seen.push(s) });
    r.start();
    r.go('boutique');
    w.location.hash = '';           // l'utilisateur appuie sur Retour
    await w.fire('popstate');
    expect(r.current()).toBe('accueil');
    expect(seen.at(-1)).toBe('accueil');
  });
});

describe('routeur — partie en cours (#310)', () => {
  test('quitter une partie demande confirmation et la refuser y laisse le joueur', async () => {
    const w = makeWin();
    const seen = [];
    const r = initRouter({
      win: w,
      onNavigate: s => seen.push(s),
      confirmLeaveGame: async () => false
    });
    r.start();
    r.go('partie');
    w.location.hash = '';
    await w.fire('popstate');

    expect(r.current()).toBe('partie');
    expect(seen.length).toBe(0);
    // L'entrée « partie » a été remise : le retour est annulé de fait.
    expect(w.entries.at(-1).url).toBe('#partie');
  });

  test('confirmer laisse bien partir', async () => {
    const w = makeWin();
    const seen = [];
    const r = initRouter({
      win: w,
      onNavigate: s => seen.push(s),
      confirmLeaveGame: async () => true
    });
    r.start();
    r.go('partie');
    w.location.hash = '';
    await w.fire('popstate');

    expect(r.current()).toBe('accueil');
    expect(seen.at(-1)).toBe('accueil');
  });

  test('aucune confirmation demandée hors partie', async () => {
    const w = makeWin();
    let asked = false;
    const r = initRouter({
      win: w,
      onNavigate() {},
      confirmLeaveGame: async () => { asked = true; return true; }
    });
    r.start();
    r.go('boutique');
    w.location.hash = '';
    await w.fire('popstate');
    expect(asked).toBe(false);
  });
});

describe('routeur — robustesse (#310)', () => {
  test('sans window, le routeur est inerte au lieu de planter', () => {
    const r = initRouter({ win: null, onNavigate() {} });
    r.start();
    r.go('boutique');
    expect(r.current()).toBe('accueil');
  });

  test('un history indisponible ne casse pas la navigation', () => {
    const w = makeWin();
    w.history = { pushState() { throw new Error('refusé'); }, replaceState() { throw new Error('refusé'); } };
    const r = initRouter({ win: w, onNavigate() {} });
    r.start();
    r.go('profil');
    expect(r.current()).toBe('profil');
  });

  test('un écran inconnu est ignoré', () => {
    const w = makeWin();
    const r = initRouter({ win: w, onNavigate() {} });
    r.start();
    r.go('ecran-inexistant');
    expect(r.current()).toBe('accueil');
  });
});
