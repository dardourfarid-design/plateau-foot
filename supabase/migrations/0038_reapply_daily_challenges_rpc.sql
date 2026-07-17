-- ============================================================================
-- TACTIC MASTER — Ré-application de get_or_create_daily_challenges (canonique)
-- ============================================================================
-- SYMPTÔME (2026-07-17) : connecté, l'onglet « Défis » affiche « Aucun défi
-- disponible aujourd'hui » — le RPC répond sans erreur mais avec 0 ligne.
--
-- DIAGNOSTIC : avec la définition du dépôt (0028) ce résultat est impossible :
-- le catalogue prod contient bien 5 templates actifs (vérifié par l'API REST,
-- lecture publique) et la fonction en insère 3 puis les retourne. Un RPC vide
-- sans erreur signifie donc que la fonction DÉPLOYÉE diffère du dépôt (dérive
-- probable lors d'une application manuelle de migrations — la version live
-- n'est pas lisible anonymement, l'OpenAPI étant verrouillé).
--
-- REMÈDE : ré-appliquer la définition canonique de 0028, à l'identique, en y
-- épinglant le search_path (durcissement 0033 — conservé puisque ALTER ne
-- survit pas à un DROP/CREATE). Idempotent : ré-exécutable sans danger.
-- Le type de retour pouvant différer de la version déployée, DROP obligatoire.

drop function if exists public.get_or_create_daily_challenges();

create function public.get_or_create_daily_challenges()
returns table(
  id uuid,
  user_id uuid,
  template_id uuid,
  challenge_date date,
  progress_count integer,
  completed boolean,
  completed_at timestamptz,
  description text,
  target_count integer,
  xp_reward integer
) as $$
declare
  v_user_id uuid := auth.uid();
  v_count integer;
  v_template record;
begin
  if v_user_id is null then
    raise exception 'Authentification requise';
  end if;

  select count(*) into v_count from public.daily_challenges dc
    where dc.user_id = v_user_id and dc.challenge_date = current_date;

  if v_count = 0 then
    for v_template in
      select t.id from public.daily_challenge_templates t
      where t.is_active = true
      order by random()
      limit 3
    loop
      insert into public.daily_challenges (user_id, template_id, challenge_date)
      values (v_user_id, v_template.id, current_date)
      on conflict (user_id, template_id, challenge_date) do nothing;
    end loop;
  end if;

  return query
    select dc.id, dc.user_id, dc.template_id, dc.challenge_date,
           dc.progress_count, dc.completed, dc.completed_at,
           t.description, t.target_count, t.xp_reward
    from public.daily_challenges dc
    join public.daily_challenge_templates t on t.id = dc.template_id
    where dc.user_id = v_user_id and dc.challenge_date = current_date;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;
