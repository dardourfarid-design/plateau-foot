-- ============================================================
-- TACTIC MASTER — Récompenses vidéo GameMonetize : modèle nonce serveur
-- Monétisation « en attendant AdSense ».
--
-- POURQUOI CE MODÈLE. La migration 0036 crédite une récompense vidéo
-- UNIQUEMENT côté serveur, après un SSV signé de Google (Edge Function
-- rewarded-ssv). Mais GameMonetize (SDK HTML5) NE fournit PAS de postback S2S
-- signé pour le web : le seul signal « vue terminée » est un événement
-- navigateur (SDK_REWARDED_WATCH_COMPLETE), donc auto-déclaré par le client —
-- exactement le chemin de farm que 0026 a fermé en supprimant earn_coins.
--
-- On préserve donc l'invariant « le client n'écrit jamais le grand livre » avec
-- un modèle NONCE en deux temps, aussi strict que possible sans crypto S2S :
--   1. rewarded-begin (Edge, JWT authentifié) → create_rewarded_nonce(user_id)
--      émet un nonce ALÉATOIRE lié à l'utilisateur AUTHENTIFIÉ (jamais déclaré
--      par le corps de la requête). Renvoyé au client.
--   2. Le joueur regarde la vidéo (GameMonetize).
--   3. rewarded-complete (Edge, JWT authentifié) → consume_rewarded_nonce(
--      user_id, nonce) valide que CE nonce appartient bien à CET utilisateur,
--      n'est pas déjà consommé et n'est pas expiré, puis crédite via
--      grant_rewarded_coins (même RPC service_role que le SSV Google).
--
-- Garde-fous cumulés : identité issue du JWT (pas du client), nonce à usage
-- unique émis par le serveur, expiration courte, idempotence (provider_ref =
-- nonce, unique dans rewarded_grants), et le PLAFOND JOURNALIER de 10/j déjà
-- porté par grant_rewarded_coins (migration 0036). Limite assumée : sans S2S
-- cryptographique, un utilisateur muni de son propre JWT peut réclamer sans
-- regarder — mais le dommage est borné à 10 pièces/jour. Le vrai SSV signé
-- reviendra avec AdMob/Ad Manager (rewarded-ssv reste en place, inchangé).
-- ============================================================

-- ---------- 1. Nonces de récompense (émis serveur, usage unique) ----------
create table if not exists public.rewarded_nonces (
  nonce uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  consumed_at timestamptz
);

create index if not exists idx_rewarded_nonces_user
  on public.rewarded_nonces(user_id, created_at);

alter table public.rewarded_nonces enable row level security;

-- Aucune policy : le client n'accède JAMAIS directement à cette table. Toutes
-- les écritures/lectures passent par les RPCs service_role ci-dessous (comme
-- rewarded_grants n'est écrite que par grant_rewarded_coins).

-- ---------- 2. Émission d'un nonce (service_role uniquement) ----------
-- Fenêtre de validité d'un nonce : au-delà, consume_rewarded_nonce le refuse.
-- Court par sécurité, mais assez large pour couvrir le chargement + la vidéo.
create or replace function public.create_rewarded_nonce(p_user_id uuid)
returns uuid as $$
declare
  v_max_per_day constant int := 10;
  v_today_count int;
  v_nonce uuid;
begin
  if p_user_id is null then
    return null;
  end if;

  -- Pré-vérification du quota (même plafond que grant_rewarded_coins) : inutile
  -- d'émettre un nonce si la récompense sera de toute façon refusée au crédit.
  select count(*) into v_today_count
    from public.rewarded_grants
    where user_id = p_user_id and created_at >= date_trunc('day', now());
  if v_today_count >= v_max_per_day then
    return null; -- quota atteint : rewarded-begin renverra « indisponible »
  end if;

  insert into public.rewarded_nonces (user_id)
  values (p_user_id)
  returning nonce into v_nonce;

  return v_nonce;
end;
$$ language plpgsql security definer;

alter function public.create_rewarded_nonce(uuid) set search_path = public, pg_temp;

-- ---------- 3. Consommation d'un nonce + crédit (service_role uniquement) ----------
create or replace function public.consume_rewarded_nonce(
  p_user_id uuid,
  p_nonce uuid
)
returns jsonb as $$
declare
  v_ttl constant interval := interval '15 minutes';
  v_row public.rewarded_nonces%rowtype;
begin
  if p_user_id is null or p_nonce is null then
    return jsonb_build_object('granted', false, 'reason', 'missing_params');
  end if;

  -- Verrou de ligne : empêche deux requêtes concurrentes de consommer le même
  -- nonce (double crédit) — filet en plus de l'idempotence provider_ref.
  select * into v_row
    from public.rewarded_nonces
    where nonce = p_nonce
    for update;

  if not found then
    return jsonb_build_object('granted', false, 'reason', 'unknown_nonce');
  end if;
  if v_row.user_id <> p_user_id then
    -- Le nonce n'appartient pas à l'utilisateur du JWT : tentative de vol.
    return jsonb_build_object('granted', false, 'reason', 'nonce_owner_mismatch');
  end if;
  if v_row.consumed_at is not null then
    return jsonb_build_object('granted', false, 'reason', 'already_consumed');
  end if;
  if v_row.created_at < now() - v_ttl then
    return jsonb_build_object('granted', false, 'reason', 'nonce_expired');
  end if;

  -- Usage unique : on marque consommé AVANT le crédit (même si le crédit est
  -- refusé pour quota, le nonce ne pourra pas être rejoué).
  update public.rewarded_nonces set consumed_at = now() where nonce = p_nonce;

  -- Crédit par la MÊME voie que le SSV Google : montant décidé serveur,
  -- idempotence + quota portés par grant_rewarded_coins. provider_ref = nonce.
  return public.grant_rewarded_coins(p_user_id, 'coins_small', p_nonce::text);
end;
$$ language plpgsql security definer;

alter function public.consume_rewarded_nonce(uuid, uuid) set search_path = public, pg_temp;

-- ---------- 4. Verrouillage des exécutions ----------
-- Réservé au serveur (Edge Functions rewarded-begin / rewarded-complete).
-- Jamais appelable par le client : c'est ce qui empêche le farm auto-déclaré.
revoke execute on function public.create_rewarded_nonce(uuid) from public, anon, authenticated;
revoke execute on function public.consume_rewarded_nonce(uuid, uuid) from public, anon, authenticated;
grant execute on function public.create_rewarded_nonce(uuid) to service_role;
grant execute on function public.consume_rewarded_nonce(uuid, uuid) to service_role;
