# Plateau Foot — Projet

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

- ✅ Moteur de jeu testé et robuste (règles, immutabilité, anti-régression) — 31 tests automatisés
- ✅ UI reconnectée au moteur, jouable même si Supabase est indisponible
- ✅ Mise en page responsive réelle : layout deux colonnes sur desktop (plateau +
  panneau "feuille de match"), hero avec aperçu visuel sur l'accueil, grille
  boutique qui utilise correctement l'espace large — plus seulement pensé mobile
- ✅ Schéma Supabase posé avec sécurité RLS stricte
- ✅ Système de thèmes (4 thèmes en base, 1 gratuit + 3 payants à 1,99€)
- ✅ Catalogue de secours affiché si la connexion à Supabase échoue (au lieu d'un
  écran vide), avec avertissement clair que les achats ne fonctionneront pas
  tant que la connexion n'est pas rétablie
- ✅ Paiement mocké fonctionnel (achat simulé, pas de vrai argent)
- ✅ Connexion / inscription / déconnexion via Supabase Auth (email + mot de passe)
- ⏳ Application visuelle effective d'un thème acheté sur le plateau de jeu :
  câblée côté code (`applyTheme()` dans `themeManager.js`) mais pas encore
  déclenchée automatiquement à l'ouverture du jeu — actuellement seulement
  appliquée en live depuis l'écran boutique
- ⏳ Stripe réel : squelette prêt dans `src/services/payment/stripePaymentProvider.js`,
  à compléter quand le compte Stripe sera créé (voir commentaires dans ce fichier)
- ⏳ Pas encore testé en conditions réelles avec ta vraie instance Supabase
  (le sandbox de développement n'a pas accès réseau à ton projet — à valider
  toi-même en local avec les étapes ci-dessus)

