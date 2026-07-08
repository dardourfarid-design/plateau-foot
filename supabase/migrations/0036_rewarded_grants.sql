-- ============================================================
-- TACTIC MASTER — Récompenses vidéo (rewarded) : crédit sécurisé
-- Épic monétisation publicitaire, PR E (issue #30).
--
-- CONTEXTE SÉCURITÉ : la migration 0026 a SUPPRIMÉ earn_coins parce qu'un
-- crédit de pièces déclenché par le client est un chemin de farm. On ne
-- réintroduit donc PAS de crédit auto-déclaré. Le crédit d'une récompense
-- vidéo est accordé UNIQUEMENT par le serveur, après vérification côté
-- serveur (SSV) de Google Ad Manager, exactement comme complete_stripe_purchase
-- n'est appelable que par le webhook Stripe (service_role).
--
-- Flux cible :
--   1. Le joueur regarde une vidéo récompensée (client, via adService).
--   2. Google vérifie la vue et appelle notre Edge Function `rewarded-ssv`
--      avec une requête SIGNÉE (transaction_id + custom_data = user_id).
--   3. L'Edge Function vérifie la signature Google, puis appelle
--      grant_rewarded_coins(...) avec la clé service_role.
--   4. Le client ne fait que rafraîchir son solde — il ne crédite jamais.
--
-- Tant que le compte Ad Manager + SSV n'est pas configuré (#25), l'Edge
-- Function reste en échec fermé (aucun crédit). Le montant est TOUJOURS
-- décidé ici, jamais transmis par le client.
-- ============================================================

-- ---------- 1. Registre des récompenses accordées (traçabilité + idempotence) ----------
create table if not exists public.rewarded_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  reward_type text not null check (reward_type in ('coins_small')),
  coins_granted int not null check (coins_granted >= 0),
  -- Identifiant de transaction fourni par le SSV Google : unique => une même
  -- notification rejouée ne crédite qu'une fois (idempotence, comme le webhook
  -- Stripe s'appuie sur stripe_session_id).
  provider_ref text not null unique,
  created_at timestamptz not null default now()
);

create index if not exists idx_rewarded_grants_user_day
  on public.rewarded_grants(user_id, created_at);

alter table public.rewarded_grants enable row level security;

-- Le joueur peut lire ses propres récompenses (affichage historique), jamais
-- en insérer : l'écriture passe exclusivement par la RPC service_role.
create policy "Un joueur lit ses propres récompenses vidéo"
  on public.rewarded_grants for select
  using (auth.uid() = user_id);

-- ---------- 1b. Nouveau type de transaction : 'rewarded' ----------
-- La contrainte de 0026 n'autorisait que win/spend/bonus/purchase.
alter table public.currency_transactions drop constraint if exists currency_transactions_type_check;
alter table public.currency_transactions add constraint currency_transactions_type_check
  check (type in ('win', 'spend', 'bonus', 'purchase', 'rewarded'));

-- ---------- 2. Barème (décidé serveur) + quota anti-abus ----------
-- Montant par type de récompense. Étendre ici, jamais côté client.
create or replace function public.rewarded_coins_for(p_reward_type text)
returns int as $$
  select case p_reward_type
    when 'coins_small' then 10
    else 0
  end;
$$ language sql immutable;

-- ---------- 3. Crédit d'une récompense (service_role uniquement) ----------
-- Nombre maximum de récompenses vidéo créditables par jour et par joueur.
-- Deuxième filet de sécurité en plus de la vérification SSV : borne le farm
-- même en cas de faille en amont.
create or replace function public.grant_rewarded_coins(
  p_user_id uuid,
  p_reward_type text,
  p_provider_ref text
)
returns jsonb as $$
declare
  v_max_per_day constant int := 10;
  v_coins int;
  v_today_count int;
begin
  if p_user_id is null or p_provider_ref is null then
    return jsonb_build_object('granted', false, 'reason', 'missing_params');
  end if;

  -- Idempotence : une notification rejouée ne crédite jamais deux fois.
  if exists (select 1 from public.rewarded_grants where provider_ref = p_provider_ref) then
    return jsonb_build_object('granted', false, 'reason', 'already_granted');
  end if;

  v_coins := public.rewarded_coins_for(p_reward_type);
  if v_coins <= 0 then
    return jsonb_build_object('granted', false, 'reason', 'unknown_reward_type');
  end if;

  -- Quota journalier (anti-farm), indépendant de la vérification SSV.
  select count(*) into v_today_count
    from public.rewarded_grants
    where user_id = p_user_id and created_at >= date_trunc('day', now());
  if v_today_count >= v_max_per_day then
    return jsonb_build_object('granted', false, 'reason', 'daily_quota_reached');
  end if;

  -- Crédit atomique : solde + transaction + ligne de registre.
  insert into public.user_currency (user_id, balance)
  values (p_user_id, v_coins)
  on conflict (user_id) do update
    set balance = user_currency.balance + v_coins, updated_at = now();

  insert into public.currency_transactions (user_id, amount, type, description)
  values (p_user_id, v_coins, 'rewarded', 'Récompense vidéo : ' || p_reward_type);

  insert into public.rewarded_grants (user_id, reward_type, coins_granted, provider_ref)
  values (p_user_id, p_reward_type, v_coins, p_provider_ref);

  return jsonb_build_object('granted', true, 'coins', v_coins);
end;
$$ language plpgsql security definer;

alter function public.grant_rewarded_coins(uuid, text, text) set search_path = public, pg_temp;

-- Réservé au serveur (Edge Function SSV). Jamais appelable par le client :
-- c'est ce qui empêche le farm auto-déclaré que 0026 avait fermé.
revoke execute on function public.grant_rewarded_coins(uuid, text, text) from public, anon, authenticated;
grant execute on function public.grant_rewarded_coins(uuid, text, text) to service_role;
