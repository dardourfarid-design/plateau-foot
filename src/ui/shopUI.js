// ===================== BOUTIQUE DE THÈMES (UI) =====================
// Extrait de main.js (sprint dette technique) pour alléger ce fichier
// devenu trop volumineux. Gère l'affichage et les achats de thèmes,
// y compris le bundle Mondial. État interne (catalogue, achats, thème
// actif) entièrement local à ce module — vérifié avant extraction que
// rien ici n'est lu ailleurs dans l'app (seul currentUser et la
// navigation hors-boutique restent transverses, reçus via `deps`).
//
// Contrat avec main.js : ce module expose initShop(deps) qui câble tout,
// et ne dépend que de ce qui lui est explicitement fourni — pas d'accès
// direct à des variables globales de main.js.
//
// deps = {
//   els,                     // référence aux éléments DOM mis en cache par main.js
//   getCurrentUser,          // () => currentUser actuel
//   openAccountForSignIn,    // () => ouvre la modale de connexion
//   loadSavedThemeId,        // () => string, thème sauvegardé au démarrage
//   saveActiveTheme,         // (id, config) => persiste le choix
//   rememberScreenContext,   // () => mémorise l'écran avant ouverture boutique
//   restoreScreenContext     // () => referme la boutique et revient à l'écran précédent
// }

import { fetchActiveThemes, fetchMyPurchases } from '../services/supabaseClient.js';
import { checkoutTheme, checkoutBundle, isMockPaymentActive } from '../services/payment/paymentProvider.js';
import { applyTheme, isThemeUnlocked, formatPrice, DEFAULT_THEME_ID } from './themeManager.js';

let availableThemes = [];
let purchasedThemeIds = [];
let activeThemeId = DEFAULT_THEME_ID;

// Catalogue de secours : utilisé uniquement si la requête vers Supabase échoue
// (réseau indisponible, configuration absente). Permet à la boutique de rester
// présentable plutôt que vide, même si les achats ne pourront pas être validés
// dans cet état (l'utilisateur verra l'erreur au moment d'acheter, pas avant).
const FALLBACK_THEMES = [
  { id: 'or-mondial', name: 'Or Mondial', description: 'L’or du sommet, l’instant où tout se joue.', price_cents: 199, currency: 'eur', config: { vertTerrain: '#0F2818', vertTerrainClair: '#173820', bleuEquipe: '#1C3F66', rougeEquipe: '#C9A227', accent: '#F4D35E' }, isWorldCup: true },
  { id: 'samba', name: 'Samba', description: 'Jaune et vert, la fête sur la pelouse.', price_cents: 199, currency: 'eur', config: { vertTerrain: '#0B4D2C', vertTerrainClair: '#116B3D', bleuEquipe: '#1565C0', rougeEquipe: '#F9D923', accent: '#2E9E4F' }, isWorldCup: true },
  { id: 'tricolore', name: 'Tricolore', description: 'Bleu, blanc, rouge, droit vers la cage.', price_cents: 199, currency: 'eur', config: { vertTerrain: '#13294B', vertTerrainClair: '#1B3A66', bleuEquipe: '#1B3A66', rougeEquipe: '#C8102E', accent: '#F5F2E8' }, isWorldCup: true },
  { id: 'albiceleste', name: 'Albiceleste', description: 'Le ciel et la victoire, à bandes blanches.', price_cents: 199, currency: 'eur', config: { vertTerrain: '#1B2A4A', vertTerrainClair: '#243A63', bleuEquipe: '#6CB4EE', rougeEquipe: '#F5F2E8', accent: '#FDB927' }, isWorldCup: true },
  { id: 'nuit-americaine', name: 'Nuit Américaine', description: 'Sous les étoiles, l’été du grand tournoi.', price_cents: 199, currency: 'eur', config: { vertTerrain: '#0A1A33', vertTerrainClair: '#102448', bleuEquipe: '#3B5BA5', rougeEquipe: '#B22234', accent: '#F5F2E8' }, isWorldCup: true },
  { id: 'classique', name: 'Classique', description: 'Le terrain vert historique de Tactic Master.', price_cents: 0, currency: 'eur', config: { vertTerrain: '#1F3D2B', vertTerrainClair: '#28492F', bleuEquipe: '#3A6EA5', rougeEquipe: '#C84B31', accent: '#C97B4A' } },
  { id: 'neon', name: 'Néon', description: 'Un terrain électrique pour les soirées arcade.', price_cents: 199, currency: 'eur', config: { vertTerrain: '#0D1B2A', vertTerrainClair: '#15263B', bleuEquipe: '#00E5FF', rougeEquipe: '#FF2D75', accent: '#FFD600' } },
  { id: 'terre-battue', name: 'Terre battue', description: 'Ambiance Roland-Garros, mais au foot.', price_cents: 199, currency: 'eur', config: { vertTerrain: '#A8542E', vertTerrainClair: '#BD663C', bleuEquipe: '#2B4C7E', rougeEquipe: '#7E2B2B', accent: '#F2C572' } },
  { id: 'nuit-stade', name: 'Nuit de stade', description: 'Sous les projecteurs, ambiance match en nocturne.', price_cents: 199, currency: 'eur', config: { vertTerrain: '#0B2818', vertTerrainClair: '#123420', bleuEquipe: '#4FC3F7', rougeEquipe: '#FFB74D', accent: '#FFD54F' } },
  { id: 'retro-8bit', name: 'Rétro 8-bit', description: 'L’esprit jeu vidéo des années 80, en plein écran.', price_cents: 199, currency: 'eur', config: { vertTerrain: '#1A1A2E', vertTerrainClair: '#22223B', bleuEquipe: '#4ECDC4', rougeEquipe: '#FF6B6B', accent: '#FFE66D' } },
  { id: 'jungle', name: 'Jungle', description: 'Un terrain englouti par la végétation tropicale.', price_cents: 199, currency: 'eur', config: { vertTerrain: '#1B4332', vertTerrainClair: '#2D6A4F', bleuEquipe: '#52B788', rougeEquipe: '#D4A017', accent: '#95D5B2' } },
  { id: 'crepuscule', name: 'Crépuscule', description: 'Les dernières lueurs du jour sur la pelouse.', price_cents: 199, currency: 'eur', config: { vertTerrain: '#3D2645', vertTerrainClair: '#4F3358', bleuEquipe: '#7C9EFF', rougeEquipe: '#FF7C7C', accent: '#FFA552' } }
];

