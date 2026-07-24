// ===================== BOUTIQUE (REFONTE E1) =====================
// 4 sections :
//   1. Pack Fondateurs (urgence + compteur)
//   2. Passes Saison (abonnements récurrents)
//   3. Packs (one-time groupés)
//   4. Kits à l'unité + Déblocage par pièces

import { fetchActiveThemes, fetchMyPurchases, getAccessToken } from '../services/supabaseClient.js';
import { checkoutTheme, checkoutBundle, isMockPaymentActive } from '../services/payment/paymentProvider.js';
import { applyTheme, isThemeUnlocked, formatPrice, DEFAULT_THEME_ID } from './themeManager.js';
import { getFoundersRemaining, getMyActivePass } from '../services/passService.js';
import { getCurrencyBalance, unlockThemeWithCoins, getKitCredits, redeemKitCredit } from '../services/currencyService.js';
import { showToast, showAlert, showConfirm } from './dialogs.js';

let availableThemes   = [];
let purchasedThemeIds = [];
let activeThemeId     = DEFAULT_THEME_ID;
let coinBalance       = 0;
let kitCredits        = 0;
let activePass        = null;
let foundersRemaining = 200;

// Kits disponibles via pièces (sélection aléatoire quotidienne stable).
// Coût partagé avec accountUI (goal-gradient de fin de partie) via un module
// de constantes sans dépendance.
import { COIN_KIT_COST } from './shopConstants.js';

// CRO/psycho #C3 — kit mis en avant (Default Effect / Paradox of Choice) : un
// point d'entrée éditorial dans la grille, pour éviter la paralysie du choix.
// « Recommandé » (choix éditorial honnête) plutôt que « Populaire » : on n'a pas
// de données de popularité réelles, on n'en invente pas.
const RECOMMENDED_KIT_ID = 'neon';

// Les produits "virtuels" vivent dans la table themes (pattern migrations
// 0012/0018/0025 : joueurs, packs, slot custom) mais ne sont pas des kits.
function _isRealKit(theme) {
  return !theme.id.startsWith('player-')
      && !theme.id.startsWith('pack-')
      && !theme.id.startsWith('coins-')
      && !theme.id.startsWith('shootout-')   // skins de la séance de tirs au but : achetés dans l'écran dédié
      && theme.id !== 'custom-player-slot';
}

