// ===================== COMPTE / AUTH / CONSENTEMENT =====================
// Overlay de compte (connexion, inscription, mot de passe oublié, RGPD),
// affichage du solde de pièces en topbar et rafraîchissements post-achat.
//
// Extrait de main.js (#21, lot 2). Même pattern que initShop()/initShootout() :
// initAccount(deps) reçoit ses dépendances explicitement et retourne les
// fonctions que main.js (et les autres modules, via main.js) orchestrent.
// L'état `currentUser` reste la propriété de main.js (le jeu, la boutique et
// le profil le lisent) : le module y accède via getUser()/setUser().

import { t } from './i18n.js';
import { COIN_KIT_COST } from './shopConstants.js';
import { showToast, showAlert, showConfirm, showConsentDialog } from './dialogs.js';
import {
  getCurrentUser, onAuthStateChange, signOut, signInWithEmail, signUpWithEmail,
  sendPasswordResetEmail
} from '../services/supabaseClient.js';
import { recordConsents, exportMyData, deleteMyData, CONSENT_PURPOSES } from '../services/consentService.js';
import { setAdvertisingConsent, hasAdvertisingConsent } from '../services/advertisingConsentService.js';
import { setAnalyticsConsent } from '../services/analyticsConsentService.js';
import { trackConsentChoice } from '../services/ads/adAnalytics.js';
import { getCurrencyBalance } from '../services/currencyService.js';
import { fetchTodayChallenges } from '../services/progressService.js';
import { fetchMyFriendships, fetchMyMercatoOffers } from '../services/mercatoService.js';

/**
 * Initialise l'UI de compte et branche les écouteurs d'authentification.
 * @param {object} deps
 * @param {object} deps.els                objet partagé de références DOM (main.js).
 * @param {() => object|null} deps.getUser  utilisateur connecté ou null.
 * @param {(u: object|null) => void} deps.setUser  met à jour l'utilisateur dans main.js.
 * @param {() => void} deps.refreshAdsForSession  recalcule le statut « sans pub ».
 * @param {() => void} deps.refreshHomeBanner     re-render de la bannière d'accueil.
 * @returns {{
 *   openAccountOverlay: (mode?: 'signin'|'signup') => void,
 *   updateAccountUI: () => void,
 *   updateCoinDisplay: (balance: number) => void,
 *   showCoinGain: (amount: number) => void,
 *   refreshAfterCheckout: () => void
 * }}
 */
