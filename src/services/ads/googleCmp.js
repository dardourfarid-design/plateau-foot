// ===================== CMP GOOGLE (Funding Choices) =====================
// Épic monétisation publicitaire — correctif consentement (#26).
//
// Charge explicitement le message de consentement RGPD certifié Google
// (Funding Choices). Avec des blocs d'annonces MANUELS (pas d'Auto ads), le
// message ne se déclenche pas tout seul via adsbygoogle.js : il faut charger
// le script Funding Choices dédié. C'est LUI qui affiche la pop-up de
// consentement en EEE et recueille le TCF.
//
// À charger TÔT (pas différé, pas gated par l'affichage d'une bannière) : le
// consentement doit pouvoir être demandé même si aucune bannière ne rend.
//
// NB CSP : on n'injecte PAS de <script> inline (interdit par notre CSP sans
// 'unsafe-inline') — le petit bootstrap `signalGooglefcPresent` est exécuté
// ici en JS de module. Seul le script distant (fundingchoicesmessages.google.com,
// autorisé par la CSP) est injecté.

let _loaded = false;

function hasDom() {
  return typeof document !== 'undefined' && !!document.createElement;
}

// Bootstrap officiel Google : signale la présence du conteneur Funding Choices.
function signalGooglefcPresent() {
  if (typeof window === 'undefined' || !hasDom()) return;
  if (!window.frames['googlefcPresent']) {
    if (document.body) {
      const iframe = document.createElement('iframe');
      iframe.style.cssText =
        'width:0;height:0;border:none;z-index:-1000;left:-1000px;top:-1000px;display:none';
      iframe.name = 'googlefcPresent';
      document.body.appendChild(iframe);
    } else {
      setTimeout(signalGooglefcPresent, 0);
    }
  }
}

/**
 * Charge le message de consentement Google pour le publisher donné.
 * Idempotent. `publisherId` au format 'ca-pub-XXXX' ou 'pub-XXXX'.
 * @returns {boolean} true si le chargement a été (ou est déjà) lancé.
 */
export function loadConsentMessaging(publisherId) {
  if (_loaded) return true;
  if (!hasDom() || !publisherId) return false;

  // Funding Choices attend l'ID sans le préfixe 'ca-'.
  const pub = String(publisherId).replace(/^ca-/, '');
  const s = document.createElement('script');
  s.async = true;
  s.src = `https://fundingchoicesmessages.google.com/i/${encodeURIComponent(pub)}?ers=1`;
  s.setAttribute('data-tm-cmp', '1');
  document.head.appendChild(s);

  signalGooglefcPresent();
  _loaded = true;
  return true;
}
