
/**
 * Construit une carte joueur au format TCG japonais : avatar, numéro de
 * maillot, badge de position, nom, style, stats VIT/TIR, badge de rareté,
 * badge de pouvoir si applicable, badge "Aligné" si assigné.
 *
 * @param {object} owned   — données du joueur (format player_ownership ou ownedShape)
 * @param {object} options — { deps, idx, isOwned, assignedIds }
 */
function _buildPlayerCard(owned, { deps, idx = 0, isOwned = true, assignedIds = new Set() }) {
  const rarity = owned.isCustom ? 'custom' : owned.fictional_players.rarity;
  const playerName = owned.custom_name || (owned.isCustom ? owned.name : owned.fictional_players.name);
  const playerStyle = owned.isCustom ? owned.style : owned.fictional_players.style;
  const hasPower = !!(owned.power || owned.fictional_players?.power);
  const powerKey = owned.power || owned.fictional_players?.power;

  const card = document.createElement('div');
  card.className = `player-card rarity-${rarity}` + (assignedIds.has(owned.id) ? ' assigned' : '');
  card.dataset.ownershipId = owned.id;

  // Badge "Aligné" (z-index 3 — par-dessus tout)
  if (assignedIds.has(owned.id)) {
    const aligned = document.createElement('span');
    aligned.className = 'player-card-assigned-badge';
    aligned.textContent = 'Aligné';
    card.appendChild(aligned);
  }

  const inner = document.createElement('div');
  inner.className = 'player-card-inner';

  // --- Header : avatar + numéro + badge position ---
  const header = document.createElement('div');
  header.className = 'player-card-header';

  const avatarWrap = document.createElement('div');
  avatarWrap.className = 'player-card-avatar-wrap';

  const avatarSvg = owned.isCustom
    ? deps.renderAvatarSvg({ color: owned.avatar_color, pattern: owned.avatar_pattern, accessory: owned.avatar_accessory })
    : deps.renderAvatarSvg(deps.hashSeedToAvatar(owned.fictional_players.avatar_seed));
  avatarWrap.innerHTML = avatarSvg;

  // Numéro de maillot déterministe
  const jerseyNum = document.createElement('span');
  jerseyNum.className = 'player-card-jersey';
  jerseyNum.textContent = (idx % 11) + 1;
  avatarWrap.appendChild(jerseyNum);

  header.appendChild(avatarWrap);

  // Badge de position
  const posEl = document.createElement('span');
  posEl.className = 'player-card-pos';
  posEl.textContent = _positionFromStyle(playerStyle);
  header.appendChild(posEl);

  inner.appendChild(header);

  // --- Nom + style ---
  const nameEl = document.createElement('div');
  nameEl.className = 'player-card-name';
  nameEl.textContent = playerName;
  inner.appendChild(nameEl);

  const styleEl = document.createElement('div');
  styleEl.className = 'player-card-style';
  styleEl.textContent = playerStyle || '';
  inner.appendChild(styleEl);

  // --- Stats VIT / TIR (déterministes depuis le nom) ---
  const statsEl = document.createElement('div');
  statsEl.className = 'player-card-stats';
  const vit = _statFromSeed(playerName, 7);
  const tir = _statFromSeed(playerName, 13);
  statsEl.innerHTML = `
    <div class="player-card-stat">
      <span class="player-card-stat-label">VIT</span>
      <span class="player-card-stat-val">${vit}</span>
    </div>
    <div class="player-card-stat">
      <span class="player-card-stat-label">TIR</span>
      <span class="player-card-stat-val">${tir}</span>
    </div>`;
  inner.appendChild(statsEl);

  // --- Footer : rareté + badge pouvoir ---
  const footer = document.createElement('div');
  footer.className = 'player-card-footer';

  const rarityEl = document.createElement('span');
  rarityEl.className = 'player-card-rarity';
  rarityEl.textContent = owned.isCustom ? 'PERSO' : rarity.toUpperCase();
  footer.appendChild(rarityEl);

  if (hasPower && powerKey) {
    const powerBadge = document.createElement('span');
    powerBadge.className = 'player-card-power-badge';
    powerBadge.innerHTML = (POWER_ICONS_CARD[powerKey] || '') + (deps.POWER_LABELS?.[powerKey] || powerKey);
    footer.appendChild(powerBadge);
  }

  inner.appendChild(footer);
  card.appendChild(inner);
  return card;
}

