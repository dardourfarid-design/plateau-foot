-- ============================================================
-- TACTIC MASTER — Thèmes "Mondial" (édition événementielle)
-- Évoquent l'ambiance Coupe du Monde par les couleurs et l'atmosphère,
-- SANS utiliser de noms, logos, emblèmes ou marques officielles FIFA ou
-- d'équipes nationales sous licence — uniquement des associations de
-- couleurs et d'ambiance, qui ne sont pas protégeables par le droit des
-- marques. Mis en avant en tête de boutique (sort_order négatif) pendant
-- la période de l'événement pour maximiser leur visibilité commerciale.
-- ============================================================

insert into public.themes (id, name, description, price_cents, sort_order, config) values
  ('or-mondial', 'Or Mondial', 'L''or du sommet, l''instant où tout se joue.', 199, -5,
    '{"vertTerrain":"#0F2818","vertTerrainClair":"#173820","bleuEquipe":"#1C3F66","rougeEquipe":"#C9A227","accent":"#F4D35E"}'::jsonb),
  ('samba', 'Samba', 'Jaune et vert, la fête sur la pelouse.', 199, -4,
    '{"vertTerrain":"#0B4D2C","vertTerrainClair":"#116B3D","bleuEquipe":"#1565C0","rougeEquipe":"#F9D923","accent":"#2E9E4F"}'::jsonb),
  ('tricolore', 'Tricolore', 'Bleu, blanc, rouge, droit vers la cage.', 199, -3,
    '{"vertTerrain":"#13294B","vertTerrainClair":"#1B3A66","bleuEquipe":"#1B3A66","rougeEquipe":"#C8102E","accent":"#F5F2E8"}'::jsonb),
  ('albiceleste', 'Albiceleste', 'Le ciel et la victoire, à bandes blanches.', 199, -2,
    '{"vertTerrain":"#1B2A4A","vertTerrainClair":"#243A63","bleuEquipe":"#6CB4EE","rougeEquipe":"#F5F2E8","accent":"#FDB927"}'::jsonb),
  ('nuit-americaine', 'Nuit Américaine', 'Sous les étoiles, l''été du grand tournoi.', 199, -1,
    '{"vertTerrain":"#0A1A33","vertTerrainClair":"#102448","bleuEquipe":"#3B5BA5","rougeEquipe":"#B22234","accent":"#F5F2E8"}'::jsonb)
on conflict (id) do nothing;

-- ---------------------------------------------------------------
-- Bundle promotionnel : les 5 thèmes Mondial au prix de 4 (6,99€ au lieu
-- de 9,95€ pris séparément). L'achat du bundle déverrouille les 5 thèmes
-- d'un coup — géré par la fonction RPC ci-dessous plutôt que par une ligne
-- "thème" classique, car ce n'est pas un thème en soi mais un raccourci
-- d'achat groupé.
-- ---------------------------------------------------------------

create or replace function public.mock_complete_bundle_purchase(
  p_theme_ids text[],
  p_amount_cents integer
)
returns void as $$
declare
  v_user_id uuid := auth.uid();
  v_theme_id text;
begin
  if v_user_id is null then
    raise exception 'Authentification requise';
  end if;

  foreach v_theme_id in array p_theme_ids loop
    if not exists (select 1 from public.themes where id = v_theme_id and is_active = true) then
      raise exception 'Thème inconnu ou inactif : %', v_theme_id;
    end if;

    insert into public.purchases (user_id, theme_id, amount_cents, status, stripe_session_id)
    values (v_user_id, v_theme_id, p_amount_cents / array_length(p_theme_ids, 1), 'completed', 'mock-bundle-' || gen_random_uuid()::text)
    on conflict (user_id, theme_id) do nothing;
  end loop;
end;
$$ language plpgsql security definer;
