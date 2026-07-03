-- ============================================================
-- TACTIC MASTER — Social, sessions et pseudos
--
-- 1. cancel_friend_request : annuler une demande d'ami envoyée (la table
--    friendships n'expose volontairement aucune policy DELETE).
-- 2. fetch_my_mercato_offers_detailed : offres avec pseudo de l'autre
--    joueur et noms des joueurs échangés, pour une UI compréhensible
--    (« Zorana te propose Diego Salaz contre Marcus Idowu »).
-- 3. cancel_game_session : clôture d'une session en attente par son hôte
--    (l'annulation côté client laissait des sessions « waiting » zombies
--    avec un code d'invitation joignable pour toujours).
--    + nettoyage ponctuel des sessions zombies existantes.
-- 4. Unicité des pseudos (insensible à la casse) : sans elle, deux comptes
--    « testar » existaient et send_friend_request visait l'un des deux au
--    hasard. Dédoublonnage préalable + index unique + handle_new_user
--    robuste (suffixe automatique en cas de collision à l'inscription).
-- ============================================================

-- ---------- 1. Annulation d'une demande d'ami envoyée ----------
create or replace function public.cancel_friend_request(p_friend_id uuid)
returns void as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Authentification requise';
  end if;

  delete from public.friendships f
  where f.user_id = v_user_id and f.friend_id = p_friend_id and f.status = 'pending';
end;
$$ language plpgsql security definer;

-- ---------- 2. Offres de mercato détaillées ----------
create or replace function public.fetch_my_mercato_offers_detailed()
returns table(
  id uuid,
  direction text,
  other_pseudo text,
  offered_player_name text,
  requested_player_name text,
  created_at timestamptz
) as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Authentification requise';
  end if;

  return query
    select
      o.id,
      case when o.from_user_id = v_user_id then 'sent' else 'received' end,
      p.display_name,
      coalesce(po1.custom_name, fp1.name),
      coalesce(po2.custom_name, fp2.name),
      o.created_at
    from public.mercato_offers o
    join public.profiles p
      on p.id = case when o.from_user_id = v_user_id then o.to_user_id else o.from_user_id end
    left join public.player_ownership po1 on po1.id = o.offered_ownership_id
    left join public.fictional_players fp1 on fp1.id = po1.player_id
    left join public.player_ownership po2 on po2.id = o.requested_ownership_id
    left join public.fictional_players fp2 on fp2.id = po2.player_id
    where o.status = 'pending'
      and (o.from_user_id = v_user_id or o.to_user_id = v_user_id);
end;
$$ language plpgsql security definer;

-- ---------- 3. Sessions en ligne ----------
create or replace function public.cancel_game_session(p_session_id uuid)
returns void as $$
declare
  v_user_id uuid := auth.uid();
begin
  -- Les invités anonymes peuvent aussi créer des parties : on autorise
  -- l'annulation par l'hôte authentifié OU celle d'une session sans hôte.
  update public.game_sessions gs
  set status = 'abandoned'
  where gs.id = p_session_id
    and gs.status = 'waiting'
    and (gs.host_user_id is null or gs.host_user_id = v_user_id);
end;
$$ language plpgsql security definer;

-- Nettoyage ponctuel des zombies accumulés :
--   - « waiting » depuis plus d'1 heure : personne ne viendra plus.
--   - « active » depuis plus de 7 jours : partie manifestement abandonnée.
update public.game_sessions set status = 'abandoned'
where status = 'waiting' and created_at < now() - interval '1 hour';

update public.game_sessions set status = 'abandoned'
where status = 'active' and created_at < now() - interval '7 days';

-- ---------- 4. Unicité des pseudos ----------
-- Dédoublonnage des pseudos existants (insensible à la casse) : les
-- doublons reçoivent un suffixe court dérivé de leur id, déterministe.
with dups as (
  select id,
         row_number() over (partition by lower(display_name) order by created_at, id) as rn
  from public.profiles
)
update public.profiles p
set display_name = p.display_name || '_' || substr(p.id::text, 1, 4)
from dups d
where d.id = p.id and d.rn > 1;

create unique index if not exists idx_profiles_display_name_ci
  on public.profiles (lower(display_name));

-- handle_new_user robuste : en cas de collision de pseudo à l'inscription,
-- suffixe automatique plutôt qu'un échec « Database error saving new user »
-- qui bloquerait la création du compte.
create or replace function public.handle_new_user()
returns trigger as $$
declare
  v_base text := coalesce(nullif(trim(new.raw_user_meta_data->>'display_name'), ''), 'Joueur');
  v_name text := v_base;
  v_try integer := 0;
begin
  loop
    begin
      insert into public.profiles (id, display_name) values (new.id, v_name);
      return new;
    exception when unique_violation then
      v_try := v_try + 1;
      if v_try > 5 then
        -- Ultime filet : l'id est unique par construction.
        insert into public.profiles (id, display_name)
        values (new.id, 'Joueur_' || substr(new.id::text, 1, 6));
        return new;
      end if;
      v_name := v_base || '_' || substr(md5(random()::text), 1, 3);
    end;
  end loop;
end;
$$ language plpgsql security definer;
