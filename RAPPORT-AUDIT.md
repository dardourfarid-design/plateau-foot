# Tactic Master — Rapport d'audit pré-commercialisation

**Date** : 2 juillet 2026 · **Périmètre** : code, sécurité, monétisation, UX, SEO, légal · **Tests** : 112/112 verts après corrections · **Livrable** : `plateau-foot-pro-v0.2-audit.zip`

## Verdict global

L'architecture est saine (moteur pur testé, séparation stricte engine/UI/services, RLS partout) mais **la chaîne de monétisation était cassée ou exploitable sur presque tous les chemins d'achat**. En l'état, une mise en vente aurait encaissé des paiements sans livrer les produits (packs, bundle, pass) tout en laissant des portes ouvertes pour tout obtenir gratuitement (mock, pièces). Tous ces points sont corrigés dans ce livrable.

## Failles critiques corrigées

| # | Problème | Impact | Correction |
|---|----------|--------|------------|
| 1 | **Le front utilisait encore le paiement mock** (`paymentProvider.js`), et les RPC `mock_complete_purchase` / `mock_complete_bundle_purchase` restaient appelables par n'importe quel client authentifié | N'importe qui pouvait s'attribuer tous les produits gratuitement | Provider basculé sur Stripe ; fonctions mock **supprimées en base** (migration 0025) |
| 2 | **Packs payés jamais livrés** : les IDs de packs n'existaient pas en base → `create_pending_purchase` échouait, erreur ignorée par l'Edge Function → Stripe encaissait, le webhook ne trouvait rien | Paiement encaissé, produit non livré (risque de litiges/chargebacks immédiat) | Packs enregistrés comme produits + erreurs RPC vérifiées (abandon avant paiement) + **livraison réelle du contenu** : Académie → 3 Rares, Légendes → 2 Légendaires, 3 Kits → 3 crédits kit à dépenser librement, Fondateurs → tous les kits + 1 Légendaire + badge (`profiles.is_founder`) + Pass 90 jours |
| 3 | **Abonnements Pass jamais activés** : Stripe ne recopie pas les metadata de la session Checkout sur la Subscription → `upsertPass` ne trouvait jamais `user_id` | Abonnement prélevé chaque mois, pass jamais actif | `subscription_data.metadata` ajouté dans `create-checkout-session` |
| 4 | **`earn_coins(p_amount)`** : montant contrôlé par le client (RPC security definer) | Farm illimité de monnaie en une requête | Montant fixé serveur (10), paramètre ignoré + anti-spam (1 gain/min, 15/jour) |
| 5 | **Achat de kit par pièces non persisté** : débit des pièces puis simple `push()` local | Pièces débitées, kit perdu au rechargement | RPC atomique `unlock_theme_with_coins` (débit + ligne d'achat dans la même transaction) |
| 6 | **Bundle Mondial : 1 seul thème livré sur 5** en flux Stripe | Client payait 6,99 € pour 1 thème | Le webhook octroie désormais chaque thème (metadata `theme_ids`) |
| 7 | **Promesses du Pass non tenues** : kits non sélectionnables, Rare offert jamais octroyé, XP +20 % inexistant | Publicité mensongère de fait | Kits réellement débloqués par le pass (shopUI), Rare octroyé à l'activation (idempotent), XP +20 % appliqué côté serveur dans `record_game_result` |
| 8 | **RPCs webhook appelables par tous** (`complete_stripe_purchase`, `decrement_founders_counter`, …) | Décrémenter le compteur Fondateurs, tenter des complétions | `revoke execute` pour anon/authenticated, `grant` au seul service_role |
| 9 | **Produits virtuels affichés comme kits** en boutique (`player-…`, `custom-player-slot`, packs) | Cartes parasites achetables dans la grille | Filtre `_isRealKit()` dans shopUI |

## Durcissements et améliorations

**Sécurité web** : en-têtes ajoutés dans `vercel.json` — CSP complète (scripts limités à self + jsdelivr + plausible, connexions limitées à Supabase/Plausible), HSTS, X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy. CORS des Edge Functions restreint au domaine de production (au lieu de `*`).

**Fiabilité** : erreurs RPC vérifiées partout dans `create-checkout-session` (plus aucun échec silencieux avant paiement) ; garde d'épuisement du Pack Fondateurs ; retour `?checkout=pass_success` désormais géré (toast dédié) ; service worker remis à niveau (la liste d'assets ignorait powers.js, shopUI, profileUI, mercatoUI, tous les services et skins.css → offline cassé ; cache v3).

**Légal (indispensable pour vendre)** : nouvelle page `terms.html` — CGU/CGV françaises avec prix TTC, droit de rétractation contenu numérique (L221-28), monnaie virtuelle, résiliation, médiation. Champs `[entre crochets]` à compléter avec l'identité de l'éditeur, et **à faire relire par un professionnel** avant le Live (je ne suis pas juriste). Pied de page légal ajouté sur le jeu, sitemap mis à jour.

**SEO** : balise canonical + données structurées JSON-LD (fiche VideoGame) sur l'accueil.

## Fichiers modifiés/créés

`supabase/migrations/0025_commercial_hardening.sql` (nouveau, **à exécuter dans le SQL Editor**) · `supabase/functions/create-checkout-session/index.ts` et `stripe-webhook/index.ts` (**à redéployer**) · `src/services/payment/paymentProvider.js` · `src/services/currencyService.js` · `src/ui/shopUI.js` · `src/ui/main.js` · `public/sw.js` · `public/index.html` · `public/terms.html` (nouveau) · `public/sitemap.xml` · `vercel.json` · `README.md` (+ checklist de passage en Live). `public/src/` synchronisé.

## Actions de ton côté (déploiement)

1. Exécuter `supabase/migrations/0025_commercial_hardening.sql` dans le SQL Editor.
2. Redéployer les 2 Edge Functions : `supabase functions deploy create-checkout-session` puis `supabase functions deploy stripe-webhook`.
3. Pousser le projet sur Vercel (les en-têtes de sécurité partent avec `vercel.json`).
4. Vérifier un achat de chaque type en mode Test : kit, pack Académie, pack 3 Kits (crédits), Pass mensuel, pièces.

## Reste à faire avant le Live (non bloquant en mode Test)

Compléter et faire relire `terms.html` et `privacy.html` (bannière brouillon encore visible) ; créer les Prices Stripe Live + basculer les clés (checklist détaillée dans le README) ; vérifier le domaine Resend (les emails de reset ne partent que vers ton adresse) ; créer le compte Plausible ; prévoir une vraie image Open Graph 1200×630 (l'icône 512 fait l'affaire mais convertit moins bien) ; afficher le badge Fondateur dans le profil (la donnée `is_founder` existe désormais, l'UI reste à brancher) ; envisager de rendre le compteur Fondateurs réellement fidèle (valeur initiale « fictive » = risque d'image) ; extraction `powersUI.js` toujours au backlog (main.js à 1541 lignes).
