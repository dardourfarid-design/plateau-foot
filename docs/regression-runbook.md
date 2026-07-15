# Runbook de non-régression — santé du projet

> Comment **rejouer périodiquement** toute la suite de tests pour vérifier la santé du projet.
> Inventaire de ce qui est couvert : [`regression-matrix.md`](./regression-matrix.md).
> Épic : **[EPIC] Non-régression pérenne** (#143).

Le projet a deux niveaux de tests :

| Niveau | Quand | Où |
|---|---|---|
| **CI rapide** (`ci.yml`) | automatique, à chaque PR/push sur `main` | 7 jobs |
| **Non-régression complète** (`full-regression.yml`) | **à la demande** (bouton) | tous les jobs, rapports 14 j |
| **Smoke de production** (`prod-smoke.yml`) | **à la demande** (bouton) | prod live |

## 0. Notes ponctuelles avant un run

Avant de lancer une non-régression, écris tes consignes du moment (périmètre,
exclusions, contexte) dans [`regression-notes.md`](./regression-notes.md) — un seul
fichier en texte libre. Claude le lit en premier à chaque demande de « lancer les
tests de non-régression » et en tient compte.

## 1. Rejouer à la demande sur GitHub (recommandé)

Onglet **Actions** du repo → choisir le workflow → **Run workflow** :

- **Non-régression complète** : rejoue unit, parité, e2e, e2e-auth, edge, coverage, intégration.
  Choisir le périmètre via l'entrée `suite` (`all` par défaut, ou `unit` / `e2e` / `quality`).
- **Smoke de production** : vérifie que https://tactic-master.vercel.app répond et que les
  parcours critiques marchent. Entrée `prod_url` pour cibler une preview/branche.

Les rapports (Playwright HTML, `coverage/lcov.info`) sont attachés au run comme *artifacts*.

## 2. Rejouer en local

Prérequis : `npm install` puis `npx playwright install chromium` (déjà faits sur la machine de dev).

```bash
node tests/run-tests.js          # unitaires (moteur + UI-pure + pub), sans dépendances
npm run e2e                      # E2E publics (Playwright, sert public/ tout seul)
npm run coverage                 # couverture c8 (échoue sous les seuils package.json)
npm run integration              # intégration Supabase — CI uniquement (sans secrets : sauté ; avec : refusé hors CI)
deno test --allow-env --node-modules-dir=auto supabase/functions/rewarded-ssv/   # edge
```

> `public/src/` est la **source unique** du code applicatif (#20) : l'ancien
> contrôle de parité `src/ ↔ public/src/` (et `build.js`) n'existe plus.

> **⛔ Smoke prod et E2E authentifiés : CI uniquement (politique IT, 2026-07-15).**
> Ces deux suites génèrent du trafic réseau vers le backend Supabase depuis la
> machine qui les lance — interdit depuis les postes de travail. Les configs
> (`playwright.prod.config.js`, `playwright.auth.config.js`) refusent désormais
> de démarrer hors CI (`CI` non défini → erreur explicite).
>
> - Smoke prod → workflow **prod-smoke** (Actions → Run workflow).
> - E2E authentifiés → job **« E2E authentifiés »** de `ci.yml` (à chaque PR)
>   ou **full-regression** (à la demande).
> - **Tests manuels de l'app** (achat, suppression de compte…) : appareil
>   **hors réseau d'entreprise** — le front appelle le backend par nature.
> - Les **E2E publics** restent lançables en local : `e2e/fixtures.js` coupe
>   toute requête vers le backend avant qu'elle ne quitte le processus et
>   fait échouer le test en cas de fuite non prévue (les lectures publiques
>   thèmes/Fondateurs sont coupées silencieusement — catalogue de secours).
>   Les lectures « mes données » sont gardées par session locale
>   (`hasLocalSession`, supabaseClient.js) : un anonyme ne déclenche plus
>   aucun RPC.

### Piège Windows

Des serveurs statiques fantômes s'accumulent sur le port **8080** entre deux runs. Avant de
relancer, les tuer :

```powershell
Get-NetTCPConnection -LocalPort 8080 -State Listen | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
```

## 3. Lire les rapports

- **Playwright** : `playwright-report/` (local) ou l'artifact `playwright-report` / `-auth` / `-prod` du run.
  Ouvrir avec `npx playwright show-report`.
- **Couverture** : artifact `coverage-lcov` → `coverage/lcov.info`. Résumé texte affiché en fin de `npm run coverage`.

## 4. Régénérer les baselines visuelles

Après un **changement d'UI volontaire**, les tests `e2e/visual.spec.js` échouent tant que les
images de référence (Linux) ne sont pas régénérées :

```bash
gh workflow run visual-baselines.yml
```

⚠️ Sur ce repo, GitHub Actions **ne peut pas créer la PR** : le workflow pousse une branche avec
les nouveaux PNG → créer la PR à la main puis la merger.

## 5. Réagir à un échec

1. **E2E rouge en local mais pas en CI (ou l'inverse)** → souvent un flake de timing ou un
   serveur 8080 fantôme (voir piège Windows). Relancer une fois.
2. **`a11y` / `visual` rouge** → vérifier si c'est un changement d'UI voulu ; si oui, régénérer
   les baselines (§4) ; sinon, régression réelle à corriger.
3. **`integration` / `e2e-auth` sautés** → secrets de test absents (normal sur un fork).
   Sur le repo principal, vérifier les secrets `TEST_SUPABASE_*` / `E2E_USER` / `E2E_PASS`.
4. **`prod-smoke` rouge** → panne de prod : vérifier le dernier déploiement Vercel et `config.js`.
5. **Nouveau test async instable** → il doit rester **déterministe** : poser sa config
   `window.__PLATEAU_FOOT_CONFIG__` dans le corps du test, pas au chargement (état partagé).

## 6. Étendre la couverture

Chaque ligne ⚠️ de la [matrice](./regression-matrix.md) est un test à écrire — suivi dans
l'issue **#147** (« Combler les trous »). Après ajout d'un test, passer la ligne à ✅.
