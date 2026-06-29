-- ============================================================
-- TACTIC MASTER — Pouvoirs de pion sur joueurs rares/légendaires
-- Réservés aux joueurs obtenus par mercato : seuls les rares et légendaires
-- portent un pouvoir, jamais les communs du starter pack gratuit.
-- ============================================================

alter table public.fictional_players add column if not exists power text
  check (power in ('tir_puissant', 'sprint', 'mur', 'relais', 'repli_adverse'));

alter table public.custom_players add column if not exists power text
  check (power in ('tir_puissant', 'sprint', 'mur', 'relais', 'repli_adverse'));

update public.fictional_players set power = 'tir_puissant' where name = 'Mateo Rinaldi';
update public.fictional_players set power = 'sprint' where name = 'Connor Blake';
update public.fictional_players set power = 'mur' where name = 'Yannick Dubois';
update public.fictional_players set power = 'relais' where name = 'Tariq Mensah';
update public.fictional_players set power = 'tir_puissant' where name = 'Aleksander Kovac';
update public.fictional_players set power = 'repli_adverse' where name = 'Hiroshi Yamamoto';
