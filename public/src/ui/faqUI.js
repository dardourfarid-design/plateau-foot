// ===================== RÈGLES & FAQ (M11, #252 ; #270-bis) =====================
// Overlay « Règles & FAQ » ouvrable depuis la landing (sans scroll) et pendant
// une partie. Depuis #270-bis, les règles et la FAQ vivent DIRECTEMENT dans le
// HTML de l'overlay (#faqBody) — plus de clonage depuis .seo-about, et surtout
// plus de duplication visible en bas de la landing. Le contenu statique est
// présent dès le chargement (donc indexable) et traduit en place par i18n
// (applyTranslations / MutationObserver), ce qui rend le suivi de langue
// automatique — d'où la disparition de l'ancienne logique de re-clonage.

export function initFaq() {
  const overlay = document.getElementById('faqOverlay');
  const closeBtn = document.getElementById('faqCloseBtn');
  if (!overlay || !closeBtn) return null;

  let lastFocused = null;
  const isOpen = () => overlay.classList.contains('show');

  function open() {
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

  // Trois points d'accès : hero de la landing, texte « à propos » en bas de
  // page, et carte « Rappel des règles » pendant une partie.
  document.getElementById('landingFaqBtn')?.addEventListener('click', open);
  document.getElementById('aboutFaqBtn')?.addEventListener('click', open);
  document.getElementById('gameFaqBtn')?.addEventListener('click', open);
  closeBtn.addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && isOpen()) close();
  });

  return { open, close };
}