// ── Catalogue de secours (offline) ────────────────────────────────
const FALLBACK_THEMES = [
  { id: 'classique',     name: 'Classique',      description: 'Le terrain vert historique.',          price_cents: 0,   currency: 'eur', config: { vertTerrain: '#1F3D2B', vertTerrainClair: '#28492F', bleuEquipe: '#3A6EA5', rougeEquipe: '#C84B31', accent: '#C97B4A' } },
  { id: 'neon',          name: 'Néon',            description: 'Terrain électrique soirée arcade.',    price_cents: 249, currency: 'eur', config: { vertTerrain: '#0D1B2A', vertTerrainClair: '#15263B', bleuEquipe: '#00E5FF', rougeEquipe: '#FF2D75', accent: '#FFD600' } },
  { id: 'tokyo-minuit',  name: 'Tokyo Minuit',    description: 'Néon violet, pluie et béton.',         price_cents: 249, currency: 'eur', config: { vertTerrain: '#120820', vertTerrainClair: '#1C1030', bleuEquipe: '#8A2BE2', rougeEquipe: '#FF1493', accent: '#C084FC' } },
  { id: 'savane',        name: 'Savane',           description: 'Terre ocre, horizon brûlé.',           price_cents: 249, currency: 'eur', config: { vertTerrain: '#2C1A06', vertTerrainClair: '#3D2408', bleuEquipe: '#C2742A', rougeEquipe: '#8B4513', accent: '#E8C97A' } },
  { id: 'arctique',      name: 'Arctique',         description: 'Glace bleutée, enjeu maximum.',        price_cents: 249, currency: 'eur', config: { vertTerrain: '#040E1F', vertTerrainClair: '#071529', bleuEquipe: '#4DD8F0', rougeEquipe: '#A8E6F0', accent: '#E0F4FF' } },
  { id: 'volcan',        name: 'Volcan',           description: 'Lave sous la surface.',                price_cents: 249, currency: 'eur', config: { vertTerrain: '#1A0505', vertTerrainClair: '#260707', bleuEquipe: '#FF4500', rougeEquipe: '#8B0000', accent: '#FFA040' } },
  { id: 'cyber',         name: 'Cyber',            description: 'Matrix. Chaque déplacement trace.',    price_cents: 249, currency: 'eur', config: { vertTerrain: '#020A05', vertTerrainClair: '#031008', bleuEquipe: '#00FF41', rougeEquipe: '#39FF14', accent: '#ADFF2F' } },
  { id: 'terre-battue',  name: 'Terre battue',     description: 'Ambiance Roland-Garros au foot.',     price_cents: 249, currency: 'eur', config: { vertTerrain: '#A8542E', vertTerrainClair: '#BD663C', bleuEquipe: '#2B4C7E', rougeEquipe: '#7E2B2B', accent: '#F2C572' } },
  { id: 'crepuscule',    name: 'Crépuscule',       description: 'Dernières lueurs du jour.',            price_cents: 249, currency: 'eur', config: { vertTerrain: '#3D2645', vertTerrainClair: '#4F3358', bleuEquipe: '#7C9EFF', rougeEquipe: '#FF7C7C', accent: '#FFA552' } },
  { id: 'jungle',        name: 'Jungle',           description: 'Terrain englouti par la végétation.',  price_cents: 249, currency: 'eur', config: { vertTerrain: '#1B4332', vertTerrainClair: '#2D6A4F', bleuEquipe: '#52B788', rougeEquipe: '#D4A017', accent: '#95D5B2' } },
  { id: 'nuit-stade',    name: 'Nuit de stade',    description: 'Sous les projecteurs, nocturne.',      price_cents: 249, currency: 'eur', config: { vertTerrain: '#0B2818', vertTerrainClair: '#123420', bleuEquipe: '#4FC3F7', rougeEquipe: '#FFB74D', accent: '#FFD54F' } },
  { id: 'retro-8bit',    name: 'Rétro 8-bit',      description: 'Jeu vidéo années 80, plein écran.',   price_cents: 249, currency: 'eur', config: { vertTerrain: '#1A1A2E', vertTerrainClair: '#22223B', bleuEquipe: '#4ECDC4', rougeEquipe: '#FF6B6B', accent: '#FFE66D' } },
  { id: 'or-mondial',    name: 'Or Mondial',       description: "L'or du sommet, l'instant décisif.",   price_cents: 249, currency: 'eur', config: { vertTerrain: '#0F2818', vertTerrainClair: '#173820', bleuEquipe: '#1C3F66', rougeEquipe: '#C9A227', accent: '#F4D35E' }, isWorldCup: true },
  { id: 'samba',         name: 'Samba',            description: 'Jaune et vert, la fête sur la pelouse.', price_cents: 249, currency: 'eur', config: { vertTerrain: '#0B4D2C', vertTerrainClair: '#116B3D', bleuEquipe: '#1565C0', rougeEquipe: '#F9D923', accent: '#2E9E4F' }, isWorldCup: true },
  { id: 'tricolore',     name: 'Tricolore',        description: 'Bleu, blanc, rouge, droit vers la cage.', price_cents: 249, currency: 'eur', config: { vertTerrain: '#13294B', vertTerrainClair: '#1B3A66', bleuEquipe: '#1B3A66', rougeEquipe: '#C8102E', accent: '#F5F2E8' }, isWorldCup: true },
  { id: 'albiceleste',   name: 'Albiceleste',      description: 'Le ciel et la victoire.',              price_cents: 249, currency: 'eur', config: { vertTerrain: '#1B2A4A', vertTerrainClair: '#243A63', bleuEquipe: '#6CB4EE', rougeEquipe: '#F5F2E8', accent: '#FDB927' }, isWorldCup: true },
  { id: 'nuit-americaine', name: 'Nuit Américaine', description: "Sous les étoiles, l'été du tournoi.", price_cents: 249, currency: 'eur', config: { vertTerrain: '#0A1A33', vertTerrainClair: '#102448', bleuEquipe: '#3B5BA5', rougeEquipe: '#B22234', accent: '#F5F2E8' }, isWorldCup: true },
  { id: 'chalkboard',    name: 'Chalkboard',      description: 'Tableau tactique du coach — lignes à la craie, sobre et lisible.', price_cents: 0,   currency: 'eur', config: { vertTerrain: '#14231C', vertTerrainClair: '#16241D', bleuEquipe: '#6BA8FF', rougeEquipe: '#FF7A7A', accent: '#6FBF9A', skin: 'chalkboard' } },
  { id: 'stadium-night', name: 'Stadium Night',   description: 'Ambiance broadcast : pions lumineux, feuille de match en verre.',  price_cents: 249, currency: 'eur', config: { vertTerrain: '#0A1728', vertTerrainClair: '#0E2038', bleuEquipe: '#2563EB', rougeEquipe: '#DC2626', accent: '#FFD87A', skin: 'stadium-night' } },
  { id: 'arcade-turf',   name: 'Arcade Turf',     description: 'Pions chunky, ombres franches, énergie arcade.',                   price_cents: 249, currency: 'eur', config: { vertTerrain: '#178A3E', vertTerrainClair: '#1EA34A', bleuEquipe: '#2563EB', rougeEquipe: '#E11D48', accent: '#FACC15', skin: 'arcade-turf' } },
];

