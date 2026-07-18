// ===================== PARTAGE DU RÉSULTAT DE MATCH (#111) =====================
// Compose le texte et l'URL de partage à partir du bilan de match, puis délègue
// au partage natif (navigator.share) avec repli sur le presse-papiers.
//
// La composition est une fonction PURE (buildShareContent) : aucun accès au DOM
// ni à navigator, donc testable sous Node comme le reste du moteur. Seul
// shareResult() touche aux API du navigateur.
//
// Confidentialité : l'URL partagée ne contient QUE le score et le type de
// résultat. Jamais d'identifiant de compte, de pseudo ni d'identifiant de
// session — un lien de partage finit indexé, copié, transféré.

import { t } from './i18n.js';

/** Pages de partage statiques (une par issue) — voir public/partage/. */
const RESULT_SLUGS = { win: 'victoire', loss: 'defaite', draw: 'match-nul' };

/**
 * Compose le contenu de partage. Fonction pure.
 * @param {{result:string, myGoals:number, oppGoals:number, bestMomentum:number}} summary
 *        bilan issu de buildMatchSummary().
 * @param {string} origin  origine du site (ex. 'https://tactic-master.vercel.app').
 * @returns {{title:string, text:string, url:string}}
 */
export function buildShareContent(summary, origin) {
  const { result, myGoals, oppGoals, bestMomentum } = summary;
  const score = `${myGoals}–${oppGoals}`;

  let text;
  if (result === 'win') text = t('Je viens de gagner {score} sur Tactic Master.', { score });
  else if (result === 'loss') text = t('Battu {score} sur Tactic Master. Prends ta revanche pour moi.', { score });
  else text = t('Match nul {score} sur Tactic Master. Départage-nous.', { score });

  // La plus belle action n'est mentionnée que si elle vaut le coup d'être dite.
  if (bestMomentum >= 3) {
    text += ' ' + t('Meilleure action : {n} passes.', { n: bestMomentum });
  }

  const slug = RESULT_SLUGS[result] || RESULT_SLUGS.draw;
  // utm_source permet de distinguer le trafic de partage dans Plausible (#49).
  const url = `${origin}/partage/${slug}?utm_source=partage`;

  return { title: 'Tactic Master', text, url };
}

/**
 * Partage le résultat : partage natif si disponible, sinon presse-papiers.
 * @param {object} summary  bilan issu de buildMatchSummary().
 * @param {object} [io]     points d'injection pour les tests.
 * @returns {Promise<'shared'|'copied'|'cancelled'|'failed'>}
 */
export async function shareResult(summary, io = {}) {
  const nav = io.navigator || (typeof navigator !== 'undefined' ? navigator : null);
  const origin = io.origin || (typeof location !== 'undefined' ? location.origin : '');
  if (!nav) return 'failed';

  const content = buildShareContent(summary, origin);

  if (typeof nav.share === 'function') {
    try {
      await nav.share(content);
      return 'shared';
    } catch (err) {
      // AbortError = l'utilisateur a fermé la feuille de partage. Ce n'est pas
      // une erreur : ne pas enchaîner sur une copie qu'il n'a pas demandée.
      if (err && err.name === 'AbortError') return 'cancelled';
      // Tout autre échec (permission, navigateur capricieux) : on retombe sur
      // la copie plutôt que de laisser le joueur sans rien.
    }
  }

  try {
    await nav.clipboard.writeText(`${content.text} ${content.url}`);
    return 'copied';
  } catch {
    return 'failed';
  }
}
