-- ============================================================
-- TACTIC MASTER — Correctif : 0039 n'a jamais fermé la RPC
-- Issue #295 (anti-triche #260, épic scalabilité #281).
--
-- SYMPTÔME (constaté en prod le 2026-07-18, après application de 0039) :
--   has_function_privilege('anon',          '…update_game_session_state…', 'EXECUTE') → true
--   has_function_privilege('authenticated', '…update_game_session_state…', 'EXECUTE') → true
--
-- 0039 s'est pourtant appliquée sans erreur, et figure bien dans
-- schema_migrations. Elle n'a simplement rien fermé.
--
-- CAUSE : PostgreSQL accorde EXECUTE à PUBLIC par défaut à la création d'une
-- fonction. 0039 révoque sur `anon` et `authenticated` uniquement :
--
--   revoke execute on function public.update_game_session_state(uuid, jsonb) from anon;
--   revoke execute on function public.update_game_session_state(uuid, jsonb) from authenticated;
--
-- Le droit de PUBLIC reste donc intact, et tout rôle continue d'exécuter la
-- fonction à travers lui. Révoquer sur un rôle qui tient le privilège par
-- héritage de PUBLIC est un no-op silencieux — aucune erreur, aucun effet.
--
-- Le reste de la chaîne fait pourtant les choses correctement : les huit
-- autres revoke (0025, 0026, 0027, 0031, 0036) incluent tous `public` :
--
--   revoke execute on function … from public, anon, authenticated;
--
-- 0039 est la seule à s'en écarter. Ce n'est pas une subtilité inconnue du
-- projet — c'est un oubli ponctuel, qui a laissé le chemin d'écriture non
-- validé du multijoueur ouvert alors que #260 le croyait fermé.
-- ============================================================

-- ---------- Le correctif ----------
--
-- `public` d'abord : c'est le droit qui portait réellement l'accès. `anon` et
-- `authenticated` sont conservés dans la liste par symétrie avec le reste de
-- la chaîne — sans effet ici, mais l'uniformité vaut mieux qu'une exception
-- de plus à expliquer.
revoke execute on function public.update_game_session_state(uuid, jsonb)
  from public, anon, authenticated;

-- Révoquer sur PUBLIC retire aussi le droit hérité par service_role : on le
-- repose explicitement. Les Edge Functions passent par ce rôle — sans cette
-- ligne, push-game-state ne pourrait plus écrire et le multijoueur casserait,
-- cette fois pour de bon.
grant execute on function public.update_game_session_state(uuid, jsonb)
  to service_role;

-- ---------- Vérification embarquée ----------
--
-- Le défaut corrigé ici est précisément le genre qui s'applique « avec
-- succès » sans rien faire. Une migration qui ne peut pas échouer ne prouve
-- rien : on assère donc l'effet obtenu, ici même.
--
-- Conséquence utile : le job de rejeu de la CI (0001 → 0043, à chaque PR)
-- exécute cette assertion. Si quelqu'un réintroduit un jour un grant qui
-- rouvre la fonction, la PR échoue au lieu de passer en silence.
do $$
begin
  if to_regrole('anon') is not null
     and has_function_privilege('anon', 'public.update_game_session_state(uuid, jsonb)', 'EXECUTE') then
    raise exception
      'Correctif inopérant : anon peut toujours exécuter update_game_session_state (voir 0039 et #295).';
  end if;

  if to_regrole('authenticated') is not null
     and has_function_privilege('authenticated', 'public.update_game_session_state(uuid, jsonb)', 'EXECUTE') then
    raise exception
      'Correctif inopérant : authenticated peut toujours exécuter update_game_session_state (voir 0039 et #295).';
  end if;

  -- L'inverse compte tout autant : fermer la fonction au point de bloquer les
  -- Edge Functions casserait le multijoueur sans que rien ne le signale.
  if to_regrole('service_role') is not null
     and not has_function_privilege('service_role', 'public.update_game_session_state(uuid, jsonb)', 'EXECUTE') then
    raise exception
      'service_role a perdu l''exécution de update_game_session_state — push-game-state ne pourrait plus écrire.';
  end if;
end
$$;
