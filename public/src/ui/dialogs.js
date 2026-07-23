import { t } from './i18n.js';
// ===================== DIALOGUES INTÉGRÉS =====================
// Remplace les alert()/confirm() natifs du navigateur, qui bloquent le
// thread, cassent l'immersion (surtout en PWA plein écran) et ne suivent
// pas la direction artistique du jeu.
//
// - showToast(message)        : notification furtive non bloquante.
// - showAlert(message)        : modale d'information, Promise résolue à la fermeture.
// - showConfirm(message)      : modale de confirmation, Promise<boolean>.
// - showConsentDialog(defaults): panneau RGPD à cases à cocher,
//   Promise<{analytics, emailMarketing, dataSharing, advertising} | null> (null = annulé).
//
// Réutilise les classes .overlay / .overlay-card / .btn existantes pour
// hériter automatiquement du thème du jeu.

let _dom = null;

function ensureDom() {
  if (_dom) return _dom;

  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  overlay.id = 'appDialogOverlay';
  overlay.innerHTML = `
    <div class="overlay-card" style="max-width:420px;text-align:left;">
      <h2 class="overlay-title" id="appDialogTitle" style="font-size:22px;margin-bottom:10px;"></h2>
      <div id="appDialogBody" style="margin-bottom:18px;line-height:1.5;white-space:pre-line;"></div>
      <div style="display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap;">
        <button class="topbar-link" id="appDialogCancelBtn">Annuler</button>
        <button class="btn primary" id="appDialogOkBtn" style="min-width:120px;">OK</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  const toast = document.createElement('div');
  toast.id = 'appToast';
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');
  toast.style.cssText = [
    'position:fixed', 'top:18px', 'left:50%',
    'transform:translateX(-50%) translateY(-60px)', 'opacity:0',
    'transition:transform .25s ease, opacity .25s ease',
    'z-index:220', 'max-width:min(92vw,480px)',
    'background:rgba(20,16,10,.96)', 'color:#F2E8D5',
    'border:1px solid rgba(200,132,26,.55)', 'border-radius:10px',
    'padding:12px 18px', 'font-size:14px', 'line-height:1.4',
    'box-shadow:0 8px 30px rgba(0,0,0,.45)', 'pointer-events:none'
  ].join(';');
  document.body.appendChild(toast);

  _dom = {
    overlay,
    title: overlay.querySelector('#appDialogTitle'),
    body: overlay.querySelector('#appDialogBody'),
    okBtn: overlay.querySelector('#appDialogOkBtn'),
    cancelBtn: overlay.querySelector('#appDialogCancelBtn'),
    toast,
    toastTimer: null
  };
  return _dom;
}

export function showToast(message, { duration = 3000 } = {}) {
  const d = ensureDom();
  d.toast.textContent = message;
  clearTimeout(d.toastTimer);
  requestAnimationFrame(() => {
    d.toast.style.opacity = '1';
    d.toast.style.transform = 'translateX(-50%) translateY(0)';
  });
  d.toastTimer = setTimeout(() => {
    d.toast.style.opacity = '0';
    d.toast.style.transform = 'translateX(-50%) translateY(-60px)';
  }, duration);
}

function openModal({ title, bodyHtml, bodyText, okLabel, cancelLabel, showCancel }) {
  const d = ensureDom();
  return new Promise(resolve => {
    d.title.textContent = title || '';
    d.title.style.display = title ? '' : 'none';
    if (bodyHtml !== undefined) d.body.innerHTML = bodyHtml;
    else d.body.textContent = bodyText || '';
    d.okBtn.textContent = okLabel || t('OK');
    d.cancelBtn.textContent = cancelLabel || t('Annuler');
    d.cancelBtn.style.display = showCancel ? '' : 'none';

    const close = result => {
      d.overlay.classList.remove('show');
      d.okBtn.onclick = d.cancelBtn.onclick = d.overlay.onclick = null;
      document.removeEventListener('keydown', onKey);
      resolve(result);
    };
    const onKey = e => {
      if (e.key === 'Escape') close(showCancel ? false : undefined);
      if (e.key === 'Enter') close(true);
    };
    d.okBtn.onclick = () => close(true);
    d.cancelBtn.onclick = () => close(false);
    d.overlay.onclick = e => { if (e.target === d.overlay && showCancel) close(false); };
    document.addEventListener('keydown', onKey);

    d.overlay.classList.add('show');
    d.okBtn.focus();
  });
}

export function showAlert(message, { title = '' } = {}) {
  return openModal({ title, bodyText: message, okLabel: t('OK'), showCancel: false });
}

export function showConfirm(message, { title = '', okLabel = t('Confirmer'), cancelLabel = t('Annuler') } = {}) {
  return openModal({ title, bodyText: message, okLabel, cancelLabel, showCancel: true });
}

/**
 * Panneau de gestion des consentements RGPD : les trois finalités sont
 * présentées ENSEMBLE avec des cases à cocher (exigence CNIL : vue
 * d'ensemble, retrait aussi simple que l'octroi), au lieu de trois
 * confirm() successifs sans contexte.
 */
export function showConsentDialog(defaults = {}) {
  const d = ensureDom();
  const cb = (id, label, checked) => `
    <label style="display:flex;gap:10px;align-items:flex-start;margin-bottom:12px;cursor:pointer;">
      <input type="checkbox" id="${id}" ${checked ? 'checked' : ''} style="margin-top:3px;">
      <span>${label}</span>
    </label>`;
  const bodyHtml = `
    <p style="margin-bottom:14px;">Choisis ce que tu autorises. Tu peux tout décocher : le jeu reste entièrement fonctionnel.</p>
    ${cb('consentDlgAnalytics', "Analyse de mon usage du jeu pour améliorer le produit", defaults.analytics)}
    ${cb('consentDlgEmail', "Recevoir des emails sur les nouveautés et offres", defaults.emailMarketing)}
    ${cb('consentDlgSharing', "Partage de mes données avec des partenaires sélectionnés", defaults.dataSharing)}
    ${cb('consentDlgAds', "Affichage de publicités, y compris personnalisées", defaults.advertising)}`;
  return openModal({
    title: t('Mes préférences de données'),
    bodyHtml,
    okLabel: t('Enregistrer'),
    cancelLabel: t('Annuler'),
    showCancel: true
  }).then(ok => {
    if (!ok) return null;
    return {
      analytics: d.body.querySelector('#consentDlgAnalytics')?.checked ?? false,
      emailMarketing: d.body.querySelector('#consentDlgEmail')?.checked ?? false,
      dataSharing: d.body.querySelector('#consentDlgSharing')?.checked ?? false,
      advertising: d.body.querySelector('#consentDlgAds')?.checked ?? false
    };
  });
}

// ---------------------------------------------------------------------------
// #345 (extraction #311) : toast de retour d'achat Stripe. Vivait dans main.js
// — déplacé ici (foyer des toasts) pour rester sous le plafond de taille de
// main.js. Les icônes sont des SVG inline (#344, F9) : constantes INTERNES
// uniquement, d'où le innerHTML.
export const PURCHASE_TOAST_ICONS = {
  success: '<svg width="16" height="16" viewBox="0 0 14 14" fill="none" aria-hidden="true"><circle cx="7" cy="7" r="6" stroke="currentColor" stroke-width="1.3"/><path d="M4.5 7l1.8 1.8L9.8 5.4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  pass: '<svg width="16" height="16" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="M1.5 5V3.5h11V5a1.5 1.5 0 000 3v1.5h-11V8a1.5 1.5 0 000-3z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M8.5 3.5v7" stroke="currentColor" stroke-width="1.3" stroke-dasharray="1.6 1.6"/></svg>',
  cancelled: '<svg width="16" height="16" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="M5 3L2.5 5.5 5 8" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/><path d="M2.5 5.5H9a2.5 2.5 0 010 5H7" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>'
};

export function showPurchaseToast(els, iconSvg, text, isCancelled) {
  if (!els.purchaseToast) return;
  els.purchaseToastIcon.innerHTML = iconSvg;
  els.purchaseToastText.textContent = text;
  els.purchaseToast.classList.toggle('cancelled', isCancelled);
  els.purchaseToast.classList.add('show');
  els.purchaseToast.classList.remove('hidden');
  setTimeout(() => { els.purchaseToast.classList.remove('show'); }, 5000);
}
