-- ============================================================================
-- PR2b SCHEMA — gestione-affitti v4 (per-entity tables)
-- Idempotente: ogni statement usa IF NOT EXISTS / on conflict do nothing.
-- Eseguire una volta via Supabase SQL Editor.
-- Se un `create policy` fallisce per duplicate, prepend `drop policy if exists`.
-- ============================================================================

-- 1. updated_at trigger function (riusato da tutte le tabelle)
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- 2. tipi_utenza (root, no FK uscenti)
create table if not exists tipi_utenza (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  nome text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, nome)
);
alter table tipi_utenza enable row level security;
drop policy if exists "tipi_utenza_owner" on tipi_utenza;
create policy "tipi_utenza_owner" on tipi_utenza for all using (user_id = auth.uid()) with check (user_id = auth.uid());
drop trigger if exists tipi_utenza_updated on tipi_utenza;
create trigger tipi_utenza_updated before update on tipi_utenza for each row execute function set_updated_at();

-- 3. banche
create table if not exists banche (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  nome text not null,
  intestatario text,
  currency text not null default 'EUR',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
alter table banche enable row level security;
drop policy if exists "banche_owner" on banche;
create policy "banche_owner" on banche for all using (user_id = auth.uid()) with check (user_id = auth.uid());
drop trigger if exists banche_updated on banche;
create trigger banche_updated before update on banche for each row execute function set_updated_at();

-- 4. proprieta
create table if not exists proprieta (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  nome text not null,
  tipo text default 'appartamento',
  importo_affitto_mensile numeric(12,2) not null default 0,
  currency text not null default 'EUR',
  banca_incasso_id uuid references banche(id) on delete set null,
  banca_destinazione_id uuid references banche(id) on delete set null,
  intestatario text,
  scadenza_giorno text not null default '1'
    check (scadenza_giorno = 'fine_mese' or (scadenza_giorno ~ '^[0-9]{1,2}$' and scadenza_giorno::int between 1 and 31)),
  note text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
alter table proprieta enable row level security;
drop policy if exists "proprieta_owner" on proprieta;
create policy "proprieta_owner" on proprieta for all using (user_id = auth.uid()) with check (user_id = auth.uid());
drop trigger if exists proprieta_updated on proprieta;
create trigger proprieta_updated before update on proprieta for each row execute function set_updated_at();

-- 5. inquilini
create table if not exists inquilini (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  proprieta_id uuid references proprieta(id) on delete set null,
  nome text not null,
  codice_fiscale text check (codice_fiscale is null or char_length(codice_fiscale) = 16),
  telefono text,
  email text check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
alter table inquilini enable row level security;
drop policy if exists "inquilini_owner" on inquilini;
create policy "inquilini_owner" on inquilini for all using (user_id = auth.uid()) with check (user_id = auth.uid());
drop trigger if exists inquilini_updated on inquilini;
create trigger inquilini_updated before update on inquilini for each row execute function set_updated_at();

-- 6. incassi_affitti
create table if not exists incassi_affitti (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  proprieta_id uuid not null references proprieta(id) on delete cascade,
  banca_id uuid references banche(id) on delete set null,
  banca_destinazione_id uuid references banche(id) on delete set null,
  mese text not null, -- 'YYYY-MM'
  anno int generated always as (substring(mese, 1, 4)::int) stored,
  importo numeric(12,2) not null default 0,
  currency text not null default 'EUR',
  data_incasso date,
  modificato_manualmente boolean not null default false,
  girato boolean not null default false,
  data_giro date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
alter table incassi_affitti enable row level security;
drop policy if exists "incassi_owner" on incassi_affitti;
create policy "incassi_owner" on incassi_affitti for all using (user_id = auth.uid()) with check (user_id = auth.uid());
drop trigger if exists incassi_updated on incassi_affitti;
create trigger incassi_updated before update on incassi_affitti for each row execute function set_updated_at();

-- 7. utenze
create table if not exists utenze (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  proprieta_id uuid not null references proprieta(id) on delete cascade,
  tipo_id uuid not null references tipi_utenza(id) on delete restrict,
  fornitore text,
  periodo_riferimento text,
  importo numeric(12,2) not null default 0,
  currency text not null default 'EUR',
  data_scadenza date,
  data_ricezione date,
  data_pagamento date,
  stato text default 'da_ricevere'
    check (stato in ('da_ricevere','da_pagare','pagata','rimborsata_inquilino')),
  note text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
alter table utenze enable row level security;
drop policy if exists "utenze_owner" on utenze;
create policy "utenze_owner" on utenze for all using (user_id = auth.uid()) with check (user_id = auth.uid());
drop trigger if exists utenze_updated on utenze;
create trigger utenze_updated before update on utenze for each row execute function set_updated_at();

-- 8. INDEXES (performance hint)
create index if not exists idx_proprieta_user on proprieta(user_id) where deleted_at is null;
create index if not exists idx_incassi_user_propmese on incassi_affitti(user_id, proprieta_id, mese);
create index if not exists idx_utenze_user_prop on utenze(user_id, proprieta_id) where deleted_at is null;
create index if not exists idx_inquilini_prop on inquilini(proprieta_id) where deleted_at is null;
