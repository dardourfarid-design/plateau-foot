-- ============================================================
-- PLATEAU FOOT — Migration initiale
-- Tables : profiles, themes, purchases
-- Row Level Security activée partout : chaque joueur ne voit/modifie
-- que ses propres données ; le catalogue de thèmes est public en lecture.
-- ============================================================

-- ---------- PROFILES ----------
-- Un profil par utilisateur Supabase Auth (1:1 avec auth.users).
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Joueur',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Un joueur peut lire son propre profil"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Un joueur peut modifier son propre profil"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Un joueur peut créer son propre profil"
  on public.profiles for insert
  with check (auth.uid() = id);

-- Création automatique du profil à l'inscription
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', 'Joueur'));
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- ---------- THEMES ----------
-- Catalogue des thèmes visuels (skins). Public en lecture pour tout le monde
-- (connecté ou pas), modifiable uniquement via le back-office (pas de policy
-- d'écriture côté client : gestion par la console Supabase ou un rôle admin).
create table if not exists public.themes (
  id text primary key,              -- ex: 'neon', 'neige', 'classique'
  name text not null,                -- nom affiché, ex: 'Néon'
  description text,
  price_cents integer not null default 0,  -- 0 = thème gratuit
  currency text not null default 'eur',
  preview_image_url text,
  config jsonb not null default '{}'::jsonb, -- variables CSS / assets du thème
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.themes enable row level security;

create policy "Le catalogue de thèmes est public en lecture"
  on public.themes for select
  using (is_active = true);


-- ---------- PURCHASES ----------
-- Historique des achats de thèmes. Une ligne = un thème débloqué pour un joueur.
-- Alimentée uniquement par le webhook Stripe (service role), jamais directement
-- par le client, pour empêcher qu'un joueur s'auto-attribue un achat.
create table if not exists public.purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  theme_id text not null references public.themes(id),
  stripe_session_id text unique,
  amount_cents integer not null,
  currency text not null default 'eur',
  status text not null default 'completed' check (status in ('pending', 'completed', 'refunded')),
  created_at timestamptz not null default now(),
  unique (user_id, theme_id)
);

alter table public.purchases enable row level security;

create policy "Un joueur peut lire ses propres achats"
  on public.purchases for select
  using (auth.uid() = user_id);

-- Pas de policy insert/update pour le rôle "authenticated" :
-- seul le service_role (utilisé par le webhook serveur) peut écrire ici.


-- ---------- SEED : thèmes de départ ----------
insert into public.themes (id, name, description, price_cents, sort_order, config) values
  ('classique', 'Classique', 'Le terrain vert historique de Tactic Master.', 0, 0,
    '{"vertTerrain":"#1F3D2B","vertTerrainClair":"#28492F","bleuEquipe":"#3A6EA5","rougeEquipe":"#C84B31","accent":"#C97B4A"}'::jsonb),
  ('neon', 'Néon', 'Un terrain électrique pour les soirées arcade.', 199, 1,
    '{"vertTerrain":"#0D1B2A","vertTerrainClair":"#15263B","bleuEquipe":"#00E5FF","rougeEquipe":"#FF2D75","accent":"#FFD600"}'::jsonb),
  ('terre-battue', 'Terre battue', 'Ambiance Roland-Garros, mais au foot.', 199, 3,
    '{"vertTerrain":"#A8542E","vertTerrainClair":"#BD663C","bleuEquipe":"#2B4C7E","rougeEquipe":"#7E2B2B","accent":"#F2C572"}'::jsonb)
on conflict (id) do nothing;
