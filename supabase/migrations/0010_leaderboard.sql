-- ============================================================
-- TACTIC MASTER — Classement
-- Vue simple basée sur player_progress (déjà alimentée par
-- record_game_result dans 0009). Pas de table dédiée nécessaire : un
-- classement n'est qu'une lecture triée de données déjà existantes.
-- ============================================================

-- Vue publique en lecture : pseudo + stats, sans email ni autre donnée
-- sensible. Le classement doit être consultable par tous les joueurs
-- connectés, mais ne doit jamais exposer plus que ce qui est nécessaire à
-- la fonctionnalité (principe de minimisation RGPD déjà appliqué ailleurs
-- dans le projet, voir 0007_gdpr_consent.sql).
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
order by pr.xp desc;

grant select on public.leaderboard to authenticated, anon;
