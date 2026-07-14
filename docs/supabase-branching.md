# Supabase ↔ GitHub : branching & environnements de test

Tutoriel pas-à-pas pour connecter le projet Supabase au dépôt GitHub et
activer le **branching** (bases de données de prévisualisation par branche).
C'est le prérequis propre pour :
- **#17** — plus aucune migration appliquée « à la main » (elles partent du repo) ;
- **#128** — tests d'intégration services ↔ Supabase sur une base jetable ;
- **#129** — E2E authentifiés sur un environnement seedé (jamais la prod).

> ⚠️ **Plan requis** : le branching Supabase nécessite le plan **Pro** (les
> branches de préversion sont facturées à l'heure d'activité). Alternative
> gratuite en bas de page.

## 1. Connecter GitHub au projet Supabase 🧑‍💻

1. Dashboard Supabase → ton projet → **Project Settings → Integrations → GitHub**.
2. **Connect** : installe la GitHub App Supabase, autorise-la sur
   `dardourfarid-design/plateau-foot`.
3. **Supabase directory path** : `supabase` (le dépôt contient déjà
   `supabase/migrations/`, `supabase/functions/`, `supabase/config.toml` — c'est
   exactement ce que l'intégration attend).
4. **Production branch** : `main`.

Effet : chaque push sur `main` qui touche `supabase/` fait appliquer les
changements au projet de production (fin des applications manuelles — critère
de #17), et des *checks* Supabase apparaissent sur les PRs.

## 2. Activer le branching 🧑‍💻

1. Dashboard → bandeau/branche en haut → **Enable branching**.
2. Confirmer `main` comme branche de production.

Effet : toute **PR qui modifie `supabase/`** provisionne automatiquement une
**branche de préversion** = une base Postgres neuve où **toute la chaîne de
migrations est rejouée de zéro** (`0001` → `0036`, voir `supabase/MIGRATIONS.md`).
Si une migration ne rejoue pas proprement, le check de la PR échoue — c'est un
test gratuit de la « rejouabilité » exigée par #17. À la fermeture de la PR, la
branche est détruite.

## 3. Créer une branche persistante `testing` 🧑‍💻

Pour #128/#129 il faut un environnement **stable** (pas détruit à chaque PR) :

1. Dashboard → sélecteur de branches → **Create branch** → nom `testing` →
   cocher **Persistent**.
2. Récupérer dans la branche `testing` : **URL du projet** et **clé `anon`**
   (Settings → API de la branche).
3. Les mettre en **secrets GitHub** du dépôt (Settings → Secrets and variables
   → Actions) :
   - `TEST_SUPABASE_URL`
   - `TEST_SUPABASE_ANON_KEY`
4. Seed : créer un **compte de test** sur cette branche (email/mot de passe
   dédiés) et l'ajouter en secrets `E2E_USER` / `E2E_PASS`.

Dès que ces 4 secrets existent, je peux implémenter #128 (harnais d'intégration)
et #129 (E2E authentifiés) — la CI les utilisera et **sautera proprement** ces
jobs sur les forks (secrets absents).

## 4. Secrets des Edge Functions par branche 🧑‍💻

Les branches n'héritent pas des secrets d'exécution : sur la branche `testing`,
poser au besoin `REWARDED_SSV_ENABLED=false` (défaut sûr) et les clés Stripe
**de test** uniquement. Jamais de clés Live hors production.

## 5. Vérifications (une fois branché)

- [ ] Ouvrir une PR touchant `supabase/migrations/` → un check « Supabase »
      apparaît et une branche de préversion se crée.
- [ ] La chaîne `0001→0036` rejoue **sans erreur** sur la branche neuve
      (valide `MIGRATIONS.md` ; sinon, corriger la migration fautive).
- [ ] `supabase db push` n'est plus nécessaire à la main (#17).
- [ ] Secrets `TEST_SUPABASE_URL` / `TEST_SUPABASE_ANON_KEY` / `E2E_USER` /
      `E2E_PASS` présents dans GitHub → me pinguer pour lancer #128/#129.

## Alternative sans plan Pro

Deux options si le branching n'est pas souhaité tout de suite :
1. **Second projet gratuit** : créer un projet Supabase « tactic-master-test »
   (le tier gratuit permet 2 projets), y rejouer `supabase/migrations/` dans
   l'ordre (SQL Editor), puis fournir les mêmes 4 secrets GitHub. Fonctionnel
   pour #128/#129, mais les migrations de test restent à appliquer à la main.
2. **Stack locale CI** : `supabase start` (Docker) dans un job GitHub Actions,
   migrations rejouées localement. Zéro coût, mais plus lent et ne couvre pas
   les Edge Functions déployées.
