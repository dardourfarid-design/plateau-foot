-- ===================== MIGRATION 0024 — UI SKINS =====================
-- Ajoute 3 thèmes qui restylent entièrement le plateau (au-delà des couleurs).
-- Complémentaire de la migration 0022 (Sprint E1 : nouveaux kits couleur + passes)
-- et 0023 (Sprint E2 : pièces tactiques).
--
-- Chaque thème porte une clé `skin` dans sa config JSON :
--   - `themeManager.applyTheme()` pose la classe `skin-<id>` sur <body>
--   - `public/skins.css` restyle plateau, pions, feuille de match, boutons
--   - un thème couleur classique (sans clé `skin`) retire toute classe skin-* →
--     rendu par défaut inchangé
--
-- Modèle économique :
--   - Chalkboard    : gratuit (défaut alternatif, découverte du système)
--   - Stadium Night : 2,49 € (aligné grille tarifaire Sprint E1)
--   - Arcade Turf   : 2,49 €
--
-- Aucun nouveau chemin de paiement : réutilise `themes` + `purchases` existant.

insert into public.themes (id, name, description, price_cents, sort_order, config) values

  ('chalkboard', 'Chalkboard',
    'Tableau tactique du coach — lignes à la craie, sobre et lisible.',
    0, 30,
    '{"vertTerrain":"#14231C","vertTerrainClair":"#16241D","bleuEquipe":"#6BA8FF","rougeEquipe":"#FF7A7A","accent":"#6FBF9A","skin":"chalkboard"}'::jsonb),

  ('stadium-night', 'Stadium Night',
    'Ambiance broadcast : pions lumineux, feuille de match en verre.',
    249, 31,
    '{"vertTerrain":"#0A1728","vertTerrainClair":"#0E2038","bleuEquipe":"#2563EB","rougeEquipe":"#DC2626","accent":"#FFD87A","skin":"stadium-night"}'::jsonb),

  ('arcade-turf', 'Arcade Turf',
    'Pions chunky, ombres franches, énergie arcade.',
    249, 32,
    '{"vertTerrain":"#178A3E","vertTerrainClair":"#1EA34A","bleuEquipe":"#2563EB","rougeEquipe":"#E11D48","accent":"#FACC15","skin":"arcade-turf"}'::jsonb)

on conflict (id) do nothing;
