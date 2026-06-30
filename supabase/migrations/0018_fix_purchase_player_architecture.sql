-- ============================================================
-- TACTIC MASTER — Correctif Phase 0 : purchase_player suit le même chemin
-- générique que les thèmes, au lieu d'appeler mock_complete_purchase en dur.
--
-- Problème corrigé : purchase_player() (0017) appelait directement
-- mock_complete_purchase(), ce qui aurait continué de fonctionner en mode
-- "gratuit" même après avoir basculé Stripe pour les thèmes — un joueur
-- rare/légendaire serait resté débloquable sans paiement réel.
--
-- Nouveau découpage en 2 fonctions, qui réutilisent le chemin déjà
-- correct des thèmes (checkoutTheme côté client, qui route lui-même vers
-- mock ou Stripe selon paymentProvider.js — jamais décidé en SQL) :
--   1. prepare_player_purchase(player_id) : garantit l'existence de la
--      ligne "thème factice" et retourne (theme_id, price_cents) pour que
--      le client appelle checkoutTheme() normalement, comme pour un vrai
--      thème.
--   2. grant_player_if_purchased(player_id) : vérifie qu'un achat
--      'completed' existe réellement dans purchases pour ce thème factice
--      et cet utilisateur, puis seulement alors accorde le joueur. Jamais
--      l'inverse. Idempotente et rejouable sans risque (utile aussi comme
--      filet de sécurité après un webhook Stripe asynchrone).
-- ============================================================

drop function if exists public.purchase_player(uuid);

create or replace function public.prepare_player_purchase(p_player_id uuid)
returns table(theme_id text, price_cents integer) as $$
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
  on conflict (id) do update set price_cents = v_price;

  theme_id := v_theme_id;
  price_cents := v_price;
  return next;
end;
$$ language plpgsql security definer;


create or replace function public.grant_player_if_purchased(p_player_id uuid)
returns boolean as $$
declare
  v_user_id uuid := auth.uid();
  v_theme_id text := 'player-' || p_player_id::text;
  v_has_completed_purchase boolean;
begin
  if v_user_id is null then
    raise exception 'Authentification requise';
  end if;

  select exists(
    select 1 from public.purchases
    where user_id = v_user_id and theme_id = v_theme_id and status = 'completed'
  ) into v_has_completed_purchase;

  if not v_has_completed_purchase then
    return false;
  end if;

  insert into public.player_ownership (user_id, player_id, acquired_via)
  values (v_user_id, p_player_id, 'purchase')
  on conflict (user_id, player_id) do nothing;

  return true;
end;
$$ language plpgsql security definer;
