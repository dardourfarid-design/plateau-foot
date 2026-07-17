// ===================== RÈGLES & FAQ (M11, #252) =====================
// Overlay « Règles & FAQ » ouvrable depuis la landing (sans scroll) et pendant
// une partie. Le contenu n'est PAS dupliqué : il est cloné à chaque ouverture
// depuis la section éditoriale SEO (.seo-about, #181), qui reste la source
// unique — visible en bas de page pour les moteurs et miroir du JSON-LD
// FAQPage (#182). Le clone porte la classe .faq-body (jamais .seo-about) :
// les e2e SEO comptent les <details> de .seo-about et ne doivent voir que
// l'original.

import { onLangChange } from './i18n.js';

export function initFaq() {
  const overlay = document.getElementById('faqOverlay');
  const body = document.getElementById('faqBody');
  const closeBtn = document.getElementById('faqCloseBtn');
  if (!overlay || !body || !closeBtn) return null;

  let lastFocused = null;

  // Re-clone à chaque ouverture : les nœuds clonés ne portent pas la mémoire
  // FR de i18n (propriétés __i18nFr non copiées par cloneNode), donc un clone
  // fait en anglais ne saurait pas revenir au français. La source, elle, est
  // toujours dans la bonne langue — repartir d'elle règle la question.
  function populate() {
    const source = document.querySelector('section.seo-about');
    if (!source) return;
    body.replaceChildren();
    // Tout sauf le h2 : l'overlay a déjà son titre.
    source.querySelectorAll(':scope > *:not(h2)').forEach(node => {
      body.appendChild(node.cloneNode(true));
    });
  }

  const isOpen = () => overlay.classList.contains('show');

  function open() {
    populate();
    lastFocused = document.activeElement;
    overlay.classList.add('show');
    closeBtn.focus();
  }

  function close() {
    if (!isOpen()) return;
    overlay.classList.remove('show');
    if (lastFocused && typeof lastFocused.focus === 'function') lastFocused.focus();
    lastFocused = null;
  }

  document.getElementById('landingFaqBtn')?.addEventListener('click', open);
  document.getElementById('gameFaqBtn')?.addEventListener('click', open);
  closeBtn.addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && isOpen()) close();
  });
  // Bascule de langue pendant que l'overlay est ouvert : la source vient
  // d'être retraduite par setLang(), on repart d'elle.
  onLangChange(() => { if (isOpen()) populate(); });

  return { open, close };
}
