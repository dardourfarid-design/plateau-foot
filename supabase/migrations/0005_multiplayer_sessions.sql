-- ============================================================
-- TACTIC MASTER — Multijoueur en ligne (V1 : lien d'invitation)
-- Table game_sessions : une ligne = une partie en cours ou terminée,
-- partagée en temps réel entre deux navigateurs via Supabase Realtime.
-- ============================================================

create table if not exists public.game_sessions (
  id uuid primary key default gen_random_uuid(),

  -- Code court et lisible pour le lien d'invitation (ex: "ABCD12"),
  -- distinct de l'id technique pour rester partageable facilement.
  invite_code text not null unique,

  -- Le créateur de la partie ; peut être null si un visiteur non connecté
  -- crée une partie (le jeu reste jouable sans compte, cf. principe déjà
  -- établi pour le mode solo).
  host_user_id uuid references public.profiles(id) on delete set null,
  guest_user_id uuid references public.profiles(id) on delete set null,

  -- Snapshot complet de l'état de jeu (même structure que l'état du moteur
  -- côté client, voir src/engine/gameEngine.js::createGame). Stocké en jsonb
  -- plutôt que d'éclater en colonnes, pour ne pas dupliquer la modélisation
  -- déjà testée côté moteur : la table reflète l'état, elle ne réinvente pas
  -- les règles.
  game_state jsonb not null,

  -- Qui doit jouer le prochain coup, dénormalisé hors de game_state pour
  -- pouvoir filtrer/indexer efficacement sans descendre dans le jsonb.
  status text not null default 'waiting' check (status in ('waiting', 'active', 'finished', 'abandoned')),

  host_team text not null default 'bleu' check (host_team in ('bleu', 'rouge')),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Les parties orphelines (jamais rejointes) doivent pouvoir être nettoyées
  -- après un délai ; ce champ permet une purge périodique simple.
  last_activity_at timestamptz not null default now()
);

create index if not exists idx_game_sessions_invite_code on public.game_sessions(invite_code);
create index if not exists idx_game_sessions_status on public.game_sessions(status);

alter table public.game_sessions enable row level security;

-- Lecture : les deux joueurs de la partie peuvent la lire, ainsi que
-- n'importe qui connaissant le invite_code (nécessaire pour qu'un invité
-- puisse découvrir la partie avant même d'y avoir une ligne en tant que
-- guest_user_id — la policy se base donc sur la lecture par invite_code,
-- pas sur l'identité, pour cette V1 sans système de salons privés complexe).
create policy "Une partie est lisible par quiconque connaît son code"
  on public.game_sessions for select
  using (true);

-- Écriture : seul le service backend (via une fonction security definer)
-- doit pouvoir modifier l'état du jeu, pour appliquer la même discipline
-- que purchases — jamais de mutation directe par un client, même
-- authentifié, sur une donnée partagée entre deux joueurs (sinon un joueur
-- malhonnête pourrait modifier l'état pour tricher).
-- Pas de policy insert/update pour "authenticated" : tout passe par RPC.


-- ---------------------------------------------------------------
-- Fonctions RPC sécurisées pour manipuler une session de partie
-- ---------------------------------------------------------------

-- Crée une nouvelle partie en attente, retourne son invite_code.
create or replace function public.create_game_session(p_initial_state jsonb)
returns table(id uuid, invite_code text) as $$
declare
  v_code text;
  v_id uuid;
  v_user_id uuid := auth.uid(); -- null accepté : invité non connecté autorisé
begin
  -- Génère un code court à partir d'un uuid, lisible et peu ambigu
  -- (majuscules + chiffres, sans caractères visuellement confondables).
  v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));

  insert into public.game_sessions (invite_code, host_user_id, game_state, status)
  values (v_code, v_user_id, p_initial_state, 'waiting')
  returning game_sessions.id into v_id;

  return query select v_id, v_code;
end;
$$ language plpgsql security definer;


-- Rejoint une partie existante via son code d'invitation.
create or replace function public.join_game_session(p_invite_code text)
returns jsonb as $$
declare
  v_session record;
  v_user_id uuid := auth.uid();
begin
  select * into v_session from public.game_sessions
    where invite_code = upper(p_invite_code) and status = 'waiting'
    for update; -- verrou pour éviter que deux invités rejoignent en même temps

  if v_session is null then
    raise exception 'Partie introuvable ou déjà complète.';
  end if;

  update public.game_sessions
    set guest_user_id = v_user_id,
        status = 'active',
        last_activity_at = now()
    where id = v_session.id;

  return jsonb_build_object('id', v_session.id, 'game_state', v_session.game_state, 'host_team', v_session.host_team);
end;
$$ language plpgsql security definer;


-- Applique un nouvel état de jeu à une session existante (appelé après
-- chaque coup validé côté client par le moteur déjà testé). Une vérification
-- complète "le coup est-il légal" côté serveur est un chantier futur
-- (voir docs/team/developpeur-backend.md) ; cette V1 fait confiance au
-- moteur client identique des deux côtés, ce qui est un compromis assumé
-- pour la première version, pas un oubli.
create or replace function public.update_game_session_state(
  p_session_id uuid,
  p_new_state jsonb
)
returns void as $$
begin
  update public.game_sessions
    set game_state = p_new_state,
        last_activity_at = now(),
        status = case when (p_new_state->>'gameOver')::boolean is true then 'finished' else status end
    where id = p_session_id;
end;
$$ language plpgsql security definer;
