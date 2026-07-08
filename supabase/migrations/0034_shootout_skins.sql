-- ============================================================
-- TACTIC MASTER — Habillages payants de la séance de tirs au but
--
-- Enregistre 3 « skins » de la séance de tirs au but (Néon, Cartoon, Manga)
-- comme produits achetables, en réutilisant tel quel le mécanisme générique
-- themes + purchases + create-checkout-session + stripe-webhook :
--   - create_pending_purchase valide l'id contre `themes` (is_active) ;
--   - le webhook marque simplement la ligne `purchases` 'completed' pour un
--     id de thème (pas de player-/pack-/coins-), donc la POSSESSION = une
--     ligne purchases 'completed'. Aucune modification du webhook nécessaire.
--
-- Ces produits ne sont PAS des thèmes de plateau : leur config ne porte pas
-- les couleurs du terrain, juste un marqueur {"kind":"shootout-skin"}. Le
-- catalogue de la boutique de plateau les exclut côté client (shopUI
-- _isRealKit filtre les ids commençant par 'shootout-'). Le point d'achat est
-- le sélecteur de thème DANS l'écran de tirs au but (main.js).
--
-- Le thème « Stade » reste gratuit et par défaut (aucune ligne ici).
-- ============================================================

insert into public.themes (id, name, description, price_cents, sort_order, config, is_active) values
  ('shootout-neon',    'Tirs au but — Néon',    'Habillage néon (cyan/rose lumineux) de la séance de tirs au but.', 199, 200, '{"kind":"shootout-skin"}'::jsonb, true),
  ('shootout-cartoon', 'Tirs au but — Cartoon', 'Habillage cartoon (fond clair, contours francs) de la séance de tirs au but.', 199, 201, '{"kind":"shootout-skin"}'::jsonb, true),
  ('shootout-manga',   'Tirs au but — Manga',   'Habillage manga (noir & rouge) de la séance de tirs au but.', 199, 202, '{"kind":"shootout-skin"}'::jsonb, true)
on conflict (id) do nothing;
