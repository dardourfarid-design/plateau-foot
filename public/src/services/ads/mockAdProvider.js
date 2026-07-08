// ===================== MOCK AD PROVIDER =====================
// Implémentation factice du contrat AdProvider, active tant qu'aucun réseau
// pub réel n'est branché (compte AdSense/Ad Manager fourni en PR 0 / #25).
// Ne charge aucun SDK, n'affiche aucune vraie pub, ne génère aucun revenu :
// sert uniquement à développer et tester l'UX et le gating (PR C/D/E) avant
// que la vraie régie soit disponible.
//
// Rendu visuel volontairement minimal (un placeholder « pub (démo) ») pour
// que l'intégration UI soit vérifiable, sans dépendance externe. En l'absence
// de DOM (tests Node), les méthodes restent des no-op sûrs.

export const isMock = true;

let _ready = false;

function hasDom() {
  return typeof document !== 'undefined' && !!document.getElementById;
}

export async function init(context) {
  // Rien à charger : on marque simplement le provider prêt.
  _ready = true;
  return true;
}

export async function showBanner(slot) {
  if (!_ready) await init({ consent: true });
  if (!hasDom() || !slot) return false;
  const container = document.getElementById(slot);
  if (!container) return false;
  container.innerHTML =
    '<div class="ad-slot-mock" role="img" aria-label="Emplacement publicitaire de démonstration" ' +
    'style="display:flex;align-items:center;justify-content:center;min-height:90px;' +
    'border:1px dashed rgba(200,132,26,.6);border-radius:8px;color:rgba(242,232,213,.7);' +
    'font-size:13px;letter-spacing:.04em;">pub (démo)</div>';
  return true;
}

export function hideBanner(slot) {
  if (!hasDom() || !slot) return;
  const container = document.getElementById(slot);
  if (container) container.innerHTML = '';
}

export async function showInterstitial() {
  // Le mock considère toujours qu'une pub est « disponible ».
  return { shown: true };
}

export async function showRewarded(context = {}) {
  // Le mock simule un visionnage mené à son terme. NB : il ne CRÉDITE rien —
  // le crédit réel n'arrive que via le SSV serveur (Edge Function rewarded-ssv),
  // absent en mock. C'est volontaire : aucun chemin de crédit côté client.
  return { completed: true };
}

export function destroy() {
  _ready = false;
}