/**
 * Applique un effet de rotation 3D subtil à une carte au passage de la
 * souris : la carte s'incline légèrement vers la direction du curseur,
 * donnant une impression de relief et de matérialité à l'objet.
 */
function _applyCard3DHover(card) {
  card.addEventListener('mousemove', e => {
    const rect = card.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = (e.clientX - cx) / (rect.width / 2);
    const dy = (e.clientY - cy) / (rect.height / 2);
    card.style.transform = `perspective(600px) rotateX(${-dy * 6}deg) rotateY(${dx * 6}deg) translateY(-2px)`;
  });
  card.addEventListener('mouseleave', () => {
    card.style.transform = '';
  });
}

// ===================== PROFIL UI =====================
// Gère tout l'écran profil : onglets progression / défis / équipe /
// leaderboard, composition d'équipe (drag & drop), collection de joueurs,
// boutique de joueurs à pouvoir, et création de joueurs personnalisés.
//
// Pattern d'isolation identique à shopUI.js :
//   - Aucun accès aux globales de main.js.
//   - Tout ce qui est transverse (utilisateur courant, navigation entre
//     écrans, paiement) est reçu via l'objet `deps` passé par main.js.
//   - Les fonctions que main.js (ou mercatoUI.js) doivent appeler après
//     l'initialisation sont retournées explicitement par initProfile().
//
// Dépendances croisées (gérées dans main.js, pas ici) :
//   - switchProfileTab dans main.js appelle loadMercatoPanel (mercatoUI)
//     ET loadTeamPanel (retourné ici) — main.js orchestre les deux.
//   - mercatoUI.js reçoit toOwnedShape et loadTeamPanel dans ses propres
//     deps, fournis par main.js depuis les retours d'initProfile().

// ---------- État local ----------

let myCollectionCache = [];
let myCustomPlayersCache = [];
let myLineupCache = null;
let newPlayerDraft = { style: 'rapide', color: null, pattern: 'plain', accessory: 'none' };

// ---------- Constantes ----------

// Génère des cartes squelettes pendant le chargement des données.
// Remplace les textes "Chargement…" par une animation qui donne une
// idée de la structure à venir, sans bloquer visuellement l'écran.
function _skeletonCards(count = 4, size = 'normal') {
  return Array.from({ length: count }).map(() => {
    if (size === 'small') {
      return `<div class="skeleton-card">
        <div class="skeleton skeleton-line medium"></div>
        <div class="skeleton skeleton-line short"></div>
      </div>`;
    }
    return `<div class="skeleton-card">
      <div style="display:flex;gap:8px;align-items:flex-start;margin-bottom:8px">
        <div class="skeleton skeleton-circle"></div>
        <div style="flex:1;display:flex;flex-direction:column;gap:6px;padding-top:4px">
          <div class="skeleton skeleton-line medium"></div>
          <div class="skeleton skeleton-line short"></div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-bottom:8px">
        <div class="skeleton skeleton-line long" style="height:28px"></div>
        <div class="skeleton skeleton-line long" style="height:28px"></div>
      </div>
      <div class="skeleton skeleton-badge"></div>
    </div>`;
  }).join('');
}

const LINEUP_SLOT_LABELS = {
  gk: 'Gardien', def0: 'Défenseur 1', def1: 'Défenseur 2',
  att0: 'Attaquant 1', att1: 'Attaquant 2', att2: 'Attaquant 3'
};

// ---------- Utilitaires d'état partageable ----------