// ── Packs de pièces tactiques (prix vérifiés côté serveur) ─────────
const COIN_PACKS = [
  { id: 'coins-100', amount: 100, price_cents: 199, tag: '' },
  { id: 'coins-250', amount: 250, price_cents: 399, tag: 'POPULAIRE' },
  { id: 'coins-600', amount: 600, price_cents: 799, tag: 'MEILLEUR TAUX' }
];

// ── Données packs ──────────────────────────────────────────────────
const PACKS = [
  {
    id: 'pack-3-kits',
    name: '3 Kits au choix',
    description: 'Choisis 3 kits dans le catalogue, quand tu veux.',
    price_cents: 549,
    saves: '(—27 % vs 7,47 €)',
    // #344 (F9) : icônes SVG inline (stroke currentColor) au lieu d'emojis —
    // rendu identique sur tous les OS, cohérent avec le kit topbar/avatars.
    icon: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3a9 9 0 100 18h1.5a2 2 0 001.4-3.4c-.9-.9-.3-2.6 1-2.6H18a3 3 0 003-3c0-5-4-9-9-9z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><circle cx="8" cy="10" r="1.2" fill="currentColor"/><circle cx="12" cy="7.5" r="1.2" fill="currentColor"/><circle cx="16" cy="10" r="1.2" fill="currentColor"/></svg>'
  },
  {
    id: 'pack-academie',
    name: 'Pack Académie',
    description: '3 joueurs Rares avec pouvoir, à intégrer directement dans ton équipe.',
    price_cents: 499,
    saves: '(vs 8,97 €)',
    icon: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M13 2L5 13h6l-1 9 8-11h-6l1-9z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>'
  },
  {
    id: 'pack-legendes',
    name: 'Pack Légendes',
    description: '2 joueurs Légendaires — les plus puissants du catalogue.',
    price_cents: 799,
    saves: '(vs 9,98 €)',
    icon: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 8l4 4 4-6 4 6 4-4v9H4V8z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>'
  }
];

// ── Export principal ────────────────────────────────────────────────
export async function refreshThemeData() {
  try {
    const [themes, purchases] = await Promise.all([
      fetchActiveThemes(),
      fetchMyPurchases()
    ]);
    availableThemes   = themes;
    purchasedThemeIds = purchases.map(p => p.theme_id);
    return { themes, purchasedThemeIds, usedFallback: false };
  } catch {
    availableThemes   = FALLBACK_THEMES;
    purchasedThemeIds = [];
    return { themes: FALLBACK_THEMES, purchasedThemeIds: [], usedFallback: true };
  }
}

export function initShop(deps) {
  const { els } = deps;

  // Ouverture de la boutique
  els.shopBtn?.addEventListener('click', async () => {
    deps.rememberScreenContext();
    els.setupScreen?.classList.add('hidden');
    els.configScreen?.classList.add('hidden');
    els.gameScreen?.classList.add('hidden');
    els.profileScreen?.classList.add('hidden');
    els.shopScreen.classList.remove('hidden');
    await _loadShop(deps);
  });

  els.shopBackBtn?.addEventListener('click', () => {
    els.shopScreen.classList.add('hidden');
    deps.restoreScreenContext();
  });
}

// ── Chargement principal de la boutique ────────────────────────────
async function _loadShop(deps) {
  const { els } = deps;
  els.shopGrid.innerHTML = _skeleton();

  try {
    const [themeData, currency, pass, remaining, credits] = await Promise.all([
      refreshThemeData(),
      getCurrencyBalance(),
      getMyActivePass(),
      getFoundersRemaining(),
      getKitCredits()
    ]);

    availableThemes   = themeData.themes;
    purchasedThemeIds = themeData.purchasedThemeIds;
    coinBalance       = currency;
    kitCredits        = credits;
    activePass        = pass;
    foundersRemaining = remaining;
    activeThemeId     = deps.loadSavedThemeId();
  } catch (err) {
    console.error('[shop] chargement:', err);
  }

  _renderShop(deps);
}

// Refonte « SaaS-first » : l'objectif business est le récurrent (Pass Saison).
// L'architecture de choix converge vers le Pass : ancre Fondateurs compacte,
// Pass en tête de gondole, kits = showroom du Pass, pièces en modale
// contextuelle (plus de rayon permanent — le prompt arrive au moment du besoin).
function _renderShop(deps) {
  const { els } = deps;
  const sections = [];

  // 1. Pack Fondateurs — bandeau compact (ancre haute 9,99 €, sans dominer)
  if (foundersRemaining > 0) {
    sections.push(_renderFoundersPack(deps));
  }

  // 2. Pass Saison = tête de gondole (North Star : passes actifs / MRR)
  sections.push(_renderPasses(deps));

  // 3. Kits (showroom du Pass) + kit du jour en pièces + carte pack 3 kits
  sections.push(_renderKits(deps));

  // 4. Packs joueurs (Académie / Légendes) — candidats à un déménagement
  //    vers l'écran Équipe/Mercato (phase ultérieure)
  sections.push(_renderPacks(deps));

  els.shopGrid.innerHTML = '';
  sections.forEach(section => {
    if (section) els.shopGrid.appendChild(section);
  });
}

