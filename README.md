# Tactic Master — Projet

[![CI](https://github.com/dardourfarid-design/plateau-foot/actions/workflows/ci.yml/badge.svg)](https://github.com/dardourfarid-design/plateau-foot/actions/workflows/ci.yml)
[![Non-régression complète](https://github.com/dardourfarid-design/plateau-foot/actions/workflows/full-regression.yml/badge.svg)](https://github.com/dardourfarid-design/plateau-foot/actions/workflows/full-regression.yml)
[![Smoke de production](https://github.com/dardourfarid-design/plateau-foot/actions/workflows/prod-smoke.yml/badge.svg)](https://github.com/dardourfarid-design/plateau-foot/actions/workflows/prod-smoke.yml)
[![Couverture](https://img.shields.io/badge/couverture-63%25%20lignes%20%C2%B7%2086%25%20branches-brightgreen)](docs/regression-runbook.md)

> Santé du projet en un coup d'œil. Détails et rejeu : **[Santé & non-régression](#santé--non-régression)**.

## Propriété intellectuelle

© 2026 Farid Dardour — **tous droits réservés**. Le dépôt est public à des
fins de consultation (source-available) : aucune licence de réutilisation
n'est accordée — voir [`LICENSE`](LICENSE). Provenance détaillée de chaque
composant (dépendances, polices, sons, images, marque) :
[`docs/ip-provenance.md`](docs/ip-provenance.md).

## Lancer l'app en local

Les modules JavaScript (ES modules) ne fonctionnent pas en ouvrant le fichier
HTML directement (double-clic) à cause des restrictions CORS du navigateur.
Il faut un petit serveur HTTP local — une commande suffit :

```bash
# Depuis le dossier racine du projet (celui qui contient ce README)
python3 -m http.server 8080
```

Puis ouvre dans ton navigateur :
```
http://localhost:8080/public/index.html
```

(Si tu n'as pas Python, l'équivalent avec Node : `npx serve .` puis suivre l'URL affichée.)

## Lancer les tests du moteur de jeu

```bash
npm test
```

Aucune installation préalable nécessaire (le runner de test est écrit en JS pur,
sans dépendance externe — voir `tests/test-utils.js` pour le détail).

## Santé & non-régression

Le projet dispose d'une **suite de non-régression pérenne** (épic #143) pour
surveiller la santé du projet dans la durée. Trois niveaux :

| Niveau | Déclenchement | Contenu |
|---|---|---|
| **CI** (`ci.yml`) | auto (PR / push `main`) | 6 jobs : unit, e2e, e2e-auth, edge Deno, coverage c8, intégration Supabase |
| **Non-régression complète** (`full-regression.yml`) | **à la demande** (Actions → Run workflow) | rejoue toute la suite lourde d'un coup, entrée `suite` = all/unit/e2e/quality |
| **Smoke de production** (`prod-smoke.yml`) | **à la demande** | parcours critiques anonymes contre https://tactic-master.vercel.app |

**Couverture actuelle** : moteur + services testés unitairement (16 fichiers de
tests) ; **22 fichiers de spec E2E** (parcours publics + authentifiés + smoke
prod) ; couverture c8 **63 % lignes / 86 % branches** (planchers CI : lignes 60,
fonctions 55, branches 80).

- 📋 **Inventaire exhaustif** (chaque bouton / feature / parcours + statut) : [`docs/regression-matrix.md`](docs/regression-matrix.md)
- 📖 **Mode d'emploi** (rejouer en local / à la demande, lire les rapports, régénérer les baselines, réagir à un échec) : [`docs/regression-runbook.md`](docs/regression-runbook.md)
- 📝 **Consignes ponctuelles avant un run** : [`docs/regression-notes.md`](docs/regression-notes.md)

Rejeu local rapide :

```bash
node tests/run-tests.js   # tests unitaires du moteur
npm run e2e               # E2E Playwright (parcours publics)
npm run coverage          # couverture c8 (échoue sous les planchers)
```

## Configurer Supabase

Le fichier `public/config.js` contient déjà ton URL et ta clé `anon` Supabase.
Si tu changes de projet Supabase, mets à jour ces deux valeurs (Settings → API
→ "Project URL" et clé "anon public", **pas** l'URL `/rest/v1/` ni la clé
`service_role`).

Les migrations SQL sont dans `supabase/migrations/`, dans l'ordre numéroté.
Elles sont appliquées **par la CI, jamais à la main** (#283) : un merge sur
`main` déclenche `.github/workflows/supabase-migrations.yml`, qui les rejoue
d'abord de zéro sur une base jetable, puis applique celles en attente. Voir
`supabase/MIGRATIONS.md`, qui reste la source de vérité de la chaîne.

La liste ci-dessous est là pour comprendre **ce que fait** chaque migration,
pas pour les exécuter une par une dans le SQL Editor :
1. `0001_initial_schema.sql` — tables profiles/themes/purchases + RLS
2. `0002_mock_payment_function.sql` — fonction d'achat simulé (à retirer le jour où Stripe est branché)
3. `0003_new_themes.sql` — 4 thèmes supplémentaires (Nuit de stade, Rétro 8-bit, Jungle, Crépuscule)
4. `0004_rename_to_tactic_master.sql` — mise à jour du texte suite au renommage du jeu
5. `0005_multiplayer_sessions.sql` — table et fonctions pour le multijoueur en ligne (lien d'invitation)
6. `0006_world_cup_themes.sql` — 5 thèmes événementiels + fonction d'achat groupé (bundle)
7. `0007_gdpr_consent.sql` — consentement granulaire par finalité, export et suppression de données (RGPD)
8. `0008_fictional_players.sql` — catalogue de joueurs fictifs, collection, composition d'équipe, mercato
9. `0009_daily_challenges_progress.sql` — progression (XP/niveau), streak sans punition, défis quotidiens
10. `0010_leaderboard.sql` — vue de classement
11. `0011_notification_consent.sql` — ajoute la finalité notifications au système de consentement
12. `0012_custom_players.sql` — joueurs personnalisés (freemium : 1 gratuit, le reste payant)
13. `0013_fix_lineup_custom_players.sql` — correctif pour permettre l'alignement de joueurs personnalisés
14. `0014_friends_and_mercato_offers.sql` — système d'amis et offres de mercato avec consentement
15. `0015_fix_friendships_query.sql` — correctif de fiabilité pour la lecture des amitiés
16. `0016_pawn_powers.sql` — pouvoirs de pion sur les joueurs rares/légendaires
17. `0017_player_acquisition.sql` — récompenses de palier de niveau et boutique de joueurs mercato
18. `0018_fix_purchase_player_architecture.sql` — correctif Phase 0 (audit) : l'achat de joueurs mercato suit désormais le même chemin générique que les thèmes, prêt pour le branchement Stripe
19. `0019_stripe_foundations.sql` — fonctions serveur pour le webhook Stripe (achat en attente puis confirmation signée)
20. `0020_fix_pending_purchase_session_update.sql` — correctif : mise à jour du session_id Stripe qui échouait silencieusement sous RLS
21. `0021_retire_neige_theme.sql` — retrait du thème Neige
22. `0022_new_shop.sql` — nouvelle boutique : kits Saison 1, passes (user_passes), compteur Fondateurs
23. `0023_tactical_coins.sql` — pièces tactiques (monnaie in-game)
24. `0024_ui_skins.sql` — habillages complets de plateau (skins)
25. `0025_commercial_hardening.sql` — **AUDIT COMMERCIALISATION (à exécuter absolument)** : suppression des fonctions de paiement mock (self-grant gratuit possible sinon), earn_coins à montant fixe + anti-spam, achat de kit par pièces atomique et persisté, enregistrement + livraison réelle des packs (Académie, Légendes, 3 Kits → crédits, Fondateurs), récompense Rare du pass, bonus XP +20 % du pass, verrouillage des RPCs webhook
26. `0026_coin_economy.sql` — packs de pièces achetables (Stripe), gains en jouant : +10 victoire, +3 défaite, +15 par défi complété (tout dans record_game_result), suppression d'earn_coins
27. `0027_shop_rationalization.sql` — rationalisation boutique : kit du jour à 100 pièces, packs de pièces réalignés (100/250/600 à 1,99/3,99/7,99 €) pour préserver la vente de kits à l'unité (2,49 €), pack 3 Kits à 5,49 €
28. `0037_momentum_bonus.sql` — **bonus « beau jeu » (#203)** : `record_game_result` prend un paramètre `p_best_momentum` ; un but marqué en ≥ 3 passes rapporte +10 XP et +5 pièces, décidés côté serveur et protégés par le même anti-spam que les gains de base. À exécuter après `0026`. (Les migrations `0028`–`0036` — correctifs, social, avatars, skins shootout, consentement pub, rewarded SSV — sont dans `supabase/migrations/`, à appliquer dans l'ordre numéroté.)

## Activer la réinitialisation de mot de passe

Une seule étape de configuration côté Supabase, sinon le lien envoyé par
email redirigera vers une URL refusée par sécurité :

1. Dashboard Supabase → **Authentication** → **URL Configuration**
2. Dans **Redirect URLs**, ajoute `https://tactic-master.vercel.app/reset-password.html`
3. Sauvegarde

Sans cette étape, `resetPasswordForEmail` fonctionne toujours (l'email part), mais Supabase refusera de rediriger vers la page une fois le lien cliqué.

## Activer Stripe (mode Test permanent, jamais Live)

Décision produit explicite : ce projet reste gratuit. Stripe tourne
uniquement en mode Test (clés `sk_test_`/`pk_test_`) — aucune carte réelle
n'est jamais débitée. L'architecture reste réversible vers Live plus tard
(changement de clés uniquement, aucune réécriture de code), mais ce n'est
pas l'objectif actuel.

**Étapes côté toi (je ne peux pas les faire à ta place) :**

1. Crée un compte sur [stripe.com](https://stripe.com), reste en **mode Test**
   (bouton en haut du dashboard — ne jamais basculer sur "Activer le compte" / mode Live)
2. Récupère la clé secrète de test : Dashboard → Developers → API keys → `Secret key` (commence par `sk_test_`)
3. Dans ton projet Supabase → Edge Functions → Settings (ou via la CLI `supabase secrets set`), ajoute ces variables :
   - `STRIPE_SECRET_KEY` = ta clé `sk_test_...`
   - `FRONTEND_URL` = `https://tactic-master.vercel.app`
   - `SUPABASE_SERVICE_ROLE_KEY` = trouvable dans Supabase → Project Settings → API → `service_role` (⚠️ ne JAMAIS mettre cette clé dans le code client, uniquement dans les secrets serveur)
4. Déploie les deux fonctions (`supabase/functions/create-checkout-session` et `supabase/functions/stripe-webhook`) via la CLI Supabase (`supabase functions deploy create-checkout-session`, puis pareil pour `stripe-webhook`) ou directement depuis le dashboard Supabase (Edge Functions → New Function → coller le contenu de `index.ts`)
5. Dans Stripe Dashboard → Developers → Webhooks → "Add endpoint" :
   - URL : l'URL de ta fonction `stripe-webhook` déployée (donnée par Supabase après déploiement, ressemble à `https://<ton-projet>.supabase.co/functions/v1/stripe-webhook`)
   - Événement à écouter : `checkout.session.completed`
   - Une fois créé, copie le "Signing secret" (commence par `whsec_`) et ajoute-le comme variable `STRIPE_WEBHOOK_SECRET` dans les secrets Supabase (même endroit qu'à l'étape 3)
6. Exécute la migration `0019_stripe_foundations.sql` (comme les précédentes, via le SQL Editor)
7. Dans `public/src/services/payment/paymentProvider.js`, décommente l'import Stripe et remplace `mockProvider` par `stripeProvider` — c'est le seul changement de code nécessaire pour activer réellement Stripe
8. Teste avec une [carte de test Stripe](https://docs.stripe.com/testing) (ex: `4242 4242 4242 4242`, n'importe quelle date future, n'importe quel CVC) — jamais une vraie carte, le compte étant en mode Test ça ne fonctionnerait de toute façon pas

**Pour revenir au mock à tout moment** : remettre `mockProvider` dans `paymentProvider.js`, aucune autre étape nécessaire — les deux systèmes coexistent sans conflit.

## Publicité (monétisation hors boutique)

Régie **Google AdSense** (bannières hors-jeu), consentement via le **CMP certifié Google**. Toute la logique vit dans `public/src/services/ads/` et passe par `adService` (point d'entrée unique). Détails, runbook de déploiement progressif et checklist de conformité : **`docs/monetization-ads.md`**.

**Contrôles rapides (dans `public/config.js` → `ads`) :**

- `enabled` — kill switch global (coupe toute la pub instantanément).
- `rolloutPercent` — déploiement progressif `0 → 5 → 25 → 100` (réversible sans redéploiement de code).
- `banner` / `interstitial` / `rewarded` — activation par format.
- `slots.banner` — ID du bloc AdSense.

**Garanties structurelles :** aucune pub pendant une partie ; **jamais** pour un détenteur de pass actif ; rien ne se charge en cas de refus explicite ; le crédit des vidéos récompensées est décidé **côté serveur** (SSV, migration 0036) — jamais par le client.

**Basculer AdSense ↔ mock** : changer `activeProvider` dans `public/src/services/ads/adProvider.js` (le mock sert au développement hors-ligne).

## Tester l'installation PWA

Une fois le site déployé (Vercel sert déjà tout en HTTPS, condition
obligatoire pour qu'une PWA s'installe) :

**Sur Android (Chrome) :**
1. Ouvre le site dans Chrome
2. Un bandeau "Ajouter à l'écran d'accueil" devrait apparaître automatiquement,
   ou via le menu ⋮ → "Installer l'application"
3. L'icône Tactic Master apparaît sur l'écran d'accueil, s'ouvre en plein
   écran sans barre de navigateur

**Sur iOS (Safari, obligatoire — Chrome iOS ne supporte pas l'installation) :**
1. Ouvre le site dans Safari
2. Bouton de partage (carré avec flèche) → "Sur l'écran d'accueil"
3. Confirme le nom → l'icône apparaît, s'ouvre en plein écran

**Vérification rapide depuis un ordinateur (Chrome DevTools)** : ouvre le
site, `F12` → onglet **Application** → **Manifest** : doit afficher le nom,
les icônes, et "Service Workers" doit montrer le worker comme actif.

**Limite connue** : c'est une PWA, pas une app native — pas de fiche App
Store/Google Play. Si une vraie présence sur les stores devient nécessaire,
Capacitor (https://capacitorjs.com) peut embarquer ce même code presque tel
quel ; ça demande un compte développeur Apple (99$/an) et Google (25$ une
fois), plus Xcode pour publier sur iOS — pas faisable depuis cet
environnement, à prévoir comme chantier séparé si le besoin se confirme.

## Activer le multijoueur en ligne

Le multijoueur nécessite en plus de l'auth/boutique déjà configurées :

1. Exécuter la migration `0005_multiplayer_sessions.sql` dans le SQL Editor Supabase
2. Activer Realtime sur la table `game_sessions` : dans le dashboard Supabase,
   Database → Replication → activer la réplication pour `game_sessions`
   (sans ça, les mises à jour ne sont jamais poussées aux navigateurs abonnés)
3. Tester : ouvrir l'app dans deux navigateurs (ou un normal + un en navigation
   privée), choisir "En ligne" sur l'un, "Créer une partie", copier le code,
   le coller dans l'autre via "Rejoindre"

**Limite connue de cette V1** (documentée pour le rôle backend, voir
`docs/team/developpeur-backend.md`) : aucun coup n'est revalidé côté serveur,
les deux clients font confiance à leur moteur local identique. Pas
d'anti-triche pour l'instant — acceptable pour une V1 entre amis, à revoir
avant tout mode compétitif/classé.

**Note suite à la simplification des règles (plateau 7×9, 6 pions/équipe)** :
toute partie multijoueur déjà créée en base avec l'ancienne géométrie
(9×11, 11 pions) sera incohérente avec le moteur actuel. Sans impact connu à
ce jour puisque le multijoueur n'a pas encore été testé en conditions
réelles ; à garder en tête si jamais des sessions `waiting`/`active`
anciennes traînent en base lors d'un futur nettoyage.

## Structure du projet

```
public/              fichiers servis au navigateur (HTML, CSS, config) — déployés tels quels
public/src/engine/   moteur de jeu pur (règles, aucune dépendance UI) — testé unitairement
public/src/ui/       rendu DOM + orchestration des interactions + compte/auth
public/src/services/ accès Supabase et abstraction du paiement (mock / Stripe)
supabase/            migrations SQL
tests/               suite de tests du moteur
```

> **Source unique** (#20) : `public/src/` est LE code applicatif — il n'y a
> plus de dossier `src/` dupliqué ni d'étape `node build.js`. On édite
> directement `public/src/`, ce qui est committé est ce qui est servi.

> **Fichiers HTML générés — ne pas éditer à la main :**
> - `public/en/index.html` — landing anglaise, générée par `node tools/build-en.mjs`
>   depuis `content/enLanding.mjs` (#313). Elle avait dérivé de l'accueil FR à
>   plusieurs reprises quand elle était recopiée à la main ; le contenu est
>   maintenant une donnée unique et l'échafaudage (métas, PWA, hreflang,
>   Plausible) est écrit une seule fois dans le gabarit.
> - `public/blog/*.html` — articles, générés depuis `content/blog/` (#300).
>
> Dans les deux cas, un test (`tests/enLandingGenerated.test.js`,
> `tests/blog.test.js`) échoue en CI si le fichier committé a dérivé de sa
> source : après modification du contenu, régénérer puis committer.

## Mettre l'app en ligne (déploiement réel)

Le projet est prêt pour Vercel ou Netlify (configs déjà incluses : `vercel.json`,
`netlify.toml`). Les deux ont un plan gratuit suffisant pour démarrer.

### Option Vercel (recommandée, la plus simple)

1. Crée un compte sur [vercel.com](https://vercel.com) (gratuit, connexion via GitHub possible)
2. Installe leur CLI : `npm install -g vercel` (si npm est accessible chez toi)
3. Depuis le dossier racine du projet : `vercel`
4. Réponds aux quelques questions (nom du projet, etc.) — accepte les valeurs par défaut
5. Vercel détecte `vercel.json` et publie `public/` tel quel (aucune étape de build)
6. Tu obtiens une URL publique du type `https://plateau-foot-xxxx.vercel.app`

Pour les mises à jour suivantes : `vercel --prod` republie en production.

### Option sans CLI (interface web uniquement)

1. Mets le code sur GitHub (crée un dépôt, pousse ce dossier)
2. Sur [vercel.com](https://vercel.com) → "Add New Project" → importe le dépôt GitHub
3. Vercel lit automatiquement `vercel.json` et déploie

Netlify fonctionne de façon identique via [netlify.com](https://netlify.com),
soit en CLI (`npx netlify-cli deploy`), soit en glissant le dossier du projet
directement sur leur interface "Deploy manually".

### Variables à ne pas oublier après déploiement

Le fichier `public/config.js` contient déjà ta clé Supabase `anon` (publique
par design, pas un risque de sécurité). Aucune variable d'environnement
supplémentaire n'est nécessaire pour cette étape — uniquement quand Stripe
sera branché (voir plus bas) faudra-t-il ajouter des clés serveur.

### Checklist Edge Functions — réglage `verify_jwt` (#22)

Les fonctions `delete-account` et `create-checkout-session` tournent **par
conception** avec `verify_jwt = false` : l'authentification est vérifiée
**dans** la fonction (`supabase.auth.getUser()`), pas par le gateway — qui
peut rejeter des JWT valides de façon imprévisible.

⚠️ Ce réglage est posé dans `supabase/config.toml`, **mais** il doit aussi
être vérifié dans le **Dashboard** (Edge Functions → *nom de la fonction* →
Details → « Verify JWT with legacy secret » **décoché**) après chaque
**redéploiement de fonction** : selon la méthode de déploiement, le réglage
Dashboard peut être réécrasé, ce qui casse silencieusement la suppression de
compte (RGPD) et le checkout.

**Filet de sécurité automatique** : le smoke de production
(`e2e-prod/edge-functions.spec.js`, workflow *Smoke de production*) appelle
les deux fonctions sans jeton et vérifie que la réponse 401 vient de la
fonction (`{"error":"Authentification requise."}`) et non du gateway — à
lancer après tout redéploiement d'Edge Function.



## Tester le flux compte + boutique

1. Lance le serveur local (voir ci-dessus) et ouvre l'app
2. Clique sur "Non connecté" en haut à gauche → une modale s'ouvre
3. Clique sur "Pas encore de compte ? Créer un compte"
4. Renseigne un pseudo, un email, un mot de passe → "Créer mon compte"
5. Selon la configuration de ton projet Supabase (Authentication → Settings →
   "Confirm email"), il faudra peut-être valider l'email avant de pouvoir te
   connecter. Si la confirmation email est activée, vérifie ta boîte mail.
6. Une fois connecté, ouvre "Boutique de thèmes" et clique sur "Acheter" pour
   un thème payant : l'achat est simulé instantanément (mode mock), et le
   bouton passe à "Utiliser"
7. Vérifie dans ton dashboard Supabase (Table Editor → purchases) qu'une
   ligne est apparue avec ton user_id et le bon theme_id

## Statut actuel

- 🆕 **Début du découpage de main.js (dette technique, Phase 4 du plan)** :
  extraction de la boutique de thèmes vers `public/src/ui/shopUI.js` (catalogue,
  bundle Mondial, achats individuels), -204 lignes sur `main.js`
  (2398 → 2195). Le module reçoit ses dépendances transverses (compte,
  navigation d'écran) via un objet `deps` explicite plutôt que d'accéder à
  des variables globales — pattern à reproduire pour les prochaines
  extractions (profil, mercato, pouvoirs). Vérifié sans régression
  (navigation, achat, retour d'écran) ; 89/89 tests toujours au vert.
- 🐛 **Bug corrigé : le bouton "Tout débloquer" (pack Mondial) ne faisait
  rien avec Stripe actif.** Le handler ne gérait que le cas mock
  (`result.immediate`), jamais `result.redirectUrl` retourné par Stripe —
  contrairement aux achats individuels (thème, joueur, slot) qui géraient
  déjà ce cas. Corrigé par symétrie avec les autres points d'achat.
- 🆕 **"Mot de passe oublié ?" à la connexion.** Nouveau lien sous le
  formulaire de connexion, ouvre un mini-formulaire pour saisir l'email,
  envoie un lien de réinitialisation via Supabase Auth. Nouvelle page
  `public/reset-password.html` (destination du lien dans l'email) où
  l'utilisateur choisit son nouveau mot de passe. Message volontairement
  identique que l'email existe ou non en base, pour éviter toute
  énumération de comptes existants.

- 🐛 **Bug corrigé : le paiement réussissait mais rien ne se débloquait.**
  `create-checkout-session` mettait à jour `stripe_session_id` via un
  update direct avec la clé anon — mais `purchases` n'a qu'une policy RLS
  en lecture, donc cet update échouait silencieusement (0 ligne affectée,
  aucune erreur visible). Résultat : le webhook recevait bien la
  confirmation Stripe (200 OK, paiement réussi) mais ne retrouvait jamais
  la ligne `pending` correspondante, donc ne débloquait jamais l'achat —
  sans qu'aucune erreur n'apparaisse nulle part pour le révéler. Corrigé
  via une fonction RPC dédiée (`update_pending_purchase_session_id`,
  migration `0020`). **Nécessite de redéployer `create-checkout-session`
  et d'exécuter la migration `0020`.**
- 🐛 **Bug corrigé : CORS bloquait tous les appels depuis le navigateur.**
  Les Edge Functions ne répondaient à aucune requête `OPTIONS` (préflight)
  et n'envoyaient aucun en-tête `Access-Control-Allow-*` — le navigateur
  bloquait donc la requête avant même qu'elle ne parte, symptôme observé :
  "Failed to send a request to the Edge Function" + "CORS error" dans les
  outils réseau. Corrigé dans les deux fonctions. **Si tu avais déjà
  déployé une version précédente, il faut redéployer ces deux fonctions
  avec le nouveau code.**
- 🆕 **Stripe câblé en mode Test permanent** (décision produit : le site
  reste gratuit, aucune carte réelle n'est jamais débitée). Deux Edge
  Functions écrites (`create-checkout-session`, `stripe-webhook`),
  généralisant les 4 mécanismes d'achat existants (thème, bundle, joueur
  rare/légendaire, slot personnalisé) sous un seul webhook signé. Voir la
  section "Activer Stripe" ci-dessus pour les étapes de configuration
  (création de compte, secrets, déploiement) — actions qui nécessitent un
  humain, pas encore faites ni testées en conditions réelles à ce stade.
  Le provider actif reste le mock par défaut tant que l'étape 7 de la
  section ci-dessus n'a pas été faite.

- ✅ **Audit général réalisé (29 juin 2026)** — voir le document complet
  livré séparément (technique/marketing/business + plan vers Stripe).
  Phase 0 du plan déjà appliquée :
  - Correctif d'une vraie faille de revenu : `purchase_player()` appelait
    `mock_complete_purchase` en dur, ce qui aurait laissé les joueurs
    rares/légendaires gratuits même après avoir branché Stripe sur les
    thèmes. Désormais découpé en `prepare_player_purchase()` +
    `grant_player_if_purchased()`, qui réutilisent le même chemin
    générique (`paymentProvider.js`) que les thèmes — validé par une
    simulation du flux complet.
  - Suppression de `public/src/engine/undoManager.js` (code mort, jamais importé).
  - Documentation d'équipe (`docs/team/`) resynchronisée avec l'état réel
    du projet (multijoueur livré, Stripe en tête des priorités backend).
  Prochaine étape du plan : créer les Edge Functions Stripe
  (`create-checkout-session`, `stripe-webhook`).

- 🐛 **Bug corrigé : impasse d'acquisition des joueurs à pouvoir.** Les
  pouvoirs n'étaient attribués qu'aux rares/légendaires, mais aucune voie
  n'existait pour en obtenir un premier (starter pack = communs uniquement,
  mercato suppose d'en posséder déjà un). Deux voies ajoutées :
  récompense automatique au niveau 5 (1 rare) et niveau 10 (1 légendaire,
  réclamée à l'ouverture de "Mon équipe"), et achat direct en boutique
  (2,99€ rare / 4,99€ légendaire, section "Joueurs à pouvoir" dans
  l'onglet équipe).
- 🆕 **Pouvoirs de pion (sprint dédié, mécanique terminée)** : 5 pouvoirs
  réservés aux joueurs rares/légendaires du mercato (jamais sur la
  formation de départ ni le starter pack gratuit), chacun activable une
  fois par partie — voir `public/src/engine/powers.js` (21 tests dédiés, dont un
  scénario d'intégration complet pour Relais) :
  - **Tir Puissant** : traverse un pion adverse sur la trajectoire de passe
  - **Sprint** : déplacement de 2 cases au lieu d'1
  - **Mur** : bloque les trajectoires diagonales pendant le tour adverse suivant
  - **Relais** : un second déplacement de pion après la passe (jamais une seconde passe)
  - **Repli adverse** : force un pion ennemi à reculer d'une case
  Badge violet (★) affiché sur les pions concernés, grisé une fois utilisé.
  Bouton "Utiliser le pouvoir" dans les contrôles de jeu quand applicable.
  ⚠️ **L'IA n'utilise jamais les pouvoirs pour cette V1** (elle continue de
  jouer normalement même avec un pion qui en porte un — pas de régression,
  juste une limite connue à traiter plus tard si besoin).
- 🆕 **Système d'amis et mercato avec consentement** : ajout d'ami par
  pseudo exact, acceptation/refus de demande, puis proposition d'échange
  entre amis qui nécessite l'acceptation explicite du destinataire — jamais
  d'échange direct sans consentement (l'ancienne fonction
  `execute_mercato_trade`, qui permettait ça, n'est plus appelée par aucun
  code client). Nouvel onglet "Amis & Mercato" dans Mon Profil.
- 🆕 **PWA (installable sur écran d'accueil iOS/Android)** : manifest
  (`public/manifest.json`), service worker (`public/sw.js`, cache uniquement
  les fichiers statiques — jamais les appels Supabase, qui restent toujours
  frais), icônes générées (`public/icons/`). Vérifié : le service worker
  s'enregistre sans erreur, le jeu fonctionne normalement sur un profil
  d'appareil iPhone simulé (Playwright). **Pas testé sur un vrai téléphone**
  — voir la section "Tester l'installation PWA" ci-dessous.
- 🆕 **Glisser-déposer pour la composition d'équipe** : API HTML5 Drag and
  Drop native, zones de dépôt en surbrillance, possibilité de retirer un
  joueur d'un poste (✕) ou de glisser un nouveau joueur pour remplacer
  l'occupant. Solution de repli au clic conservée pour le tactile.
- 🆕 **Création de joueurs personnalisés** : nom, style, et avatar composable
  (couleur + motif + accessoire, rendu en SVG déterministe — voir
  `public/src/ui/playerAvatar.js`, 11 tests dédiés). Modèle freemium : 1 joueur
  gratuit par compte, les suivants nécessitent l'achat d'un slot (réutilise
  le système de paiement déjà en place pour les thèmes, jamais de logique
  de quota côté client — tout vérifié dans `create_custom_player()` côté
  serveur contre la table `purchases`).
- 🐛 **Bug corrigé** : le nom du gardien se superposait au marqueur "G",
  rendant les deux illisibles sur un pion de cette taille. Le marqueur "G"
  ne s'affiche désormais que si aucun nom de joueur n'est disponible pour
  ce pion.
- ⚠️ **Migration multijoueur (`0005_multiplayer_sessions.sql`) à exécuter
  si pas encore fait** — sans elle, la création de partie en ligne échoue
  avec une erreur "function not found". Penser aussi à activer la
  réplication Realtime sur `game_sessions` (Database → Replication).
- 🆕 **Croissance produit (rétention saine)** : système de joueurs fictifs
  (14 au catalogue, 3 raretés, styles purement cosmétiques), collection,
  composition d'équipe (6 postes), mercato (échange direct entre comptes),
  progression (XP/niveau), streak quotidien **sans punition d'absence**,
  3 défis tirés chaque jour, classement. Écran "Mon profil" dans la topbar.
  Noms de joueurs affichés sur les pions en partie quand une composition
  existe (`public/src/ui/playerIdentity.js`, 9 tests dédiés).
  ⚠️ Tous les joueurs sont **entièrement fictifs**, par choix délibéré :
  voir la discussion produit qui a écarté les noms de joueurs réels ou
  "légèrement modifiés" pour raisons de droit à l'image / droit des
  marques. Le renommage par l'utilisateur reste libre (usage personnel).
- 🆕 **Notifications de retour strictement opt-in**, contenu toujours
  factuel (jamais culpabilisant — voir les templates dans
  `public/src/services/notificationService.js`). Aucun envoi réel implémenté
  encore (pas d'infrastructure Web Push) — uniquement la préférence
  utilisateur, stockée dans le même système de consentement RGPD.
- ⚠️ **Mercato V1 simplifié** : échange direct et immédiat entre deux
  comptes (pas d'offre asynchrone, pas de négociation) — à enrichir si le
  besoin se confirme.
- ℹ️ **Le jeu reste accessible sans compte** (tutoriel et parties locales/IA
  inclus). Un compte obligatoire pour jouer a été implémenté puis désactivé
  temporairement pour faciliter les tests — le code existe toujours
  (`requireAccountThen()` dans `public/src/ui/main.js`, non appelé) si on veut le
  réactiver plus tard. Un compte reste nécessaire pour la boutique, le
  profil (progression/collection/classement) et le multijoueur en ligne.
- ⚠️ **Système de consentement RGPD granulaire** : 3 cases séparées et non
  pré-cochées à l'inscription (analyse d'usage, emails marketing, partage à
  des tiers), chacune tracée individuellement en base avec horodatage
  (`user_consents`). Export et suppression de compte disponibles depuis
  "Mon compte". **Brouillon de politique de confidentialité** dans
  `public/privacy.html`, qui doit être relu par un juriste avant toute mise
  en ligne réelle ou ouverture à grande échelle — voir le bandeau
  d'avertissement en haut de cette page.
- ⚠️ **Limite RGPD connue** : la suppression de compte ne nettoie que les
  données applicatives (profil, achats, consentements) ; le compte
  d'authentification Supabase lui-même persiste. Une suppression complète
  nécessite un appel serveur avec la clé `service_role` (jamais côté
  client) — chantier documenté dans `docs/team/developpeur-backend.md`,
  point n°1, à traiter avant tout contrôle réel ou volume significatif
  d'utilisateurs.
- ✅ **Tutoriel guidé interactif** : mini-partie scriptée jouée sur le vrai
  plateau (pas une simulation séparée), 6 étapes avec bulles contextuelles
  qui mettent en valeur l'élément concerné (halo doré pulsant). Accessible
  depuis l'accueil via "Comment jouer ?". Le joueur sélectionne un pion,
  le déplace, pousse le ballon, et marque un vrai but guidé avant de basculer
  vers une partie normale. Bouton "Passer le tutoriel" disponible à tout
  moment. Voir `public/src/ui/tutorial.js` pour la séquence d'étapes.
- ✅ **Règles simplifiées (v2)** : plateau réduit de 9×11 à 7×9, 6 pions par
  équipe au lieu de 11 (1 gardien + 2 défenseurs + 3 attaquants), gardien
  limité à sa seule ligne de cage au lieu d'une zone profonde de 3 lignes —
  plus rapide à saisir et à jouer, tout en gardant de vrais choix tactiques
- ✅ Renommé en **Tactic Master** (anciennement Plateau Foot)
- ✅ 5 thèmes événementiels "Mondial" (Or Mondial, Samba, Tricolore,
  Albiceleste, Nuit Américaine) — couleurs et ambiance uniquement, aucune
  marque ni emblème officiel utilisé — + bundle promotionnel à prix réduit
  (6,99€ pour les 5 au lieu de 9,95€ séparément)
- ✅ **Bug critique corrigé** : un déséquilibre de balises `<div>` dans
  `public/index.html` (deux fermetures orphelines avant l'écran de jeu)
  faisait sortir tous les écrans suivants (boutique, overlays) du conteneur
  principal de mise en page, rendant la boutique invisible à l'écran sans
  scroll manuel. Vérifié avec un vrai parseur HTML, plus seulement à l'œil.
- ✅ Moteur de jeu testé et robuste (règles, immutabilité, anti-régression) — 53 tests automatisés
- ✅ UI reconnectée au moteur, jouable même si Supabase est indisponible
- ✅ Mode multijoueur en ligne V1 : créer une partie + code d'invitation à 6
  caractères, synchronisation temps réel via Supabase Realtime — protocole
  validé par des tests automatisés, mais **pas encore testé en conditions
  réelles avec un vrai client Supabase** (voir section dédiée ci-dessus)
- ✅ Rôles d'équipe documentés dans `docs/team/` (Game Designer, Dev
  Frontend, Dev Backend, Designer UI/UX, Growth/Marketing)
- ✅ Mise en page responsive réelle : layout deux colonnes sur desktop (plateau +
  panneau "feuille de match"), hero avec aperçu visuel sur l'accueil, grille
  boutique qui utilise correctement l'espace large — plus seulement pensé mobile
- ✅ Règles simplifiées : bouton "Terminer le tour" explicite dès qu'un pion
  touche le ballon, messages d'aide reformulés pour rester directs
- ✅ Mode solo contre l'ordinateur, 3 niveaux de difficulté (Facile / Moyen /
  Difficile) — moteur IA pur et testé dans `public/src/engine/ai.js`, aucune
  dépendance réseau, fonctionne même hors-ligne
- ✅ Schéma Supabase posé avec sécurité RLS stricte
- ✅ Système de thèmes : 8 thèmes en base (1 gratuit + 7 payants à 1,99€),
  choix persisté et appliqué automatiquement à chaque ouverture du jeu
- ✅ Catalogue de secours affiché si la connexion à Supabase échoue (au lieu d'un
  écran vide), avec avertissement clair que les achats ne fonctionneront pas
  tant que la connexion n'est pas rétablie
- ✅ Paiement mocké fonctionnel (achat simulé, pas de vrai argent)
- ✅ Connexion / inscription / déconnexion via Supabase Auth (email + mot de passe)
- ⏳ Multijoueur en ligne (lien d'invitation, liste de joueurs connectés,
  matchmaking) — pas encore commencé, nécessite Supabase Realtime
- ⏳ Stripe réel : squelette prêt dans `public/src/services/payment/stripePaymentProvider.js`,
  à compléter quand le compte Stripe sera créé (voir commentaires dans ce fichier)
- ⏳ Pas encore testé en conditions réelles avec ta vraie instance Supabase
  (le sandbox de développement n'a pas accès réseau à ton projet — à valider
  toi-même en local avec les étapes ci-dessus)



## Checklist de passage en Stripe LIVE (quand la décision sera prise)

Le code est prêt : aucun changement de code n'est nécessaire, uniquement de la configuration.

1. Exécuter la migration `0025_commercial_hardening.sql` (si pas déjà fait) — elle supprime
   les fonctions mock et corrige les chemins d'achat cassés (packs, pass, pièces, bundle).
2. Redéployer les 2 Edge Functions modifiées : `supabase functions deploy create-checkout-session`
   et `supabase functions deploy stripe-webhook`.
3. Dans Stripe Dashboard (mode Live) : créer les 2 produits Pass (Price mensuel 1,99 €,
   trimestriel 3,99 €) et renseigner `STRIPE_PRICE_MONTHLY` / `STRIPE_PRICE_QUARTERLY`
   dans les secrets Supabase.
4. Remplacer `STRIPE_SECRET_KEY` (sk_live_...) et `STRIPE_WEBHOOK_SECRET` (webhook Live)
   dans les secrets Supabase. Créer le endpoint webhook Live pointant vers
   `https://<projet>.supabase.co/functions/v1/stripe-webhook` avec les événements :
   checkout.session.completed, customer.subscription.created/updated/deleted,
   invoice.payment_succeeded, invoice.payment_failed.
5. Compléter `public/terms.html` (champs [entre crochets] : identité de l'éditeur,
   médiateur de la consommation) et faire relire CGU/CGV + politique de confidentialité
   par un professionnel. Activer la collecte de TVA (Stripe Tax recommandé).
6. Vérifier le domaine d'envoi d'emails (Resend) pour que reset de mot de passe et
   emails transactionnels partent vers tous les utilisateurs.
7. Créer le compte Plausible (data-domain déjà en place) pour suivre la conversion.
8. Tester en Live avec un vrai achat de chaque type (kit, pack, pass) puis un
   remboursement, avant toute communication publique.
