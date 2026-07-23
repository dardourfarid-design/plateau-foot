// ===================== PARTAGE DU CODE D'INVITATION (#264) =====================
// Salle d'attente en ligne : copier le code, ou le partager via l'API Web Share
// avec repli sur le presse-papiers. Même forme que shareResult.js (#111) : une
// composition PURE (buildInviteShareContent) testable sous Node, et des
// fonctions d'action qui, seules, touchent aux API du navigateur — toutes deux
// avec un point d'injection `io` pour les tests.
//
// Confidentialité : le message ne contient QUE le code d'invitation (éphémère,
// non nominatif) et l'URL du site. Jamais d'identifiant de compte ni de pseudo.

import { t } from './i18n.js';

/**
 * Compose le contenu de partage d'une invitation. Fonction pure.
 * @param {string} code    code d'invitation de la partie.
 * @param {string} origin  origine du site (ex. 'https://tactic-master.vercel.app').
 * @returns {{title:string, text:string, url:string}}
 */
export function buildInviteShareContent(code, origin) {
  const text = t('Rejoins ma partie sur Tactic Master avec le code {code}.', { code });
  return { title: 'Tactic Master', text, url: origin || '' };
}

/**
 * Copie le code brut dans le presse-papiers (le format le plus utile : il se
 * colle directement dans le champ « Rejoindre »).
 * @returns {Promise<'copied'|'failed'>}
 */
export async function copyInviteCode(code, io = {}) {
  const nav = io.navigator || (typeof navigator !== 'undefined' ? navigator : null);
  if (!nav || !nav.clipboard) return 'failed';
  try {
    await nav.clipboard.writeText(code);
    return 'copied';
  } catch {
    return 'failed';
  }
}

/**
 * Partage l'invitation : partage natif si disponible, sinon presse-papiers.
 * @returns {Promise<'shared'|'copied'|'cancelled'|'failed'>}
 */
export async function shareInvite(code, io = {}) {
  const nav = io.navigator || (typeof navigator !== 'undefined' ? navigator : null);
  const origin = io.origin || (typeof location !== 'undefined' ? location.origin : '');
  if (!nav) return 'failed';

  const content = buildInviteShareContent(code, origin);

  if (typeof nav.share === 'function') {
    try {
      await nav.share(content);
      return 'shared';
    } catch (err) {
      // AbortError = feuille de partage fermée par l'utilisateur : ce n'est pas
      // un échec, on n'enchaîne pas sur une copie qu'il n'a pas demandée.
      if (err && err.name === 'AbortError') return 'cancelled';
      // Autre échec : repli copie plutôt que de laisser l'utilisateur sans rien.
    }
  }

  if (nav.clipboard) {
    try {
      await nav.clipboard.writeText(`${content.text} ${content.url}`.trim());
      return 'copied';
    } catch { /* tombe en échec ci-dessous */ }
  }
  return 'failed';
}
