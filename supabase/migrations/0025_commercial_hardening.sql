-- ===================== MIGRATION 0025 — DURCISSEMENT COMMERCIAL =====================
-- Audit pré-commercialisation. Corrige les failles et chemins d'achat cassés :
--
--   1. SUPPRESSION des fonctions de paiement mock (self-grant gratuit possible
--      par n'importe quel client authentifié tant qu'elles existent).
--   2. earn_coins : le montant n'est PLUS contrôlable par le client (10 fixe),
--      + anti-spam (cooldown 60 s entre deux gains, plafond 15 gains/jour).
--   3. unlock_theme_with_coins : achat de kit par pièces ATOMIQUE et PERSISTÉ
--      (avant : débit des pièces sans ligne purchases → kit perdu au rechargement).
--   4. Packs : enregistrés comme produits (lignes themes virtuelles, même
--      pattern que 0012/0018) + octroi réel du contenu à la confirmation webhook.
--   5. Pass : récompense "1 joueur Rare offert" réellement octroyée (idempotent),
--      et bonus XP +20 % appliqué côté serveur dans record_game_result.
--   6. Verrouillage des RPCs réservées au webhook (revoke anon/authenticated).
--
-- À exécuter dans le SQL Editor Supabase, après 0024.

-- ---------- 1. Suppression des fonctions mock ----------
-- Le front bascule sur stripePaymentProvider dans le même commit. Ces deux
-- fonctions permettaient à un client authentifié de s'attribuer n'importe quel
-- produit gratuitement (security definer, appelables par tous).
drop function if exists public.mock_complete_purchase(text, integer);
drop function if exists public.mock_complete_bundle_purchase(text[], integer);

-- ---------- 2. earn_coins durci ----------
-- La signature garde le paramètre (compatibilité clients déjà déployés),
-- mais il est IGNORÉ : le montant est toujours 10, décidé ici.
create or replace function public.earn_coins(p_amount int default 10)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_amount constant int := 10; -- p_amount volontairement ignoré
  v_recent int;
  v_today_wins int;
  new_balance int;
