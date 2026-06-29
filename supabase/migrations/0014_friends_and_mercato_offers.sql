-- ============================================================
-- TACTIC MASTER — Système d'amis et mercato avec consentement
-- Remplace l'échange direct immédiat (execute_mercato_trade, voir
-- 0008_fictional_players.sql) par un vrai flux à deux temps : offre, puis
-- acceptation explicite par l'autre joueur. Sans ça, n'importe qui
-- connaissant un user_id et un ownershipId pouvait déclencher un échange
-- sans le consentement de la victime — faille corrigée ici structurellement,
-- pas seulement par une UI qui aurait pu être contournée.
--
-- execute_mercato_trade() reste en base (déjà déployée) mais n'est plus
-- appelée par aucun code client à partir de cette version.
-- ============================================================

-- ---------- Amis ----------
create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  friend_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  unique (user_id, friend_id),
  check (user_id <> friend_id)
);

create index if not exists idx_friendships_user on public.friendships(user_id);
create index if not exists idx_friendships_friend on public.friendships(friend_id);

alter table public.friendships enable row level security;

create policy "Un joueur voit ses propres relations d'amitié (envoyées ou reçues)"
  on public.friendships for select
  using (auth.uid() = user_id or auth.uid() = friend_id);

create or replace function public.send_friend_request(p_friend_pseudo text)
returns void as $$
declare
  v_user_id uuid := auth.uid();
  v_friend_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentification requise';
  end if;

  select id into v_friend_id from public.profiles where display_name = p_friend_pseudo;

  if v_friend_id is null then
    raise exception 'Aucun joueur trouvé avec ce pseudo.';
  end if;

  if v_friend_id = v_user_id then
    raise exception 'Tu ne peux pas t''ajouter toi-même.';
  end if;

  insert into public.friendships (user_id, friend_id, status)
  values (v_user_id, v_friend_id, 'pending')
  on conflict (user_id, friend_id) do nothing;
end;
$$ language plpgsql security definer;

create or replace function public.respond_friend_request(p_requester_id uuid, p_accept boolean)
returns void as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Authentification requise';
  end if;

  update public.friendships
    set status = case when p_accept then 'accepted' else 'declined' end
    where user_id = p_requester_id and friend_id = v_user_id and status = 'pending';

  if p_accept then
    insert into public.friendships (user_id, friend_id, status)
    values (v_user_id, p_requester_id, 'accepted')
    on conflict (user_id, friend_id) do update set status = 'accepted';
  end if;
end;
$$ language plpgsql security definer;


-- ---------- Offres de mercato ----------
create table if not exists public.mercato_offers (
  id uuid primary key default gen_random_uuid(),
  from_user_id uuid not null references public.profiles(id) on delete cascade,
  to_user_id uuid not null references public.profiles(id) on delete cascade,
  offered_ownership_id uuid not null,
  requested_ownership_id uuid not null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  check (from_user_id <> to_user_id)
);

create index if not exists idx_mercato_offers_to_user on public.mercato_offers(to_user_id, status);
create index if not exists idx_mercato_offers_from_user on public.mercato_offers(from_user_id, status);

alter table public.mercato_offers enable row level security;

create policy "Un joueur voit les offres qu'il a faites ou reçues"
  on public.mercato_offers for select
  using (auth.uid() = from_user_id or auth.uid() = to_user_id);

create or replace function public.create_mercato_offer(
  p_to_user_id uuid,
  p_offered_ownership_id uuid,
  p_requested_ownership_id uuid
)
returns public.mercato_offers as $$
declare
  v_user_id uuid := auth.uid();
  v_new_offer public.mercato_offers;
begin
  if v_user_id is null then
    raise exception 'Authentification requise';
  end if;

  if not exists (
    select 1 from public.friendships
    where user_id = v_user_id and friend_id = p_to_user_id and status = 'accepted'
  ) then
    raise exception 'Tu ne peux proposer un échange qu''à un ami.';
  end if;

  if not exists (
    select 1 from public.player_ownership
    where id = p_offered_ownership_id and user_id = v_user_id
  ) then
    raise exception 'Tu ne possèdes pas le joueur que tu proposes.';
  end if;

  if not exists (
    select 1 from public.player_ownership
    where id = p_requested_ownership_id and user_id = p_to_user_id
  ) then
    raise exception 'Ce joueur n''appartient pas au destinataire.';
  end if;

  insert into public.mercato_offers (from_user_id, to_user_id, offered_ownership_id, requested_ownership_id)
  values (v_user_id, p_to_user_id, p_offered_ownership_id, p_requested_ownership_id)
  returning * into v_new_offer;

  return v_new_offer;
end;
$$ language plpgsql security definer;

create or replace function public.respond_mercato_offer(p_offer_id uuid, p_accept boolean)
returns void as $$
declare
  v_user_id uuid := auth.uid();
  v_offer record;
begin
  if v_user_id is null then
    raise exception 'Authentification requise';
  end if;

  select * into v_offer from public.mercato_offers
    where id = p_offer_id and to_user_id = v_user_id and status = 'pending'
    for update;

  if v_offer is null then
    raise exception 'Offre introuvable ou déjà traitée.';
  end if;

  if p_accept then
    if not exists (select 1 from public.player_ownership where id = v_offer.offered_ownership_id and user_id = v_offer.from_user_id) then
      raise exception 'Le joueur proposé n''est plus disponible.';
    end if;
    if not exists (select 1 from public.player_ownership where id = v_offer.requested_ownership_id and user_id = v_offer.to_user_id) then
      raise exception 'Ton joueur demandé n''est plus disponible.';
    end if;

    update public.player_ownership set user_id = v_offer.to_user_id, acquired_via = 'mercato_trade'
      where id = v_offer.offered_ownership_id;
    update public.player_ownership set user_id = v_offer.from_user_id, acquired_via = 'mercato_trade'
      where id = v_offer.requested_ownership_id;

    update public.mercato_offers set status = 'accepted', responded_at = now() where id = p_offer_id;
  else
    update public.mercato_offers set status = 'declined', responded_at = now() where id = p_offer_id;
  end if;
end;
$$ language plpgsql security definer;

create or replace function public.cancel_mercato_offer(p_offer_id uuid)
returns void as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Authentification requise';
  end if;

  update public.mercato_offers set status = 'cancelled', responded_at = now()
    where id = p_offer_id and from_user_id = v_user_id and status = 'pending';
end;
$$ language plpgsql security definer;


-- ---------------------------------------------------------------
-- Lecture de la collection d'un ami : nécessaire pour choisir quel joueur
-- lui proposer en échange. La policy RLS standard de player_ownership
-- limite la lecture au propriétaire — cette fonction security definer
-- l'ouvre explicitement, mais UNIQUEMENT entre amis acceptés, jamais à
-- n'importe qui (vérifié à chaque appel, pas seulement à la création d'une
-- offre).
-- ---------------------------------------------------------------
create or replace function public.fetch_friend_collection(p_friend_user_id uuid)
returns table(
  id uuid,
  custom_name text,
  player_name text,
  player_style text,
  player_rarity text,
  avatar_seed text
) as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Authentification requise';
  end if;

  if not exists (
    select 1 from public.friendships
    where user_id = v_user_id and friend_id = p_friend_user_id and status = 'accepted'
  ) then
    raise exception 'Tu ne peux voir la collection que d''un ami.';
  end if;

  return query
    select po.id, po.custom_name, fp.name, fp.style, fp.rarity, fp.avatar_seed
    from public.player_ownership po
    join public.fictional_players fp on fp.id = po.player_id
    where po.user_id = p_friend_user_id;
end;
$$ language plpgsql security definer;
