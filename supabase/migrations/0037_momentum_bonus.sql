-- ============================================================================
-- 0037_momentum_bonus.sql — Bonus de « beau jeu » (momentum) (#203)
-- ----------------------------------------------------------------------------
-- La v0.5 expose `lastGoalPassStreak` (nb de passes de l'action d'un but) mais
-- le bonus n'était jamais crédité. On étend record_game_result d'un paramètre
-- `p_best_momentum` (meilleur momentum d'un but marqué par le joueur sur la
-- partie) et on récompense un but construit en >= 3 passes :
--   +10 XP (avant le multiplicateur de Pass), et +5 pièces.
--
-- Le montant est décidé ICI, jamais par le client, et le bonus pièces est
-- protégé par le MÊME anti-spam que les gains de base (1 partie/min, 15
-- parties récompensées/jour) : impossible de farmer au-delà.
--
-- À exécuter après 0026 (idempotent : remplace la fonction).
-- ============================================================================

-- L'ancienne signature (boolean, integer) est remplacée par (boolean, integer,
-- integer). On la supprime pour ne pas laisser deux surcharges coexister.
drop function if exists public.record_game_result(boolean, integer);

create or replace function public.record_game_result(
  p_won boolean,
  p_goals_scored integer default 0,
  p_best_momentum integer default 0
)
returns void as $$
declare
  v_user_id uuid := auth.uid();
  v_today date := current_date;
  v_last_played date;
  v_new_streak integer;
  v_xp_gain integer;
  v_has_pass boolean;
  v_completed_now integer := 0;
  v_base_coins integer := 0;
  v_momentum_xp integer := 0;
  v_momentum_coins integer := 0;
  v_recent integer;
  v_today_games integer;
begin
  if v_user_id is null then
    raise exception 'Authentification requise';
  end if;

  insert into public.player_progress (user_id) values (v_user_id)
    on conflict (user_id) do nothing;

  select last_played_date into v_last_played from public.player_progress where user_id = v_user_id;

  if v_last_played = v_today then
    v_new_streak := null;
  elsif v_last_played = v_today - interval '1 day' then
    v_new_streak := (select current_streak_days + 1 from public.player_progress where user_id = v_user_id);
  else
    v_new_streak := 1;
  end if;

  v_xp_gain := 10 + (p_goals_scored * 5) + (case when p_won then 20 else 0 end);

  -- #203 : bonus « beau jeu » — un but marqué en >= 3 passes rapporte +10 XP,
  -- ajouté AVANT le multiplicateur de Pass (donc lui aussi boosté de 20 %).
  if coalesce(p_best_momentum, 0) >= 3 then
    v_momentum_xp := 10;
    v_xp_gain := v_xp_gain + v_momentum_xp;
  end if;

  -- Bonus XP +20 % du Pass Saison, appliqué côté serveur (0025)
  select exists (
    select 1 from public.user_passes
    where user_id = v_user_id and status = 'active'
      and (current_period_end is null or current_period_end > now())
  ) into v_has_pass;

  if v_has_pass then
    v_xp_gain := round(v_xp_gain * 1.2);
  end if;

  update public.player_progress set
    xp = xp + v_xp_gain,
    level = 1 + floor((xp + v_xp_gain) / 100.0)::integer,
    games_played = games_played + 1,
    games_won = games_won + (case when p_won then 1 else 0 end),
    current_streak_days = coalesce(v_new_streak, current_streak_days),
    longest_streak_days = greatest(longest_streak_days, coalesce(v_new_streak, current_streak_days)),
    last_played_date = v_today,
    updated_at = now()
  where user_id = v_user_id;

  -- Défis du jour : progression + comptage de ceux complétés PAR CETTE partie
  with bumped as (
    update public.daily_challenges dc
      set progress_count = progress_count + 1,
          completed = (progress_count + 1) >= (select target_count from public.daily_challenge_templates t where t.id = dc.template_id),
          completed_at = case when completed then completed_at else now() end
      from public.daily_challenge_templates t
      where dc.template_id = t.id
        and dc.user_id = v_user_id
        and dc.challenge_date = v_today
        and dc.completed = false
        and (
          t.challenge_type = 'play_games'
          or (t.challenge_type = 'win_games' and p_won)
          or (t.challenge_type = 'score_goals' and p_goals_scored > 0)
        )
      returning dc.completed
  )
  select count(*) into v_completed_now from bumped where completed;

  -- ── Pièces tactiques ──────────────────────────────────────────────
  -- Base : +10 victoire / +3 défaite, protégée par l'anti-spam (1 partie/min,
  -- 15 parties récompensées/jour). Le bonus momentum suit le MÊME plafond.
  select count(*) into v_recent from public.currency_transactions
    where user_id = v_user_id and description in ('Victoire en partie', 'Partie jouée')
      and created_at > now() - interval '60 seconds';
  select count(*) into v_today_games from public.currency_transactions
    where user_id = v_user_id and description in ('Victoire en partie', 'Partie jouée')
      and created_at::date = v_today;

  if v_recent = 0 and v_today_games < 15 then
    v_base_coins := case when p_won then 10 else 3 end;
    insert into public.currency_transactions (user_id, amount, type, description)
    values (v_user_id, v_base_coins,
            case when p_won then 'win' else 'bonus' end,
            case when p_won then 'Victoire en partie' else 'Partie jouée' end);

    -- #203 : +5 pièces pour un but construit en >= 3 passes (dans le même
    -- créneau anti-spam, donc jamais farmable au-delà des gains de base).
    if coalesce(p_best_momentum, 0) >= 3 then
      v_momentum_coins := 5;
      insert into public.currency_transactions (user_id, amount, type, description)
      values (v_user_id, v_momentum_coins, 'bonus',
              'Beau but (momentum) : ' || p_best_momentum || ' passes');
    end if;
  end if;

  -- Bonus défis : +15 par défi complété par cette partie (max 3/jour par
  -- construction — jamais farmable au-delà).
  if v_completed_now > 0 then
    insert into public.currency_transactions (user_id, amount, type, description)
    values (v_user_id, v_completed_now * 15, 'bonus',
            'Défi(s) du jour complété(s) : ' || v_completed_now);
  end if;

  if v_base_coins + v_momentum_coins + (v_completed_now * 15) > 0 then
    insert into public.user_currency (user_id, balance)
    values (v_user_id, v_base_coins + v_momentum_coins + (v_completed_now * 15))
    on conflict (user_id) do update
      set balance = user_currency.balance + excluded.balance, updated_at = now();
  end if;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;
