-- ============================================================
-- TACTIC MASTER — Correctif : l'id de session Stripe n'était jamais
-- enregistré, ce qui rendait le webhook incapable de retrouver la ligne
-- `purchases` en attente.
--
-- create-checkout-session faisait un update direct sur `purchases` avec
-- le client authentifié standard (clé anon + JWT utilisateur) — mais la
-- seule policy RLS existante sur cette table est en lecture (select),
-- jamais en update. L'update échouait donc silencieusement (0 ligne
-- affectée, aucune erreur levée par le client JS Supabase par défaut),
-- laissant `stripe_session_id` bloqué sur l'id temporaire 'pending-<uuid>'
-- pour toujours. Conséquence concrète observée : le paiement Stripe
-- réussissait (200 OK, payment_status: paid), le webhook s'exécutait sans
-- erreur, mais ne trouvait jamais la ligne 'pending' correspondante au
-- vrai id de session reçu — donc ne faisait jamais rien, sans qu'aucune
-- erreur ne le révèle nulle part.
--
-- Cette fonction permet au client authentifié de faire cette mise à jour
-- précise sans avoir besoin d'une policy RLS update générale sur
-- `purchases` (qui serait risquée — un client pourrait alors modifier
-- n'importe quel champ de ses propres achats, y compris le statut).
-- ============================================================

create or replace function public.update_pending_purchase_session_id(
  p_old_session_id text,
  p_new_session_id text
)
returns void as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Authentification requise';
  end if;

  update public.purchases
    set stripe_session_id = p_new_session_id
    where stripe_session_id = p_old_session_id
      and user_id = v_user_id
      and status = 'pending';
end;
$$ language plpgsql security definer;
