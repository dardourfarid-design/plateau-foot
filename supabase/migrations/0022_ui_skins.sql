-- ============================================================
-- TACTIC MASTER — Habillages de plateau (UI skins)
-- Ajoute 3 thèmes qui, en plus des couleurs, portent une clé
-- `skin` dans leur config JSON. Le front (themeManager.applySkin)
-- pose alors une classe `skin-<id>` sur <body> et public/skins.css
-- restyle entièrement le plateau (pions, feuille de match, boutons).
--
-- Modèle : Chalkboard est GRATUIT (price_cents = 0), Stadium Night et
-- Arcade Turf sont premium à 1,99 € — mêmes achats/purchases que les
-- autres thèmes, aucun chemin de paiement nouveau.
-- ============================================================

insert into public.themes (id, name, description, price_cents, sort_order, config) values
  ('chalkboard', 'Chalkboard',
    'Tableau tactique du coach — lignes à la craie, sobre et lisible.', 0, 8,
    '{"vertTerrain":"#14231C","vertTerrainClair":"#16241D","bleuEquipe":"#6BA8FF","rougeEquipe":"#FF7A7A","accent":"#6FBF9A","skin":"chalkboard"}'::jsonb),
  ('stadium-night', 'Stadium Night',
    'Ambiance broadcast : pions lumineux, feuille de match en verre.', 199, 9,
    '{"vertTerrain":"#0A1728","vertTerrainClair":"#0E2038","bleuEquipe":"#2563EB","rougeEquipe":"#DC2626","accent":"#FFD87A","skin":"stadium-night"}'::jsonb),
  ('arcade-turf', 'Arcade Turf',
    'Pions chunky, ombres franches, énergie arcade.', 199, 10,
    '{"vertTerrain":"#178A3E","vertTerrainClair":"#1EA34A","bleuEquipe":"#2563EB","rougeEquipe":"#E11D48","accent":"#FACC15","skin":"arcade-turf"}'::jsonb)
on conflict (id) do nothing;
