-- ============================================================
-- TACTIC MASTER — Correctifs onglet Équipe et Défis du jour
--
-- 1. claim_level_rewards : la fonction plantait SYSTÉMATIQUEMENT en
--    production avec « column reference "reward_key" is ambiguous »
--    (42702) dès que le joueur avait une progression : la variable de
--    sortie du RETURNS TABLE (reward_key) entre en conflit avec la
--    colonne level_reward_claims.reward_key dans les WHERE. Comme
--    loadTeamPanel() appelle cette RPC en premier, TOUT l'onglet
--    « Mon équipe » affichait « Équipe indisponible pour le moment ».
--    Correctif : alias de table + colonnes qualifiées.
--
-- 2. get_or_create_daily_challenges : renvoyait les lignes de
--    daily_challenges SANS les infos du template (description,
--    target_count), alors que l'UI attend ces champs — d'où des cartes
--    « Défi du jour 0/1 » sans libellé. Correctif : la fonction renvoie
--    désormais les champs du template joints. (Le client lit les deux
--    formats pour rester compatible.)
-- ============================================================

-- ---------- 1. claim_level_rewards ----------
create or replace function public.claim_level_rewards()
returns table(reward_key text, player_name text) as $$
declare
  v_user_id uuid := auth.uid();
  v_level integer;
  v_random_player record;
begin
  if v_user_id is null then
    raise exception 'Authentification requise';
  end if;

  select level into v_level from public.player_progress where user_id = v_user_id;
  if v_level is null then
    return;
  end if;

  if v_level >= 5 and not exists (
    select 1 from public.level_reward_claims lrc
    where lrc.user_id = v_user_id and lrc.reward_key = 'level_5_rare'
  ) then
    select id, name into v_random_player from public.fictional_players
      where rarity = 'rare' and is_active = true order by random() limit 1;
    if v_random_player.id is not null then
      insert into public.player_ownership (user_id, player_id, acquired_via)
        values (v_user_id, v_random_player.id, 'reward')
        on conflict (user_id, player_id) do nothing;
      insert into public.level_reward_claims (user_id, reward_key) values (v_user_id, 'level_5_rare');
      reward_key := 'level_5_rare';
      player_name := v_random_player.name;
      return next;
    end if;
  end if;

  if v_level >= 10 and not exists (
    select 1 from public.level_reward_claims lrc
    where lrc.user_id = v_user_id and lrc.reward_key = 'level_10_legendary'
  ) then
    select id, name into v_random_player from public.fictional_players
      where rarity = 'legendaire' and is_active = true order by random() limit 1;
    if v_random_player.id is not null then
      insert into public.player_ownership (user_id, player_id, acquired_via)
        values (v_user_id, v_random_player.id, 'reward')
        on conflict (user_id, player_id) do nothing;
      insert into public.level_reward_claims (user_id, reward_key) values (v_user_id, 'level_10_legendary');
      reward_key := 'level_10_legendary';
      player_name := v_random_player.name;
      return next;
    end if;
  end if;
end;
$$ language plpgsql security definer;

-- ---------- 2. get_or_create_daily_challenges ----------
-- Changement du type de retour : DROP obligatoire avant re-création.
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
$$ language plpgsql security definer;
