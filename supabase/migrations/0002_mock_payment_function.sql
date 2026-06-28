-- ============================================================
-- PLATEAU FOOT — Fonction de paiement mocké
-- Permet de simuler un achat réussi tant que Stripe n'est pas branché,
-- sans donner au client la permission d'écrire directement dans `purchases`.
-- À SUPPRIMER (ou désactiver) une fois Stripe en production : voir le
-- commentaire DROP en bas de fichier.
-- ============================================================

create or replace function public.mock_complete_purchase(
  p_theme_id text,
  p_amount_cents integer
)
returns void as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Authentification requise';
  end if;

  -- Vérifie que le thème existe et est actif, pour éviter un achat fantaisiste
  if not exists (select 1 from public.themes where id = p_theme_id and is_active = true) then
    raise exception 'Thème inconnu ou inactif : %', p_theme_id;
  end if;

  insert into public.purchases (user_id, theme_id, amount_cents, status, stripe_session_id)
  values (v_user_id, p_theme_id, p_amount_cents, 'completed', 'mock-' || gen_random_uuid()::text)
  on conflict (user_id, theme_id) do nothing;
end;
$$ language plpgsql security definer;

-- Le security definer permet à cette fonction de contourner la RLS de `purchases`
-- de façon contrôlée : seul ce chemin précis (et plus tard le webhook Stripe avec
-- la service_role key) peut écrire des achats.

-- ---------------------------------------------------------------
-- MIGRATION DE NETTOYAGE À EXÉCUTER QUAND STRIPE SERA EN PRODUCTION :
--   drop function if exists public.mock_complete_purchase(text, integer);
-- ---------------------------------------------------------------
