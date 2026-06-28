-- ============================================================
-- TACTIC MASTER — Joueurs fictifs, collection et équipes
-- Fondation du système de collection/mercato. Tous les joueurs sont
-- entièrement fictifs (nom, nationalité, style) — aucune référence à une
-- personne réelle. Le champ `custom_name` permet à chaque utilisateur de
-- renommer librement SES propres exemplaires pour son usage personnel
-- (différent d'une exploitation commerciale d'un nom réel par l'éditeur).
-- ============================================================

-- ---------- Catalogue des joueurs fictifs ----------
-- Référentiel global, le même pour tout le monde (comme `themes`).
create table if not exists public.fictional_players (
  id uuid primary key default gen_random_uuid(),
  name text not null,                  -- nom fictif (ex: "Theo Vasquez")
  nationality_flag text,                -- code pays générique pour l'avatar (ex: "fr", "br") — pas de lien avec une fédération
  style text not null check (style in ('rapide', 'costaud', 'technique', 'polyvalent')),
  rarity text not null check (rarity in ('commun', 'rare', 'legendaire')),
  base_stat integer not null default 50 check (base_stat between 1 and 99), -- purement cosmétique pour l'instant (aucun effet sur les règles de jeu)
  avatar_seed text not null,           -- graine utilisée pour générer un avatar visuel déterministe (voir src/ui/playerAvatar.js)
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.fictional_players enable row level security;

create policy "Le catalogue de joueurs est public en lecture"
  on public.fictional_players for select
  using (is_active = true);


-- ---------- Collection : quels joueurs un compte possède ----------
create table if not exists public.player_ownership (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  player_id uuid not null references public.fictional_players(id),
  custom_name text,                    -- renommage libre par le joueur, optionnel
  acquired_via text not null default 'starter' check (acquired_via in ('starter', 'purchase', 'mercato_trade', 'reward')),
  acquired_at timestamptz not null default now(),
  unique (user_id, player_id)
);

create index if not exists idx_player_ownership_user on public.player_ownership(user_id);

alter table public.player_ownership enable row level security;

create policy "Un joueur peut lire sa propre collection"
  on public.player_ownership for select
  using (auth.uid() = user_id);

create policy "Un joueur peut renommer ses propres exemplaires"
  on public.player_ownership for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Pas de policy insert pour "authenticated" : l'acquisition (starter pack,
-- achat, mercato) passe toujours par une fonction RPC dédiée, jamais par un
-- insert direct — même logique de sécurité que purchases/game_sessions.


-- ---------- Équipe active : quels 6 joueurs de la collection sont alignés ----------
create table if not exists public.team_lineups (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  -- 6 positions fixes correspondant aux 6 pions du moteur de jeu
  -- (gk, def0, def1, att0, att1, att2) ; chaque valeur référence
  -- player_ownership.id ou est NULL si la position n'est pas encore pourvue.
  slot_gk uuid references public.player_ownership(id),
  slot_def0 uuid references public.player_ownership(id),
  slot_def1 uuid references public.player_ownership(id),
  slot_att0 uuid references public.player_ownership(id),
  slot_att1 uuid references public.player_ownership(id),
  slot_att2 uuid references public.player_ownership(id),
  updated_at timestamptz not null default now()
);

alter table public.team_lineups enable row level security;

create policy "Un joueur peut lire et gérer sa propre composition"
  on public.team_lineups for select
  using (auth.uid() = user_id);

create policy "Un joueur peut modifier sa propre composition"
  on public.team_lineups for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);


-- ---------- Fonctions RPC ----------

-- Attribue un pack de démarrage (6 joueurs communs aléatoires) à un nouveau
-- compte, pour qu'il ait immédiatement de quoi composer une équipe.
create or replace function public.grant_starter_pack()
returns void as $$
declare
  v_user_id uuid := auth.uid();
  v_player record;
begin
  if v_user_id is null then
    raise exception 'Authentification requise';
  end if;

  -- Si déjà un starter pack, ne rien refaire (idempotent)
  if exists (select 1 from public.player_ownership where user_id = v_user_id) then
    return;
  end if;

  for v_player in
    select id from public.fictional_players
    where rarity = 'commun' and is_active = true
    order by random()
    limit 6
  loop
    insert into public.player_ownership (user_id, player_id, acquired_via)
    values (v_user_id, v_player.id, 'starter');
  end loop;
end;
$$ language plpgsql security definer;


-- Mercato : propose un échange de joueurs entre deux comptes. Pour rester
-- simple en V1, l'échange est direct et immédiat si les deux joueurs
-- listés appartiennent bien aux comptes indiqués (pas de système d'offre
-- asynchrone pour l'instant — voir limite documentée dans le README).
create or replace function public.execute_mercato_trade(
  p_my_ownership_id uuid,
  p_their_ownership_id uuid,
  p_their_user_id uuid
)
returns void as $$
declare
  v_my_user_id uuid := auth.uid();
begin
  if v_my_user_id is null then
    raise exception 'Authentification requise';
  end if;

  if not exists (
    select 1 from public.player_ownership
    where id = p_my_ownership_id and user_id = v_my_user_id
  ) then
    raise exception 'Tu ne possèdes pas ce joueur.';
  end if;

  if not exists (
    select 1 from public.player_ownership
    where id = p_their_ownership_id and user_id = p_their_user_id
  ) then
    raise exception 'L''autre joueur ne possède pas ce joueur.';
  end if;

  update public.player_ownership set user_id = p_their_user_id, acquired_via = 'mercato_trade'
    where id = p_my_ownership_id;
  update public.player_ownership set user_id = v_my_user_id, acquired_via = 'mercato_trade'
    where id = p_their_ownership_id;
end;
$$ language plpgsql security definer;


-- ---------- Seed : catalogue initial de joueurs fictifs ----------
insert into public.fictional_players (name, nationality_flag, style, rarity, base_stat, avatar_seed) values
  ('Theo Vasquez', 'fr', 'rapide', 'commun', 58, 'tv01'),
  ('Marcus Idowu', 'ng', 'costaud', 'commun', 55, 'mi02'),
  ('Kenji Asano', 'jp', 'technique', 'commun', 56, 'ka03'),
  ('Lukas Berg', 'se', 'polyvalent', 'commun', 54, 'lb04'),
  ('Diego Salaz', 'ar', 'rapide', 'commun', 57, 'ds05'),
  ('Omar Haidari', 'ma', 'technique', 'commun', 55, 'oh06'),
  ('Bastian Voss', 'de', 'costaud', 'commun', 56, 'bv07'),
  ('Ryo Tanaka', 'jp', 'rapide', 'commun', 53, 'rt08'),
  ('Mateo Rinaldi', 'it', 'technique', 'rare', 68, 'mr09'),
  ('Connor Blake', 'ie', 'costaud', 'rare', 67, 'cb10'),
  ('Yannick Dubois', 'fr', 'polyvalent', 'rare', 69, 'yd11'),
  ('Tariq Mensah', 'gh', 'rapide', 'rare', 70, 'tm12'),
  ('Aleksander Kovac', 'rs', 'technique', 'legendaire', 88, 'ak13'),
  ('Hiroshi Yamamoto', 'jp', 'polyvalent', 'legendaire', 86, 'hy14')
on conflict do nothing;
