-- ===================== MIGRATION 0027 — RATIONALISATION BOUTIQUE =====================
-- Objectif : préserver la vente de kits à l'unité (2,49 €) — la grille 0026
-- permettait d'obtenir un kit pour ~0,17 € via les pièces.
--
-- Nouvelle grille cohérente :
--   • Kit du jour en pièces : 100 pièces (au lieu de 10)
--   • Packs de pièces : 100 → 1,99 € | 250 → 3,99 € | 600 → 7,99 €
--     (kit effectif via pièces : 1,99 € à 1,33 € — proche du prix unitaire,
--      la remise récompense l'engagement, sans cannibaliser)
--   • Gains en jouant inchangés (+10 victoire, +3 défaite, +15/défi) :
--     un kit gratuit ≈ 1 semaine de jeu régulier — objectif de rétention sain
--   • Pack "3 Kits au choix" : 3,99 € → 5,49 € (—27 % vs 7,47 €, au lieu
--     de —47 % qui écrasait le prix unitaire)
-- À exécuter après 0026.

-- ---------- 1. Nouveaux packs de pièces, anciens désactivés ----------
-- Désactiver bloque immédiatement les achats de l'ancienne grille
-- (create_pending_purchase exige is_active = true).
update public.themes set is_active = false where id in ('coins-60', 'coins-150', 'coins-400');

insert into public.themes (id, name, description, price_cents, sort_order, config, is_active) values
  ('coins-100', '100 Pièces Tactiques', 'Pack de 100 pièces — 1 kit du jour.',        199, 9997, '{}'::jsonb, true),
  ('coins-250', '250 Pièces Tactiques', 'Pack de 250 pièces — 20 % de bonus.',        399, 9997, '{}'::jsonb, true),
  ('coins-600', '600 Pièces Tactiques', 'Pack de 600 pièces — le meilleur taux.',     799, 9997, '{}'::jsonb, true)
on conflict (id) do nothing;

-- ---------- 2. Pack "3 Kits au choix" réaligné ----------
update public.themes set price_cents = 549 where id = 'pack-3-kits';

-- ---------- 3. Kit du jour : 100 pièces ----------
create or replace function public.unlock_theme_with_coins(p_theme_id text)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_cost constant int := 100; -- grille 0027 (était 10)
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

-- ---------- 4. Livraison des nouveaux packs de pièces ----------
-- On conserve les correspondances 0026 (sessions Stripe encore en vol au
-- moment de la migration) et on ajoute la nouvelle grille.
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

  if v_purchase.theme_id like 'player-%' then
    insert into public.player_ownership (user_id, player_id, acquired_via)
    values (v_purchase.user_id, substring(v_purchase.theme_id from 8)::uuid, 'purchase')
    on conflict (user_id, player_id) do nothing;

  elsif v_purchase.theme_id like 'coins-%' then
    v_coins := case v_purchase.theme_id
      when 'coins-100' then 100
      when 'coins-250' then 250
      when 'coins-600' then 600
      -- ancienne grille 0026 (sessions en vol uniquement)
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

  elsif v_purchase.theme_id = 'pack-academie' then
    perform public.grant_random_players(v_purchase.user_id, 'rare', 3);

  elsif v_purchase.theme_id = 'pack-legendes' then
    perform public.grant_random_players(v_purchase.user_id, 'legendaire', 2);

  elsif v_purchase.theme_id = 'pack-3-kits' then
    insert into public.user_kit_credits (user_id, credits)
    values (v_purchase.user_id, 3)
    on conflict (user_id) do update
      set credits = user_kit_credits.credits + 3, updated_at = now();

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