export async function refreshThemeData() {
  let usedFallback = false;
  try {
    availableThemes = await fetchActiveThemes();
    if (!availableThemes || availableThemes.length === 0) {
      availableThemes = FALLBACK_THEMES;
      usedFallback = true;
    }
  } catch (err) {
    console.error('Impossible de charger les thèmes depuis Supabase, catalogue de secours utilisé :', err);
    availableThemes = FALLBACK_THEMES;
    usedFallback = true;
  }
  try {
    const purchases = await fetchMyPurchases();
    purchasedThemeIds = purchases.map(p => p.theme_id);
  } catch (err) {
    purchasedThemeIds = [];
  }
  return usedFallback;
}

// IDs des thèmes événementiels "Coupe du Monde", utilisés pour afficher un
// badge promotionnel dans la boutique quel que soit l'endroit d'où vient le
// catalogue (Supabase réel ou catalogue de secours hors-ligne).
const WORLD_CUP_THEME_IDS = ['or-mondial', 'samba', 'tricolore', 'albiceleste', 'nuit-americaine'];

const WORLD_CUP_BUNDLE_PRICE_CENTS = 699; // 6,99€ au lieu de 9,95€ (5 x 1,99€) séparément

function renderWorldCupBundleCard(deps) {
  const missingThemes = WORLD_CUP_THEME_IDS.filter(id => !purchasedThemeIds.includes(id));
  if (missingThemes.length === 0) return; // déjà tout débloqué, le bundle n'a plus d'intérêt

  const card = document.createElement('div');
  card.className = 'theme-card world-cup bundle-card';

  const badge = document.createElement('span');
  badge.className = 'world-cup-badge';
  badge.textContent = 'Économisez 3€';
  card.appendChild(badge);

  const swatch = document.createElement('div');
  swatch.className = 'theme-swatch bundle-swatch';
  ['#F4D35E', '#2E9E4F', '#C8102E', '#6CB4EE', '#3B5BA5'].forEach(color => {
    const dot = document.createElement('span');
    dot.style.background = color;
    swatch.appendChild(dot);
  });

  const name = document.createElement('div');
  name.className = 'theme-name';
  name.textContent = 'Pack Mondial complet';

  const desc = document.createElement('div');
  desc.className = 'theme-desc';
  desc.textContent = `Les 5 thèmes événementiels en un seul achat — ${formatPrice(WORLD_CUP_BUNDLE_PRICE_CENTS)} au lieu de ${formatPrice(199 * 5)}.`;

  const action = document.createElement('button');
  action.className = 'btn primary theme-action';
  action.textContent = `Tout débloquer — ${formatPrice(WORLD_CUP_BUNDLE_PRICE_CENTS)}`;
  action.addEventListener('click', () => handleBundlePurchase(deps, missingThemes));

  card.appendChild(swatch);
  card.appendChild(name);
  card.appendChild(desc);
  card.appendChild(action);
  deps.els.shopGrid.appendChild(card);
}

