# Guide des tests — combler les gaps #128–#134

Tutoriel pas-à-pas pour compléter la pyramide de tests (épic #125). Chaque
section indique **qui** fait quoi : 🧑‍💻 *toi* (infra/comptes que je ne peux pas
provisionner) · 🤖 *moi* (le code, une fois le prérequis levé).

## Rappels — comment ça marche déjà
- **Unitaires** : `node tests/run-tests.js` (runner maison, `runAll()` séquentiel — les tests async DOIVENT être déterministes : poser leur config dans le corps du test, pas au chargement, car `window.__PLATEAU_FOOT_CONFIG__` est partagé).
- **E2E** : `npm install && npx playwright test` (config `playwright.config.js`, serveur `tools/static-server.mjs` sert `public/` à la racine comme Vercel).
- **CI** : `.github/workflows/ci.yml` joue *unit + e2e + parité src* à chaque PR.

Vue d'ensemble de qui débloque quoi :

| Gap | Prérequis infra (toi) | Implémentation (moi) |
|-----|----------------------|----------------------|
| #131 a11y axe-core | — | ✅ tout de suite |
| #133 couverture c8 | — | ✅ tout de suite |
| #132 régression visuelle | valider les baselines | ✅ presque tout |
| #134 tests Edge Functions | — (Deno en CI) | ✅ tout de suite |
| #130 E2E shootout + thèmes | — | ✅ (contournement, voir §) |
| #128 intégration Supabase | **projet Supabase de test** | 🤝 après le projet |
| #129 E2E authentifiés | **projet + compte seedé** | 🤝 après le seed |

---

## #131 — Accessibilité automatisée (axe-core) 🤖 *prêt à faire*
**Objectif** : échouer la CI si un écran a des violations a11y critiques.

1. Dépendance : `npm i -D @axe-core/playwright`.
2. Test `e2e/a11y.spec.js` :
   ```js
   import { test, expect } from '@playwright/test';
   import AxeBuilder from '@axe-core/playwright';
   test('accueil sans violation a11y sérieuse', async ({ page }) => {
     await page.goto('/');
     const r = await new AxeBuilder({ page })
       .withTags(['wcag2a', 'wcag2aa'])
       .analyze();
     const graves = r.violations.filter(v => ['serious','critical'].includes(v.impact));
     expect(graves, JSON.stringify(graves.map(v=>v.id))).toEqual([]);
   }); // idem sur config/partie/compte
   ```
3. La CI e2e le joue automatiquement (même job Playwright).

**DoD** : violations serious/critical = 0 sur les écrans publics.

---

## #133 — Couverture de code (c8) + seuil CI 🤖 *prêt à faire*
**Objectif** : mesurer et verrouiller la couverture du moteur/services.

1. Dépendance : `npm i -D c8`.
2. Script `package.json` : `"coverage": "c8 --reporter=text --reporter=lcov --check-coverage --lines 70 node tests/run-tests.js"`.
3. Job CI `coverage` (nouveau) qui lance `npm run coverage` ; publie `coverage/lcov.info` en artefact.
4. Monter le seuil progressivement (70 → 80 %) au fil des tests ajoutés.

**DoD** : rapport publié + seuil minimal appliqué en CI.

---

## #132 — Régression visuelle (screenshots Playwright) 🤖 *presque tout*
**Objectif** : détecter les régressions CSS/skins.

1. Tests `e2e/visual.spec.js` :
   ```js
   test('accueil — visuel', async ({ page }) => {
     await page.goto('/');
     await expect(page).toHaveScreenshot('accueil.png', { maxDiffPixelRatio: 0.01 });
   });
   ```
2. **Générer les baselines** : `npx playwright test --update-snapshots` → commit des PNG de référence.
3. ⚠️ Baselines **par OS** : Playwright suffixe `-linux`. Générer en CI (ubuntu) via un job manuel one-shot, sinon les rendus divergent. 🧑‍💻 *toi* : valider visuellement les baselines avant de les figer.

**DoD** : baselines linux versionnées + diff visuel en CI.

---

## #134 — Tests des Edge Functions (SSV rewarded, delete-account) 🤖 *prêt à faire*
**Objectif** : verrouiller la sécurité côté serveur sans backend réel.

1. Les Edge Functions sont en **Deno** → tests Deno purs (pas de réseau) sur la logique isolée.
2. `supabase/functions/rewarded-ssv/verify.test.ts` : extraire `verifyGoogleSignature`/`derToRaw` dans un module testable, puis :
   - signature invalide → `false` ;
   - `REWARDED_SSV_ENABLED != 'true'` → l'endpoint renvoie 503 (échec fermé) ;
   - vecteur signé valide (clé de test) → `true`.
3. Job CI `edge` : `denoland/setup-deno` + `deno test supabase/functions/`.

**DoD** : rejet des signatures invalides prouvé + échec fermé vérifié.

---

## #130 — E2E séance de tirs au but + thèmes 🤖 *avec contournement*
**Subtilité** : la séance de tirs se déclenche par une **égalité en « manche courte »** (départage), pas par un bouton direct. Deux options :
- **A (recommandée)** : test d'**intégration UI** ciblé — exposer/atteindre `startShootoutDepartage()` via l'état, puis piloter un tir (clic zone + jauge) et vérifier le score. Plus rapide et déterministe.
- **B** : E2E complet — configurer une partie « manche courte », jouer jusqu'à une égalité (long, fragile).

Les thèmes de skins nécessitant la boutique (compte), la partie « changement de thème » dépend de #129. Le **moteur** penalty est déjà couvert en unitaire (`penaltyShootoutV2.test.js`).

**DoD** : un tir de la séance piloté et vérifié via l'UI (option A).

---

## #128 — Intégration services ↔ Supabase 🧑‍💻 *prérequis* puis 🤝
**Objectif** : tester les services (currency, pass, mercato…) contre un **vrai** backend, pas des mocks.

**🧑‍💻 Toi (une fois) :**
1. Créer un **projet Supabase dédié aux tests** (jamais la prod).
2. Y appliquer toute la chaîne `supabase/migrations/` (voir `MIGRATIONS.md`).
3. Fournir en **secrets GitHub** : `TEST_SUPABASE_URL`, `TEST_SUPABASE_ANON_KEY` (et `SERVICE_ROLE` pour le seed, jamais exposée au client).

**🤖 Moi (ensuite) :**
4. Un harnais qui instancie le client sur le projet de test + un `beforeEach` qui réinitialise les données.
5. Tests : gain de pièces via `record_game_result` (anti-spam), `unlock_theme_with_coins` (atomicité), refus Fondateurs à 0, RLS (un user ne lit pas les données d'un autre).
6. Job CI `integration` gardé par la présence des secrets (skip sur les forks).

**DoD** : les invariants serveur (RLS, anti-farm, idempotence) testés sur un vrai backend.

---

## #129 — E2E parcours authentifiés (compte de test seedé) 🧑‍💻 *prérequis* puis 🤝
**Objectif** : couvrir boutique / profil / mercato, qui exigent un compte.

**🧑‍💻 Toi :** le même projet de test que #128, plus un **compte de test** seedé (email/mot de passe dédiés, données de départ) en secrets `E2E_USER` / `E2E_PASS`.

**🤖 Moi :**
1. Un helper `login(page)` (remplit `#authEmail`/`#authPassword`, soumet, attend l'état connecté).
2. Storage state Playwright réutilisé entre tests (login une fois).
3. Parcours : ouvrir la boutique, acheter en **mode mock** (jamais Stripe réel), vérifier le solde ; onglets profil ; envoyer une offre mercato.

⚠️ **Ne jamais taper la prod ni Stripe Live** : provider de paiement en mock sur l'environnement de test uniquement.

**DoD** : au moins un achat mock + un parcours profil validés de bout en bout.

---

## Ordre conseillé
1. **#131 + #133** (aucun prérequis, gros ROI immédiat — je peux les faire maintenant).
2. **#134** (sécurité serveur, sans infra).
3. **#132** (visuel — tu valides les baselines).
4. **#130** (option A).
5. Quand tu as le **projet Supabase de test** → **#128** puis **#129**.

> Dis-moi « go #131 #133 » et je les implémente + branche en CI dans la foulée.
