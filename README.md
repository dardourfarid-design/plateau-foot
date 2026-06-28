# Tactic Master — Projet

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

## Configurer Supabase

Le fichier `public/config.js` contient déjà ton URL et ta clé `anon` Supabase.
Si tu changes de projet Supabase, mets à jour ces deux valeurs (Settings → API
→ "Project URL" et clé "anon public", **pas** l'URL `/rest/v1/` ni la clé
`service_role`).

Les migrations SQL à exécuter (une seule fois, dans le SQL Editor de ton
dashboard Supabase) sont dans `supabase/migrations/`, dans l'ordre numéroté :
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
src/engine/      moteur de jeu pur (règles, aucune dépendance UI) — testé unitairement
src/ui/          rendu DOM + orchestration des interactions + compte/auth
src/services/    accès Supabase et abstraction du paiement (mock / Stripe)
public/          fichiers servis au navigateur (HTML, CSS, config)
supabase/        migrations SQL
tests/           suite de tests du moteur (31 tests)
```

## Mettre l'app en ligne (déploiement réel)

Le projet est prêt pour Vercel ou Netlify (configs déjà incluses : `vercel.json`,
`netlify.toml`). Les deux ont un plan gratuit suffisant pour démarrer.

### Option Vercel (recommandée, la plus simple)

1. Crée un compte sur [vercel.com](https://vercel.com) (gratuit, connexion via GitHub possible)
2. Installe leur CLI : `npm install -g vercel` (si npm est accessible chez toi)
3. Depuis le dossier racine du projet : `vercel`
4. Réponds aux quelques questions (nom du projet, etc.) — accepte les valeurs par défaut
5. Vercel détecte `vercel.json`, exécute `node build.js`, publie `public/`
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

- 🆕 **Glisser-déposer pour la composition d'équipe** : API HTML5 Drag and
  Drop native, zones de dépôt en surbrillance, possibilité de retirer un
  joueur d'un poste (✕) ou de glisser un nouveau joueur pour remplacer
  l'occupant. Solution de repli au clic conservée pour le tactile.
- 🆕 **Création de joueurs personnalisés** : nom, style, et avatar composable
  (couleur + motif + accessoire, rendu en SVG déterministe — voir
  `src/ui/playerAvatar.js`, 11 tests dédiés). Modèle freemium : 1 joueur
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
  existe (`src/ui/playerIdentity.js`, 9 tests dédiés).
  ⚠️ Tous les joueurs sont **entièrement fictifs**, par choix délibéré :
  voir la discussion produit qui a écarté les noms de joueurs réels ou
  "légèrement modifiés" pour raisons de droit à l'image / droit des
  marques. Le renommage par l'utilisateur reste libre (usage personnel).
- 🆕 **Notifications de retour strictement opt-in**, contenu toujours
  factuel (jamais culpabilisant — voir les templates dans
  `src/services/notificationService.js`). Aucun envoi réel implémenté
  encore (pas d'infrastructure Web Push) — uniquement la préférence
  utilisateur, stockée dans le même système de consentement RGPD.
- ⚠️ **Mercato V1 simplifié** : échange direct et immédiat entre deux
  comptes (pas d'offre asynchrone, pas de négociation) — à enrichir si le
  besoin se confirme.
- ℹ️ **Le jeu reste accessible sans compte** (tutoriel et parties locales/IA
  inclus). Un compte obligatoire pour jouer a été implémenté puis désactivé
  temporairement pour faciliter les tests — le code existe toujours
  (`requireAccountThen()` dans `src/ui/main.js`, non appelé) si on veut le
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
  moment. Voir `src/ui/tutorial.js` pour la séquence d'étapes.
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
  Difficile) — moteur IA pur et testé dans `src/engine/ai.js`, aucune
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
- ⏳ Stripe réel : squelette prêt dans `src/services/payment/stripePaymentProvider.js`,
  à compléter quand le compte Stripe sera créé (voir commentaires dans ce fichier)
- ⏳ Pas encore testé en conditions réelles avec ta vraie instance Supabase
  (le sandbox de développement n'a pas accès réseau à ton projet — à valider
  toi-même en local avec les étapes ci-dessus)