// ── Section 1 : Pack Fondateurs (bandeau compact) ──────────────────
// Refonte SaaS-first : l'ancien gros bloc ouvrait la boutique sur 9,99 € plein
// écran. Le bandeau garde l'ancre haute (door-in-the-face : le Pass à 1,99 €
// paraît dérisoire juste dessous) et la rareté, sans reléguer le Pass.
function _renderFoundersPack(deps) {
  const section = document.createElement('section');
  section.className = 'shop-section shop-founders-banner';

  const spotsLeft = Math.max(foundersRemaining, 0);

  section.innerHTML = `
    <span class="shop-section-tag shop-tag-limited">ÉDITION LIMITÉE</span>
    <div class="shop-founders-banner-text">
      <strong>Pack Fondateurs</strong> <span class="shop-founders-desc">— tous les kits actuels + 1 Légendaire exclusif + badge doré + Pass S1 inclus ·</span>
      <span class="shop-founders-left"><span id="foundersNum">${spotsLeft}</span> places restantes sur 200</span>
    </div>
    <button class="btn shop-founders-btn" id="buyFoundersPack">
      Devenir Fondateur — 9,99 €
    </button>
  `;

  section.querySelector('#buyFoundersPack')?.addEventListener('click', () =>
    _buyPack('pack-fondateurs', 'Pack Fondateurs', deps)
  );
  return section;
}

