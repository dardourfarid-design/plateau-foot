// ===================== AVATAR DE JOUEUR =====================
// Emblème/blason stylisé (esprit écusson "Winning Eleven" x affiche du jeu),
// généré en SVG à partir de 3 axes composables : couleur, motif, accessoire.
// Utilisé à la fois pour les joueurs du catalogue (avatar déterminé par
// avatar_seed, voir hashSeedToAvatar) et pour les joueurs custom (avatar
// choisi explicitement par l'utilisateur).
//
// 100% SVG paramétrique — aucune image importée, aucune dépendance externe —
// pour rester léger et cohérent avec l'identité visuelle (noir chaud / or /
// bleu-rouge d'équipe). L'API (couleur/motif/accessoire) est inchangée : le
// blason dérive toutes ses teintes de la couleur d'équipe fournie.

export const AVATAR_COLORS = [
  '#3A6EA5', '#C84B31', '#2E9E4F', '#F4D35E',
  '#6CB4EE', '#9B5DE5', '#FF6B6B', '#4ECDC4'
];

export const AVATAR_PATTERNS = ['plain', 'stripes', 'halves', 'dots'];
export const AVATAR_ACCESSORIES = ['none', 'band', 'star', 'bolt'];

// Or des affiches — constant sur tous les emblèmes (liseré, étoile, ornements).
const GOLD = '#E8A030';
const GOLD_DARK = '#9C6410';

// Compteur d'instances : chaque <clipPath> doit avoir un id unique dans le
// document, sinon plusieurs avatars sur une même page partageraient le même
// clip (url(#id) résout le premier trouvé) et se découperaient mal.
let _uid = 0;

/**
 * Dérive un avatar déterministe (couleur/motif/accessoire) à partir d'une
 * seed textuelle (ex: avatar_seed du catalogue). Même seed = même avatar,
 * toujours — pas d'aléatoire à l'affichage.
 */
export function hashSeedToAvatar(seed) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return {
    color: AVATAR_COLORS[hash % AVATAR_COLORS.length],
    pattern: AVATAR_PATTERNS[Math.floor(hash / AVATAR_COLORS.length) % AVATAR_PATTERNS.length],
    accessory: AVATAR_ACCESSORIES[Math.floor(hash / (AVATAR_COLORS.length * AVATAR_PATTERNS.length)) % AVATAR_ACCESSORIES.length]
  };
}

/**
 * Construit le SVG (en chaîne) d'un emblème-joueur pour les 3 axes donnés.
 * Conçu pour être inséré directement en innerHTML dans un conteneur carré
 * (carte de collection, slot de composition, aperçu de création, profil).
 * Les pions du plateau restent de simples cercles colorés — cet emblème est
 * réservé à l'UI où l'avatar a la place d'être détaillé.
 */
