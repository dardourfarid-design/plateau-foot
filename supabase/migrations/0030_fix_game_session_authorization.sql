-- ============================================================
-- TACTIC MASTER — Correctif sécurité : autorisation sur les sessions de partie
--
-- FAILLE (migration 0005) : update_game_session_state() est SECURITY DEFINER
-- et mettait à jour game_state pour N'IMPORTE QUEL p_session_id, SANS vérifier
-- que l'appelant participe à la partie. Combinée à la policy de lecture
-- `using (true)` (toute session est lisible), n'importe quel utilisateur
-- authentifié pouvait énumérer puis ÉCRASER l'état de n'importe quelle partie
-- en cours — triche et sabotage triviaux.
--
-- CORRECTIF : la mise à jour est restreinte au host ou au guest AUTHENTIFIÉ de
-- la session. On ajoute aussi `set search_path` (durcissement standard des
-- fonctions security definer).
--
-- ⚠️  CONSÉQUENCE PRODUIT : le multijoueur en ligne exige désormais d'être
--     connecté (les deux joueurs). On ne peut pas autoriser de façon sûre une
--     mutation d'état partagé pour un appelant anonyme (aucune identité à
--     vérifier). Si le jeu en ligne sans compte doit être conservé, il faudra
--     un jeton de session par partie plutôt qu'une identité utilisateur.
-- ============================================================

create or replace function public.update_game_session_state(
  p_session_id uuid,
  p_new_state jsonb
)
returns void as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Authentification requise';
  end if;

  update public.game_sessions
    set game_state = p_new_state,
        last_activity_at = now(),
        status = case when (p_new_state->>'gameOver')::boolean is true then 'finished' else status end
    where id = p_session_id
      and v_user_id in (host_user_id, guest_user_id);

  -- Aucune ligne touchée = session inexistante OU appelant non participant.
  -- On lève plutôt que de retourner silencieusement, pour que le client sache
  -- que son coup n'a pas été enregistré.
  if not found then
    raise exception 'Partie introuvable ou accès refusé.';
  end if;
end;
$$ language plpgsql security definer
set search_path = public, pg_temp;
