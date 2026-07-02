-- ===================== MIGRATION 0023 — PIÈCES TACTIQUES =====================
-- Système de monnaie in-game gagnée à la victoire et dépensée en boutique.
-- Pas achetable contre de l'argent réel — uniquement récompense gameplay.
--
-- Flux : victoire → earn_coins(10) → solde mis à jour + log transaction
--        achat kit  → spend_coins(10, desc) → solde débité + kit débloqué
--
-- Choix d'architecture : le solde vit dans user_currency (lecture rapide O(1))
-- et les mouvements dans currency_transactions (audit complet, jamais effacé).
-- Les deux tables référencent profiles.id (pas auth.users.id) pour s'aligner
-- avec le reste du schéma et profiter du ON DELETE CASCADE déjà en place.

-- ---------- Table user_currency : solde courant ----------
create table if not exists public.user_currency (
  user_id    uuid primary key references public.profiles(id) on delete cascade,
  balance    int  not null default 0 check (balance >= 0),
  updated_at timestamptz not null default now()
);

alter table public.user_currency enable row level security;

create policy "lecture solde par propriétaire"
  on public.user_currency for select
  using (auth.uid() = user_id);

-- ---------- Table currency_transactions : journal des mouvements ----------
create table if not exists public.currency_transactions (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references public.profiles(id) on delete cascade,
  amount      int         not null,  -- positif = gain, négatif = dépense
  type        text        not null check (type in ('win', 'spend', 'bonus')),
  description text,
  created_at  timestamptz not null default now()
);

alter table public.currency_transactions enable row level security;

create policy "lecture transactions par propriétaire"
  on public.currency_transactions for select
  using (auth.uid() = user_id);

-- Index pour les requêtes de solde récent
create index if not exists idx_currency_tx_user_date
  on public.currency_transactions (user_id, created_at desc);

-- ---------- RPC earn_coins : appelée après une victoire ----------
-- Crée la ligne user_currency si elle n'existe pas encore (first win),
-- incrémente le solde, et log la transaction.
-- security definer : le client ne peut pas truquer le montant,
-- c'est toujours la valeur fixée dans la RPC qui s'applique.
create or replace function public.earn_coins(p_amount int default 10)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  new_balance int;
begin
  insert into user_currency (user_id, balance)
  values (auth.uid(), p_amount)
  on conflict (user_id)
  do update set
    balance    = user_currency.balance + p_amount,
    updated_at = now()
  returning balance into new_balance;

  insert into currency_transactions (user_id, amount, type, description)
  values (auth.uid(), p_amount, 'win', 'Victoire en partie');

  return new_balance;
end;
$$;

-- ---------- RPC spend_coins : appelée lors d'un achat avec pièces ----------
-- Vérifie le solde avant de débiter. Lève une exception si insuffisant
-- (attrapée côté client et affichée à l'utilisateur sans crash).
create or replace function public.spend_coins(p_amount int, p_description text)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  new_balance int;
begin
  update user_currency
  set
    balance    = balance - p_amount,
    updated_at = now()
  where user_id = auth.uid()
    and balance >= p_amount
  returning balance into new_balance;

  if new_balance is null then
    raise exception 'Solde insuffisant pour cet achat.';
  end if;

  insert into currency_transactions (user_id, amount, type, description)
  values (auth.uid(), -p_amount, 'spend', p_description);

  return new_balance;
end;
$$;

-- ---------- RPC get_currency_balance : lecture solde ----------
create or replace function public.get_currency_balance()
returns int
language sql
security definer
set search_path = public
as $$
  select coalesce(
    (select balance from public.user_currency where user_id = auth.uid()),
    0
  );
$$;
