import { showToast, showAlert } from './dialogs.js';
// ===================== MERCATO UI =====================
// Gère l'onglet Amis & Mercato dans l'écran profil : liste d'amis,
// demandes en attente, envoi/réception/annulation d'offres d'échange,
// modale de création d'offre, et partage de profil.
//
// Pattern d'isolation identique à shopUI.js et profileUI.js :
//   - Aucun accès aux globales de main.js.
//   - Tout ce qui est transverse reçu via `deps` fourni par main.js.
//   - loadMercatoPanel est retourné pour que main.js puisse l'appeler
//     depuis switchProfileTab.
//
// Dépendance croisée (résolue dans main.js) :
//   - Après acceptation/refus d'une offre, on recharge l'onglet équipe :
//     deps.loadTeamPanel() est passé depuis le retour d'initProfile().
//   - toOwnedShape est aussi fourni via deps depuis initProfile().

// ---------- État local ----------

let mercatoOfferContext = null; // { friendUserId } pendant la création d'offre
let mercatoMySelectedOwnershipId = null;
let mercatoFriendSelectedOwnershipId = null;
let myFriendsCache = [];

// ---------- Sécurité ----------

// Échappe le HTML avant toute insertion via innerHTML. Les pseudos
// (display_name) et noms de joueurs (custom_name) sont choisis librement par
// les utilisateurs : sans échappement, un pseudo tel que
// `<img src=x onerror=…>` s'exécuterait dans la session d'un AUTRE joueur
// affichant la demande/offre — XSS stocké menant au vol de session.
export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
}

// ---------- Point d'entrée ----------

/**
 * Initialise le module mercato : branche les écouteurs et retourne
 * loadMercatoPanel pour que main.js puisse l'appeler depuis switchProfileTab.
 *
 * @param {object} deps
 *   els                    — objet des références DOM (cacheDomRefs)
 *   fetchMyFriendships     — service amis
 *   sendFriendRequest      — service amis
 *   respondFriendRequest   — service amis
 *   createMercatoOffer     — service mercato
 *   respondMercatoOffer    — service mercato
 *   cancelMercatoOffer     — service mercato
 *   fetchMyMercatoOffers   — service mercato
 *   fetchFriendCollection  — service mercato
 *   fetchMyCollection      — service collection
 *   fetchMyCustomPlayers   — service joueurs custom
 *   toOwnedShape           — fn de normalisation, fourni par initProfile()
 *   loadTeamPanel          — fn de rechargement équipe, fourni par initProfile()
 */
export function initMercato(deps) {
  const { els } = deps;

  // ----- Boutons persistants de l'onglet mercato -----
  els.sendFriendRequestBtn?.addEventListener('click', () => handleSendFriendRequest(deps));
  els.friendPseudoInput?.addEventListener('keydown', e => {
    if (e.key === 'Enter') handleSendFriendRequest(deps);
  });
  els.shareProfileBtn?.addEventListener('click', () => handleShareProfile(deps));
  els.closeMercatoOfferBtn?.addEventListener('click', () => {
    els.mercatoOfferOverlay.classList.remove('show');
  });
  els.confirmMercatoOfferBtn?.addEventListener('click', () => handleConfirmMercatoOffer(deps));

  return {
    /** Appelé par switchProfileTab dans main.js quand l'onglet mercato est sélectionné. */
    loadMercatoPanel: () => loadMercatoPanel(deps)
  };
}

// ---------- Chargement du panneau ----------

async function loadMercatoPanel(deps) {
  const { els } = deps;
  els.friendRequestError.textContent = '';
  try {
    await Promise.all([renderFriendshipsSection(deps), renderMercatoOffersSection(deps)]);
  } catch (err) {
    // Filet de sécurité : si une erreur inattendue remonte malgré les
    // try/catch internes à chaque section (ex: erreur avant même d'y
    // entrer), on l'affiche au lieu de la laisser disparaître en silence
    // — c'est exactement ce qui produisait un onglet vide sans aucun
    // message ni log, avant le correctif de la migration 0015.
    console.error('Erreur de chargement du panneau mercato :', err);
    els.friendRequestError.textContent = 'Une erreur est survenue au chargement (' + (err.message || 'inconnue') + ').';
  }
}

// ---------- Section amis ----------

