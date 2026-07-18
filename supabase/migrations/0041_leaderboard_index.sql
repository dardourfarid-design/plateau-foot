-- ============================================================
-- TACTIC MASTER — Classement : index de tri + borne dure
-- Issue #282 (épic scalabilité #281).
--
-- Contexte : 0010_leaderboard.sql définit la vue `leaderboard` comme une
-- lecture triée de player_progress jointe à profiles. Deux défauts, de
-- natures différentes, corrigés ici.
-- ============================================================

-- ---------- 1. Index de tri ----------
--
-- `player_progress.user_id` est clé primaire : les lectures PAR JOUEUR sont
-- déjà couvertes. Le TRI du classement, lui, ne l'est pas — Postgres doit
-- lire et trier toute la table à chaque affichage de l'onglet Classement.
-- Invisible à 500 joueurs, plusieurs centaines de ms à 50 000, et ça
-- immobilise une connexion du pool pendant ce temps.
--
-- L'index est descendant pour correspondre exactement au `order by xp desc`
-- de la vue : le planificateur peut alors parcourir l'index et s'arrêter aux
-- N premières lignes, au lieu de trier l'ensemble.
--
-- `user_id` en seconde colonne rend le tri déterministe à XP égal (sans quoi
-- deux joueurs à même XP peuvent permuter d'un affichage à l'autre) et
-- fournit au passage la clé de jointure vers `profiles` sans retour à la
-- table.
create index if not exists idx_player_progress_xp
  on public.player_progress (xp desc, user_id);

-- ---------- 2. Borne dure sur la vue ----------
--
-- La vue est `grant select` à `anon` (voir 0010). Le client borne bien à 20
-- (progressService.fetchLeaderboard), mais rien n'empêchait un appel direct
-- `select * from leaderboard` sans `limit` de ramener toute la table de
-- progression — autant un problème de charge que d'exposition de données.
--
-- Un classement est un TOP, pas un export : la pagination au-delà de 100
-- n'est pas un besoin produit. La borne supprime le pire cas sans rien
-- retirer à la fonctionnalité.
--
-- Colonnes inchangées par rapport à 0010 : `create or replace view` reste
-- valide et le client n'a rien à modifier.
create or replace view public.leaderboard as
select
  p.id as user_id,
  p.display_name,
  pr.xp,
  pr.level,
  pr.games_played,
  pr.games_won,
  pr.longest_streak_days
from public.player_progress pr
join public.profiles p on p.id = pr.user_id
order by pr.xp desc, pr.user_id
limit 100;

-- `create or replace view` ne préserve pas toujours les droits selon les
-- versions : on les repose explicitement, à l'identique de 0010.
grant select on public.leaderboard to authenticated, anon;
