-- ============================================================
-- TACTIC MASTER — Défis quotidiens, streak et progression
-- Conçu pour la rétention SAINE : pas de punition en cas d'absence (un
-- streak qui casse n'enlève rien d'acquis, il repart juste à zéro pour le
-- compteur de jours consécutifs), pas de perte de progression, pas de
-- pression artificielle. Le but est l'envie de revenir, pas la peur de
-- perdre quelque chose.
-- ============================================================

-- ---------- Progression du joueur ----------
create table if not exists public.player_progress (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  xp integer not null default 0 check (xp >= 0),
  level integer not null default 1 check (level >= 1),
  games_played integer not null default 0,
  games_won integer not null default 0,
  current_streak_days integer not null default 0,
  longest_streak_days integer not null default 0,
  last_played_date date,
  updated_at timestamptz not null default now()
);

alter table public.player_progress enable row level security;

create policy "Un joueur peut lire sa propre progression"
  on public.player_progress for select
  using (auth.uid() = user_id);

-- Écriture uniquement via record_game_result() ci-dessous.


-- ---------- Défis quotidiens ----------
-- Catalogue de défis possibles (référentiel global, comme themes/players).
create table if not exists public.daily_challenge_templates (
  id uuid primary key default gen_random_uuid(),
  description text not null,
  challenge_type text not null check (challenge_type in ('win_game', 'score_goals', 'play_games', 'win_streak')),
  target_count integer not null default 1,
  xp_reward integer not null default 20,
  is_active boolean not null default true
);

alter table public.daily_challenge_templates enable row level security;

create policy "Le catalogue de défis est public en lecture"
  on public.daily_challenge_templates for select
  using (is_active = true);

-- Défi assigné à un joueur pour une date donnée, avec sa progression.
create table if not exists public.daily_challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  template_id uuid not null references public.daily_challenge_templates(id),
  challenge_date date not null default current_date,
  progress_count integer not null default 0,
  completed boolean not null default false,
  completed_at timestamptz,
  unique (user_id, template_id, challenge_date)
);

create index if not exists idx_daily_challenges_user_date on public.daily_challenges(user_id, challenge_date);

alter table public.daily_challenges enable row level security;

create policy "Un joueur peut lire ses propres défis"
  on public.daily_challenges for select
  using (auth.uid() = user_id);


-- ---------- Fonctions RPC ----------

-- Assigne (ou retourne, si déjà fait aujourd'hui) les défis du jour pour
-- l'utilisateur courant. Idempotent : appelable autant de fois que
-- nécessaire sans dupliquer les défis du jour.
create or replace function public.get_or_create_daily_challenges()
returns setof public.daily_challenges as $$
declare
  v_user_id uuid := auth.uid();
  v_count integer;
  v_template record;
begin
  if v_user_id is null then
    raise exception 'Authentification requise';
  end if;

  select count(*) into v_count from public.daily_challenges
    where user_id = v_user_id and challenge_date = current_date;

  if v_count = 0 then
    for v_template in
      select id from public.daily_challenge_templates
      where is_active = true
      order by random()
      limit 3
    loop
      insert into public.daily_challenges (user_id, template_id, challenge_date)
      values (v_user_id, v_template.id, current_date)
      on conflict (user_id, template_id, challenge_date) do nothing;
    end loop;
  end if;

  return query select * from public.daily_challenges
    where user_id = v_user_id and challenge_date = current_date;
end;
$$ language plpgsql security definer;


-- Enregistre le résultat d'une partie : met à jour XP, niveau, statistiques,
-- streak (sans jamais punir une absence — le streak repart juste à 0 puis
-- remonte, aucune autre conséquence), et fait progresser les défis du jour
-- pertinents. Point d'entrée unique appelé en fin de partie côté client.
create or replace function public.record_game_result(
  p_won boolean,
  p_goals_scored integer default 0
)
returns void as $$
declare
  v_user_id uuid := auth.uid();
  v_today date := current_date;
  v_last_played date;
  v_new_streak integer;
  v_xp_gain integer;
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
        (t.challenge_type = 'play_games') or
        (t.challenge_type = 'win_game' and p_won) or
        (t.challenge_type = 'score_goals' and p_goals_scored > 0)
      );
end;
$$ language plpgsql security definer;


-- ---------- Seed : défis quotidiens de base ----------
insert into public.daily_challenge_templates (description, challenge_type, target_count, xp_reward) values
  ('Joue une partie', 'play_games', 1, 15),
  ('Gagne une partie', 'win_game', 1, 25),
  ('Marque au moins un but', 'score_goals', 1, 15),
  ('Joue trois parties', 'play_games', 3, 30),
  ('Gagne deux parties', 'win_game', 2, 40)
on conflict do nothing;
