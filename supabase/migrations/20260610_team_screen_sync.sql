-- supabase/migrations/20260610_team_screen_sync.sql

-- Shared current-mission state for remote-mode screen sync.
-- null  = team is on the missions list
-- non-null = team is viewing that mission's challenge screen
alter table public.teams
  add column if not exists synced_mission_id text;