// ── Section 2 : Passes Saison ──────────────────────────────────────
function _renderPasses(deps) {
  const section = document.createElement('section');
  // shop-section-passes : cible du lien « voir le Pass » de la modale pièces.
  section.className = 'shop-section shop-section-passes';

  const hasPass = !!activePass;
  const passType = activePass?.pass_type;
  const periodEnd = activePass?.current_period_end
    ? new Date(activePass.current_period_end).toLocaleDateString('fr-FR')
    : null;

  // Price relativity : « 1 kit seul coûte plus cher qu'un mois de TOUT le
  // catalogue ». Calculé depuis les données (le prix des kits vient du
  // serveur : rien en dur qui pourrait diverger de la facturation).
  const paidKits = (availableThemes.length ? availableThemes : FALLBACK_THEMES)
    .filter(_isRealKit).filter(t => t.price_cents > 0);
  const minKitPrice = paidKits.length
    ? formatPrice(Math.min(...paidKits.map(t => t.price_cents)), 'eur')
    : null;

  section.innerHTML = `
    <div class="shop-section-header">
      <span class="shop-section-tag">ACCÈS ILLIMITÉ</span>
      <h2 class="shop-section-title">Pass Saison S1</h2>
      <p class="shop-section-desc">
        Tous les kits Saison 1 débloqués pendant l'abonnement + 1 joueur Rare offert +
        bonus XP +20% sur chaque partie. Annulable à tout moment.
      </p>
      ${hasPass
        ? `<p class="shop-pass-compare"><span>Ton pass débloque</span> ${paidKits.length} <span>kits en ce moment.</span></p>`
        : minKitPrice
        ? `<p class="shop-pass-compare"><span>Un kit seul :</span> ${minKitPrice} <span>· Le Pass : les</span> ${paidKits.length} <span>kits pour 1,99 €/mois.</span></p>`
        : ''}
    </div>
    <div class="shop-passes-grid">

      <div class="shop-pass-card ${passType === 'monthly' ? 'shop-pass-active' : ''}">
        <div class="shop-pass-label">MENSUEL</div>
        <div class="shop-pass-price">1,99 €<span class="shop-pass-period">/mois</span></div>
        <ul class="shop-pass-perks">
          <li>Tous les kits Saison 1</li>
          <li>1 joueur Rare offert</li>
          <li>XP +20%</li>
        </ul>
        ${hasPass && passType === 'monthly'
          ? `<div class="shop-pass-active-badge">Actif jusqu'au ${periodEnd}</div>`
          : `<button class="btn primary shop-pass-btn" data-pass="monthly">S'abonner</button>`}
      </div>

      <div class="shop-pass-card shop-pass-best ${passType === 'quarterly' ? 'shop-pass-active' : ''}">
        <div class="shop-pass-badge-best">MEILLEURE VALEUR</div>
        <div class="shop-pass-label">TRIMESTRIEL</div>
        <div class="shop-pass-price">3,99 €<span class="shop-pass-period">/3 mois</span></div>
        <!-- #psycho — Mental accounting : ramener au prix mensuel rend l'écart
             avec le mensuel (1,99 €) tangible. -->
        <div class="shop-pass-permonth">soit 1,33 €/mois</div>
        <div class="shop-pass-savings">Économise 33% vs mensuel</div>
        <ul class="shop-pass-perks">
          <li>Tous les kits Saison 1</li>
          <li>1 joueur Rare offert</li>
          <li>XP +20%</li>
          <li>Accès aux kits S2 en avant-première</li>
        </ul>
        ${hasPass && passType === 'quarterly'
          ? `<div class="shop-pass-active-badge">Actif jusqu'au ${periodEnd}</div>`
          : `<button class="btn primary shop-pass-btn" data-pass="quarterly">S'abonner</button>`}
      </div>

    </div>
  `;

  section.querySelectorAll('.shop-pass-btn').forEach(btn => {
    btn.addEventListener('click', () => _buyPass(btn.dataset.pass, deps));
  });

  return section;
}

// ── Section 3 : Packs groupés ──────────────────────────────────────
function _renderPacks(deps) {
  const section = document.createElement('section');
  section.className = 'shop-section';

  section.innerHTML = `
    <div class="shop-section-header">
      <span class="shop-section-tag">ÉQUIPE</span>
      <h2 class="shop-section-title">Packs Joueurs</h2>
      <p class="shop-section-desc">Renforce ton effectif — joueurs à pouvoir en groupe, au meilleur prix.</p>
    </div>
    <div class="shop-packs-grid"></div>
  `;

  const grid = section.querySelector('.shop-packs-grid');
  // Le pack « 3 kits au choix » vit désormais dans la grille Kits (même rayon
  // que ce qu'il vend) : ici, uniquement les packs de joueurs.
  PACKS.filter(p => p.id !== 'pack-3-kits').forEach(pack => {
    const card = document.createElement('div');
    card.className = 'shop-pack-card';
    card.innerHTML = `
      <div class="shop-pack-icon">${pack.icon}</div>
      <div class="shop-pack-name">${pack.name}</div>
      <div class="shop-pack-desc">${pack.description}</div>
      <div class="shop-pack-footer">
        <span class="shop-pack-price">${formatPrice(pack.price_cents, 'eur')}</span>
        <span class="shop-pack-saves">${pack.saves}</span>
      </div>
      <button class="btn primary shop-pack-btn">Acheter</button>
    `;
    card.querySelector('.shop-pack-btn').addEventListener('click', () =>
      _buyPack(pack.id, pack.name, deps)
    );
    grid.appendChild(card);
  });

  return section;
}

// ── Modale contextuelle de recharge de pièces ─────────────────────
// Remplace l'ancien rayon « Pièces » permanent : le prompt d'achat arrive au
// moment exact du besoin (clic sur un kit du jour sans solde suffisant), pas
// en rayonnage pour tout le monde (BJ Fogg : Motivation × Ability × Prompt).
function _showCoinTopUpModal(theme, deps) {
  const missing = COIN_KIT_COST - coinBalance;
  const overlay = document.createElement('div');
  overlay.className = 'coin-topup-overlay';
  overlay.innerHTML = `
    <div class="coin-topup-modal" role="dialog" aria-modal="true" aria-label="Recharger des pièces">
      <div class="coin-topup-title">Il te manque ${missing} pièce${missing > 1 ? 's' : ''}</div>
      <p class="coin-topup-sub">« ${theme.name} » coûte ${COIN_KIT_COST} pièces — tu en as ${coinBalance}.
        Continue à jouer (+10 victoire, +15 par défi)… ou recharge :</p>
      <div class="coin-topup-grid"></div>
      <button class="coin-topup-pass-link" type="button">ou le Pass Saison : tous les kits dès 1,33 €/mois →</button>
      <button class="btn coin-topup-close" type="button">Plus tard — je continue à jouer</button>
    </div>
  `;

  const close = () => overlay.remove();
  const grid = overlay.querySelector('.coin-topup-grid');
  COIN_PACKS.forEach(pack => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'coin-topup-pack';
    card.innerHTML = `
      <strong>${pack.amount} pièces</strong>
      ${pack.tag ? `<span class="coin-topup-tag">${pack.tag}</span>` : ''}
      <span class="coin-topup-price">${formatPrice(pack.price_cents, 'eur')}</span>
    `;
    card.addEventListener('click', () => { close(); _buyCoins(pack.id, deps); });
    grid.appendChild(card);
  });

  // Passerelle SaaS : depuis le manque de pièces vers l'offre récurrente.
  overlay.querySelector('.coin-topup-pass-link').addEventListener('click', () => {
    close();
    document.querySelector('.shop-section-passes')
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  overlay.querySelector('.coin-topup-close').addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  document.body.appendChild(overlay);
}

async function _buyCoins(packId, deps) {
  if (!deps.getCurrentUser()) { deps.openAccountForSignIn(); return; }
  try {
    const token = await getAccessToken();
    if (!token) throw new Error('Session expirée, reconnecte-toi.');
    const supabaseUrl = window.__PLATEAU_FOOT_CONFIG__?.supabaseUrl;
    const res = await fetch(`${supabaseUrl}/functions/v1/create-checkout-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ kind: 'coins', packId })
    });
    const data = await res.json();
    if (data.url) window.location.href = data.url;
    else showAlert(data.error || 'Impossible de créer la session de paiement.');
  } catch (err) {
    showAlert(err.message || 'Achat impossible pour le moment.');
  }
}

