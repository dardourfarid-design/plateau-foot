-- ============================================================
-- TACTIC MASTER — Durcissement : search_path fixe sur les fonctions
-- SECURITY DEFINER
--
-- PROBLÈME : la plupart des fonctions SECURITY DEFINER des premières
-- migrations (0001, 0005, 0007, 0008, 0009, 0012, 0014, 0015, 0017, 0018,
-- 0019, 0020, 0029…) ne fixent pas leur search_path. C'est l'avertissement
-- « Function Search Path Mutable » du linter Supabase : une fonction
-- SECURITY DEFINER dont le search_path n'est pas figé peut, dans certaines
-- configurations, résoudre un objet (table/fonction) vers un schéma
-- contrôlé par un attaquant placé plus tôt dans le search_path, et donc
-- exécuter du code non prévu avec les droits du propriétaire (élévation).
--
-- CORRECTIF : on épingle `search_path = public, pg_temp` sur TOUTES les
-- fonctions SECURITY DEFINER du schéma public. Un bloc dynamique évite
-- d'énumérer à la main chaque signature (d'autant que plusieurs fonctions
-- ont été recréées au fil des migrations) et couvre aussi les futures.
-- ALTER FUNCTION ... SET search_path ne touche pas le corps des fonctions ;
-- ré-appliquer la valeur sur une fonction qui l'a déjà est sans effet de bord.
-- ============================================================

do $$
declare
  fn record;
begin
  for fn in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef                 -- uniquement SECURITY DEFINER
  loop
    execute format('alter function %s set search_path = public, pg_temp', fn.sig);
  end loop;
end $$;
