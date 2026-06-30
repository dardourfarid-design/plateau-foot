-- ---------- RETRAIT DU THÈME "NEIGE" ----------
-- Le thème Neige (vert-terrain quasi-blanc #E8EEF3) est jugé non pertinent :
-- son rendu très clair est trop proche d'un plateau "vide"/blanc et crée une
-- confusion visuelle avec un bug d'affichage.
--
-- Projet encore en sandbox, aucun achat réel n'a été effectué sur ce thème :
-- suppression complète et définitive de la ligne (pas de simple désactivation),
-- aucun risque d'orphelin côté table purchases.

delete from public.themes
where id = 'neige';
