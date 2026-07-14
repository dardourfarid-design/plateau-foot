# Matrice de non-régression — surface interactive du site

> Inventaire **exhaustif et rejouable** de tous les éléments interactifs de `public/index.html`,
> avec leur statut de couverture automatisée. Sert de checklist pour rejouer périodiquement
> la santé du projet. Voir le mode d'emploi dans [`regression-runbook.md`](./regression-runbook.md).
>
> Légende — ✅ couvert par un test automatisé · ⚠️ trou (à couvrir, cf. issue #147 / sous-issue **D**) · 🔒 nécessite le backend de test (suite `e2e/auth/`)
>
> Épic : **[EPIC] Non-régression pérenne** (#143). Dernière mise à jour : 2026-07-14.

## Topbar (visible partout)

| Élément | Sélecteur | Parcours | Statut | Test |
|---|---|---|---|---|
| Logo / retour accueil | `#homeLogoBtn` | clic → écran d'accueil (depuis config, partie, shootout) | ✅ | `e2e/navigation.spec.js`, `shootout-nav` |
| Compte | `#accountBtn` | clic → `#accountOverlay` | ✅ | `e2e/smoke.spec.js`, `a11y`, `visual` |
| Mon profil | `#profileBtn` | clic → `#profileScreen` (authentifié) ou modale compte (anonyme) | ✅ | `e2e/auth/authenticated.spec.js`, `account-ui` (gating anon) |
| Boutique | `#shopBtn` | clic → `#shopScreen` | 🔒 partiel | `e2e/auth/authenticated.spec.js` |
| Solde pièces | `#coinDisplay` / `#coinAmount` | affichage conditionnel | ⚠️ | — |
| Badge notif profil | `#profileNotifBadge` | affichage conditionnel | ⚠️ | — |

## Écran d'accueil (`#setupScreen`)

| Élément | Sélecteur | Parcours | Statut | Test |
|---|---|---|---|---|
| Chargement sans erreur JS | `.logo-title` | accueil charge, 0 erreur console | ✅ | `e2e/smoke.spec.js` |
| Jouer maintenant | `#goToSetupBtn` | clic → `#configScreen` | ✅ | `smoke`, `gameplay`, `a11y`, `visual`, `shootout` |
| Lancer le tutoriel | `#startTutorialBtn` | clic → `#tutorialBubble` | ✅ | `e2e/tutorial.spec.js` |
| Toggle langue FR/EN | `.lang-opt[data-lang]` | retraduit l'UI (`.logo-sub`) | ✅ | `e2e/i18n.spec.js` |
| Bannière pub accueil | `#adBannerHome` | remplie si pub autorisée | ⚠️ (unit gating) | `tests/adService.test.js` |

## Écran de configuration (`#configScreen`)

| Élément | Sélecteur | Parcours | Statut | Test |
|---|---|---|---|---|
| Retour | `#configBackBtn` | clic → accueil | ✅ | `e2e/navigation.spec.js` |
| Mode de jeu | `#modeOptions` (local/ai/online) | bascule → affiche IA / bloc online | ✅ | `e2e/config.spec.js` |
| Niveau IA | `#aiDifficultyOptions` (facile/moyen/difficile) | visible en mode IA | ✅ | `e2e/config.spec.js` |
| Style de jeu | `#variantOptions` (standard/tactique) | sélection | ✅ | `e2e/config.spec.js` |
| Pouvoirs bonus | `#powersOptions` (on/off) | sélection | ✅ | `e2e/config.spec.js` |
| Format | `#formatOptions` (score/manche) | sélection | ✅ | `e2e/config.spec.js` |
| Buts pour gagner | `#goalOptions` (1/3/5/∞) | sélection | ✅ | `e2e/config.spec.js` |
| Lancer la partie | `#startBtn` | clic → `#gameScreen` | ✅ | `smoke`, `gameplay`, `a11y`, `visual` |
| Séance de tirs au but | `#launchShootoutBtn` | clic → `#shootoutScreen` | ✅ | `e2e/shootout.spec.js` |
| Créer une partie (online) | `#createOnlineBtn` | clic → `#waitingScreen` | ⚠️ | — |
| Code d'invitation | `#inviteCodeDisplay` | affiché en salle d'attente | ⚠️ | — |
| Annuler l'attente | `#cancelWaitingBtn` | clic → retour config | ⚠️ | — |
| Rejoindre via code | `#joinCodeInput` + `#joinOnlineBtn` | code invalide → `#onlineError` | ✅ | `e2e/config.spec.js` |

## Écran de jeu (`#gameScreen`)

| Élément | Sélecteur | Parcours | Statut | Test |
|---|---|---|---|---|
| Plateau | `#boardGrid .cell` (63) | rendu du plateau | ✅ | `gameplay`, `visual` |
| Sélection pion + coup | `.token.bleu:not(.gardien)` → `.dest-move` | jouer un coup | ✅ | `e2e/gameplay.spec.js` |
| Bandeau de tour | `#turnBanner` | change de tour | ✅ (assert) | `e2e/gameplay.spec.js` |
| Annuler le coup | `#cancelBtn` | annule la sélection | ✅ | `e2e/game-controls.spec.js` |
| Utiliser le pouvoir | `#activatePowerBtn` | active un pouvoir | ⚠️ | — |
| Ciblage pouvoir | `#powerTargetOverlay` / `#cancelPowerTargetBtn` | choisir un pion adverse | ⚠️ | — |
| Terminer le tour | `#endTurnBtn` | passe la main | ⚠️ | — |
| Nouvelle partie | `#restartBtn` | retour config | ✅ | `e2e/game-controls.spec.js` |
| Overlay but | `#goalOverlay` / `#continueBtn` | but marqué → continuer | ⚠️ | — |
| Overlay fin — Accueil | `#backToSetupFromEndBtn` | clic → accueil | ⚠️ | — |
| Overlay fin — Rejouer | `#newGameBtn` | clic → nouvelle partie | ⚠️ | — |
| Overlay fin — Pub récompensée | `#watchRewardedBtn` | opt-in vidéo → pièces | ⚠️ (unit + edge) | `adService`, `rewarded-ssv` |

## Séance de tirs au but (`#shootoutScreen`)

| Élément | Sélecteur | Parcours | Statut | Test |
|---|---|---|---|---|
| Thèmes visuels | `#pkSwitcher .pk-theme-btn` (stade/néon/cartoon/manga) | défaut stade ; thème verrouillé → modale compte | ✅ | `e2e/shootout-nav.spec.js` |
| Tirer / arrêter | `#pkCta` | déclenche le tir | ✅ | `e2e/shootout.spec.js` |
| Choix de zone | `#pkZones .pk-zone` (6) | sélection de zone | ✅ | `e2e/shootout.spec.js` |
| Jauge de puissance | `#pkPowerWrap` / `#pkPowerMarker` | timing de puissance | ✅ | `e2e/shootout.spec.js` |
| Résultat | `#pkResult` / `#pkResultMain` | issue du tir | ✅ | `e2e/shootout.spec.js` |
| Rejouer | `#shootoutReplayBtn` | relance la séance | ⚠️ | — |
| Retour accueil | `#shootoutBackBtn` | clic → accueil | ⚠️ | — |
| Logique de score | (moteur) | best-of-5, mort subite | ✅ | `tests/penaltyShootoutV2.test.js` |

## Boutique (`#shopScreen`)

| Élément | Sélecteur | Parcours | Statut | Test |
|---|---|---|---|---|
| Ouverture (nav) | `#shopBtn` → `#shopScreen` | ouvre la boutique (anon inclus) | ✅ | `e2e/shop-nav.spec.js` |
| Liste produits | `#shopGrid` | affiche les thèmes (données backend) | 🔒 | `e2e/auth/authenticated.spec.js` |
| Retour | `#shopBackBtn` | clic → écran précédent (accueil/config) | ✅ | `e2e/shop-nav.spec.js` |
| Achat d'un thème | `#shopGrid` (carte) | flux monnaie/paiement (mock) | ⚠️ | — |
| Toast retour Stripe | `#purchaseToast` | confirmation/annulation | ⚠️ | — |

## Profil (`#profileScreen`) — 5 onglets

| Élément | Sélecteur | Parcours | Statut | Test |
|---|---|---|---|---|
| Retour | `#profileBackBtn` | clic → accueil | ⚠️ | — |
| Onglet Progression | `.profile-tab[data-tab=progress]` → `#panelProgress` | niveau/XP/streak/victoires | 🔒 ✅ | `authenticated`, `auth/profile-tabs` |
| Onglet Défis | `.profile-tab[data-tab=challenges]` → `#panelChallenges` | bascule panneau (contenu async) | 🔒 ✅ | `e2e/auth/profile-tabs.spec.js` |
| Onglet Mon équipe | `.profile-tab[data-tab=team]` → `#panelTeam` | bascule panneau (contenu async) | 🔒 ✅ | `e2e/auth/profile-tabs.spec.js` |
| Onglet Mercato | `.profile-tab[data-tab=mercato]` → `#panelMercato` | bascule panneau (contenu async) | 🔒 ✅ | `e2e/auth/profile-tabs.spec.js` |
| Onglet Classement | `.profile-tab[data-tab=leaderboard]` → `#panelLeaderboard` | bascule panneau (contenu async) | 🔒 ✅ | `e2e/auth/profile-tabs.spec.js` |
| Enregistrer composition | `#saveLineupBtn` | sauve l'équipe | ⚠️ | — |
| Créer un joueur | `#openCreatePlayerBtn` → `#createPlayerOverlay` | nom/style/couleur/motif/accessoire → `#confirmCreatePlayerBtn` | ⚠️ | — |
| Collection | `#collectionGrid` / `#powerShopGrid` | affichage joueurs | ⚠️ | — |
| Badge Fondateur | `#founderBadge` | affichage conditionnel | ✅ (service) | `passService` |

## Mercato (`#panelMercato`)

| Élément | Sélecteur | Parcours | Statut | Test |
|---|---|---|---|---|
| Ajouter un ami | `#friendPseudoInput` + `#sendFriendRequestBtn` | pseudo invalide → `#friendRequestError` | ⚠️ | — |
| Copier lien d'invitation | `#shareProfileBtn` | copie + `#shareProfileFeedback` | ⚠️ | — |
| Demandes / amis | `#pendingFriendRequests`, `#friendsList` | listes dynamiques | ⚠️ | — |
| Proposer un échange | `#mercatoOfferOverlay` / `#confirmMercatoOfferBtn` | sélection joueurs → offre | ⚠️ | — |

## Compte / Auth (`#accountOverlay`)

| Élément | Sélecteur | Parcours | Statut | Test |
|---|---|---|---|---|
| Connexion | `#authEmail` + `#authPassword` + `#authSubmitBtn` | login | 🔒 ✅ | `e2e/auth/authenticated.spec.js` |
| Déconnexion | `#signOutBtn` | logout → « Non connecté » | 🔒 ✅ | `e2e/auth/authenticated.spec.js` |
| Bascule inscription | `#authSwitchBtn` → `#consentBlock` | affiche pseudo + consentements | ✅ | `e2e/account-ui.spec.js` |
| Cases de consentement | `#consentAnalytics`, `#consentEmailMarketing`, `#consentDataSharing`, `#consentAdvertising` | opt-in granulaire (4 cases, décochées) | ✅ | `e2e/account-ui.spec.js`, `tests/advertisingConsent.test.js` |
| Mot de passe oublié | `#forgotPasswordBtn` → `#sendResetLinkBtn` | affiche la vue reset ; email vide → erreur | ✅ | `e2e/account-ui.spec.js` |
| Retour connexion | `#backToLoginBtn` | revient au login | ✅ | `e2e/account-ui.spec.js` |
| Gérer mes données | `#manageConsentBtn` | ouvre la gestion RGPD | ⚠️ | — |
| Exporter mes données | `#exportDataBtn` | export RGPD | ⚠️ | — |
| Supprimer mon compte | `#deleteDataBtn` | suppression (Edge Function) | ⚠️ (edge) | `supabase/functions` |
| Connexion sans identifiants | `#authSubmitBtn` | champs vides → `#authError` (validation client) | ✅ | `e2e/account-ui.spec.js` |
| Fermer | `#accountCloseBtn` | ferme l'overlay (classe `show`) | ✅ | `e2e/account-ui.spec.js` |

## Tutoriel (`#tutorialBubble`)

| Élément | Sélecteur | Parcours | Statut | Test |
|---|---|---|---|---|
| Ouverture + progression | `#startTutorialBtn` → `#tutorialProgress` | étapes 1/N → suivant | ✅ | `e2e/tutorial.spec.js` |
| Suivant | `#tutorialNextBtn` | avance d'une étape | ✅ | `e2e/tutorial.spec.js` |
| Passer | `#tutorialSkipBtn` | ferme le tutoriel | ✅ | `e2e/tutorial.spec.js` |

## Légal / PWA / pages annexes

| Élément | Cible | Statut | Test |
|---|---|---|---|
| Conditions d'utilisation | `terms.html` | ⚠️ | — |
| Confidentialité | `privacy.html` | ⚠️ | — |
| Réinitialisation mot de passe | `reset-password.html` | ⚠️ | — |
| Manifest PWA | `manifest.json` | ⚠️ | — |
| Service worker / offline | (à vérifier) | ⚠️ | — |
| Installation A2HS | manifest + meta iOS | ⚠️ | — |

## Accessibilité & visuel (transverse)

| Couverture | Écrans | Statut | Test |
|---|---|---|---|
| axe-core WCAG A/AA | accueil, config, partie, compte | ✅ | `e2e/a11y.spec.js` |
| Régression visuelle | accueil, config, plateau, compte | ✅ | `e2e/visual.spec.js` (baselines linux) |

---

### Synthèse

- **Cœur de jeu, tutoriel, i18n, shootout, a11y, visuel** : couverts.
- **Parcours authentifiés** (login, profil, boutique) : couverts via `e2e/auth/` (backend de test).
- **Ajouté par #147 — lot 1** (specs publiques) : navigation topbar (logo TM), retour config, bascules de mode + tous les groupes d'options, validation du code en ligne, annuler le coup, nouvelle partie, thèmes shootout + gating. Voir `navigation`, `config`, `game-controls`, `shootout-nav`.
- **Ajouté par #147 — lot 2** : compte côté UI — bascule inscription (consentements + pseudo), mot de passe oublié, validations client (identifiants/email vides), fermeture, gating `#profileBtn` anonyme (`account-ui`) ; navigation boutique open/back (`shop-nav`) ; navigation des 5 onglets du profil, backend de test (`auth/profile-tabs`).
- **Trous restants** : contrôles de partie avancés (pouvoir/fin de partie/overlay but — parcours long/non déterministe), achat de thème en boutique (paiement), création de joueur (quota backend), mercato (demandes/échanges), envoi réel du lien reset & actions RGPD (export/suppression), pages légales, PWA/offline. La plupart nécessitent soit un flux backend mutant, soit de jouer une partie jusqu'au but.
