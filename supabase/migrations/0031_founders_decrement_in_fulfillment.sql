-- ============================================================
-- TACTIC MASTER — Correctif : décrément Fondateurs idempotent
--
-- FAILLE : le webhook appelait decrement_founders_counter() séparément à
-- chaque `checkout.session.completed`. Stripe livre ses événements AU MOINS
-- une fois (redélivraisons normales et documentées) → le compteur d'édition
-- limitée pouvait être décrémenté plusieurs fois pour un seul achat.
--
-- CORRECTIF : on déplace le décrément DANS complete_stripe_purchase, à
-- l'intérieur de la branche `pack-fondateurs`. Cette fonction ne franchit la
-- transition pending → completed qu'UNE seule fois par session (garde
-- `status = 'pending' ... for update` + retour anticipé si déjà complétée),
-- donc le décrément s'exécute exactement une fois, quelles que soient les
-- redélivraisons. Le webhook ne doit plus appeler decrement_founders_counter
-- directement (voir stripe-webhook/index.ts dans le même correctif).
--
-- Corps identique à la version 0027, à une ligne près (le `perform
-- decrement_founders_counter()`), plus le durcissement `set search_path`.
-- ============================================================

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

    -- Décrément idempotent : exécuté une seule fois, à la transition
    -- pending → completed de CET achat (plus dans le webhook).
    perform public.decrement_founders_counter();
  end if;
end;
$$ language plpgsql security definer
set search_path = public, pg_temp;

revoke execute on function public.complete_stripe_purchase(text) from public, anon, authenticated;
grant execute on function public.complete_stripe_purchase(text) to service_role;
