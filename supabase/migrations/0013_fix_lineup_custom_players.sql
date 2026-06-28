-- ============================================================
-- TACTIC MASTER — Correctif : permettre l'alignement de joueurs personnalisés
-- team_lineups référençait strictement player_ownership(id) via une clé
-- étrangère stricte, ce qui empêchait d'aligner un joueur de
-- custom_players (table différente) — la sauvegarde de composition
-- échouait en violation de contrainte dès qu'un joueur personnalisé était
-- glissé sur un poste puis enregistré.
--
-- Solution : retirer la contrainte de clé étrangère stricte sur les 6
-- colonnes de slot (qui ne peut pointer qu'une seule table) et la
-- remplacer par une simple colonne uuid libre. La validation "cet
-- ownershipId appartient bien à l'utilisateur, dans l'une des deux tables"
-- reste de la responsabilité de l'application — comme pour d'autres règles
-- déjà gérées côté RPC plutôt que par contrainte SQL dans ce projet
-- (ex: execute_mercato_trade vérifie l'appartenance explicitement).
-- ============================================================

alter table public.team_lineups drop constraint if exists team_lineups_slot_gk_fkey;
alter table public.team_lineups drop constraint if exists team_lineups_slot_def0_fkey;
alter table public.team_lineups drop constraint if exists team_lineups_slot_def1_fkey;
alter table public.team_lineups drop constraint if exists team_lineups_slot_att0_fkey;
alter table public.team_lineups drop constraint if exists team_lineups_slot_att1_fkey;
alter table public.team_lineups drop constraint if exists team_lineups_slot_att2_fkey;
