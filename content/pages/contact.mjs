// Page /contact. L'adresse et l'URL du dépôt viennent de tools/lib/page-layout.mjs
// (CONTACT_EMAIL, REPO_URL) : un seul endroit à changer le jour où le domaine
// personnalisé arrive (#307).
//
// Pas de formulaire : il faudrait un point d'API, une protection anti-spam et un
// traitement de données personnelles supplémentaire, pour un service moins fiable
// qu'un lien mailto. Deux canaux réels valent mieux qu'un formulaire décoratif.

import { CONTACT_EMAIL, REPO_URL } from '../../tools/lib/page-layout.mjs';

export const CONTACT = `
<p class="page-lead">Une question sur les règles, un bug à signaler, une
suggestion, une demande liée à vos données personnelles ou une proposition
professionnelle : voici comment nous joindre, et à quoi vous attendre.</p>

<h2>Par courriel</h2>

<p>Écrivez à <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>. C'est le
canal à privilégier pour&nbsp;:</p>

<ul>
  <li>les questions sur le jeu, les règles ou un compte&nbsp;;</li>
  <li>les demandes relatives aux <strong>données personnelles</strong> — accès,
      rectification, suppression, retrait d'un consentement&nbsp;;</li>
  <li>un problème de <strong>paiement</strong> ou d'achat dans la boutique&nbsp;;</li>
  <li>toute question de <strong>droits, de licence ou de partenariat</strong>.</li>
</ul>

<p>Le projet est édité à titre indépendant : les réponses ne sont pas
instantanées, mais chaque message est lu. Comptez quelques jours.</p>

<h2>Signaler un bug ou proposer une idée</h2>

<p>Le développement se fait en public. Pour un bug ou une suggestion, le plus
efficace est d'ouvrir un ticket sur
<a href="${REPO_URL}/issues" rel="noopener">le dépôt du projet</a> : la demande
est alors visible, suivie, et vous êtes prévenu quand elle avance. Un courriel
fonctionne tout aussi bien si vous préférez.</p>

<p>Un bon signalement tient en quatre lignes&nbsp;:</p>

<ol>
  <li>ce que vous faisiez (mode de jeu, palier de règles, solo ou en ligne)&nbsp;;</li>
  <li>ce que vous attendiez&nbsp;;</li>
  <li>ce qui s'est passé à la place&nbsp;;</li>
  <li>votre navigateur et votre appareil.</li>
</ol>

<p>Une capture d'écran vaut souvent les quatre lignes à elle seule.</p>

<h2>Avant d'écrire</h2>

<p>Beaucoup de questions ont déjà leur réponse&nbsp;:</p>

<ul>
  <li>une règle ou un cas limite → les <a href="/regles">règles complètes</a>&nbsp;;</li>
  <li>une question courante → la <a href="/faq">FAQ</a>&nbsp;;</li>
  <li>un terme de jeu → le <a href="/glossaire">glossaire</a>&nbsp;;</li>
  <li>l'usage de vos données → la <a href="/privacy">politique de confidentialité</a>&nbsp;;</li>
  <li>les achats et le service → les <a href="/terms">conditions d'utilisation et de vente</a>.</li>
</ul>

<h2>Qui vous répond</h2>

<p>Tactic Master est édité à titre indépendant, sans studio ni service client
externalisé. Les messages sont traités par la personne qui développe le jeu.
Vous pouvez en savoir plus sur la page <a href="/a-propos">à propos</a>.</p>
`;
