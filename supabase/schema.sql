-- Cotejo schema. Run once in Supabase > SQL Editor.
-- Design rules (Team 8 Blueprint): no score, grade or label column about a person anywhere;
-- listing screenshots and free text are never stored; only the student's confirmed fields and the
-- verdicts she chose to save, tied to the catalog version they were computed with.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- checks (saved by the student)
create table public.checks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 80),
  software_ids text[] not null check (cardinality(software_ids) between 1 and 5),
  specs jsonb not null check (jsonb_typeof(specs) = 'object'),
  budget_mxn int check (budget_mxn is null or budget_mxn between 0 and 1000000),
  verdicts jsonb not null check (jsonb_typeof(verdicts) = 'array'),
  catalog_version text not null check (char_length(catalog_version) <= 30),
  is_sample boolean not null default false,
  used_text_helper boolean not null default false,
  used_screenshot boolean not null default false,
  ai_fields_proposed int not null default 0 check (ai_fields_proposed between 0 and 20),
  ai_fields_changed int not null default 0 check (ai_fields_changed between 0 and 20),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- corrections (reports on a requirement)
-- The student reports; only the operator (via the SQL editor) can change status.
create table public.corrections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  requirement_id text not null check (requirement_id ~ '^[a-z0-9_.]{3,80}$'),
  note text not null check (char_length(note) between 5 and 500),
  catalog_version text not null check (char_length(catalog_version) <= 30),
  status text not null default 'open' check (status in ('open', 'fixed', 'rejected')),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- consents
create table public.consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  purpose text not null check (purpose in ('process_data', 'ai_text', 'ai_image')),
  granted boolean not null,
  text_version text not null check (char_length(text_version) <= 20),
  created_at timestamptz not null default now()
);

create index on public.checks (user_id, created_at desc);
create index on public.corrections (user_id, created_at desc);
create index on public.consents (user_id, purpose, created_at desc);

-- ---------------------------------------------------------------- RLS on every table
alter table public.checks enable row level security;
alter table public.corrections enable row level security;
alter table public.consents enable row level security;

-- checks: the student sees and manages only her own rows. No update: a saved check is immutable.
create policy "checks select own" on public.checks for select using (user_id = auth.uid());
create policy "checks insert own" on public.checks for insert with check (user_id = auth.uid());
create policy "checks delete own" on public.checks for delete using (user_id = auth.uid());

-- corrections: own rows, readable and insertable by the student; status is set by the operator only.
create policy "corrections select own" on public.corrections for select using (user_id = auth.uid());
create policy "corrections insert own" on public.corrections
  for insert with check (user_id = auth.uid() and status = 'open');
create policy "corrections delete own" on public.corrections for delete using (user_id = auth.uid());

-- consents: append-only for the student, readable, deletable with "delete my data".
create policy "consents select own" on public.consents for select using (user_id = auth.uid());
create policy "consents insert own" on public.consents for insert with check (user_id = auth.uid());
create policy "consents delete own" on public.consents for delete using (user_id = auth.uid());
