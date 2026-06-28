-- ============================================================
-- TACTIC MASTER — Consentement RGPD granulaire
-- Le RGPD exige un consentement spécifique, libre, éclairé et univoque
-- PAR FINALITÉ (CNIL, art. 7 RGPD) : on ne peut pas faire cocher une seule
-- case "j'accepte tout". Cette table trace, pour chaque utilisateur,
-- chaque finalité de traitement, avec horodatage — c'est aussi la preuve
-- du consentement exigée en cas de contrôle.
--
-- Finalités couvertes (correspondent aux cases distinctes affichées à
-- l'inscription, voir src/ui/main.js / handleAuthSubmit) :
--   - account        : nécessaire pour jouer, pas un "consentement" au sens
--                       RGPD (c'est l'exécution du contrat de service),
--                       mais on trace quand même la version acceptée des CGU.
--   - analytics       : mesure d'usage interne, pour améliorer le produit.
--   - email_marketing : envoi d'emails promotionnels (nouveaux thèmes, etc.)
--   - data_sharing    : partage de données à des tiers (partenaires, etc.)
-- ============================================================

create table if not exists public.user_consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  purpose text not null check (purpose in ('account', 'analytics', 'email_marketing', 'data_sharing')),
  granted boolean not null,
  -- Version du texte de consentement affiché au moment de l'action : permet
  -- de savoir exactement à quoi la personne a consenti si le texte change
  -- plus tard (exigence de traçabilité RGPD).
  policy_version text not null default '2026-06-28',
  created_at timestamptz not null default now(),
  unique (user_id, purpose, policy_version)
);

create index if not exists idx_user_consents_user_id on public.user_consents(user_id);

alter table public.user_consents enable row level security;

create policy "Un joueur peut lire ses propres consentements"
  on public.user_consents for select
  using (auth.uid() = user_id);

-- Écriture uniquement via la fonction RPC ci-dessous (jamais d'insert direct
-- côté client), pour garder une seule porte d'entrée qui horodate et
-- structure proprement chaque consentement.

create or replace function public.record_consent(
  p_purpose text,
  p_granted boolean,
  p_policy_version text default '2026-06-28'
)
returns void as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Authentification requise';
  end if;

  insert into public.user_consents (user_id, purpose, granted, policy_version)
  values (v_user_id, p_purpose, p_granted, p_policy_version)
  on conflict (user_id, purpose, policy_version)
  do update set granted = p_granted, created_at = now();
end;
$$ language plpgsql security definer;


-- ---------------------------------------------------------------
-- Export et suppression de compte (droits RGPD d'accès et d'effacement,
-- art. 15 et 17). Fonctions appelables par l'utilisateur lui-même.
-- ---------------------------------------------------------------

-- Export : renvoie toutes les données personnelles connues pour ce compte,
-- dans un seul objet JSON exploitable (le joueur peut le copier/sauvegarder).
create or replace function public.export_my_data()
returns jsonb as $$
declare
  v_user_id uuid := auth.uid();
  v_profile jsonb;
  v_purchases jsonb;
  v_consents jsonb;
begin
  if v_user_id is null then
    raise exception 'Authentification requise';
  end if;

  select to_jsonb(p) into v_profile from public.profiles p where p.id = v_user_id;
  select coalesce(jsonb_agg(to_jsonb(pu)), '[]'::jsonb) into v_purchases
    from public.purchases pu where pu.user_id = v_user_id;
  select coalesce(jsonb_agg(to_jsonb(c)), '[]'::jsonb) into v_consents
    from public.user_consents c where c.user_id = v_user_id;

  return jsonb_build_object(
    'profile', v_profile,
    'purchases', v_purchases,
    'consents', v_consents,
    'exported_at', now()
  );
end;
$$ language plpgsql security definer;

-- Suppression : supprime le profil (les tables liées suivent via ON DELETE
-- CASCADE déjà en place). Ne supprime pas auth.users directement ici — la
-- suppression du compte d'authentification lui-même se fait via l'API
-- Supabase Auth côté client (supabase.auth.admin nécessite la service_role,
-- donc cette fonction nettoie les données applicatives ; la suppression
-- complète du compte d'auth est documentée comme étape serveur séparée,
-- voir docs/team/developpeur-backend.md).
create or replace function public.delete_my_data()
returns void as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Authentification requise';
  end if;

  delete from public.profiles where id = v_user_id;
end;
$$ language plpgsql security definer;
