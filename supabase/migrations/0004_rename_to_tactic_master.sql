-- ============================================================
-- TACTIC MASTER (anciennement "Plateau Foot") — Renommage
-- Met à jour le texte déjà en base suite au changement de nom du jeu.
-- N'affecte aucune donnée joueur (achats, profils) : seulement le texte
-- descriptif du thème "classique".
-- ============================================================

update public.themes
set description = 'Le terrain vert historique de Tactic Master.'
where id = 'classique';