export function initAccount({ els, getUser, setUser, refreshAdsForSession, refreshHomeBanner }) {

  let authMode = 'signin'; // 'signin' | 'signup'

  function updateAccountUI() {
    const currentUser = getUser();
    if (!els.accountStatus) return;
    els.accountStatus.textContent = currentUser
      ? (currentUser.email || 'Connecté')
      : 'Non connecté';

    // Rafraîchir le solde de pièces dans la topbar quand l'état du compte change
    if (currentUser) {
      getCurrencyBalance().then(balance => updateCoinDisplay(balance)).catch(() => {});
    } else {
      updateCoinDisplay(0);
    }
    refreshNotifications();
  }

  /**
   * Badge de notifications sur « Mon profil » (demandes d'ami + offres de
   * mercato en attente) et rappel des défis du jour sur l'accueil. Best
   * effort : toute erreur réseau est silencieuse, l'UI reste utilisable.
   */
  async function refreshNotifications() {
    if (!getUser()) {
      if (els.profileNotifBadge) els.profileNotifBadge.style.display = 'none';
      // Visiteur anonyme : pas de rappel de défis sur l'accueil — c'est
      // l'onglet Défis du profil qui porte l'invitation à se connecter.
      if (els.dailyHint) els.dailyHint.classList.add('hidden');
      return;
    }
    try {
      const [friendships, offers, challenges] = await Promise.all([
        fetchMyFriendships().catch(() => ({ pendingReceived: [] })),
        fetchMyMercatoOffers().catch(() => ({ received: [] })),
        fetchTodayChallenges().catch(() => [])
      ]);
      const notifCount = (friendships.pendingReceived?.length || 0) + (offers.received?.length || 0);
      if (els.profileNotifBadge) {
        els.profileNotifBadge.textContent = notifCount;
        els.profileNotifBadge.style.display = notifCount > 0 ? 'inline-flex' : 'none';
      }
      if (els.dailyHint) {
        const remaining = (challenges || []).filter(c => !c.completed).length;
        if (remaining > 0) {
          els.dailyHint.textContent = t(remaining > 1 ? '🎯 {n} défis du jour à relever (+15 pièces chacun)' : '🎯 {n} défi du jour à relever (+15 pièces chacun)', { n: remaining });
          els.dailyHint.classList.remove('hidden');
        } else {
          els.dailyHint.classList.add('hidden');
        }
      }
    } catch (err) {
      /* silencieux : purement décoratif */
    }
  }

  function updateCoinDisplay(balance) {
    if (els.coinAmount) els.coinAmount.textContent = balance;
    if (els.coinDisplay) {
      els.coinDisplay.style.display = balance > 0 || getUser() ? 'flex' : 'none';
    }
  }

  /**
   * Après un retour de Stripe Checkout, la livraison passe par le webhook :
   * elle peut atterrir quelques secondes APRÈS la redirection du navigateur.
   * La boutique s'ouvre donc parfois sur un solde/contenu encore anciens.
   * On relit le solde à intervalles espacés : dès qu'il bouge, topbar mise à
   * jour + badge de gain + un rafraîchissement silencieux de la boutique si
   * elle est toujours affichée. Un rafraîchissement de sécurité à 3 s couvre
   * aussi les achats sans pièces (kits, packs, crédits).
   */
  function refreshAfterCheckout() {
    const initialBalance = parseInt(els.coinAmount?.textContent, 10) || 0;
    let settled = false;

    // Rafraîchissement de sécurité unique (kits/packs livrés par webhook)
    setTimeout(() => {
      if (!settled && els.shopScreen && !els.shopScreen.classList.contains('hidden')) {
        els.shopBtn?.click();
      }
    }, 3000);

    // Perk « sans pub » (PR F, #31) : un pass acheté à l'instant est activé par
    // le webhook Stripe avec un léger délai. On recalcule le statut plusieurs
    // fois pour retirer la pub dès activation, sans attendre un rechargement.
    // Indépendant du solde (un pass peut ne pas créditer de pièces).
    [1500, 4000, 8000, 15000].forEach(ms => setTimeout(() => refreshAdsForSession(), ms));

    [1500, 4000, 8000, 15000].forEach(ms => {
      setTimeout(() => {
        if (settled) return;
        getCurrencyBalance().then(balance => {
          if (settled || balance === initialBalance) return;
          settled = true;
          updateCoinDisplay(balance);
          if (balance > initialBalance) showCoinGain(balance - initialBalance, balance);
          if (els.shopScreen && !els.shopScreen.classList.contains('hidden')) {
            els.shopBtn?.click(); // recharge la boutique avec le nouveau solde
          }
        }).catch(() => {/* silencieux : le prochain essai retentera */});
      }, ms);
    });
  }

  /** Micro-animation de gain de pièces affichée sur la topbar.
   *  @param {number} amount        gain à afficher (+X ⬤)
   *  @param {number} [newBalance]  solde après crédit — si fourni, ajoute la
   *    ligne goal-gradient « X/100 vers ton prochain kit » (effet Zeigarnik :
   *    la proximité de la récompense, montrée au pic de motivation du gain,
   *    donne une raison de rejouer). */
  function showCoinGain(amount, newBalance) {
    const badge = document.createElement('div');
    badge.className = 'coin-gain-badge';
    let html = '+' + amount + ' ⬤';
    const hasGoal = Number.isFinite(newBalance);
    if (hasGoal) {
      const sub = newBalance < COIN_KIT_COST
        ? `${newBalance}/${COIN_KIT_COST} vers ton prochain kit`
        : 'De quoi débloquer un kit du jour !';
      html += `<span class="coin-gain-sub">${sub}</span>`;
    }
    badge.innerHTML = html;
    badge.setAttribute('aria-live', 'polite');
    document.body.appendChild(badge);
    setTimeout(() => badge.classList.add('coin-gain-badge-show'), 10);
    setTimeout(() => {
      badge.classList.remove('coin-gain-badge-show');
      setTimeout(() => badge.remove(), 400);
    }, hasGoal ? 3200 : 2200); // 2 lignes = un peu plus de temps de lecture
  }

  function renderAccountOverlayContent() {
    const currentUser = getUser();
    if (currentUser) {
      els.accountLoggedOutView.classList.add('hidden');
      els.accountLoggedInView.classList.remove('hidden');
      els.accountEmailDisplay.textContent = currentUser.email;
    } else {
      els.accountLoggedInView.classList.add('hidden');
      els.accountLoggedOutView.classList.remove('hidden');
      els.forgotPasswordView.classList.add('hidden'); // toujours repartir sur le formulaire de connexion, pas la récupération
      els.authTitle.textContent = authMode === 'signin' ? 'Connexion' : 'Créer un compte';
      els.authSubmitBtn.textContent = authMode === 'signin' ? 'Se connecter' : 'Créer mon compte';
      els.authSwitchBtn.textContent = authMode === 'signin'
        ? 'Pas encore de compte ? Créer un compte'
        : 'Déjà un compte ? Se connecter';
      els.authDisplayName.style.display = authMode === 'signup' ? 'block' : 'none';
      // #342 : le label visible du pseudo suit l'affichage de son input.
      if (els.authDisplayNameLabel) {
        els.authDisplayNameLabel.style.display = authMode === 'signup' ? 'block' : 'none';
      }
      // #342 : l'autocomplete doit suivre le mode, sinon les gestionnaires de
      // mots de passe proposent l'existant à l'inscription (et inversement).
      els.authPassword.setAttribute('autocomplete',
        authMode === 'signin' ? 'current-password' : 'new-password');
      // #342 : à chaque (ré)ouverture, le mot de passe repart masqué.
      els.authPassword.type = 'password';
      if (els.authPasswordToggle) {
        els.authPasswordToggle.setAttribute('aria-pressed', 'false');
        els.authPasswordToggle.textContent = t('Afficher le mot de passe');
      }
      els.consentBlock.classList.toggle('hidden', authMode !== 'signup');
      els.authError.textContent = '';
    }
  }

  /**
   * Ouvre l'overlay de compte dans le mode demandé. Point d'entrée unique
   * pour main.js et les modules (boutique, profil, tirs au but) — remplace
   * le triplet authMode=… / renderAccountOverlayContent() / classList.add
   * dupliqué avant l'extraction.
   */
  function openAccountOverlay(mode = 'signin') {
    authMode = mode === 'signup' ? 'signup' : 'signin';
    renderAccountOverlayContent();
    els.accountOverlay.classList.add('show');
  }

  async function handleAuthSubmit() {
    const email = els.authEmail.value.trim();
    const password = els.authPassword.value;
    els.authError.textContent = '';
    els.authError.style.color = '';

    if (!email || !password) {
      els.authError.textContent = t('Email et mot de passe requis.');
      return;
    }

    // État de chargement sur le bouton — évite les double-clics et indique
    // clairement que la requête est en cours (Supabase Auth peut prendre 1-2s).
    const originalLabel = els.authSubmitBtn.textContent;
    els.authSubmitBtn.textContent = '…';
    els.authSubmitBtn.disabled = true;

    try {
      if (authMode === 'signin') {
        console.log('[auth] appel signInWithEmail...');
        const { data: signInData, error } = await signInWithEmail(email, password);
        console.log('[auth] signInWithEmail retour:', error ? ('ERREUR: ' + error.message) : 'succès');
        if (error) throw error;
        // Utiliser data.user directement : évite un second appel getUser()
        // qui peut échouer avec 500 même après un sign-in réussi.
        setUser(signInData?.user ?? null);
      } else {
        const displayName = els.authDisplayName.value.trim() || 'Joueur';
        const { data: signUpData, error } = await signUpWithEmail(email, password, displayName);
        if (error) throw error;

        // Cas particulier Supabase : si l'email correspond a un compte deja
        // existant, signUp ne renvoie PAS d'erreur (anti-enumeration) mais un
        // user sans identities. Sans ce test, on afficherait "Compte cree !"
        // a quelqu'un qui a deja un compte — parcours trompeur.
        if (signUpData?.user && Array.isArray(signUpData.user.identities) && signUpData.user.identities.length === 0) {
          throw new Error('User already registered');
        }

        // Enregistre chaque consentement séparément, reflétant exactement
        // l'état des cases au moment de l'inscription (cochée ou non).
        try {
          await recordConsents({
            [CONSENT_PURPOSES.ANALYTICS]: els.consentAnalytics.checked,
            [CONSENT_PURPOSES.EMAIL_MARKETING]: els.consentEmailMarketing.checked,
            [CONSENT_PURPOSES.DATA_SHARING]: els.consentDataSharing.checked,
            [CONSENT_PURPOSES.ADVERTISING]: els.consentAdvertising.checked
          });
        } catch (consentErr) {
          console.error('Consentement non enregistré :', consentErr);
        }

        // Modèle « CMP Google fait autorité » : ne pas transformer une case
        // laissée décochée à l'inscription en refus dur (le CMP recueille le
        // consentement RGPD). On ne pose le signal local que si la personne
        // coche explicitement pour accepter ; le refus explicite se fait via le
        // panneau « Gérer mes préférences ».
        if (els.consentAdvertising.checked) await setAdvertisingConsent(true);
        // Analytics : choix explicite à l'inscription (pas de CMP externe pour
        // cette finalité) → on aligne le signal local sur la case (PR G).
        setAnalyticsConsent(els.consentAnalytics.checked);
        refreshHomeBanner();

        els.authSubmitBtn.disabled = false;
        els.authSubmitBtn.textContent = originalLabel;

        if (signUpData?.session) {
          // Confirmation email desactivee cote Supabase : la session est
          // active immediatement. On connecte l'utilisateur directement au
          // lieu de le laisser devant un message ambigu lui demandant de
          // verifier ses emails alors qu'aucun email ne partira.
          setUser(signUpData.session.user);
          updateAccountUI();
          renderAccountOverlayContent();
          els.accountOverlay.classList.remove('show');
          return;
        }

        els.authError.style.color = 'var(--craie-att)';
        els.authError.textContent = t('Compte créé ! Un email de confirmation t\'a été envoyé — clique sur le lien qu\'il contient puis connecte-toi (pense aux spams).');
        // Bascule le formulaire en mode connexion pour que l'etape suivante
        // soit evidente une fois l'email confirme.
        authMode = 'signin';
        els.authTitle.textContent = 'Connexion';
        els.authSubmitBtn.textContent = 'Se connecter';
        els.authSwitchBtn.textContent = 'Pas encore de compte ? Créer un compte';
        els.authDisplayName.style.display = 'none';
        els.consentBlock.classList.add('hidden');
        return;
      }
      // currentUser déjà alimenté par data.user (signin) ou restera null (signup)
      updateAccountUI();
      renderAccountOverlayContent();
      els.accountOverlay.classList.remove('show');
    } catch (err) {
      els.authSubmitBtn.disabled = false;
      els.authSubmitBtn.textContent = originalLabel;
      console.error('[Auth]', err.message);

      // Si currentUser est déjà défini (sign-in réussi mais erreur post-signin),
      // on ferme quand même l'overlay — l'utilisateur est connecté.
      if (getUser()) {
        updateAccountUI();
        renderAccountOverlayContent();
        els.accountOverlay.classList.remove('show');
        return;
      }

      // Sinon afficher l'erreur en clair
      const msg = err.message || '';
      let displayMsg = msg;
      if (msg.includes('Invalid login credentials') || msg.includes('invalid_credentials')) {
        displayMsg = 'Email ou mot de passe incorrect.';
      } else if (msg.includes('Email not confirmed')) {
        displayMsg = 'Confirme ton adresse email avant de te connecter (vérifie tes spams).';
      } else if (msg.includes('User already registered')) {
        displayMsg = 'Ce compte existe déjà. Connecte-toi plutôt.';
      } else if (msg.includes('Password should be at least')) {
        displayMsg = 'Le mot de passe doit faire au moins 6 caractères.';
      } else if (!msg) {
        displayMsg = 'Connexion impossible. Vérifie ta connexion internet.';
      }
      els.authError.textContent = displayMsg;
    }
  }

  function wireAccount() {
    onAuthStateChange(user => {
      setUser(user);
      updateAccountUI();
      refreshAdsForSession(); // le statut « sans pub » dépend du pass de la session
    });
    getCurrentUser().then(user => {
      setUser(user);
      updateAccountUI();
      refreshAdsForSession();
    });

    els.accountBtn?.addEventListener('click', () => {
      renderAccountOverlayContent();
      els.accountOverlay.classList.add('show');
    });

    // #342 : afficher/masquer le mot de passe (taper en aveugle multiplie les
    // erreurs de saisie — WCAG/HIG recommandent le toggle).
    els.authPasswordToggle?.addEventListener('click', () => {
      const show = els.authPassword.type === 'password';
      els.authPassword.type = show ? 'text' : 'password';
      els.authPasswordToggle.setAttribute('aria-pressed', String(show));
      els.authPasswordToggle.textContent =
        t(show ? 'Masquer le mot de passe' : 'Afficher le mot de passe');
    });

    els.accountCloseBtn?.addEventListener('click', () => {
      els.accountOverlay.classList.remove('show');
    });

    els.authSwitchBtn?.addEventListener('click', () => {
      authMode = authMode === 'signin' ? 'signup' : 'signin';
      renderAccountOverlayContent();
    });

    els.authSubmitBtn?.addEventListener('click', handleAuthSubmit);

    els.forgotPasswordBtn?.addEventListener('click', () => {
      els.accountLoggedOutView.classList.add('hidden');
      els.forgotPasswordView.classList.remove('hidden');
      els.forgotPasswordError.textContent = '';
      els.forgotPasswordEmail.value = els.authEmail.value || '';
    });

    els.backToLoginBtn?.addEventListener('click', () => {
      els.forgotPasswordView.classList.add('hidden');
      els.accountLoggedOutView.classList.remove('hidden');
    });

    els.sendResetLinkBtn?.addEventListener('click', async () => {
      const email = els.forgotPasswordEmail.value.trim();
      els.forgotPasswordError.textContent = '';
      if (!email) {
        els.forgotPasswordError.textContent = t('Indique ton email.');
        return;
      }
      try {
        await sendPasswordResetEmail(email);
        // Message volontairement identique que l'email existe ou non dans la
        // base : ne jamais révéler si une adresse précise a un compte ou
        // pas, pour éviter qu'un tiers puisse vérifier l'existence de
        // comptes par essais successifs (énumération d'utilisateurs).
        els.forgotPasswordError.style.color = 'var(--craie-att)';
        els.forgotPasswordError.textContent = t('Si un compte existe avec cet email, un lien de réinitialisation vient d\'être envoyé.');
      } catch (err) {
        els.forgotPasswordError.style.color = 'var(--rouge-equipe-clair)';
        els.forgotPasswordError.textContent = err.message || 'Envoi impossible pour le moment.';
      }
    });

    els.authPassword?.addEventListener('keydown', e => {
      if (e.key === 'Enter') handleAuthSubmit();
    });

    els.signOutBtn?.addEventListener('click', async () => {
      await signOut();
      setUser(null);
      updateAccountUI();
      els.accountOverlay.classList.remove('show');
    });

    els.exportDataBtn?.addEventListener('click', async () => {
      try {
        const data = await exportMyData();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'tactic-master-mes-donnees.json';
        a.click();
        URL.revokeObjectURL(url);
      } catch (err) {
        showAlert(err.message || t('Export impossible pour le moment.'));
      }
    });

    els.deleteDataBtn?.addEventListener('click', async () => {
      const confirmed = await showConfirm(
        t('Supprimer définitivement ton compte et toutes tes données (achats, parties, préférences) ? Cette action est irréversible.'),
        { title: t('Supprimer mon compte'), okLabel: t('Supprimer définitivement') }
      );
      if (!confirmed) return;
      try {
        await deleteMyData();
        await signOut();
        setUser(null);
        updateAccountUI();
        els.accountOverlay.classList.remove('show');
        showAlert(t('Tes données ont été supprimées.'));
      } catch (err) {
        showAlert(err.message || t('Suppression impossible pour le moment.'));
      }
    });

    els.manageConsentBtn?.addEventListener('click', () => {
      // Réutilise le même panneau de consentement que l'inscription, en mode
      // "mise à jour" plutôt que création — les choix sont enregistrés
      // immédiatement, sans recréer de compte.
      openConsentManagementPanel();
    });
  }

  async function openConsentManagementPanel() {
    // Pré-coche la case pub selon le signal local courant (le retrait doit être
    // aussi simple que l'octroi — exigence CNIL).
    const choices = await showConsentDialog({ advertising: hasAdvertisingConsent() });
    if (!choices) return; // annulé : aucun changement enregistré

    // Les signaux locaux (gating) sont mis à jour immédiatement, indépendamment
    // de la synchro serveur ci-dessous. L'analytics a son propre signal local
    // qui conditionne l'émission de nos événements de mesure (PR G).
    setAdvertisingConsent(choices.advertising);
    setAnalyticsConsent(choices.analytics);
    // Émis avant tout changement d'état d'analytics n'ayant pas encore pris :
    // si l'utilisateur vient d'accorder l'analytics, l'événement passera ; s'il
    // vient de refuser, track() ne l'émettra pas (gating respecté).
    trackConsentChoice('advertising', choices.advertising);
    refreshHomeBanner(); // reflète tout de suite l'octroi/retrait à l'écran

    recordConsents({
      [CONSENT_PURPOSES.ANALYTICS]: choices.analytics,
      [CONSENT_PURPOSES.EMAIL_MARKETING]: choices.emailMarketing,
      [CONSENT_PURPOSES.DATA_SHARING]: choices.dataSharing,
      [CONSENT_PURPOSES.ADVERTISING]: choices.advertising
    }).then(() => {
      showToast(t('Tes préférences ont été mises à jour.'));
    }).catch(err => {
      showAlert(err.message || t('Mise à jour impossible pour le moment.'));
    });
  }

  wireAccount();

  return { openAccountOverlay, updateAccountUI, updateCoinDisplay, showCoinGain, refreshAfterCheckout };
}
