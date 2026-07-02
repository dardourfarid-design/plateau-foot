-- ===================== MIGRATION 0026 — ÉCONOMIE DES PIÈCES =====================
-- Décision produit : les pièces tactiques deviennent achetables (packs Stripe)
-- ET plus généreuses à gagner en jouant :
--   • +10 par victoire (inchangé)
--   • +3 par défaite (nouveau — chaque partie compte)
--   • +15 par défi du jour complété (nouveau)
-- Les gains passent DANS record_game_result (un seul point d'entrée serveur,
-- même anti-spam pour tout) ; earn_coins est supprimée (le client ne l'appelle
-- plus, la garder ouvrait un second chemin de farm).
-- À exécuter après 0025.

-- ---------- 1. Packs de pièces : produits virtuels (pattern 0012/0018/0025) ----------
insert into public.themes (id, name, description, price_cents, sort_order, config, is_active) values
  ('coins-60',  '60 Pièces Tactiques',  'Pack de 60 pièces à dépenser en boutique.',                 99, 9997, '{}'::jsonb, true),
  ('coins-150', '150 Pièces Tactiques', 'Pack de 150 pièces — 25 % de bonus.',                      199, 9997, '{}'::jsonb, true),
  ('coins-400', '400 Pièces Tactiques', 'Pack de 400 pièces — le meilleur taux.',                   399, 9997, '{}'::jsonb, true)
on conflict (id) do nothing;

-- ---------- 2. Nouveau type de transaction : 'purchase' ----------
alter table public.currency_transactions drop constraint if exists currency_transactions_type_check;
alter table public.currency_transactions add constraint currency_transactions_type_check
  check (type in ('win', 'spend', 'bonus', 'purchase'));

-- ---------- 3. Suppression d'earn_coins (chemin de farm désormais inutile) ----------
drop function if exists public.earn_coins(int);

-- ---------- 4. complete_stripe_purchase : livraison des packs de pièces ----------
create or replace function public.complete_stripe_purchase(p_stripe_session_id text)
returns void as $$
declare
  v_purchase record;
  v_coins int;
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

  -- Packs de pièces : crédit du solde (montant décidé ICI, jamais par le client)
  elsif v_purchase.theme_id like 'coins-%' then
    v_coins := case v_purchase.theme_id
      when 'coins-60'  then 60
      when 'coins-150' then 150
      when 'coins-400' then 400
      else 0
    end;
    if v_coins > 0 then
      insert into public.user_currency (user_id, balance)
      values (v_purchase.user_id, v_coins)
      on conflict (user_id) do update
        set balance = user_currency.balance + v_coins, updated_at = now();
      insert into public.currency_transactions (user_id, amount, type, description)
      values (v_purchase.user_id, v_coins, 'purchase', 'Achat pack de pièces : ' || v_purchase.theme_id);
    end if;

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
      and t.id not like 'player-%' and t.id not like 'pack-%'
      and t.id not like 'coins-%' and t.id <> 'custom-player-slot'
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

revoke execute on function public.complete_stripe_purchase(text) from public, anon, authenticated;
grant execute on function public.complete_stripe_purchase(text) to service_role;

-- ---------- 5. Les packs de pièces et packs ne sont pas des "kits" ----------
-- unlock_theme_with_coins / redeem_kit_credit excluent déjà pack-% et player-% ;
-- on ajoute l'exclusion coins-% aux deux.
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

  if not exists (
    select 1 from themes
    where id = p_theme_id and is_active = true and price_cents > 0
      and id not like 'player-%' and id not like 'pack-%'
      and id not like 'coins-%' and id <> 'custom-player-slot'
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
      and id not like 'player-%' and id not like 'pack-%'
      and id not like 'coins-%' and id <> 'custom-player-slot'
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

-- ---------- 6. record_game_result : XP + pièces en un seul point d'entrée ----------
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
  v_completed_now integer := 0;
  v_base_coins integer := 0;
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
  -- Base : +10 victoire / +3 défaite, protégée par le même anti-spam que
  -- l'ancienne earn_coins (1 partie/min, 15 parties récompensées/jour).
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
  end if;

  -- Bonus défis : +15 par défi complété par cette partie (max 3/jour par
  -- construction — jamais farmable au-delà).
  if v_completed_now > 0 then
    insert into public.currency_transactions (user_id, amount, type, description)
    values (v_user_id, v_completed_now * 15, 'bonus',
            'Défi(s) du jour complété(s) : ' || v_completed_now);
  end if;

  if v_base_coins + (v_completed_now * 15) > 0 then
    insert into public.user_currency (user_id, balance)
    values (v_user_id, v_base_coins + (v_completed_now * 15))
    on conflict (user_id) do update
      set balance = user_currency.balance + excluded.balance, updated_at = now();
  end if;
end;
$$ language plpgsql security definer;
