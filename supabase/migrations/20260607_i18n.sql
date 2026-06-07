-- supabase/migrations/20260607_i18n.sql

-- Add language preference to games
alter table public.games
  add column if not exists language text not null default 'en';

-- Cache for translated custom mission names/descs
create table if not exists public.mission_translations (
  id          uuid primary key default gen_random_uuid(),
  mission_id  uuid not null references public.custom_missions(id) on delete cascade,
  language    text not null,
  name        text not null,
  "desc"      text,
  created_at  timestamptz not null default now(),
  unique(mission_id, language)
);
