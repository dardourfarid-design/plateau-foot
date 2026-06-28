-- ============================================================
-- TACTIC MASTER — Ajout de la finalité "notifications_reengagement"
-- au système de consentement RGPD déjà en place (0007_gdpr_consent.sql).
-- Strictement opt-in, comme les autres finalités optionnelles.
-- ============================================================

alter table public.user_consents drop constraint if exists user_consents_purpose_check;
alter table public.user_consents add constraint user_consents_purpose_check
  check (purpose in ('account', 'analytics', 'email_marketing', 'data_sharing', 'notifications_reengagement'));