async function renderFriendshipsSection(deps) {
  const { els } = deps;
  els.pendingFriendRequests.innerHTML = '<p class="profile-empty-note">Chargement…</p>';
  els.friendsList.innerHTML = '';
  try {
    const { friends, pendingReceived, pendingSent } = await deps.fetchMyFriendships();
    myFriendsCache = friends;

    els.pendingFriendRequests.innerHTML = '';
    if (pendingReceived.length === 0) {
      els.pendingFriendRequests.innerHTML = '<p class="profile-empty-note">Aucune demande en attente.</p>';
    } else {
      pendingReceived.forEach(req => {
        const row = document.createElement('div');
        row.className = 'friend-row';
        row.innerHTML = `<span class="friend-row-name">${escapeHtml(req.other_pseudo || 'Joueur')}</span>`;
        const actions = document.createElement('div');
        actions.className = 'friend-row-actions';

        const acceptBtn = document.createElement('button');
        acceptBtn.className = 'btn-small primary';
        acceptBtn.textContent = 'Accepter';
        acceptBtn.addEventListener('click', async () => {
          await deps.respondFriendRequest(req.user_id, true);
          await renderFriendshipsSection(deps);
        });

        const declineBtn = document.createElement('button');
        declineBtn.className = 'btn-small danger';
        declineBtn.textContent = 'Refuser';
        declineBtn.addEventListener('click', async () => {
          await deps.respondFriendRequest(req.user_id, false);
          await renderFriendshipsSection(deps);
        });

        actions.appendChild(acceptBtn);
        actions.appendChild(declineBtn);
        row.appendChild(actions);
        els.pendingFriendRequests.appendChild(row);
      });
    }

    // Demandes ENVOYÉES en attente : sans cette section, l'expéditeur ne
    // voyait aucune trace de sa demande et croyait qu'elle avait échoué.
    if (els.pendingFriendRequestsSent) {
      els.pendingFriendRequestsSent.innerHTML = '';
      const sentList = pendingSent || [];
      if (sentList.length === 0) {
        els.pendingFriendRequestsSent.innerHTML = '<p class="profile-empty-note">Aucune demande envoyée en attente.</p>';
      } else {
        sentList.forEach(req => {
          const row = document.createElement('div');
          row.className = 'friend-row';
          row.innerHTML = `<span class="friend-row-name">${escapeHtml(req.other_pseudo || 'Joueur')} <span style="opacity:.6;font-size:12px;">(en attente)</span></span>`;
          const cancelBtn = document.createElement('button');
          cancelBtn.className = 'btn-small danger';
          cancelBtn.textContent = 'Annuler';
          cancelBtn.addEventListener('click', async () => {
            try {
              await deps.cancelFriendRequest(req.friend_id);
              await renderFriendshipsSection(deps);
            } catch (err) {
              showAlert(err.message || 'Annulation impossible pour le moment.');
            }
          });
          row.appendChild(cancelBtn);
          els.pendingFriendRequestsSent.appendChild(row);
        });
      }
    }

    if (friends.length === 0) {
      els.friendsList.innerHTML = '<p class="profile-empty-note">Aucun ami pour le moment. Ajoute quelqu\'un par son pseudo ci-dessus.</p>';
    } else {
      friends.forEach(friendship => {
        const row = document.createElement('div');
        row.className = 'friend-row';
        row.innerHTML = `<span class="friend-row-name">${escapeHtml(friendship.other_pseudo || 'Joueur')}</span>`;
        const tradeBtn = document.createElement('button');
        tradeBtn.className = 'btn-small primary';
        tradeBtn.textContent = 'Proposer un échange';
        const otherUserId = friendship.direction === 'sent' ? friendship.friend_id : friendship.user_id;
        tradeBtn.addEventListener('click', () => openMercatoOfferModal(deps, otherUserId, friendship.other_pseudo));
        row.appendChild(tradeBtn);
        els.friendsList.appendChild(row);
      });
    }
  } catch (err) {
    els.pendingFriendRequests.innerHTML = '<p class="profile-empty-note">Amis indisponibles pour le moment.</p>';
  }
}