// ── Section 4 : Kits à l'unité + pièces ───────────────────────────
function _renderKits(deps) {
  const section = document.createElement('section');
  section.className = 'shop-section';

  const themes = (availableThemes.length ? availableThemes : FALLBACK_THEMES).filter(_isRealKit);

  // Sélection pièces : 3 kits non possédés, stables sur la journée (seed date)
  const today   = new Date().toDateString();
  const seed    = today.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const locked  = themes.filter(t => t.price_cents > 0 && !purchasedThemeIds.includes(t.id));
  const coinKits = _seededPick(locked, 3, seed);

  section.innerHTML = `
    <div class="shop-section-header">
      <span class="shop-section-tag">KITS À L'UNITÉ</span>
      <h2 class="shop-section-title">Kits</h2>
      ${kitCredits > 0 ? `<p class="shop-section-desc">🎟 Tu as <strong>${kitCredits} crédit${kitCredits > 1 ? 's' : ''} kit</strong> à dépenser — choisis librement ci-dessous.</p>` : ''}
    </div>

    ${coinKits.length > 0 ? `
    <div class="shop-coins-header">
      <div class="shop-coins-info">
        <svg width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="8" r="7" fill="#C8841A"/><text x="8" y="12" font-size="9" font-weight="900" fill="#0C0A07" text-anchor="middle" font-family="'Barlow Condensed',sans-serif">P</text></svg>
        <strong>Kits du jour — ${COIN_KIT_COST} pièces</strong> · rotation quotidienne ·
        ton solde : <strong>${coinBalance} pièce${coinBalance > 1 ? 's' : ''}</strong>
        ${coinBalance < COIN_KIT_COST
          ? `<span class="shop-coins-goal">🎯 Plus que ${COIN_KIT_COST - coinBalance} pièce${(COIN_KIT_COST - coinBalance) > 1 ? 's' : ''} pour ton prochain kit</span>`
          : ''}
        <span class="shop-coins-hint">+10 par victoire, +3 par défaite, +15 par défi</span>
      </div>
      <div class="shop-coins-grid" id="coinKitsGrid"></div>
    </div>
    ` : ''}

    <div class="shop-kits-grid" id="shopKitsGrid"></div>
  `;

  // Remplir les kits pièces
  if (coinKits.length > 0) {
    const coinGrid = section.querySelector('#coinKitsGrid');
    coinKits.forEach(theme => {
      const card = _buildKitCard(theme, deps, { coinMode: true });
      coinGrid.appendChild(card);
    });
  }

  // Remplir tous les kits — sans dupliquer ceux déjà proposés en
  // "kit du jour" juste au-dessus (ils réapparaîtront dans la grille
  // normale dès demain, à la rotation suivante).
  const coinKitIds = coinKits.map(t => t.id);
  const kitsGrid = section.querySelector('#shopKitsGrid');
  // #C3 — le kit recommandé remonte en tête (s'il est présent et non déjà en
  // "kit du jour"), pour offrir un point d'entrée clair dans une longue grille.
  const gridThemes = themes.filter(t => !coinKitIds.includes(t.id));
  gridThemes.sort((a, b) =>
    (b.id === RECOMMENDED_KIT_ID ? 1 : 0) - (a.id === RECOMMENDED_KIT_ID ? 1 : 0));
  const cards = gridThemes.map(theme => _buildKitCard(theme, deps, { coinMode: false }));
  // Le pack « 3 kits au choix » s'insère dans le rayon qu'il concerne, en 2e
  // position (après le kit recommandé) — plus de section « Packs » fourre-tout.
  const packCard = _buildKitPackCard(deps);
  if (packCard) cards.splice(Math.min(1, cards.length), 0, packCard);
  cards.forEach(card => kitsGrid.appendChild(card));

  return section;
}

