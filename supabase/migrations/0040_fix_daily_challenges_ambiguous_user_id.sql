-- ============================================================================
-- TACTIC MASTER — Correctif : « column reference "user_id" is ambiguous » (42702)
-- ============================================================================
-- SYMPTÔME (2026-07-17, prod) : connecté, l'onglet Défis affiche « Défis
-- indisponibles pour le moment. » ; la console du client rapporte l'erreur
-- Postgres 42702 « column reference "user_id" is ambiguous — It could refer to
-- either a PL/pgSQL variable or a table column ».
--
-- CAUSE RACINE (présente depuis 0028, pas une dérive de déploiement) :
-- get_or_create_daily_challenges() déclare des colonnes de sortie
-- (RETURNS TABLE(... user_id uuid, template_id uuid, challenge_date date ...)).
-- Ces noms sont, dans le corps PL/pgSQL, des VARIABLES en portée. Or la clause
--   on conflict (user_id, template_id, challenge_date)
-- de l'INSERT réutilise ces mêmes identifiants : avec le réglage par défaut
-- plpgsql.variable_conflict = error, Postgres refuse de trancher entre la
-- variable de sortie et la colonne de table → 42702.
-- Le bug ne se déclenche qu'au PREMIER appel de la journée (quand v_count = 0,
-- donc quand la branche INSERT s'exécute) ; les appels suivants du même jour
-- sautent l'INSERT et réussissent, d'où l'intermittence observée.
-- (claim_level_rewards() a un ON CONFLICT similaire mais ses colonnes de sortie
--  sont reward_key/player_name — aucune collision — d'où son bon fonctionnement.)
--
-- REMÈDE : directive « #variable_conflict use_column » en tête du corps : en cas
-- d'ambiguïté sur un nom NON qualifié, Postgres choisit la colonne — exactement
-- ce qu'attend l'ON CONFLICT. Sans effet ailleurs : toutes les autres
-- références sont soit qualifiées (dc./t.), soit préfixées v_ (aucune colonne
-- homonyme). Les noms des colonnes de sortie sont INCHANGÉS : le client
-- (fetchTodayChallenges → data lu tel quel : description, target_count,
-- xp_reward, completed…) n'est pas impacté.
-- Idempotent : ré-exécutable sans danger (DROP + CREATE).
-- ============================================================================

drop function if exists public.get_or_create_daily_challenges();

create function public.get_or_create_daily_challenges()
returns table(
  id uuid,
  user_id uuid,
  template_id uuid,
  challenge_date date,
  progress_count integer,
  completed boolean,
  completed_at timestamptz,
  description text,
  target_count integer,
  xp_reward integer
) as $$
#variable_conflict use_column
declare
  v_user_id uuid := auth.uid();
  v_count integer;
  v_template record;
begin
  if v_user_id is null then
    raise exception 'Authentification requise';
  end if;

  select count(*) into v_count from public.daily_challenges dc
    where dc.user_id = v_user_id and dc.challenge_date = current_date;

  if v_count = 0 then
    for v_template in
      select t.id from public.daily_challenge_templates t
      where t.is_active = true
      order by random()
      limit 3
    loop
      insert into public.daily_challenges (user_id, template_id, challenge_date)
      values (v_user_id, v_template.id, current_date)
      on conflict (user_id, template_id, challenge_date) do nothing;
    end loop;
  end if;

  return query
    select dc.id, dc.user_id, dc.template_id, dc.challenge_date,
           dc.progress_count, dc.completed, dc.completed_at,
           t.description, t.target_count, t.xp_reward
    from public.daily_challenges dc
    join public.daily_challenge_templates t on t.id = dc.template_id
    where dc.user_id = v_user_id and dc.challenge_date = current_date;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;
