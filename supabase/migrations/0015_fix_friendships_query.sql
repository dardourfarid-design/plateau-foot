-- ============================================================
-- TACTIC MASTER — Correctif : lecture fiable des amitiés
-- La requête PostgREST côté client utilisait une syntaxe de jointure basée
-- sur des noms de contraintes de clé étrangère générés automatiquement
-- (friendships_friend_id_fkey, friendships_user_id_fkey). Si ces noms ne
-- correspondent pas exactement à ceux que Postgres a réellement créés, la
-- requête échoue d'une façon qui ne remonte aucune erreur lisible côté UI
-- — l'écran reste vide sans aucun message, exactement le symptôme observé.
--
-- Cette fonction RPC fait la même jointure directement en SQL, où la
-- syntaxe est explicite et fiable, plutôt que de dépendre d'une convention
-- de nommage PostgREST.
-- ============================================================

create or replace function public.fetch_my_friendships()
returns table(
  id uuid,
  user_id uuid,
  friend_id uuid,
  status text,
  other_pseudo text,
  direction text
) as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Authentification requise';
  end if;

  return query
    select
      f.id, f.user_id, f.friend_id, f.status,
      p.display_name as other_pseudo,
      case when f.user_id = v_user_id then 'sent' else 'received' end as direction
    from public.friendships f
    join public.profiles p on p.id = case when f.user_id = v_user_id then f.friend_id else f.user_id end
    where f.user_id = v_user_id or f.friend_id = v_user_id;
end;
$$ language plpgsql security definer;