begin
  if v_user_id is null then
    raise exception 'Authentification requise';
  end if;

  -- Anti-spam : pas plus d'un gain par minute…
  select count(*) into v_recent from currency_transactions
    where user_id = v_user_id and type = 'win' and created_at > now() - interval '60 seconds';
  -- …et pas plus de 15 gains par jour (une partie dure ~5 min, 15 victoires/jour
  -- est déjà généreux ; au-delà c'est un script, pas un joueur).
  select count(*) into v_today_wins from currency_transactions
    where user_id = v_user_id and type = 'win' and created_at::date = current_date;

  if v_recent > 0 or v_today_wins >= 15 then
    select balance into new_balance from user_currency where user_id = v_user_id;
    return coalesce(new_balance, 0); -- refus silencieux, pas d'erreur côté joueur
  end if;

  insert into user_currency (user_id, balance)
  values (v_user_id, v_amount)
  on conflict (user_id)
  do update set balance = user_currency.balance + v_amount, updated_at = now()
  returning balance into new_balance;

  insert into currency_transactions (user_id, amount, type, description)
  values (v_user_id, v_amount, 'win', 'Victoire en partie');

  return new_balance;
end;
$$;

-- ---------- 3. Achat de kit par pièces : atomique et persisté ----------
create or replace function public.unlock_theme_with_coins(p_theme_id text)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_cost constant int := 10;
  new_balance int;
begin
  if v_user_id is null then
    raise exception 'Authentification requise';
  end if;

  -- Uniquement de vrais kits visibles en boutique (jamais les produits virtuels)
  if not exists (
    select 1 from themes
    where id = p_theme_id and is_active = true and price_cents > 0
      and id not like 'player-%' and id not like 'pack-%' and id <> 'custom-player-slot'
  ) then
    raise exception 'Kit inconnu ou non éligible.';
  end if;

  if exists (select 1 from purchases where user_id = v_user_id and theme_id = p_theme_id and status = 'completed') then
    raise exception 'Kit déjà débloqué.';
  end if;

  update user_currency
  set balance = balance - v_cost, updated_at = now()
  where user_id = v_user_id and balance >= v_cost
  returning balance into new_balance;

  if new_balance is null then
    raise exception 'Solde insuffisant pour cet achat.';
  end if;

  insert into currency_transactions (user_id, amount, type, description)
  values (v_user_id, -v_cost, 'spend', 'Kit débloqué : ' || p_theme_id);

  insert into purchases (user_id, theme_id, amount_cents, status, stripe_session_id)
  values (v_user_id, p_theme_id, 0, 'completed', 'coins-' || gen_random_uuid()::text)
  on conflict (user_id, theme_id) do update set status = 'completed';

  return new_balance;
end;
$$;

-- ---------- 4a. Packs : produits enregistrés (pattern 0012/0018) ----------
-- is_active = true : exigé par create_pending_purchase. Le filtrage pour ne
-- PAS les afficher dans la grille de kits se fait côté client (shopUI).
insert into public.themes (id, name, description, price_cents, sort_order, config, is_active) values
  ('pack-3-kits',    '3 Kits au choix',   'Pack : 3 crédits kit à dépenser sur le kit de ton choix.', 399, 9998, '{}'::jsonb, true),
  ('pack-academie',  'Pack Académie',     'Pack : 3 joueurs Rares avec pouvoir.',                     499, 9998, '{}'::jsonb, true),
  ('pack-legendes',  'Pack Légendes',     'Pack : 2 joueurs Légendaires.',                            799, 9998, '{}'::jsonb, true),
  ('pack-fondateurs','Pack Fondateurs',   'Édition limitée : tous les kits + Légendaire + badge + Pass S1.', 999, 9998, '{}'::jsonb, true)
on conflict (id) do nothing;

-- ---------- 4b. Crédits kit (livraison du pack "3 Kits au choix") ----------
create table if not exists public.user_kit_credits (
  user_id    uuid primary key references public.profiles(id) on delete cascade,
  credits    int  not null default 0 check (credits >= 0),
  updated_at timestamptz not null default now()
);
alter table public.user_kit_credits enable row level security;
create policy "lecture crédits par propriétaire"
  on public.user_kit_credits for select
  using (auth.uid() = user_id);

create or replace function public.redeem_kit_credit(p_theme_id text)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_remaining int;
begin
  if v_user_id is null then
    raise exception 'Authentification requise';
  end if;

  if not exists (
    select 1 from themes
    where id = p_theme_id and is_active = true and price_cents > 0
      and id not like 'player-%' and id not like 'pack-%' and id <> 'custom-player-slot'
  ) then
    raise exception 'Kit inconnu ou non éligible.';
  end if;

  if exists (select 1 from purchases where user_id = v_user_id and theme_id = p_theme_id and status = 'completed') then
    raise exception 'Kit déjà débloqué.';
  end if;

  update user_kit_credits
  set credits = credits - 1, updated_at = now()
  where user_id = v_user_id and credits >= 1
  returning credits into v_remaining;

  if v_remaining is null then
    raise exception 'Aucun crédit kit disponible.';
  end if;

  insert into purchases (user_id, theme_id, amount_cents, status, stripe_session_id)
  values (v_user_id, p_theme_id, 0, 'completed', 'kit-credit-' || gen_random_uuid()::text)
  on conflict (user_id, theme_id) do update set status = 'completed';

  return v_remaining;
end;
$$;

create or replace function public.get_my_kit_credits()
returns int
language sql
security definer
set search_path = public
as $$
  select coalesce((select credits from public.user_kit_credits where user_id = auth.uid()), 0);
$$;

-- ---------- 4c. Badge Fondateur ----------
alter table public.profiles add column if not exists is_founder boolean not null default false;

-- ---------- 4d. Octroi de joueurs aléatoires (utilisé par le fulfillment) ----------
-- Réservée au webhook (service_role) : revoke plus bas.
create or replace function public.grant_random_players(p_user_id uuid, p_rarity text, p_count int)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into player_ownership (user_id, player_id, acquired_via)
  select p_user_id, fp.id, 'reward'
  from fictional_players fp
  where fp.rarity = p_rarity and fp.is_active = true
    and not exists (select 1 from player_ownership po where po.user_id = p_user_id and po.player_id = fp.id)
  order by random()
  limit p_count;
end;
$$;

-- ---------- 4e. complete_stripe_purchase : fulfillment complet ----------
-- Ajoute la livraison réelle du contenu des packs (avant : un pack payé ne
-- livrait RIEN — la pire situation possible commercialement).
create or replace function public.complete_stripe_purchase(p_stripe_session_id text)
returns void as $$
declare
  v_purchase record;
begin
  select * into v_purchase from public.purchases
    where stripe_session_id = p_stripe_session_id and status = 'pending'
    for update;

  if v_purchase is null then
    return; -- idempotence webhook
  end if;

  update public.purchases set status = 'completed' where id = v_purchase.id;

  -- Joueur rare/légendaire à l'unité
  if v_purchase.theme_id like 'player-%' then
    insert into public.player_ownership (user_id, player_id, acquired_via)
    values (v_purchase.user_id, substring(v_purchase.theme_id from 8)::uuid, 'purchase')
    on conflict (user_id, player_id) do nothing;

  -- Pack Académie : 3 Rares
  elsif v_purchase.theme_id = 'pack-academie' then
    perform public.grant_random_players(v_purchase.user_id, 'rare', 3);

  -- Pack Légendes : 2 Légendaires
  elsif v_purchase.theme_id = 'pack-legendes' then
    perform public.grant_random_players(v_purchase.user_id, 'legendaire', 2);

  -- Pack 3 Kits : 3 crédits kit à dépenser librement
  elsif v_purchase.theme_id = 'pack-3-kits' then
    insert into public.user_kit_credits (user_id, credits)
    values (v_purchase.user_id, 3)
    on conflict (user_id) do update
      set credits = user_kit_credits.credits + 3, updated_at = now();

  -- Pack Fondateurs : tous les kits + 1 Légendaire + badge + Pass S1 (3 mois)
  elsif v_purchase.theme_id = 'pack-fondateurs' then
    insert into public.purchases (user_id, theme_id, amount_cents, status, stripe_session_id)
    select v_purchase.user_id, t.id, 0, 'completed', 'founders-' || gen_random_uuid()::text
    from public.themes t
    where t.is_active = true and t.price_cents > 0
      and t.id not like 'player-%' and t.id not like 'pack-%' and t.id <> 'custom-player-slot'
    on conflict (user_id, theme_id) do update set status = 'completed';

    perform public.grant_random_players(v_purchase.user_id, 'legendaire', 1);

    update public.profiles set is_founder = true, updated_at = now()
      where id = v_purchase.user_id;

    insert into public.user_passes (user_id, pass_type, stripe_subscription_id, status, current_period_end)
    values (v_purchase.user_id, 'quarterly', 'founders-' || v_purchase.user_id::text, 'active', now() + interval '90 days')
    on conflict (stripe_subscription_id) do nothing;
  end if;
end;
$$ language plpgsql security definer;

-- ---------- 5a. Récompense "1 Rare offert" à l'activation d'un pass ----------
create table if not exists public.pass_reward_granted (
  user_id    uuid primary key references public.profiles(id) on delete cascade,
  granted_at timestamptz not null default now()
);
alter table public.pass_reward_granted enable row level security;
create policy "lecture par propriétaire"
  on public.pass_reward_granted for select
  using (auth.uid() = user_id);

create or replace function public.grant_pass_rare_reward(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Idempotent : une seule récompense de pass par utilisateur, à vie.
  insert into pass_reward_granted (user_id) values (p_user_id)
  on conflict (user_id) do nothing;

  if found then
    perform public.grant_random_players(p_user_id, 'rare', 1);
  end if;
end;
$$;

-- ---------- 5b. record_game_result : bonus XP +20 % si pass actif ----------
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
  v_has_pass boolean;
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

  -- Bonus XP +20 % promis par le Pass Saison — appliqué ici, côté serveur,
  -- jamais côté client (le client ne calcule jamais d'XP).
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
      );
end;
$$ language plpgsql security definer;

-- ---------- 6. Verrouillage des RPCs réservées au webhook ----------
-- security definer + EXECUTE public par défaut = n'importe quel client
-- authentifié pouvait appeler ces fonctions. Seul le service_role (webhook)
-- doit pouvoir : compléter un achat, décrémenter le compteur Fondateurs,
-- octroyer des joueurs ou la récompense de pass.
revoke execute on function public.complete_stripe_purchase(text) from public, anon, authenticated;
revoke execute on function public.decrement_founders_counter() from public, anon, authenticated;
revoke execute on function public.grant_random_players(uuid, text, int) from public, anon, authenticated;
revoke execute on function public.grant_pass_rare_reward(uuid) from public, anon, authenticated;

-- Le webhook (service_role) garde explicitement le droit d'exécution.
grant execute on function public.complete_stripe_purchase(text) to service_role;
grant execute on function public.decrement_founders_counter() to service_role;
grant execute on function public.grant_random_players(uuid, text, int) to service_role;
grant execute on function public.grant_pass_rare_reward(uuid) to service_role;
