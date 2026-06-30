-- ============================================================
-- TACTIC MASTER — Fondations Stripe (sandbox permanent, réversible vers Live)
-- Ce projet reste volontairement gratuit : Stripe tourne uniquement en
-- mode Test (clés sk_test_/pk_test_), jamais en Live, par décision produit
-- explicite. L'architecture reste cependant réversible : basculer vers Live
-- ne demande qu'un changement de clés côté Supabase (variables
-- d'environnement des Edge Functions), jamais une réécriture de ce code.
--
-- Cette migration ajoute les pièces manquantes pour que le webhook Stripe
-- (Edge Function stripe-webhook, écrite séparément) puisse finaliser un
-- paiement, en généralisant les 4 mécanismes d'achat déjà existants :
--   - thème simple (mock_complete_purchase, 0002)
--   - bundle de thèmes (mock_complete_bundle_purchase, 0006)
--   - joueur rare/légendaire (grant_player_if_purchased, 0018)
--   - slot de joueur personnalisé (vérifié à la demande, 0012 — rien à
--     faire de plus ici, déjà robuste par construction)
--
-- Tous les chemins déjà en place créent une ligne `purchases` avec
-- status='completed' directement (cohérent avec le mock instantané).
-- Avec un vrai paiement Stripe (même en sandbox), le flux devient :
-- pending à la création de la session, completed seulement après
-- confirmation du webhook signé.
-- ============================================================

-- Permet à create-checkout-session (Edge Function, appelée par
-- l'utilisateur authentifié) de poser une ligne `purchases` en attente
-- AVANT la redirection vers Stripe Checkout — trace explicite de
-- l'intention d'achat, même si l'utilisateur abandonne avant de payer.
create or replace function public.create_pending_purchase(
  p_theme_id text,
  p_amount_cents integer,
  p_stripe_session_id text
)
returns void as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Authentification requise';
  end if;

  if not exists (select 1 from public.themes where id = p_theme_id and is_active = true) then
    raise exception 'Thème inconnu ou inactif : %', p_theme_id;
  end if;

  insert into public.purchases (user_id, theme_id, amount_cents, status, stripe_session_id)
  values (v_user_id, p_theme_id, p_amount_cents, 'pending', p_stripe_session_id)
  on conflict (user_id, theme_id) do update
    set status = 'pending', amount_cents = p_amount_cents, stripe_session_id = p_stripe_session_id
    where public.purchases.status <> 'completed';
end;
$$ language plpgsql security definer;

-- Appelée UNIQUEMENT par l'Edge Function stripe-webhook, avec la clé
-- service_role (jamais par un client authentifié standard).
create or replace function public.complete_stripe_purchase(p_stripe_session_id text)
returns void as $$
declare
  v_purchase record;
begin
  select * into v_purchase from public.purchases
    where stripe_session_id = p_stripe_session_id and status = 'pending'
    for update;

  if v_purchase is null then
    -- Idempotence : si le webhook est livré plusieurs fois par Stripe
    -- (comportement normal et documenté), on ne plante pas la seconde fois.
    return;
  end if;

  update public.purchases set status = 'completed' where id = v_purchase.id;

  -- Cas particulier des joueurs rares/légendaires : la ligne purchases
  -- complétée ne suffit pas seule, il faut aussi créer la ligne
  -- player_ownership. On NE PEUT PAS réutiliser grant_player_if_purchased
  -- (0018) telle quelle : elle se base sur auth.uid(), qui est toujours
  -- NULL ici puisque cette fonction est appelée par le webhook (clé
  -- service_role, aucune session utilisateur) — on insère donc directement
  -- avec le user_id déjà connu depuis la ligne purchases elle-même.
  if v_purchase.theme_id like 'player-%' then
    insert into public.player_ownership (user_id, player_id, acquired_via)
    values (v_purchase.user_id, substring(v_purchase.theme_id from 8)::uuid, 'purchase')
    on conflict (user_id, player_id) do nothing;
  end if;

  -- Le slot custom-player-slot et les thèmes/bundles n'ont besoin d'aucune
  -- action supplémentaire : leur octroi est déjà entièrement piloté par la
  -- présence d'une ligne purchases 'completed' (vérifiée à la demande).
end;
$$ language plpgsql security definer;