// ── Carte « pack 3 kits » dans la grille des kits ─────────────────
// Classe de bouton distincte de .shop-kit-buy-btn : l'e2e Stripe opt-in cible
// « le premier .shop-kit-buy-btn » et doit continuer de tomber sur un vrai kit.
function _buildKitPackCard(deps) {
  const pack = PACKS.find(p => p.id === 'pack-3-kits');
  if (!pack) return null;
  const card = document.createElement('div');
  card.className = 'shop-kit-card shop-kit-pack';
  card.innerHTML = `
    <div class="shop-kit-preview shop-kit-pack-preview">${pack.icon}</div>
    <div class="shop-kit-body">
      <div class="shop-kit-name">${pack.name}</div>
      <div class="shop-kit-desc">${pack.description} <span class="shop-pack-saves">${pack.saves}</span></div>
      <div class="shop-kit-footer">
        <button class="btn primary shop-kit-pack-btn">${formatPrice(pack.price_cents, 'eur')}</button>
      </div>
    </div>
  `;
  card.querySelector('.shop-kit-pack-btn').addEventListener('click', () =>
    _buyPack(pack.id, pack.name, deps)
  );
  return card;
}

// ── Constructeur d'une carte de kit ───────────────────────────────
function _buildKitCard(theme, deps, { coinMode }) {
  const purchased      = purchasedThemeIds.includes(theme.id) || theme.price_cents === 0;
  // Le Pass Saison débloque RÉELLEMENT les kits payants (promesse de la
  // boutique) : sélectionnables tant que le pass est actif.
  const unlockedByPass = !!activePass && theme.price_cents > 0 && !purchased;
  const owned          = purchased || unlockedByPass;
  const isActive       = theme.id === activeThemeId;
  const hasCoin        = coinMode;
  // #C3 — mise en avant éditoriale (uniquement si non possédé/non actif et hors
  // "kit du jour" en pièces, pour ne pas surcharger cette rangée).
  const isReco         = theme.id === RECOMMENDED_KIT_ID && !owned && !isActive && !coinMode;

  const card = document.createElement('div');
  card.className = 'shop-kit-card' + (isActive ? ' shop-kit-active' : '') + (owned ? ' shop-kit-owned' : '') + (isReco ? ' shop-kit-reco' : '');

  // Prévisualisation couleur
  const bg  = theme.config?.vertTerrain ?? '#1F3D2B';
  const acc = theme.config?.accent ?? '#C97B4A';

  card.innerHTML = `
    <div class="shop-kit-preview" style="background:${bg}">
      ${isReco ? '<span class="shop-kit-reco-badge">Recommandé</span>' : ''}
      <div class="shop-kit-preview-lines" style="--acc:${acc}"></div>
      <div class="shop-kit-preview-ball"></div>
    </div>
    <div class="shop-kit-body">
      <div class="shop-kit-name">${theme.name}</div>
      <div class="shop-kit-desc">${theme.description}</div>
      <div class="shop-kit-footer">
        ${isActive
          ? '<span class="shop-kit-badge shop-kit-badge-active">Actif</span>'
          : unlockedByPass
          ? '<span class="shop-kit-badge shop-kit-badge-pass">Inclus dans ton pass</span>'
          : owned
          ? '<span class="shop-kit-badge shop-kit-badge-owned">Débloqué</span>'
          : kitCredits > 0
          ? '<button class="btn shop-kit-credit-btn">🎟 Utiliser 1 crédit</button>'
          : hasCoin
          ? `<button class="btn shop-kit-coin-btn"><svg width="12" height="12" viewBox="0 0 16 16"><circle cx="8" cy="8" r="7" fill="#C8841A"/><text x="8" y="12" font-size="9" font-weight="900" fill="#0C0A07" text-anchor="middle" font-family="'Barlow Condensed',sans-serif">P</text></svg> ${COIN_KIT_COST} pièces</button>`
          : theme.price_cents === 0
          ? '<span class="shop-kit-badge shop-kit-badge-free">Gratuit</span>'
          : `<button class="btn primary shop-kit-buy-btn">${formatPrice(theme.price_cents, theme.currency ?? 'eur')}</button>
             <span class="shop-kit-pass-hint">Inclus dans le Pass</span>`
        }
        ${owned && !isActive
          ? '<button class="btn shop-kit-select-btn">Sélectionner</button>'
          : ''}
      </div>
    </div>
  `;

  // Actions
  card.querySelector('.shop-kit-buy-btn')?.addEventListener('click', () =>
    _buyKit(theme, deps)
  );
  card.querySelector('.shop-kit-coin-btn')?.addEventListener('click', () =>
    _buyWithCoins(theme, deps)
  );
  card.querySelector('.shop-kit-credit-btn')?.addEventListener('click', () =>
    _buyWithCredit(theme, deps)
  );
  card.querySelector('.shop-kit-select-btn')?.addEventListener('click', () =>
    _selectKit(theme, deps, card)
  );

  return card;
}

// ── Actions d'achat ────────────────────────────────────────────────
async function _buyKit(theme, deps) {
  if (!deps.getCurrentUser()) { deps.openAccountForSignIn(); return; }
  try {
    const result = await checkoutTheme(theme, deps.getCurrentUser());
    if (result.redirectUrl) { window.location.href = result.redirectUrl; return; }
    if (result.immediate) {
      purchasedThemeIds.push(theme.id);
      _selectKit(theme, deps);
      _renderShop(deps);
    }
  } catch (err) {
    showAlert(err.message || 'Achat impossible pour le moment.');
  }
}

