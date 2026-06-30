-- ============================================================
-- TACTIC MASTER — Acquisition de joueurs rares/légendaires
-- Corrige une impasse de conception : les pouvoirs n'étaient attribués
-- qu'aux rares/légendaires, mais aucune voie n'existait pour en obtenir un
-- premier. Deux voies ajoutées :
--   1. Récompense de palier de niveau (niveau 5 -> 1 rare aléatoire,
--      niveau 10 -> 1 légendaire aléatoire), une seule fois chacune.
--   2. Achat direct en boutique d'un rare ou légendaire au choix, en
--      réutilisant mock_complete_purchase (0002) déjà en place.
-- ============================================================

create table if not exists public.level_reward_claims (
  user_id uuid not null references public.profiles(id) on delete cascade,
  reward_key text not null check (reward_key in ('level_5_rare', 'level_10_legendary')),
  claimed_at timestamptz not null default now(),
  primary key (user_id, reward_key)
);

alter table public.level_reward_claims enable row level security;

create policy "Un joueur peut lire ses propres récompenses réclamées"
  on public.level_reward_claims for select
  using (auth.uid() = user_id);

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
    select 1 from public.level_reward_claims where user_id = v_user_id and reward_key = 'level_5_rare'
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
    select 1 from public.level_reward_claims where user_id = v_user_id and reward_key = 'level_10_legendary'
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


-- ---------- Achat direct en boutique ----------
create or replace function public.purchase_player(p_player_id uuid)
returns void as $$
declare
  v_user_id uuid := auth.uid();
  v_theme_id text := 'player-' || p_player_id::text;
  v_price integer;
  v_rarity text;
begin
  if v_user_id is null then
    raise exception 'Authentification requise';
  end if;

  select rarity into v_rarity from public.fictional_players where id = p_player_id and is_active = true;
  if v_rarity is null then
    raise exception 'Joueur introuvable.';
  end if;
  if v_rarity = 'commun' then
    raise exception 'Les joueurs communs ne sont pas vendus individuellement.';
  end if;

  v_price := case v_rarity when 'rare' then 299 else 499 end;

  insert into public.themes (id, name, description, price_cents, sort_order, config, is_active)
  values (v_theme_id, 'Joueur ' || v_rarity, 'Achat direct d''un joueur mercato.', v_price, 9999, '{}'::jsonb, true)
  on conflict (id) do nothing;

  perform public.mock_complete_purchase(v_theme_id, v_price);

  insert into public.player_ownership (user_id, player_id, acquired_via)
  values (v_user_id, p_player_id, 'purchase')
  on conflict (user_id, player_id) do nothing;
end;
$$ language plpgsql security definer;