export function renderAvatarSvg({ color, pattern, accessory }) {
  // Défense en profondeur : `color` provient d'un champ choisi par
  // l'utilisateur (custom_players.avatar_color) et est injecté brut dans les
  // attributs SVG ci-dessous via innerHTML. On n'accepte qu'une couleur hex
  // #RRGGBB ; toute autre valeur (tentative d'injection, ou donnée héritée)
  // retombe sur la couleur par défaut. La contrainte CHECK côté base
  // (migration 0032) empêche déjà le stockage de valeurs non hex — ceci
  // protège en plus le rendu direct et les lignes antérieures à la contrainte.
  if (!/^#[0-9A-Fa-f]{6}$/.test(color)) color = '#3A6EA5';

  const kit = color;                       // couleur d'équipe brute (champ du blason)
  const kitDark = darken(color, 0.42);     // ombre du champ, bas du blason
  const kitLight = lighten(color, 0.42);   // lumière de contour (rim light)
  const ink = darken(color, 0.74);         // silhouette encrée du joueur

  const clipId = `crest-clip-${_uid++}`;
  const field = renderField(pattern, kitDark);
  const band = accessory === 'band' ? renderHeadband() : '';
  const ornament = renderOrnament(accessory);

  return `
    <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Emblème du joueur">
      <defs>
        <clipPath id="${clipId}"><path d="M50 8 L84.5 18 C84.5 47 76 74 50 92 C24 74 15.5 47 15.5 18 Z" /></clipPath>
      </defs>

      <!-- Écusson : double liseré or -->
      <path d="M50 4 L88 15 C88 47 79 76 50 96 C21 76 12 47 12 15 Z" fill="${GOLD}" />
      <path d="M50 7 L85.5 17.3 C85.5 47 77 74.5 50 93 C23 74.5 14.5 47 14.5 17.3 Z" fill="${GOLD_DARK}" />

      <!-- Champ + joueur, découpés dans la forme du blason -->
      <g clip-path="url(#${clipId})">
        <rect x="12" y="6" width="76" height="90" fill="${kit}" />
        <rect x="12" y="52" width="76" height="44" fill="${kitDark}" />
        <ellipse cx="50" cy="39" rx="26" ry="23" fill="${kitLight}" opacity="0.18" />
        <path d="M12 8 L60 8 L26 42 L12 42 Z" fill="#ffffff" opacity="0.06" />
        ${field}
        <path d="M27 80 C28 63 37 56 50 56 C63 56 72 63 73 80 Z" fill="${ink}" />
        <ellipse cx="50" cy="41" rx="12.5" ry="13.5" fill="${ink}" />
        <path d="M30.5 46 C31 30 40 23 50 23 C59 23 65 29 66 37 C61 31 57 34 55 30 C53 35 49 30 48 33 C45 30 41 34 40 30 C37 35 33 36 30.5 46 Z" fill="${ink}" />
        <path d="M30.5 46 C31 30 40 23 50 23 L48.5 26 C41 27 35 34 34 46 Z" fill="${kitLight}" opacity="0.85" />
        <path d="M27 80 C28 63 37 56 50 56 L49 59 C39 60 32 67 31 80 Z" fill="${kitLight}" opacity="0.5" />
        ${band}
      </g>

      <!-- Liseré or intérieur + ornement de tête -->
      <path d="M50 8 L84.5 18 C84.5 47 76 74 50 92 C24 74 15.5 47 15.5 18 Z" fill="none" stroke="${GOLD}" stroke-width="1.4" opacity="0.9" />
      ${ornament}
    </svg>
  `;
}

// Motif du champ (derrière la silhouette). 'plain' laisse le champ nu.
function renderField(pattern, kitDark) {
  switch (pattern) {
    case 'stripes':
      return `
        <g fill="${kitDark}" opacity="0.5">
          <rect x="22" y="6" width="6" height="90" />
          <rect x="38" y="6" width="6" height="90" />
          <rect x="54" y="6" width="6" height="90" />
          <rect x="70" y="6" width="6" height="90" />
        </g>
      `;
    case 'halves':
      return `<path d="M12 6 L88 6 L88 96 Z" fill="${kitDark}" opacity="0.4" />`;
    case 'dots':
      return `
        <g fill="${kitDark}" opacity="0.45">
          <circle cx="30" cy="18" r="2" /><circle cx="40" cy="18" r="2" /><circle cx="50" cy="18" r="2" /><circle cx="60" cy="18" r="2" /><circle cx="70" cy="18" r="2" />
          <circle cx="35" cy="26" r="2" /><circle cx="45" cy="26" r="2" /><circle cx="55" cy="26" r="2" /><circle cx="65" cy="26" r="2" />
        </g>
      `;
    case 'plain':
    default:
      return '';
  }
}

// Bandeau (capitaine) porté sur le front de la silhouette.
function renderHeadband() {
  return `<path d="M35 33.5 Q50 38.5 65 33.5 L65 38 Q50 43 35 38 Z" fill="${GOLD}" stroke="${GOLD_DARK}" stroke-width="0.5" />`;
}

// Ornement au sommet du blason (au-dessus de la tête).
function renderOrnament(accessory) {
  switch (accessory) {
    case 'star':
      return `<path d="M50 10 l2.4 5.3 5.8 .5 -4.4 3.8 1.35 5.7 -5.15 -3.1 -5.15 3.1 1.35 -5.7 -4.4 -3.8 5.8 -.5 Z" fill="${GOLD}" stroke="${GOLD_DARK}" stroke-width="0.6" stroke-linejoin="round" />`;
    case 'bolt':
      return `<path d="M53 9 L44 21 L49 21 L46.5 26 L56 16 L51 16 Z" fill="${GOLD}" stroke="${GOLD_DARK}" stroke-width="0.6" stroke-linejoin="round" />`;
    case 'none':
    case 'band':
    default:
      return '';
  }
}

function darken(hexColor, amount) {
  const hex = hexColor.replace('#', '');
  const r = Math.max(0, parseInt(hex.substring(0, 2), 16) * (1 - amount));
  const g = Math.max(0, parseInt(hex.substring(2, 4), 16) * (1 - amount));
  const b = Math.max(0, parseInt(hex.substring(4, 6), 16) * (1 - amount));
  return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
}

function lighten(hexColor, amount) {
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const mix = (c) => Math.round(c + (255 - c) * amount);
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}