/**
 * Normalise la forme d'un joueur personnalisé (custom_players) pour qu'elle
 * soit compatible avec celle d'un player_ownership classique, permettant à
 * renderLineupSlots/renderCollectionGrid de traiter les deux sources
 * de façon uniforme malgré leur structure de données différente.
 * Exporté et passé comme dep à mercatoUI, qui en a aussi besoin.
 */
export function toOwnedShape(customPlayer) {
  // ---------- Indicateur glissant d'onglet ----------

  function _initTabIndicator(els) {
    const tabsContainer = els.profileTabs;
    if (!tabsContainer) return;
    const indicator = document.createElement('div');
    indicator.className = 'tab-indicator';
    tabsContainer.appendChild(indicator);
    // Positionner immédiatement sur l'onglet actif
    const active = tabsContainer.querySelector('.profile-tab.active');
    if (active) _moveTabIndicator(indicator, active);
    // Écouter les clics sur les onglets pour déplacer l'indicateur
    tabsContainer.querySelectorAll('.profile-tab').forEach(tab => {
      tab.addEventListener('click', () => _moveTabIndicator(indicator, tab));
    });
  }

  function _moveTabIndicator(indicator, activeTab) {
    const container = activeTab.closest('.profile-tabs');
    if (!container || !indicator) return;
    const containerRect = container.getBoundingClientRect();
    const tabRect = activeTab.getBoundingClientRect();
    indicator.style.left = (tabRect.left - containerRect.left) + 'px';
    indicator.style.width = tabRect.width + 'px';
  }

  return {
    id: customPlayer.id,
    isCustom: true,
    custom_name: null,
    name: customPlayer.name,
    style: customPlayer.style,
    avatar_color: customPlayer.avatar_color,
    avatar_pattern: customPlayer.avatar_pattern,
    avatar_accessory: customPlayer.avatar_accessory
  };
}

/**
 * Liste combinée et uniforme de tous les joueurs possédés (catalogue +
 * créations personnalisées). Source de vérité unique pour éviter que les
 * joueurs custom soient invisibles dans la composition d'équipe.
 */
function getAllOwnedPlayers() {
  return [...myCollectionCache, ...myCustomPlayersCache.map(toOwnedShape)];
}

/**
 * Détermine l'avatar à afficher pour un joueur possédé.
 * Joueur custom → avatar choisi explicitement.
 * Joueur catalogue → avatar dérivé de façon déterministe depuis avatar_seed.
 */
export function avatarForOwned(owned, deps) {
  if (owned.isCustom) {
    return { color: owned.avatar_color, pattern: owned.avatar_pattern, accessory: owned.avatar_accessory };
  }
  return deps.hashSeedToAvatar(owned.fictional_players.avatar_seed);
}

// ---------- Point d'entrée ----------

/**
 * Initialise le module profil : branche les écouteurs d'événements et
 * retourne les fonctions que main.js et mercatoUI.js doivent appeler
 * de l'extérieur.
 *
 * @param {object} deps
 *   els                      — objet des références DOM (cacheDomRefs)
 *   getCurrentUser           — () => currentUser (getter, pas valeur)
 *   openAccountOverlay       — () => void, pour rediriger vers connexion
 *   checkoutTheme            — fn de paiement (mock ou Stripe)
 *   renderAvatarSvg          — fn de rendu SVG avatar
 *   hashSeedToAvatar         — fn de dérivation avatar depuis seed
 *   AVATAR_COLORS            — tableau de couleurs disponibles
 *   POWER_LABELS             — { [powerType]: string }
 *   CUSTOM_PLAYER_SLOT_THEME_ID — id du "thème factice" pour achat de slot
 *   fetchMyProgress, fetchTodayChallenges, claimLevelRewards
 *   fetchMyCollection, fetchMyLineup, fetchMyCustomPlayers, saveLineup
 *   createCustomPlayer, fetchPlayerCatalog, purchasePlayer
 *   ensureStarterPack, fetchLeaderboard
 */
