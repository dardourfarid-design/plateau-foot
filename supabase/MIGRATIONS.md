# Migrations Supabase — chaîne de référence

Ce document est la **source de vérité** de l'ordre des migrations et de la
procédure de déploiement. Objectif : pouvoir recréer la base **de zéro** de
façon fiable (staging, nouveau contributeur, reprise après incident). Traçabilité : issue #17.

## Comment appliquer (de zéro)

Exécuter les fichiers de `supabase/migrations/` **dans l'ordre numérique
croissant**, une seule fois, dans le SQL Editor du dashboard Supabase (ou via
`supabase db push`). Toutes les migrations sont idempotentes (`create ... if not
exists`, `create or replace`, `on conflict`) : un rejeu ne casse rien.

> ⚠️ Ne jamais éditer une migration déjà appliquée pour en changer le
> **comportement** — ajouter une nouvelle migration à la place. Les corrections
> de **commentaires** (comme #19) sont sans effet fonctionnel et donc sûres.

## Chaîne canonique

| # | Fichier | Rôle |
|---|---------|------|
| 0001 | initial_schema | profiles / themes / purchases + RLS |
| 0002 | mock_payment_function | achat simulé (supprimé en base par 0025) |
| 0003 | new_themes | thèmes supplémentaires |
| 0004 | rename_to_tactic_master | renommage |
| 0005 | multiplayer_sessions | sessions en ligne |
| 0006 | world_cup_themes | thèmes évènement |
| 0007 | gdpr_consent | consentements RGPD + export/suppression |
| 0008 | fictional_players | catalogue joueurs fictifs + collection |
| 0009 | daily_challenges_progress | défis quotidiens + progression |
| 0010 | leaderboard | classement |
| 0011 | notification_consent | consentement notifications |
| 0012 | custom_players | joueurs personnalisés |
| 0013 | fix_lineup_custom_players | correctif compo |
| 0014 | friends_and_mercato_offers | amis + mercato |
| 0015 | fix_friendships_query | correctif requête amis |
| 0016 | pawn_powers | pouvoirs de pions |
| 0017 | player_acquisition | acquisition de joueurs |
| 0018 | fix_purchase_player_architecture | correctif achat joueur |
| 0019 | stripe_foundations | fondations Stripe |
| 0020 | fix_pending_purchase_session_update | correctif achat en attente |
| 0021 | retire_neige_theme | retrait thème |
| **0022** | **new_shop** | refonte boutique + `founders_counter` + `user_passes` |
| 0023 | tactical_coins | monnaie « pièces tactiques » |
| 0024 | ui_skins | 3 thèmes skinnés (chalkboard/stadium-night/arcade-turf) — **canonique** |
| 0025 | commercial_hardening | durcissement achats (mock supprimé, RPC service_role) |
| 0026 | coin_economy | économie de pièces + `record_game_result` |
| 0027 | shop_rationalization | rationalisation catalogue |
| 0028 | fix_level_rewards_and_challenges | correctif récompenses/défis |
| 0029 | social_sessions_pseudos | pseudos uniques + sessions |
| 0030 | fix_game_session_authorization | autorisation sessions ⚠️ *(voir manuel)* |
| 0031 | founders_decrement_in_fulfillment | décrément Fondateurs idempotent ⚠️ |
| 0032 | avatar_color_hex_constraint | contrainte hex avatar ⚠️ |
| 0033 | definer_search_path | `search_path` figé sur SECURITY DEFINER ⚠️ |
| 0034 | shootout_skins | thèmes tirs au but ⚠️ |
| 0035 | advertising_consent | finalité RGPD publicité (épic pub) |
| 0036 | rewarded_grants | crédit rewarded serveur (SSV) |

## Points résolus (hygiène — #18)

- **Collision de numéro 0022** : l'ancien `0022_ui_skins.sql` a été **supprimé**
  (doublon mort, superseded par `0024_ui_skins.sql`). Il ne reste que
  `0022_new_shop.sql` sous le numéro 0022.
- **Bug de rejeu corrigé au passage** : l'ancien `0022_ui_skins` posait les
  prix à 1,99 € et, `on conflict do nothing` oblige, `0024_ui_skins` (2,49 €)
  ne les corrigeait pas lors d'un rejeu de zéro. Avec un seul fichier (0024),
  un rejeu produit bien 2,49 €.

## Compteur Fondateurs (#19)

`founders_counter.remaining` (défaut 200) est un **plafond réel** : décrémenté à
chaque achat (0031), vente refusée à 0 (`create-checkout-session`), contrainte
`remaining >= 0`. Le nombre affiché en boutique = vrai stock restant. Pour
changer la limite, modifier la valeur initiale dans `0022_new_shop.sql`.

## Scripts de rattrapage hors-arbre (historiques)

À la racine du **workspace** (hors dépôt) traînent des scripts de rattrapage
d'anciens environnements : `FIX-rattrapage-migrations-0014-a-0027.sql`,
`FIX-amis-mercato.sql`, `ETAT-base-inventaire.sql`. **Ils ne font PAS partie de
la chaîne canonique** et ne sont **pas nécessaires à un rejeu de zéro** (leur
contenu est couvert par les migrations numérotées). À archiver/supprimer côté
workspace ; ne pas les rejouer sur une base neuve.

## À vérifier en prod (nécessite l'accès Supabase — action éditeur)

- [ ] **0030–0034 appliquées** : linter Supabase (Database → Advisors) sans
      avertissement « Function Search Path Mutable » (confirme 0033), policies
      de `game_sessions` en place (0030).
- [ ] Prix des skins en prod (`stadium-night`, `arcade-turf`) = **2,49 €**
      (249). S'ils sont à 1,99 € (199), un ancien `0022_ui_skins` a été appliqué
      avant `0024` : `update public.themes set price_cents = 249 where id in
      ('stadium-night','arcade-turf');`.
- [ ] Adopter `supabase db push` (ou un job CI) pour supprimer toute étape
      d'application « à la main ».