async function handleSendFriendRequest(deps) {
  const { els } = deps;
  const pseudo = els.friendPseudoInput.value.trim();
  els.friendRequestError.textContent = '';
  if (!pseudo) return;
  try {
    await deps.sendFriendRequest(pseudo);
    els.friendPseudoInput.value = '';
    await renderFriendshipsSection(deps);
  } catch (err) {
    els.friendRequestError.textContent = err.message || 'Demande impossible pour le moment.';
  }
}

/**
 * Copie un lien vers le site dans le presse-papier (ou déclenche le
 * partage natif sur mobile), pour inviter facilement quelqu'un à rejoindre
 * le jeu et à utiliser le système d'amis (par pseudo exact).
 */
async function handleShareProfile(deps) {
  const { els } = deps;
  const shareUrl = window.location.origin + window.location.pathname.replace(/\/[^/]*$/, '/');
  const shareText = `Viens jouer à Tactic Master avec moi : ${shareUrl}`;
  try {
    if (navigator.share) {
      await navigator.share({ title: 'Tactic Master', text: shareText, url: shareUrl });
    } else {
      await navigator.clipboard.writeText(shareText);
      els.shareProfileFeedback.textContent = 'Lien copié ! Colle-le où tu veux pour inviter quelqu\'un.';
    }
  } catch (err) {
    // L'utilisateur peut annuler le partage natif (pas une vraie erreur) ou
    // le presse-papier peut être bloqué — dans les deux cas on reste silencieux.
    if (err.name !== 'AbortError') {
      els.shareProfileFeedback.textContent = 'Impossible de copier le lien automatiquement.';
    }
  }
}

// ---------- Section offres ----------

async function renderMercatoOffersSection(deps) {
  const { els } = deps;
  els.mercatoOffersReceived.innerHTML = '<p class="profile-empty-note">Chargement…</p>';
  els.mercatoOffersSent.innerHTML = '';
  try {
    const { received, sent } = await deps.fetchMyMercatoOffers();

    els.mercatoOffersReceived.innerHTML = '';
    if (received.length === 0) {
      els.mercatoOffersReceived.innerHTML = '<p class="profile-empty-note">Aucune offre reçue.</p>';
    } else {
      received.forEach(offer => {
        const row = document.createElement('div');
        row.className = 'offer-row';
        const who = offer.other_pseudo || 'Un ami';
        const give = offer.requested_player_name ? ` — il demande <strong>${escapeHtml(offer.requested_player_name)}</strong>` : '';
        const get = offer.offered_player_name ? ` contre <strong>${escapeHtml(offer.offered_player_name)}</strong>` : '';
        row.innerHTML = `<span class="offer-row-desc">${escapeHtml(who)} te propose un échange${give}${get}</span>`;
        const actions = document.createElement('div');
        actions.className = 'friend-row-actions';

        const acceptBtn = document.createElement('button');
        acceptBtn.className = 'btn-small primary';
        acceptBtn.textContent = 'Accepter';
        acceptBtn.addEventListener('click', async () => {
          await deps.respondMercatoOffer(offer.id, true);
          await renderMercatoOffersSection(deps);
          await deps.loadTeamPanel(); // met à jour la collection après l'échange
        });

        const declineBtn = document.createElement('button');
        declineBtn.className = 'btn-small danger';
        declineBtn.textContent = 'Refuser';
        declineBtn.addEventListener('click', async () => {
          await deps.respondMercatoOffer(offer.id, false);
          await renderMercatoOffersSection(deps);
        });

        actions.appendChild(acceptBtn);
        actions.appendChild(declineBtn);
        row.appendChild(actions);
        els.mercatoOffersReceived.appendChild(row);
      });
    }

    els.mercatoOffersSent.innerHTML = '';
    if (sent.length === 0) {
      els.mercatoOffersSent.innerHTML = '<p class="profile-empty-note">Aucune offre envoyée.</p>';
    } else {
      sent.forEach(offer => {
        const row = document.createElement('div');
        row.className = 'offer-row';
        const who2 = offer.other_pseudo || 'ton ami';
        const detail = (offer.offered_player_name && offer.requested_player_name)
          ? ` : ${escapeHtml(offer.offered_player_name)} contre ${escapeHtml(offer.requested_player_name)}`
          : '';
        row.innerHTML = `<span class="offer-row-desc">En attente de réponse de ${escapeHtml(who2)}${detail}</span>`;
        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'btn-small danger';
        cancelBtn.textContent = 'Annuler';
        cancelBtn.addEventListener('click', async () => {
          await deps.cancelMercatoOffer(offer.id);
          await renderMercatoOffersSection(deps);
        });
        row.appendChild(cancelBtn);
        els.mercatoOffersSent.appendChild(row);
      });
    }
  } catch (err) {
    els.mercatoOffersReceived.innerHTML = '<p class="profile-empty-note">Offres indisponibles pour le moment.</p>';
  }
}

