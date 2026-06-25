-- supabase/migrations/20260611_remote_missions.sql
ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS relay_state JSONB;
