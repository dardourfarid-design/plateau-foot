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

// Kits disponibles via pièces (sélection aléatoire quotidienne stable)
const COIN_KIT_COST = 100;

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
    icon: '🎨'
  },
  {
    id: 'pack-academie',
    name: 'Pack Académie',
    description: '3 joueurs Rares avec pouvoir, à intégrer directement dans ton équipe.',
    price_cents: 499,
    saves: '(vs 8,97 €)',
    icon: '⚡'
  },
  {
    id: 'pack-legendes',
    name: 'Pack Légendes',
    description: '2 joueurs Légendaires — les plus puissants du catalogue.',
    price_cents: 799,
    saves: '(vs 9,98 €)',
    icon: '👑'
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

function _renderShop(deps) {
  const { els } = deps;
  const sections = [];

  // 1. Pack Fondateurs (si encore disponible)
  if (foundersRemaining > 0) {
    sections.push(_renderFoundersPack(deps));
  }

  // 2. Passes Saison
  sections.push(_renderPasses(deps));

  // 3. Kits (cœur de l'offre) + kit du jour en pièces
  sections.push(_renderKits(deps));

  // 4. Pièces tactiques (le moyen de gagner les kits du jour)
  sections.push(_renderCoinPacks(deps));

  // 5. Packs groupés
  sections.push(_renderPacks(deps));

  els.shopGrid.innerHTML = '';
  sections.forEach(section => {
    if (section) els.shopGrid.appendChild(section);
  });
}

// ── Section 1 : Pack Fondateurs ────────────────────────────────────
function _renderFoundersPack(deps) {
  const section = document.createElement('section');
  section.className = 'shop-section shop-section-founders';

  const spotsLeft = Math.max(foundersRemaining, 0);

  section.innerHTML = `
    <div class="shop-section-header">
      <span class="shop-section-tag shop-tag-limited">ÉDITION LIMITÉE</span>
      <h2 class="shop-section-title">Pack Fondateurs</h2>
      <p class="shop-section-desc">
        Accès complet à tous les kits actuels + 1 joueur Légendaire exclusif
        "Fondateur" introuvable nulle part ailleurs + badge doré permanent sur
        ton profil + ton nom dans les crédits du jeu.
      </p>
    </div>

    <div class="founders-counter">
      <div class="founders-counter-num" id="foundersNum">${spotsLeft}</div>
      <div class="founders-counter-label">places restantes sur 200</div>
      <div class="founders-counter-bar">
        <div class="founders-counter-fill" style="width:${((200 - spotsLeft) / 200) * 100}%"></div>
      </div>
    </div>

    <div class="founders-perks">
      <div class="founders-perk">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 1l1.8 5.5H15L10.2 10l1.8 5.5L8 12.3 4 15.5l1.8-5.5L1 6.5h5.2z" fill="#FFD87A"/></svg>
        Tous les kits actuels débloqués — et ceux de la Saison 1 à venir
      </div>
      <div class="founders-perk">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 2l1.5 4.5H14L10.2 9l1.5 4.5L8 11.2 4.3 13.5 5.8 9 2 6.5h4.5z" fill="#9B6BFF"/></svg>
        1 joueur Légendaire exclusif — pouvoir Tir Puissant
      </div>
      <div class="founders-perk">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2" y="2" width="12" height="12" rx="2" stroke="#C8841A" stroke-width="1.5"/><path d="M5 8l2 2 4-4" stroke="#C8841A" stroke-width="1.5" stroke-linecap="round"/></svg>
        Badge FONDATEUR doré — visible par tous
      </div>
      <div class="founders-perk">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="#1FA86B" stroke-width="1.5"/><path d="M5 8l2 2 4-4" stroke="#1FA86B" stroke-width="1.5" stroke-linecap="round"/></svg>
        Pass Saison S1 inclus (valeur 3,99 €)
      </div>
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
  section.className = 'shop-section';

  const hasPass = !!activePass;
  const passType = activePass?.pass_type;
  const periodEnd = activePass?.current_period_end
    ? new Date(activePass.current_period_end).toLocaleDateString('fr-FR')
    : null;

  section.innerHTML = `
    <div class="shop-section-header">
      <span class="shop-section-tag">ACCÈS ILLIMITÉ</span>
      <h2 class="shop-section-title">Pass Saison S1</h2>
      <p class="shop-section-desc">
        Tous les kits Saison 1 débloqués pendant l'abonnement + 1 joueur Rare offert +
        bonus XP +20% sur chaque partie. Annulable à tout moment.
      </p>
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
        <div class="shop-pass-savings">Économise 35% vs mensuel</div>
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
      <span class="shop-section-tag">PACKS</span>
      <h2 class="shop-section-title">Packs</h2>
      <p class="shop-section-desc">Groupes de contenu — meilleur rapport qualité/prix.</p>
    </div>
    <div class="shop-packs-grid"></div>
  `;

  const grid = section.querySelector('.shop-packs-grid');
  PACKS.forEach(pack => {
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

// ── Section 3bis : Packs de pièces tactiques ──────────────────────
function _renderCoinPacks(deps) {
  const section = document.createElement('section');
  section.className = 'shop-section';

  section.innerHTML = `
    <div class="shop-section-header">
      <span class="shop-section-tag">PIÈCES TACTIQUES</span>
      <h2 class="shop-section-title">Pièces</h2>
      <p class="shop-section-desc">
        Ton solde : <strong>${coinBalance} pièce${coinBalance > 1 ? 's' : ''}</strong>.
        Tu en gagnes à chaque partie (+10 victoire, +3 défaite, +15 par défi du jour) —
        ou recharge instantanément avec un pack.
      </p>
    </div>
    <div class="shop-packs-grid shop-coins-packs-grid"></div>
  `;

  const grid = section.querySelector('.shop-coins-packs-grid');
  COIN_PACKS.forEach(pack => {
    const card = document.createElement('div');
    card.className = 'shop-pack-card';
    card.innerHTML = `
      ${pack.tag ? `<div class="shop-pass-badge-best">${pack.tag}</div>` : ''}
      <div class="shop-pack-icon"><svg width="28" height="28" viewBox="0 0 16 16"><circle cx="8" cy="8" r="7" fill="#C8841A"/><text x="8" y="12" font-size="9" font-weight="900" fill="#0C0A07" text-anchor="middle" font-family="'Barlow Condensed',sans-serif">P</text></svg></div>
      <div class="shop-pack-name">${pack.amount} pièces</div>
      <div class="shop-pack-desc">${Math.floor(pack.amount / COIN_KIT_COST) > 1
        ? `Soit ${Math.floor(pack.amount / COIN_KIT_COST)} kits du jour, ou garde-les pour la suite.`
        : 'Soit 1 kit du jour, ou garde-les pour la suite.'}</div>
      <div class="shop-pack-footer">
        <span class="shop-pack-price">${formatPrice(pack.price_cents, 'eur')}</span>
      </div>
      <button class="btn primary shop-pack-btn">Acheter</button>
    `;
    card.querySelector('.shop-pack-btn').addEventListener('click', () =>
      _buyCoins(pack.id, deps)
    );
    grid.appendChild(card);
  });

  return section;
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
  themes.filter(t => !coinKitIds.includes(t.id)).forEach(theme => {
    const card = _buildKitCard(theme, deps, { coinMode: false });
    kitsGrid.appendChild(card);
  });

  return section;
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

  const card = document.createElement('div');
  card.className = 'shop-kit-card' + (isActive ? ' shop-kit-active' : '') + (owned ? ' shop-kit-owned' : '');

  // Prévisualisation couleur
  const bg  = theme.config?.vertTerrain ?? '#1F3D2B';
  const acc = theme.config?.accent ?? '#C97B4A';

  card.innerHTML = `
    <div class="shop-kit-preview" style="background:${bg}">
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
          : `<button class="btn primary shop-kit-buy-btn">${formatPrice(theme.price_cents, theme.currency ?? 'eur')}</button>`
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
    showAlert(`Il te faut ${COIN_KIT_COST} pièces. Tu en as ${coinBalance}.\nGagne des pièces en remportant des parties !`, { title: 'Pas assez de pièces' });
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
