-- SafePath accounts, roles and guardian links (PostgreSQL).
-- Columns are snake_case here; src/types/auth.ts is camelCase, so map between them in the data layer.

create table users (
  id            uuid primary key default gen_random_uuid(),
  email         text not null unique check (email = lower(email)),
  password_hash text not null,
  name          text not null check (char_length(name) between 1 and 40),
  phone         text,
  -- null until the user picks one after their first login.
  role          text check (role in ('guardian', 'child')),
  created_at    timestamptz not null default now()
);

-- A guardian may read a child's data only while a row exists here. Revoking deletes the row,
-- so no query can forget to filter out revoked links. Not tied to users.role: roles can be switched.
create table guardian_links (
  id          uuid primary key default gen_random_uuid(),
  guardian_id uuid not null references users (id) on delete cascade,
  child_id    uuid not null references users (id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (guardian_id, child_id),
  check (guardian_id <> child_id)
);

create index guardian_links_child_id_idx on guardian_links (child_id);

-- At most one code per child. Redeem it with
--   delete from pairing_codes where code = $1 and expires_at > now() returning child_id
-- so a code can only be used once, even if two guardians submit it at the same moment.
create table pairing_codes (
  child_id   uuid primary key references users (id) on delete cascade,
  code       text not null unique,
  expires_at timestamptz not null
);

-- Row level security with no policies: Supabase's public (anon/authenticated) roles get nothing.
-- Only the server (table owner or service role) can read or write.
alter table users          enable row level security;
alter table guardian_links enable row level security;
alter table pairing_codes  enable row level security;