// ---------- Modale de création d'offre ----------

async function openMercatoOfferModal(deps, friendUserId, friendName) {
  const { els } = deps;
  mercatoOfferContext = { friendUserId };
  mercatoMySelectedOwnershipId = null;
  mercatoFriendSelectedOwnershipId = null;
  els.mercatoOfferError.textContent = '';
  els.friendPlayerSelectLabel.textContent = `Tu demandes à ${friendName || 'ton ami'}`;
  els.myPlayerSelect.innerHTML = '<p class="profile-empty-note">Chargement…</p>';
  els.friendPlayerSelect.innerHTML = '<p class="profile-empty-note">Chargement…</p>';
  els.mercatoOfferOverlay.classList.add('show');

  try {
    const [myCollection, myCustom, friendCollection] = await Promise.all([
      deps.fetchMyCollection(), deps.fetchMyCustomPlayers(), deps.fetchFriendCollection(friendUserId)
    ]);
    const myAllOwned = [...myCollection, ...myCustom.map(deps.toOwnedShape)];
    renderMercatoPlayerOptions(els.myPlayerSelect, myAllOwned, ownershipId => {
      mercatoMySelectedOwnershipId = ownershipId;
    });
    renderMercatoFriendOptions(deps, friendCollection);
  } catch (err) {
    els.mercatoOfferError.textContent = err.message || 'Collections indisponibles pour le moment.';
  }
}

export function renderMercatoPlayerOptions(container, owned, onSelect) {
  container.innerHTML = '';
  if (owned.length === 0) {
    container.innerHTML = '<p class="profile-empty-note">Aucun joueur disponible.</p>';
    return;
  }
  owned.forEach(o => {
    const opt = document.createElement('div');
    opt.className = 'mercato-player-option';
    opt.textContent = o.custom_name || (o.isCustom ? o.name : o.fictional_players.name);
    opt.addEventListener('click', () => {
      container.querySelectorAll('.mercato-player-option').forEach(el => el.classList.remove('selected'));
      opt.classList.add('selected');
      onSelect(o.id);
    });
    container.appendChild(opt);
  });
}

export function renderMercatoFriendOptions(deps, friendCollection) {
  const { els } = deps;
  els.friendPlayerSelect.innerHTML = '';
  if (friendCollection.length === 0) {
    els.friendPlayerSelect.innerHTML = '<p class="profile-empty-note">Cet ami n\'a aucun joueur.</p>';
    return;
  }
  friendCollection.forEach(p => {
    const opt = document.createElement('div');
    opt.className = 'mercato-player-option';
    opt.textContent = p.custom_name || p.player_name;
    opt.addEventListener('click', () => {
      els.friendPlayerSelect.querySelectorAll('.mercato-player-option').forEach(el => el.classList.remove('selected'));
      opt.classList.add('selected');
      mercatoFriendSelectedOwnershipId = p.id;
    });
    els.friendPlayerSelect.appendChild(opt);
  });
}

async function handleConfirmMercatoOffer(deps) {
  const { els } = deps;
  els.mercatoOfferError.textContent = '';
  if (!mercatoMySelectedOwnershipId || !mercatoFriendSelectedOwnershipId) {
    els.mercatoOfferError.textContent = 'Choisis un joueur de chaque côté.';
    return;
  }
  try {
    await deps.createMercatoOffer(
      mercatoOfferContext.friendUserId,
      mercatoMySelectedOwnershipId,
      mercatoFriendSelectedOwnershipId
    );
    els.mercatoOfferOverlay.classList.remove('show');
    await renderMercatoOffersSection(deps);
    showToast('Offre envoyée ! Ton ami doit l\'accepter pour que l\'échange se fasse.');
  } catch (err) {
    els.mercatoOfferError.textContent = err.message || 'Offre impossible pour le moment.';
  }
}