async function _buyWithCoins(theme, deps) {
  if (!deps.getCurrentUser()) { deps.openAccountForSignIn(); return; }
  if (coinBalance < COIN_KIT_COST) {
    // Solde insuffisant → modale de recharge contextuelle (remplace l'ancienne
    // alerte sèche ET l'ancien rayon « Pièces » permanent).
    _showCoinTopUpModal(theme, deps);
    return;
  }
  if (!(await showConfirm(`Débloquer "${theme.name}" pour ${COIN_KIT_COST} pièces ?`, { okLabel: 'Débloquer' }))) return;
  try {
    // Atomique et persisté côté serveur (débit + ligne d'achat en une
    // transaction) — le kit reste débloqué après rechargement.
    const newBalance = await unlockThemeWithCoins(theme.id);
    coinBalance = newBalance;
    // Rafraîchit aussi le compteur de la topbar (géré par main.js) : sans
    // ça, l'ancien solde restait affiché après l'achat.
    deps.updateCoinDisplay?.(newBalance);
    purchasedThemeIds.push(theme.id);
    _selectKit(theme, deps);
    _renderShop(deps);
    // #C2 — moment de satisfaction (Peak-End Rule / Regret aversion) : sans ça,
    // l'achat se fondait dans un simple re-render.
    showToast(`🎉 Kit « ${theme.name} » débloqué et appliqué !`);
  } catch (err) {
    showAlert(err.message || 'Achat impossible pour le moment.');
  }
}

async function _buyWithCredit(theme, deps) {
  if (!deps.getCurrentUser()) { deps.openAccountForSignIn(); return; }
  if (!(await showConfirm(`Utiliser 1 crédit kit pour débloquer "${theme.name}" ?`, { okLabel: 'Utiliser 1 crédit' }))) return;
  try {
    const remaining = await redeemKitCredit(theme.id);
    kitCredits = remaining;
    purchasedThemeIds.push(theme.id);
    _selectKit(theme, deps);
    _renderShop(deps);
    showToast(`🎉 Kit « ${theme.name} » débloqué et appliqué !`); // #C2 peak-end
  } catch (err) {
    showAlert(err.message || 'Achat impossible pour le moment.');
  }
}

async function _buyPass(passType, deps) {
  if (!deps.getCurrentUser()) { deps.openAccountForSignIn(); return; }
  try {
    const token = await getAccessToken();
    if (!token) throw new Error('Session expirée, reconnecte-toi.');
    const supabaseUrl = window.__PLATEAU_FOOT_CONFIG__?.supabaseUrl;
    const res = await fetch(`${supabaseUrl}/functions/v1/create-checkout-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ kind: 'pass', passType })
    });
    const data = await res.json();
    if (data.url) window.location.href = data.url;
    else showAlert(data.error || 'Impossible de créer la session de paiement.');
  } catch (err) {
    showAlert(err.message || 'Achat impossible pour le moment.');
  }
}

async function _buyPack(packId, packName, deps) {
  if (!deps.getCurrentUser()) { deps.openAccountForSignIn(); return; }
  try {
    const token = await getAccessToken();
    if (!token) throw new Error('Session expirée, reconnecte-toi.');
    const supabaseUrl = window.__PLATEAU_FOOT_CONFIG__?.supabaseUrl;
    const res = await fetch(`${supabaseUrl}/functions/v1/create-checkout-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ kind: 'pack', packId })
    });
    const data = await res.json();
    if (data.url) window.location.href = data.url;
    else showAlert(data.error || 'Impossible de créer la session de paiement.');
  } catch (err) {
    showAlert(err.message || 'Achat impossible pour le moment.');
  }
}

function _selectKit(theme, deps, card) {
  activeThemeId = theme.id;
  deps.saveActiveTheme(theme.id, theme.config);
  applyTheme(theme.config);
  _renderShop(deps);
}

// ── Utilitaires ────────────────────────────────────────────────────
function _seededPick(arr, n, seed) {
  if (arr.length <= n) return arr.slice(0, n);
  const result = [];
  let s = seed;
  const pool = [...arr];
  while (result.length < n && pool.length > 0) {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    const idx = Math.abs(s) % pool.length;
    result.push(pool.splice(idx, 1)[0]);
  }
  return result;
}

function _skeleton() {
  return `<div class="shop-skeleton">
    ${[1,2,3].map(() => `<div class="skeleton-card">
      <div class="skeleton skeleton-line medium" style="height:120px"></div>
      <div class="skeleton skeleton-line short" style="margin-top:8px"></div>
      <div class="skeleton skeleton-line long"></div>
    </div>`).join('')}
  </div>`;
}
