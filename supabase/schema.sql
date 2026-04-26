-- Cortex schema. Paste this whole file into Supabase SQL Editor and click Run.
-- It's idempotent: safe to re-run.

-- ============================================================
-- Notes
-- ============================================================
create table if not exists public.notes (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Untitled',
  body text not null default '',
  folder text not null default '',
  tags jsonb not null default '[]'::jsonb,
  dates jsonb not null default '[]'::jsonb,
  links jsonb not null default '[]'::jsonb,
  completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists notes_user_idx on public.notes (user_id, updated_at desc);
create index if not exists notes_folder_idx on public.notes (user_id, folder);

-- ============================================================
-- Edits (per-line history log)
-- ============================================================
create table if not exists public.edits (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  note_id text not null references public.notes(id) on delete cascade,
  ts timestamptz not null default now(),
  added jsonb not null default '[]'::jsonb,
  removed jsonb not null default '[]'::jsonb
);
create index if not exists edits_note_idx on public.edits (note_id, ts);

-- ============================================================
-- Versions (full snapshots)
-- ============================================================
create table if not exists public.versions (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  note_id text not null references public.notes(id) on delete cascade,
  ts timestamptz not null default now(),
  body text not null
);
create index if not exists versions_note_idx on public.versions (note_id, ts);

-- ============================================================
-- App settings (one row per user)
-- ============================================================
create table if not exists public.settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- ============================================================
-- Row-level security: each user only sees/edits their own rows
-- ============================================================
alter table public.notes    enable row level security;
alter table public.edits    enable row level security;
alter table public.versions enable row level security;
alter table public.settings enable row level security;

-- Notes
drop policy if exists "notes_select_own" on public.notes;
drop policy if exists "notes_modify_own" on public.notes;
create policy "notes_select_own" on public.notes for select using (auth.uid() = user_id);
create policy "notes_modify_own" on public.notes for all    using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Edits
drop policy if exists "edits_select_own" on public.edits;
drop policy if exists "edits_modify_own" on public.edits;
create policy "edits_select_own" on public.edits for select using (auth.uid() = user_id);
create policy "edits_modify_own" on public.edits for all    using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Versions
drop policy if exists "versions_select_own" on public.versions;
drop policy if exists "versions_modify_own" on public.versions;
create policy "versions_select_own" on public.versions for select using (auth.uid() = user_id);
create policy "versions_modify_own" on public.versions for all    using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Settings
drop policy if exists "settings_select_own" on public.settings;
drop policy if exists "settings_modify_own" on public.settings;
create policy "settings_select_own" on public.settings for select using (auth.uid() = user_id);
create policy "settings_modify_own" on public.settings for all    using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Auto-update updated_at on notes
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists notes_touch on public.notes;
create trigger notes_touch before update on public.notes
  for each row execute function public.touch_updated_at();

drop trigger if exists settings_touch on public.settings;
create trigger settings_touch before update on public.settings
  for each row execute function public.touch_updated_at();
