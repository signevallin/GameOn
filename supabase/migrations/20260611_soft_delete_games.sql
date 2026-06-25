alter table public.games
  add column if not exists deleted_at timestamptz,
  add column if not exists teams_count integer not null default 0;
