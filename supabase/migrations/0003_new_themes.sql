-- ============================================================
-- PLATEAU FOOT — Nouveaux thèmes
-- Ajoute 4 thèmes supplémentaires au catalogue existant.
-- ============================================================

insert into public.themes (id, name, description, price_cents, sort_order, config) values
  ('nuit-stade', 'Nuit de stade', 'Sous les projecteurs, ambiance match en nocturne.', 199, 4,
    '{"vertTerrain":"#0B2818","vertTerrainClair":"#123420","bleuEquipe":"#4FC3F7","rougeEquipe":"#FFB74D","accent":"#FFD54F"}'::jsonb),
  ('retro-8bit', 'Rétro 8-bit', 'L''esprit jeu vidéo des années 80, en plein écran.', 199, 5,
    '{"vertTerrain":"#1A1A2E","vertTerrainClair":"#22223B","bleuEquipe":"#4ECDC4","rougeEquipe":"#FF6B6B","accent":"#FFE66D"}'::jsonb),
  ('jungle', 'Jungle', 'Un terrain englouti par la végétation tropicale.', 199, 6,
    '{"vertTerrain":"#1B4332","vertTerrainClair":"#2D6A4F","bleuEquipe":"#52B788","rougeEquipe":"#D4A017","accent":"#95D5B2"}'::jsonb),
  ('crepuscule', 'Crépuscule', 'Les dernières lueurs du jour sur la pelouse.', 199, 7,
    '{"vertTerrain":"#3D2645","vertTerrainClair":"#4F3358","bleuEquipe":"#7C9EFF","rougeEquipe":"#FF7C7C","accent":"#FFA552"}'::jsonb)
on conflict (id) do nothing;
