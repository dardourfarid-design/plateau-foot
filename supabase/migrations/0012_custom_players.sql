-- ============================================================
-- TACTIC MASTER — Joueurs personnalisés (custom)
-- Modèle freemium : 1 joueur custom gratuit par compte, les suivants
-- nécessitent un achat (même mécanisme que les thèmes — mock pour l'instant,
-- voir src/services/payment/). Contrairement à fictional_players (catalogue
-- partagé), chaque ligne ici appartient à un seul compte dès la création.
-- ============================================================

create table if not exists public.custom_players (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 24),
  style text not null check (style in ('rapide', 'costaud', 'technique', 'polyvalent')),
  -- Avatar composable : 3 axes simples plutôt qu'un éditeur graphique complet.
  -- Voir src/ui/playerAvatar.js pour le rendu SVG correspondant à ces valeurs.
  avatar_color text not null default '#3A6EA5',
  avatar_pattern text not null default 'plain' check (avatar_pattern in ('plain', 'stripes', 'halves', 'dots')),
  avatar_accessory text not null default 'none' check (avatar_accessory in ('none', 'band', 'star', 'bolt')),
  created_at timestamptz not null default now()
);

create index if not exists idx_custom_players_user on public.custom_players(user_id);

alter table public.custom_players enable row level security;

create policy "Un joueur peut lire ses propres créations"
  on public.custom_players for select
  using (auth.uid() = user_id);

create policy "Un joueur peut modifier ses propres créations"
  on public.custom_players for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Un joueur peut supprimer ses propres créations"
  on public.custom_players for delete
  using (auth.uid() = user_id);

-- Pas de policy insert directe : la création passe par create_custom_player()
-- ci-dessous, qui applique le quota freemium (1 gratuit, le reste nécessite
-- une trace d'achat déjà validée par le système de paiement existant).

create or replace function public.create_custom_player(
  p_name text,
  p_style text,
  p_avatar_color text,
  p_avatar_pattern text,
  p_avatar_accessory text
)
returns public.custom_players as $$
declare
  v_user_id uuid := auth.uid();
  v_existing_count integer;
  v_paid_slots integer;
  v_new_player public.custom_players;
begin
  if v_user_id is null then
    raise exception 'Authentification requise';
  end if;

  select count(*) into v_existing_count from public.custom_players where user_id = v_user_id;

  -- Le premier joueur custom est gratuit (v_existing_count = 0). Pour chaque
  -- joueur supplémentaire, il faut une ligne d'achat 'custom-player-slot'
  -- correspondante et non encore consommée — jamais de confiance dans un
  -- flag envoyé par le client, toujours une vérification contre la table
  -- purchases déjà sécurisée par le système de paiement existant.
  if v_existing_count >= 1 then
    select count(*) into v_paid_slots from public.purchases
      where user_id = v_user_id and theme_id = 'custom-player-slot' and status = 'completed';

    if v_paid_slots < v_existing_count then
      raise exception 'Limite de joueurs personnalisés gratuits atteinte. Achète un slot supplémentaire pour en créer un nouveau.';
    end if;
  end if;

  insert into public.custom_players (user_id, name, style, avatar_color, avatar_pattern, avatar_accessory)
  values (v_user_id, trim(p_name), p_style, p_avatar_color, p_avatar_pattern, p_avatar_accessory)
  returning * into v_new_player;

  return v_new_player;
end;
$$ language plpgsql security definer;


-- ---------------------------------------------------------------
-- Le slot payant "custom-player-slot" doit exister comme thème factice
-- dans la table themes pour que le système d'achat existant (déjà testé,
-- déjà sécurisé) puisse le traiter sans dupliquer de code de paiement.
-- is_active reste true (mock_complete_purchase l'exige pour valider l'achat,
-- voir 0002_mock_payment_function.sql) ; le filtrage pour qu'il n'apparaisse
-- PAS dans la grille de boutique normale se fait côté client
-- (main.js exclut explicitement cet id de renderShop), pas côté serveur.
-- ---------------------------------------------------------------
insert into public.themes (id, name, description, price_cents, sort_order, config, is_active)
values ('custom-player-slot', 'Slot joueur personnalisé', 'Débloque un emplacement supplémentaire pour créer un joueur personnalisé.', 149, 999, '{}'::jsonb, true)
on conflict (id) do nothing;
