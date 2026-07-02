-- ===================== MIGRATION 0022 — NOUVELLE BOUTIQUE =====================
-- Refonte complète du catalogue produits :
--   • 5 nouveaux kits Saison 1 (visuel inédit, prix 2,49 €)
--   • Table user_passes pour les abonnements Stripe récurrents
--   • Table founders_counter pour le compteur Fondateurs (fictif côté affichage,
--     réel côté DB pour la cohérence des achats)
--   • Migration des anciens thèmes vers le nouveau prix 2,49 €

-- ---------- Mise à jour prix anciens kits ----------
-- On augmente de 1,99 € → 2,49 € pour alignement avec la nouvelle grille tarifaire.
-- Les achats déjà effectués ne sont pas affectés (colonne purchases.amount_cents déjà figée).
update public.themes set price_cents = 249 where price_cents = 199 and is_active = true;

-- ---------- 5 nouveaux kits Saison 1 ----------
insert into public.themes (id, name, description, price_cents, sort_order, config) values

  ('tokyo-minuit',
   'Tokyo Minuit',
   'La ville qui ne dort jamais — néon violet, pluie et béton.',
   249, 20,
   '{"vertTerrain":"#120820","vertTerrainClair":"#1C1030","bleuEquipe":"#8A2BE2","rougeEquipe":"#FF1493","accent":"#C084FC"}'::jsonb),

  ('savane',
   'Savane',
   'Terre ocre, horizon brûlé, seize secondes pour tirer.',
   249, 21,
   '{"vertTerrain":"#2C1A06","vertTerrainClair":"#3D2408","bleuEquipe":"#C2742A","rougeEquipe":"#8B4513","accent":"#E8C97A"}'::jsonb),

  ('arctique',
   'Arctique',
   'Glace bleutée, silence total, enjeu maximum.',
   249, 22,
   '{"vertTerrain":"#040E1F","vertTerrainClair":"#071529","bleuEquipe":"#4DD8F0","rougeEquipe":"#A8E6F0","accent":"#E0F4FF"}'::jsonb),

  ('volcan',
   'Volcan',
   'Lave sous la surface — rouge et cendre, avant l'explosion.',
   249, 23,
   '{"vertTerrain":"#1A0505","vertTerrainClair":"#260707","bleuEquipe":"#FF4500","rougeEquipe":"#8B0000","accent":"#FFA040"}'::jsonb),

  ('cyber',
   'Cyber',
   'Matrix. Chaque déplacement laisse une trace dans le code.',
   249, 24,
   '{"vertTerrain":"#020A05","vertTerrainClair":"#031008","bleuEquipe":"#00FF41","rougeEquipe":"#39FF14","accent":"#ADFF2F"}'::jsonb)

on conflict (id) do nothing;

-- ---------- Table user_passes : abonnements Stripe récurrents ----------
-- Chaque ligne représente un abonnement actif ou passé d'un utilisateur.
-- La colonne stripe_subscription_id permet de tracer les événements webhook
-- (invoice.payment_succeeded, customer.subscription.deleted, etc.).
create table if not exists public.user_passes (
  id                    uuid        primary key default gen_random_uuid(),
  user_id               uuid        not null references auth.users(id) on delete cascade,
  pass_type             text        not null check (pass_type in ('monthly', 'quarterly')),
  stripe_subscription_id text       unique,
  status                text        not null default 'active'
                                    check (status in ('active', 'cancelled', 'expired', 'past_due')),
  current_period_end    timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

alter table public.user_passes enable row level security;

create policy "lecture pass par propriétaire"
  on public.user_passes for select
  using (auth.uid() = user_id);

-- Index pour retrouver rapidement un abonnement par subscription_id Stripe
create index if not exists idx_user_passes_stripe_id
  on public.user_passes (stripe_subscription_id);

-- ---------- Table founders_counter : compteur Fondateurs ----------
-- Stocké en base pour être cohérent entre sessions et utilisateurs.
-- La valeur initiale est fictive (200) — décrémentée réellement à chaque
-- achat Pack Fondateurs pour que le compteur affiché reste crédible dans
-- le temps. La table ne contient qu'une ligne (id = 1).
create table if not exists public.founders_counter (
  id        int  primary key default 1 check (id = 1), -- singleton
  remaining int  not null default 200 check (remaining >= 0),
  updated_at timestamptz not null default now()
);

-- Lecture publique (pour affichage en boutique sans auth), écriture réservée au service_role
alter table public.founders_counter enable row level security;
create policy "lecture publique compteur fondateurs"
  on public.founders_counter for select
  to anon, authenticated
  using (true);

-- Insérer la valeur initiale si la table vient d'être créée
insert into public.founders_counter (id, remaining) values (1, 200)
on conflict (id) do nothing;

-- RPC : décrémente le compteur de 1 lors d'un achat Fondateurs.
-- Appelée depuis le webhook Stripe (service_role) — bypasse la RLS.
-- Retourne le nouveau remaining, ou -1 si déjà à 0 (sécurité supplémentaire).
create or replace function public.decrement_founders_counter()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  new_remaining int;
begin
  update founders_counter
  set remaining  = greatest(remaining - 1, 0),
      updated_at = now()
  where id = 1
  returning remaining into new_remaining;
  return coalesce(new_remaining, 0);
end;
$$;

-- RPC : lecture du compteur sans appel direct à la table (plus simple côté client)
create or replace function public.get_founders_remaining()
returns int
language sql
security definer
set search_path = public
as $$
  select remaining from public.founders_counter where id = 1;
$$;

-- RPC : vérifie si l'utilisateur courant a un pass actif
create or replace function public.get_my_active_pass()
returns table (pass_type text, current_period_end timestamptz)
language sql
security definer
set search_path = public
as $$
  select pass_type, current_period_end
  from public.user_passes
  where user_id = auth.uid()
    and status = 'active'
    and (current_period_end is null or current_period_end > now())
  order by created_at desc
  limit 1;
$$;
