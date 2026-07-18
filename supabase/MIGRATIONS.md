# Migrations Supabase — chaîne de référence

Ce document est la **source de vérité** de l'ordre des migrations et de la
procédure de déploiement. Objectif : pouvoir recréer la base **de zéro** de
façon fiable (staging, nouveau contributeur, reprise après incident). Traçabilité : issue #17.

## Comment appliquer

**La CI est le seul chemin d'application** (#283). Le workflow
`.github/workflows/supabase-migrations.yml` :

1. sur toute **PR** touchant `supabase/migrations/`, rejoue la chaîne complète
   depuis `0001` sur un Postgres local jetable — si une migration ne rejoue pas
   proprement, la PR échoue ;
2. sur **merge dans `main`**, applique les migrations en attente en production
   (`supabase db push --linked`), après avoir loggé la liste de ce qui va bouger.

> ⚠️ **Ne plus appliquer de migration à la main** — ni SQL Editor, ni
> `supabase db push` depuis un poste. C'est ce qui a produit les dérives
> rattrapées par `0038` et `0040`. Si une migration doit partir en urgence,
> elle part par une PR.

Secrets de dépôt requis pour le job d'application : `SUPABASE_ACCESS_TOKEN`,
`SUPABASE_PROJECT_REF`, `SUPABASE_DB_PASSWORD`.

### Recréer la base de zéro

Toutes les migrations sont idempotentes (`create ... if not exists`,
`create or replace`, `on conflict`) : un rejeu ne casse rien. Le job de rejeu
de la CI fait exactement ça à chaque PR, ce qui garde cette propriété vérifiée
plutôt que supposée.

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
| 0037 | momentum_bonus | bonus de momentum + bonus XP Pass Saison |
| 0038 | reapply_daily_challenges_rpc | rattrapage : RPC défis partie en dérive en prod |
| 0039 | lock_update_game_session_state | verrou sur l'état de session (anti-triche #260) |
| 0040 | fix_daily_challenges_ambiguous_user_id | correctif ambiguïté `user_id` (42702) |
| 0041 | leaderboard_index | index de tri du classement + borne dure sur la vue (#282) |
| 0042 | hot_path_indexes | index `user_passes(user_id, status)` — chemin de fin de partie (#284) |

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

À la racine du **workspace** (hors dépôt) traînaient des scripts de rattrapage
d'anciens environnements : `FIX-rattrapage-migrations-0014-a-0027.sql`,
`FIX-amis-mercato.sql`, `ETAT-base-inventaire.sql`. **Ils ne font PAS partie de
la chaîne canonique** et ne sont **pas nécessaires à un rejeu de zéro** (leur
contenu est couvert par les migrations numérotées). Archivés côté workspace le
2026-07-15 dans `_archive-sql-rattrapage/` ; ne pas les rejouer sur une base
neuve.

## Vérifications prod (état au 2026-07-15 — #17 clos)

- [x] **0030–0034 appliquées en prod** — confirmé par l'éditeur le 2026-07-08
      (voir #17). Le durcissement `search_path` (0033), l'autorisation des
      sessions de jeu (0030), le décrément Fondateurs idempotent (0031), la
      contrainte hex avatar (0032) et les thèmes tirs au but (0034) sont actifs.
- [x] **Prix des skins en prod = 249** — vérifié le 2026-07-15 via l'API REST
      publique (`/rest/v1/themes`) : `stadium-night` et `arcade-turf` à
      `price_cents = 249`. Le rejeu canonique (0024 seul) est cohérent avec la
      prod.
- [ ] ~~**Plus d'application manuelle**~~ — **cette case était cochée à tort**
      (corrigé le 2026-07-18, #283). L'intégration GitHub ↔ Supabase est bien
      *connectée* (#139), mais le check « Supabase Preview » est en `skipping`
      sur les PR : le branching exige le plan **Pro**, qui n'est pas actif.
      Rien ne s'appliquait automatiquement — d'où `0038` (RPC partie en dérive
      en prod) et `0039` (restée en attente d'application manuelle).
      Remplacé par le workflow `.github/workflows/supabase-migrations.yml`,
      voir « Comment appliquer » en haut de ce document.