async function handleBundlePurchase(deps, themeIds) {
  const currentUser = deps.getCurrentUser();
  if (!currentUser) {
    deps.openAccountForSignIn();
    return;
  }
  try {
    const result = await checkoutBundle(themeIds, WORLD_CUP_BUNDLE_PRICE_CENTS, currentUser);
    if (result.immediate) {
      const usedFallback = await refreshThemeData();
      renderShop(deps, usedFallback);
    } else if (result.redirectUrl) {
      window.location.href = result.redirectUrl;
    }
  } catch (err) {
    alert(err.message || 'Achat groupé impossible pour le moment.');
  }
}

export function renderShop(deps, usedFallback = false) {
  deps.els.shopGrid.innerHTML = '';

  if (usedFallback) {
    const banner = document.createElement('p');
    banner.className = 'shop-mock-banner shop-offline-banner';
    banner.textContent = 'Connexion à la boutique indisponible pour le moment : aperçu hors ligne, les achats ne peuvent pas être validés tant que la connexion n\'est pas rétablie.';
    deps.els.shopGrid.appendChild(banner);
  }

  renderWorldCupBundleCard(deps);

  if (availableThemes.length === 0) {
    deps.els.shopGrid.innerHTML = '<p class="shop-empty">Boutique indisponible pour le moment.</p>';
    return;
  }

  availableThemes.forEach(theme => {
    const unlocked = isThemeUnlocked(theme, purchasedThemeIds);
    const isWorldCup = WORLD_CUP_THEME_IDS.includes(theme.id);
    const card = document.createElement('div');
    card.className = 'theme-card' + (theme.id === activeThemeId ? ' active' : '') + (isWorldCup ? ' world-cup' : '');

    if (isWorldCup) {
      const badge = document.createElement('span');
      badge.className = 'world-cup-badge';
      badge.textContent = 'Édition Mondial';
      card.appendChild(badge);
    }

    const swatch = document.createElement('div');
    swatch.className = 'theme-swatch';
    swatch.style.background = theme.config.vertTerrain || '#1F3D2B';
    const dot1 = document.createElement('span');
    dot1.style.background = theme.config.bleuEquipe || '#3A6EA5';
    const dot2 = document.createElement('span');
    dot2.style.background = theme.config.rougeEquipe || '#C84B31';
    swatch.appendChild(dot1);
    swatch.appendChild(dot2);

    const name = document.createElement('div');
    name.className = 'theme-name';
    name.textContent = theme.name;

    const desc = document.createElement('div');
    desc.className = 'theme-desc';
    desc.textContent = theme.description || '';

    const action = document.createElement('button');
    action.className = 'btn theme-action';
    if (unlocked) {
      action.textContent = theme.id === activeThemeId ? 'Sélectionné' : 'Utiliser';
      action.classList.toggle('primary', theme.id !== activeThemeId);
      action.addEventListener('click', () => {
        activeThemeId = theme.id;
        applyTheme(theme.config);
        deps.saveActiveTheme(theme.id, theme.config);
        renderShop(deps);
      });
    } else {
      action.textContent = `Acheter — ${formatPrice(theme.price_cents, theme.currency)}`;
      action.classList.add('primary');
      action.addEventListener('click', () => handlePurchase(deps, theme));
    }

    card.appendChild(swatch);
    card.appendChild(name);
    card.appendChild(desc);
    card.appendChild(action);
    deps.els.shopGrid.appendChild(card);
  });

  if (isMockPaymentActive && !usedFallback) {
    const banner = document.createElement('p');
    banner.className = 'shop-mock-banner';
    banner.textContent = 'Mode démo : les achats sont simulés, aucun paiement réel n\'est demandé.';
    deps.els.shopGrid.appendChild(banner);
  }
}

async function handlePurchase(deps, theme) {
  const currentUser = deps.getCurrentUser();
  if (!currentUser) {
    deps.openAccountForSignIn();
    return;
  }
  try {
    const result = await checkoutTheme(theme, currentUser);
    if (result.redirectUrl) {
      window.location.href = result.redirectUrl;
      return;
    }
    if (result.immediate) {
      const usedFallback = await refreshThemeData();
      activeThemeId = theme.id;
      applyTheme(theme.config);
      deps.saveActiveTheme(theme.id, theme.config);
      renderShop(deps, usedFallback);
    }
  } catch (err) {
    alert(err.message || 'Achat impossible pour le moment.');
  }
}

export function initShop(deps) {
  activeThemeId = deps.loadSavedThemeId() || DEFAULT_THEME_ID;

  deps.els.shopBtn?.addEventListener('click', async () => {
    deps.rememberScreenContext();
    deps.els.setupScreen.classList.add('hidden');
    deps.els.configScreen.classList.add('hidden');
    deps.els.gameScreen.classList.add('hidden');
    deps.els.shopScreen.classList.remove('hidden');
    const usedFallback = await refreshThemeData();
    renderShop(deps, usedFallback);
  });
  deps.els.shopBackBtn?.addEventListener('click', () => {
    deps.els.shopScreen.classList.add('hidden');
    deps.restoreScreenContext();
  });
}
