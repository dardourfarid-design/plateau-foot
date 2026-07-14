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
npm run integration              # intégration Supabase (nécessite secrets de test)
deno test --allow-env --node-modules-dir=auto supabase/functions/rewarded-ssv/   # edge
node build.js && git diff --quiet -- public/src   # parité src/ ↔ public/src/
```

Smoke de production en local :

```bash
PROD_URL=https://tactic-master.vercel.app npx playwright test --config playwright.prod.config.js
```

E2E authentifiés en local : nécessitent un `public/config.js` pointant vers le **backend de
test** + les variables `E2E_USER` / `E2E_PASS`, puis `npx playwright test --config playwright.auth.config.js`.

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
