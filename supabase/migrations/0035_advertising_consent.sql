-- ============================================================
-- TACTIC MASTER — Consentement RGPD : finalité PUBLICITÉ
-- Épic monétisation publicitaire, PR A (issue #26).
--
-- Ajoute la finalité 'advertising' à la table user_consents (voir migration
-- 0007_gdpr_consent.sql). Comme pour les autres finalités, c'est un
-- consentement SÉPARÉ, jamais groupé (art. 7 RGPD) : cocher "analytics"
-- n'implique jamais "advertising".
--
-- Cette finalité couvre l'affichage de publicités (bannières, interstitiels,
-- vidéos récompensées) et, le cas échéant, leur personnalisation. Aucun SDK
-- publicitaire ne doit se charger côté client tant que ce consentement n'a
-- pas été recueilli — le gating est fait par advertisingConsentService.js,
-- cette table servant de trace/preuve serveur pour les utilisateurs connectés.
-- ============================================================

-- La contrainte CHECK inline de 0007 porte le nom auto-généré
-- user_consents_purpose_check. On la remplace pour élargir la liste des
-- finalités autorisées sans toucher aux données existantes.
alter table public.user_consents
  drop constraint if exists user_consents_purpose_check;

alter table public.user_consents
  add constraint user_consents_purpose_check
  check (purpose in ('account', 'analytics', 'email_marketing', 'data_sharing', 'advertising'));

-- Nouvelle version de politique : tout consentement enregistré à partir de
-- maintenant est horodaté avec cette version (le client passe explicitement
-- p_policy_version, voir CURRENT_POLICY_VERSION dans consentService.js).
-- On aligne aussi les valeurs par défaut côté base pour cohérence.
alter table public.user_consents
  alter column policy_version set default '2026-07-08';

create or replace function public.record_consent(
  p_purpose text,
  p_granted boolean,
  p_policy_version text default '2026-07-08'
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

-- CREATE OR REPLACE réinitialise le proconfig de la fonction : on ré-épingle
-- donc le search_path durci appliqué par la migration 0033_definer_search_path
-- (sinon on rouvrirait la faille que 0033 avait fermée).
alter function public.record_consent(text, boolean, text) set search_path = public, pg_temp;
