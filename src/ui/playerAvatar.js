// ===================== AVATAR DE JOUEUR =====================
// Génère un avatar SVG simple à partir de 3 axes composables : couleur,
// motif, accessoire. Utilisé à la fois pour les joueurs du catalogue
// (avatar déterminé par avatar_seed, voir hashSeedToAvatar) et pour les
// joueurs custom (avatar choisi explicitement par l'utilisateur).
//
// Volontairement simple (formes géométriques, pas d'images importées) pour
// rester léger et cohérent avec l'identité visuelle déjà en place
// (gazon/nuit/terre), sans dépendance à un éditeur graphique externe.

export const AVATAR_COLORS = [
  '#3A6EA5', '#C84B31', '#2E9E4F', '#F4D35E',
  '#6CB4EE', '#9B5DE5', '#FF6B6B', '#4ECDC4'
];

export const AVATAR_PATTERNS = ['plain', 'stripes', 'halves', 'dots'];
export const AVATAR_ACCESSORIES = ['none', 'band', 'star', 'bolt'];

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
 * Construit le SVG (en chaîne) d'un avatar pour les 3 axes donnés.
 * Conçu pour être inséré directement en innerHTML dans un petit conteneur
 * (carte de collection, aperçu de création, etc.) — pas pour les pions du
 * plateau, qui restent de simples cercles colorés pour rester lisibles à
 * cette taille.
 */
export function renderAvatarSvg({ color, pattern, accessory }) {
  const patternEl = renderPattern(pattern, color);
  const accessoryEl = renderAccessory(accessory);

  return `
    <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Avatar du joueur">
      <circle cx="32" cy="32" r="30" fill="${color}" />
      ${patternEl}
      ${accessoryEl}
    </svg>
  `;
}

function renderPattern(pattern, color) {
  const darker = darken(color, 0.25);
  switch (pattern) {
    case 'stripes':
      return `
        <rect x="14" y="2" width="8" height="60" fill="${darker}" />
        <rect x="42" y="2" width="8" height="60" fill="${darker}" />
      `;
    case 'halves':
      return `<path d="M32 2 A30 30 0 0 1 32 62 Z" fill="${darker}" />`;
    case 'dots':
      return `
        <circle cx="20" cy="20" r="4" fill="${darker}" />
        <circle cx="44" cy="20" r="4" fill="${darker}" />
        <circle cx="32" cy="40" r="4" fill="${darker}" />
        <circle cx="20" cy="48" r="3" fill="${darker}" />
        <circle cx="44" cy="48" r="3" fill="${darker}" />
      `;
    case 'plain':
    default:
      return '';
  }
}

function renderAccessory(accessory) {
  switch (accessory) {
    case 'band':
      return `<rect x="2" y="26" width="60" height="10" fill="rgba(11,20,30,0.55)" />`;
    case 'star':
      return `<path d="M32 18 L36 28 L47 28 L38 35 L41 46 L32 39 L23 46 L26 35 L17 28 L28 28 Z" fill="#F5F2E8" />`;
    case 'bolt':
      return `<path d="M34 14 L22 36 L30 36 L26 50 L42 28 L33 28 Z" fill="#F5F2E8" />`;
    case 'none':
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
