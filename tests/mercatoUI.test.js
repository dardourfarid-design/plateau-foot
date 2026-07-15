import { describe, test, expect } from './test-utils.js';
import { renderMercatoPlayerOptions, renderMercatoFriendOptions, escapeHtml } from '../public/src/ui/mercatoUI.js';

// ===================== TESTS mercatoUI.js =====================
// Couvre renderMercatoPlayerOptions et renderMercatoFriendOptions : les deux
// seules fonctions du module qui sont pures du point de vue des données
// (pas de service, pas d'état global) — elles prennent un container + une
// liste et produisent des éléments DOM.
//
// On fournit un mock document minimal pour Node.js (pas de jsdom) :
// suffisant pour vérifier les invariants de structure et de contenu sans
// démarrer un vrai navigateur.

// ---------- Mock DOM minimal ----------

function makeEl() {
  const el = {
    className: '',
    textContent: '',
    innerHTML: '',
    style: {},
    _children: [],
    _listeners: {},
    appendChild(child) { this._children.push(child); return child; },
    addEventListener(event, fn) {
      if (!this._listeners[event]) this._listeners[event] = [];
      this._listeners[event].push(fn);
    },
    querySelectorAll() { return []; },
    classList: (() => {
      const cls = new Set();
      return {
        _set: cls,
        add(c) { cls.add(c); },
        remove(c) { cls.delete(c); },
        contains(c) { return cls.has(c); }
      };
    })()
  };
  return el;
}

function makeContainer() {
  const el = makeEl();
  el.querySelectorAll = () => el._children;
  return el;
}

// Injecté dans globalThis pour que document.createElement soit disponible
// dans les fonctions importées (qui sont du code navigateur, pas Node).
globalThis.document = {
  createElement() { return makeEl(); }
};

// ---------- renderMercatoPlayerOptions ----------

describe('renderMercatoPlayerOptions', () => {
  test('liste vide : affiche le message "Aucun joueur disponible"', () => {
    const container = makeContainer();
    renderMercatoPlayerOptions(container, [], () => {});
    expect(container.innerHTML).toBe('<p class="profile-empty-note">Aucun joueur disponible.</p>');
  });

  test('crée autant d\'éléments qu\'il y a de joueurs', () => {
    const container = makeContainer();
    const owned = [
      { id: 'o1', isCustom: false, custom_name: null, fictional_players: { name: 'Marco Brio' } },
      { id: 'o2', isCustom: false, custom_name: null, fictional_players: { name: 'Zara Flash' } }
    ];
    renderMercatoPlayerOptions(container, owned, () => {});
    expect(container._children).toHaveLength(2);
  });

  test('affiche le nom du joueur catalogue (fictional_players.name)', () => {
    const container = makeContainer();
    const owned = [
      { id: 'o1', isCustom: false, custom_name: null, fictional_players: { name: 'Marco Brio' } }
    ];
    renderMercatoPlayerOptions(container, owned, () => {});
    expect(container._children[0].textContent).toBe('Marco Brio');
  });

  test('affiche custom_name en priorité sur fictional_players.name', () => {
    const container = makeContainer();
    const owned = [
      { id: 'o1', isCustom: false, custom_name: 'Mon surnom', fictional_players: { name: 'Marco Brio' } }
    ];
    renderMercatoPlayerOptions(container, owned, () => {});
    expect(container._children[0].textContent).toBe('Mon surnom');
  });

  test('affiche le name d\'un joueur custom (isCustom = true)', () => {
    const container = makeContainer();
    const owned = [
      { id: 'o1', isCustom: true, custom_name: null, name: 'Créé par moi' }
    ];
    renderMercatoPlayerOptions(container, owned, () => {});
    expect(container._children[0].textContent).toBe('Créé par moi');
  });

  test('applique la classe CSS mercato-player-option à chaque élément', () => {
    const container = makeContainer();
    const owned = [
      { id: 'o1', isCustom: false, custom_name: null, fictional_players: { name: 'X' } }
    ];
    renderMercatoPlayerOptions(container, owned, () => {});
    expect(container._children[0].className).toBe('mercato-player-option');
  });

  test('appelle onSelect avec l\'id du joueur lors d\'un clic', () => {
    const container = makeContainer();
    let selectedId = null;
    const owned = [
      { id: 'o-clicked', isCustom: false, custom_name: null, fictional_players: { name: 'X' } }
    ];
    renderMercatoPlayerOptions(container, owned, id => { selectedId = id; });
    // Simuler le clic sur le premier élément
    container._children[0]._listeners['click'][0]();
    expect(selectedId).toBe('o-clicked');
  });
});

// ---------- renderMercatoFriendOptions ----------

describe('renderMercatoFriendOptions', () => {
  function makeDeps(children = []) {
    const friendPlayerSelect = makeContainer();
    // Simuler querySelectorAll pour la désélection
    friendPlayerSelect.querySelectorAll = () => children;
    return {
      els: { friendPlayerSelect }
    };
  }

  test('liste vide : affiche "Cet ami n\'a aucun joueur"', () => {
    const deps = makeDeps();
    renderMercatoFriendOptions(deps, []);
    expect(deps.els.friendPlayerSelect.innerHTML).toBe(
      '<p class="profile-empty-note">Cet ami n\'a aucun joueur.</p>'
    );
  });

  test('crée autant d\'éléments que de joueurs dans la collection ami', () => {
    const deps = makeDeps();
    const collection = [
      { id: 'fp1', player_name: 'Joueur A', custom_name: null },
      { id: 'fp2', player_name: 'Joueur B', custom_name: null }
    ];
    renderMercatoFriendOptions(deps, collection);
    expect(deps.els.friendPlayerSelect._children).toHaveLength(2);
  });

  test('affiche player_name quand custom_name est absent', () => {
    const deps = makeDeps();
    const collection = [{ id: 'fp1', player_name: 'Joueur A', custom_name: null }];
    renderMercatoFriendOptions(deps, collection);
    expect(deps.els.friendPlayerSelect._children[0].textContent).toBe('Joueur A');
  });

  test('affiche custom_name en priorité sur player_name', () => {
    const deps = makeDeps();
    const collection = [{ id: 'fp1', player_name: 'Joueur A', custom_name: 'Son surnom' }];
    renderMercatoFriendOptions(deps, collection);
    expect(deps.els.friendPlayerSelect._children[0].textContent).toBe('Son surnom');
  });

  test('applique la classe mercato-player-option à chaque élément', () => {
    const deps = makeDeps();
    const collection = [{ id: 'fp1', player_name: 'X', custom_name: null }];
    renderMercatoFriendOptions(deps, collection);
    expect(deps.els.friendPlayerSelect._children[0].className).toBe('mercato-player-option');
  });
});

// ---------- escapeHtml (garde anti-XSS) ----------

describe('escapeHtml', () => {
  test('neutralise les chevrons et guillemets d\'une charge XSS', () => {
    const payload = '<img src=x onerror="alert(1)">';
    const out = escapeHtml(payload);
    // Plus aucun caractère capable d\'ouvrir une balise ou un attribut.
    expect(out.includes('<')).toBe(false);
    expect(out.includes('>')).toBe(false);
    expect(out.includes('"')).toBe(false);
    expect(out).toBe('&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
  });

  test('échappe l\'esperluette et l\'apostrophe', () => {
    expect(escapeHtml(`Tom & Jerry's`)).toBe('Tom &amp; Jerry&#39;s');
  });

  test('un pseudo normal reste inchangé', () => {
    expect(escapeHtml('Marco Brio 10')).toBe('Marco Brio 10');
  });

  test('null / undefined donnent une chaîne vide', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
  });
});
