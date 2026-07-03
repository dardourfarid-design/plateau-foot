// ===================== DIALOGUES INTÉGRÉS =====================
// Remplace les alert()/confirm() natifs du navigateur, qui bloquent le
// thread, cassent l'immersion (surtout en PWA plein écran) et ne suivent
// pas la direction artistique du jeu.
//
// - showToast(message)        : notification furtive non bloquante.
// - showAlert(message)        : modale d'information, Promise résolue à la fermeture.
// - showConfirm(message)      : modale de confirmation, Promise<boolean>.
// - showConsentDialog(defaults): panneau RGPD à cases à cocher,
//   Promise<{analytics, emailMarketing, dataSharing} | null> (null = annulé).
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
    d.okBtn.textContent = okLabel || 'OK';
    d.cancelBtn.textContent = cancelLabel || 'Annuler';
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
  return openModal({ title, bodyText: message, okLabel: 'OK', showCancel: false });
}

export function showConfirm(message, { title = '', okLabel = 'Confirmer', cancelLabel = 'Annuler' } = {}) {
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
    ${cb('consentDlgSharing', "Partage de mes données avec des partenaires sélectionnés", defaults.dataSharing)}`;
  return openModal({
    title: 'Mes préférences de données',
    bodyHtml,
    okLabel: 'Enregistrer',
    cancelLabel: 'Annuler',
    showCancel: true
  }).then(ok => {
    if (!ok) return null;
    return {
      analytics: d.body.querySelector('#consentDlgAnalytics')?.checked ?? false,
      emailMarketing: d.body.querySelector('#consentDlgEmail')?.checked ?? false,
      dataSharing: d.body.querySelector('#consentDlgSharing')?.checked ?? false
    };
  });
}