export function initProfile(deps) {
  const { els } = deps;

  // Couleur par défaut du brouillon de création de joueur
  newPlayerDraft.color = deps.AVATAR_COLORS[0];

  // ----- Boutons de l'écran profil -----
  els.profileBtn?.addEventListener('click', openProfileScreen);
  els.profileBackBtn?.addEventListener('click', () => {
    els.profileScreen.classList.add('hidden');
    els.setupScreen.classList.remove('hidden');
  });
  els.saveLineupBtn?.addEventListener('click', () => handleSaveLineup(deps));

  // ----- Indicateur d'onglet glissant -----
  // Crée une div absolue sous les onglets qui se translate horizontalement
  // vers l'onglet actif — animé via transition CSS (voir styles.css .tab-indicator).
  _initTabIndicator(els);

  // ----- Création de joueur personnalisé -----
  _wireCreatePlayer(deps);

  return {
    /** Charge l'onglet progression et affiche l'écran profil. */
    openProfileScreen: () => openProfileScreen(deps),
    /** À appeler depuis switchProfileTab dans main.js. */
    loadProgressPanel: () => loadProgressPanel(deps),
    loadChallengesPanel: () => loadChallengesPanel(deps),
    loadTeamPanel: () => loadTeamPanel(deps),
    loadLeaderboardPanel: () => loadLeaderboardPanel(deps),
    /** Exposé pour mercatoUI (recharge la collection après un échange). */
    toOwnedShape
  };

  // ---------- Navigation ----------

  async function openProfileScreen(deps) {
    if (!deps.getCurrentUser()) {
      deps.openAccountOverlay();
      return;
    }
    els.setupScreen.classList.add('hidden');
    els.configScreen.classList.add('hidden');
    els.gameScreen.classList.add('hidden');
    els.shopScreen.classList.add('hidden');
    els.profileScreen.classList.remove('hidden');
    await loadProgressPanel(deps);
  }

  // ---------- Onglet Progression ----------

  async function loadProgressPanel(deps) {
    try {
      await deps.ensureStarterPack();
      const progress = await deps.fetchMyProgress();
      els.progressEmptyNote.classList.toggle('hidden', !!progress);
      els.progressLevel.textContent = progress?.level ?? 1;
      els.progressXp.textContent = progress?.xp ?? 0;
      els.progressStreak.textContent = progress?.current_streak_days ?? 0;
      els.progressWins.textContent = progress?.games_won ?? 0;
    } catch (err) {
      console.error('Progression non chargée :', err);
    }
  }

  // ---------- Onglet Défis ----------

  async function loadChallengesPanel(deps) {
    els.challengesList.innerHTML = _skeletonCards(3);
    try {
      const challenges = await deps.fetchTodayChallenges();
      if (!challenges || challenges.length === 0) {
        els.challengesList.innerHTML = '<p class="profile-empty-note">Aucun défi disponible aujourd\'hui.</p>';
        return;
      }
      els.challengesList.innerHTML = '';
      challenges.forEach(c => {
        const card = document.createElement('div');
        card.className = 'challenge-card' + (c.completed ? ' completed' : '');

        const left = document.createElement('div');
        const desc = document.createElement('div');
        desc.className = 'challenge-desc';
        desc.textContent = c.daily_challenge_templates?.description || 'Défi du jour';
        const progressEl = document.createElement('div');
        progressEl.className = 'challenge-progress';
        const target = c.daily_challenge_templates?.target_count ?? 1;
        progressEl.textContent = `${Math.min(c.progress_count, target)}/${target}`;
        left.appendChild(desc);
        left.appendChild(progressEl);

        const check = document.createElement('div');
        check.className = 'challenge-check';
        check.textContent = c.completed ? '✓' : '';

        card.appendChild(left);
        card.appendChild(check);
        els.challengesList.appendChild(card);
      });
    } catch (err) {
      els.challengesList.innerHTML = '<p class="profile-empty-note">Défis indisponibles pour le moment.</p>';
    }
  }

  // ---------- Onglet Équipe ----------

  async function loadTeamPanel(deps) {
    els.lineupSlots.innerHTML = _skeletonCards(3, 'small');
    els.collectionGrid.innerHTML = _skeletonCards(4);
    try {
      const newRewards = await deps.claimLevelRewards();
      if (newRewards && newRewards.length > 0) {
        const names = newRewards.map(r => r.player_name).join(', ');
        alert(`Nouvelle récompense de niveau débloquée : ${names} ! Il/elle est maintenant dans ta collection.`);
      }

      const [collection, lineup, customPlayers] = await Promise.all([
        deps.fetchMyCollection(), deps.fetchMyLineup(), deps.fetchMyCustomPlayers()
      ]);
      myCollectionCache = collection;
      myLineupCache = lineup || {};
      myCustomPlayersCache = customPlayers;
      renderLineupSlots(deps);
      renderCollectionGrid(deps);
      renderCreatePlayerSection();
      renderPowerShop(deps, collection);
    } catch (err) {
      els.lineupSlots.innerHTML = '<p class="profile-empty-note">Équipe indisponible pour le moment.</p>';
    }
  }

  function renderLineupSlots(deps) {
    els.lineupSlots.innerHTML = '';
    const allOwned = getAllOwnedPlayers();
    Object.entries(LINEUP_SLOT_LABELS).forEach(([slot, label]) => {
      const ownershipId = myLineupCache?.[`slot_${slot}`];
      const owned = allOwned.find(c => c.id === ownershipId);

      const slotEl = document.createElement('div');
      slotEl.className = 'lineup-slot' + (owned ? ' filled' : '');
      slotEl.dataset.slot = slot;

      if (owned) {
        const avatarEl = document.createElement('div');
        avatarEl.className = 'lineup-slot-avatar';
        avatarEl.innerHTML = deps.renderAvatarSvg(avatarForOwned(owned, deps));
        slotEl.appendChild(avatarEl);
      }

      const labelEl = document.createElement('div');
      labelEl.className = 'lineup-slot-label';
      labelEl.textContent = label;
      slotEl.appendChild(labelEl);

      const nameEl = document.createElement('div');
      nameEl.className = 'lineup-slot-name';
      if (owned) {
        const baseName = owned.isCustom ? owned.name : owned.fictional_players.name;
        nameEl.textContent = owned.custom_name || baseName;
      } else {
        nameEl.textContent = 'Glisse un joueur ici';
      }
      slotEl.appendChild(nameEl);

      if (owned) {
        const clearBtn = document.createElement('button');
        clearBtn.className = 'lineup-slot-clear';
        clearBtn.textContent = '✕';
        clearBtn.title = 'Retirer ce joueur du poste';
        clearBtn.addEventListener('click', e => {
          e.stopPropagation();
          myLineupCache[`slot_${slot}`] = null;
          renderLineupSlots(deps);
        });
        slotEl.appendChild(clearBtn);
      }

      // ---------- Cible de glisser-déposer ----------
      slotEl.addEventListener('dragover', e => {
        e.preventDefault();
        slotEl.classList.add('drop-target-active');
      });
      slotEl.addEventListener('dragleave', () => {
        slotEl.classList.remove('drop-target-active');
      });
      slotEl.addEventListener('drop', e => {
        e.preventDefault();
        slotEl.classList.remove('drop-target-active');
        const ownershipIdDropped = e.dataTransfer.getData('text/plain');
        if (!ownershipIdDropped) return;
        assignPlayerToSlot(ownershipIdDropped, slot, deps);
      });

      els.lineupSlots.appendChild(slotEl);
    });
  }

  function assignPlayerToSlot(ownershipId, slot, deps) {
    // Un même joueur ne peut pas occuper deux postes à la fois.
    Object.keys(LINEUP_SLOT_LABELS).forEach(s => {
      if (myLineupCache[`slot_${s}`] === ownershipId) {
        myLineupCache[`slot_${s}`] = null;
      }
    });
    myLineupCache[`slot_${slot}`] = ownershipId;
    renderLineupSlots(deps);
    renderCollectionGrid(deps); // met à jour le badge "Aligné" sur la carte
  }

  function renderCollectionGrid(deps) {
    els.collectionGrid.innerHTML = '';
    const allOwned = getAllOwnedPlayers();

    if (allOwned.length === 0) {
      els.collectionGrid.innerHTML = '<p class="profile-empty-note">Aucun joueur dans ta collection pour le moment.</p>';
      return;
    }

    const assignedIds = new Set(
      Object.keys(LINEUP_SLOT_LABELS).map(s => myLineupCache?.[`slot_${s}`]).filter(Boolean)
    );

    allOwned.forEach((owned, idx) => {
      const card = _buildPlayerCard(owned, { deps, idx, isOwned: true, assignedIds });
      // Drag & drop
      card.draggable = true;
      card.addEventListener('dragstart', e => {
        e.dataTransfer.setData('text/plain', owned.id);
        e.dataTransfer.effectAllowed = 'move';
        card.classList.add('dragging');
      });
      card.addEventListener('dragend', () => card.classList.remove('dragging'));
      // Clic tactile
      card.addEventListener('click', () => {
        const emptySlot = Object.keys(LINEUP_SLOT_LABELS).find(s => !myLineupCache?.[`slot_${s}`]);
        if (!emptySlot) {
          alert('Les 6 postes sont déjà pourvus. Glisse ce joueur directement sur un poste pour remplacer son occupant, ou retire un joueur avec le ✕.');
          return;
        }
        assignPlayerToSlot(owned.id, emptySlot, deps);
      });
      // Hover 3D
      _applyCard3DHover(card);
      els.collectionGrid.appendChild(card);
    });
  }

  /**
   * Boutique des joueurs rares/légendaires achetables directement.
   * N'affiche que ceux que le compte ne possède pas encore.
   */
  async function renderPowerShop(deps, myCollection) {
    els.powerShopGrid.innerHTML = _skeletonCards(4);
    try {
      const catalog = await deps.fetchPlayerCatalog();
      const ownedPlayerIds = new Set(myCollection.map(o => o.player_id));
      const purchasable = catalog.filter(p => p.power && !ownedPlayerIds.has(p.id));

      els.powerShopGrid.innerHTML = '';
      if (purchasable.length === 0) {
        els.powerShopGrid.innerHTML = '<p class="profile-empty-note">Tu possèdes déjà tous les joueurs à pouvoir disponibles.</p>';
        return;
      }

      purchasable.forEach((player, idx) => {
        // Construire la carte avec la nouvelle structure TCG
        const ownedShape = {
          id: player.id,
          isCustom: false,
          custom_name: null,
          fictional_players: {
            name: player.name,
            rarity: player.rarity,
            style: deps.POWER_LABELS[player.power] || player.style || '',
            avatar_seed: player.avatar_seed
          },
          power: player.power
        };
        const card = _buildPlayerCard(ownedShape, { deps, idx, isOwned: false });

        // Bouton d'achat intégré à la carte
        const price = player.rarity === 'rare' ? '2,99 €' : '4,99 €';
        const buyBtn = document.createElement('button');
        buyBtn.className = 'btn-small primary';
        buyBtn.style.cssText = 'width:100%;margin-top:10px;display:flex;align-items:center;justify-content:center;gap:5px;';
        buyBtn.innerHTML = `<svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M1 1h1.5l1 5h5l1-3H3.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/><circle cx="5" cy="9.5" r="1" fill="currentColor"/><circle cx="8" cy="9.5" r="1" fill="currentColor"/></svg> ${price}`;
        buyBtn.addEventListener('click', async () => {
          if (!deps.getCurrentUser()) { deps.openAccountOverlay(); return; }
          try {
            const result = await deps.purchasePlayer(player.id, deps.getCurrentUser(), deps.checkoutTheme);
            if (result.redirectUrl) { window.location.href = result.redirectUrl; return; }
            alert(`${player.name} a été ajouté à ta collection !`);
            await loadTeamPanel(deps);
          } catch (err) {
            alert(err.message || 'Achat impossible pour le moment.');
          }
        });
        card.querySelector('.player-card-inner').appendChild(buyBtn);

        _applyCard3DHover(card);
        els.powerShopGrid.appendChild(card);
      });
    } catch (err) {
      els.powerShopGrid.innerHTML = '<p class="profile-empty-note">Boutique indisponible pour le moment.</p>';
    }
  }

  async function handleSaveLineup(deps) {
    try {
      await deps.saveLineup({
        slot_gk: myLineupCache.slot_gk || null,
        slot_def0: myLineupCache.slot_def0 || null,
        slot_def1: myLineupCache.slot_def1 || null,
        slot_att0: myLineupCache.slot_att0 || null,
        slot_att1: myLineupCache.slot_att1 || null,
        slot_att2: myLineupCache.slot_att2 || null
      });
      alert('Composition enregistrée ! Elle s\'appliquera à ta prochaine partie.');
    } catch (err) {
      alert(err.message || 'Impossible d\'enregistrer la composition pour le moment.');
    }
  }

  // ---------- Onglet Leaderboard ----------

  async function loadLeaderboardPanel(deps) {
    els.leaderboardBody.innerHTML = '<tr><td colspan="5">Chargement…</td></tr>';
    try {
      const rows = await deps.fetchLeaderboard(20);
      if (!rows || rows.length === 0) {
        els.leaderboardBody.innerHTML = '<tr><td colspan="5">Aucun classement disponible pour le moment.</td></tr>';
        return;
      }
      els.leaderboardBody.innerHTML = '';
      rows.forEach((row, index) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${index + 1}</td>
          <td>${row.display_name}</td>
          <td>${row.level}</td>
          <td>${row.xp}</td>
          <td>${row.games_won}</td>
        `;
        els.leaderboardBody.appendChild(tr);
      });
    } catch (err) {
      els.leaderboardBody.innerHTML = '<tr><td colspan="5">Classement indisponible pour le moment.</td></tr>';
    }
  }

  // ---------- Création de joueur personnalisé ----------

  function _wireCreatePlayer(deps) {
    els.openCreatePlayerBtn?.addEventListener('click', () => openCreatePlayerModal(deps));
    els.closeCreatePlayerBtn?.addEventListener('click', () => {
      els.createPlayerOverlay.classList.remove('show');
    });
    els.confirmCreatePlayerBtn?.addEventListener('click', () => handleConfirmCreatePlayer(deps));

    els.newPlayerStyleOptions?.querySelectorAll('.setup-option').forEach(opt => {
      opt.addEventListener('click', () => {
        els.newPlayerStyleOptions.querySelectorAll('.setup-option').forEach(o => o.classList.remove('active'));
        opt.classList.add('active');
        newPlayerDraft.style = opt.dataset.style;
      });
    });

    els.newPlayerPatternOptions?.querySelectorAll('.setup-option').forEach(opt => {
      opt.addEventListener('click', () => {
        els.newPlayerPatternOptions.querySelectorAll('.setup-option').forEach(o => o.classList.remove('active'));
        opt.classList.add('active');
        newPlayerDraft.pattern = opt.dataset.pattern;
        renderCreatePlayerPreview(deps);
      });
    });

    els.newPlayerAccessoryOptions?.querySelectorAll('.setup-option').forEach(opt => {
      opt.addEventListener('click', () => {
        els.newPlayerAccessoryOptions.querySelectorAll('.setup-option').forEach(o => o.classList.remove('active'));
        opt.classList.add('active');
        newPlayerDraft.accessory = opt.dataset.accessory;
        renderCreatePlayerPreview(deps);
      });
    });

    // Palette couleurs construite dynamiquement depuis AVATAR_COLORS,
    // pour rester synchronisée avec ce que le rendu sait afficher.
    deps.AVATAR_COLORS.forEach(color => {
      const swatch = document.createElement('div');
      swatch.className = 'avatar-color-swatch' + (color === newPlayerDraft.color ? ' active' : '');
      swatch.style.background = color;
      swatch.addEventListener('click', () => {
        els.newPlayerColorOptions.querySelectorAll('.avatar-color-swatch').forEach(s => s.classList.remove('active'));
        swatch.classList.add('active');
        newPlayerDraft.color = color;
        renderCreatePlayerPreview(deps);
      });
      els.newPlayerColorOptions.appendChild(swatch);
    });
  }

  function renderCreatePlayerSection() {
    const usedSlots = myCustomPlayersCache.length;
    if (usedSlots === 0) {
      els.createPlayerQuotaNote.textContent = '1 emplacement gratuit disponible.';
    } else {
      els.createPlayerQuotaNote.textContent = `${usedSlots} joueur(s) personnalisé(s) créé(s). Au-delà du premier, chaque emplacement supplémentaire est payant.`;
    }
  }

  function openCreatePlayerModal(deps) {
    els.createPlayerError.textContent = '';
    els.newPlayerName.value = '';
    newPlayerDraft = { style: 'rapide', color: deps.AVATAR_COLORS[0], pattern: 'plain', accessory: 'none' };

    els.newPlayerStyleOptions.querySelectorAll('.setup-option').forEach((o, i) => o.classList.toggle('active', i === 0));
    els.newPlayerPatternOptions.querySelectorAll('.setup-option').forEach((o, i) => o.classList.toggle('active', i === 0));
    els.newPlayerAccessoryOptions.querySelectorAll('.setup-option').forEach((o, i) => o.classList.toggle('active', i === 0));
    els.newPlayerColorOptions.querySelectorAll('.avatar-color-swatch').forEach((s, i) => s.classList.toggle('active', i === 0));

    renderCreatePlayerPreview(deps);
    els.createPlayerOverlay.classList.add('show');
  }

  function renderCreatePlayerPreview(deps) {
    els.createPlayerPreview.innerHTML = deps.renderAvatarSvg(newPlayerDraft);
  }

  async function handleConfirmCreatePlayer(deps) {
    const name = els.newPlayerName.value.trim();
    els.createPlayerError.textContent = '';
    if (!name) {
      els.createPlayerError.textContent = 'Donne un nom à ton joueur.';
      return;
    }
    try {
      await deps.createCustomPlayer({
        name,
        style: newPlayerDraft.style,
        avatarColor: newPlayerDraft.color,
        avatarPattern: newPlayerDraft.pattern,
        avatarAccessory: newPlayerDraft.accessory
      });
      els.createPlayerOverlay.classList.remove('show');
      await loadTeamPanel(deps);
    } catch (err) {
      const message = err.message || '';
      if (message.includes('Limite de joueurs personnalisés')) {
        els.createPlayerError.textContent = 'Limite gratuite atteinte. Achète un emplacement supplémentaire pour créer ce joueur.';
        offerCustomPlayerSlotPurchase(deps);
      } else {
        els.createPlayerError.textContent = message || 'Création impossible pour le moment.';
      }
    }
  }

  /**
   * Propose l'achat d'un emplacement supplémentaire en réutilisant le
   * système de paiement des thèmes (même checkoutTheme), plutôt que de
   * dupliquer une logique de paiement spécifique aux joueurs custom.
   */
  async function offerCustomPlayerSlotPurchase(deps) {
    if (!deps.getCurrentUser()) return;
    const confirmed = confirm('Acheter un emplacement supplémentaire pour créer un joueur personnalisé (1,49€) ?');
    if (!confirmed) return;
    try {
      const fakeThemeForSlot = { id: deps.CUSTOM_PLAYER_SLOT_THEME_ID, price_cents: 149 };
      const result = await deps.checkoutTheme(fakeThemeForSlot, deps.getCurrentUser());
      if (result.immediate) {
        alert('Emplacement débloqué ! Tu peux maintenant créer ce joueur.');
        els.createPlayerError.textContent = '';
      } else if (result.redirectUrl) {
        window.location.href = result.redirectUrl;
      }
    } catch (err) {
      alert(err.message || 'Achat impossible pour le moment.');
    }
  }
}
