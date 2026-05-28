-- docs/sql/2026-05-28-auth-migration.sql
-- Run this once in the Supabase SQL editor.

-- 1. Add user_id to games
ALTER TABLE games
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- 2. Move powerups_used and hot_potato from settings → games
ALTER TABLE games
  ADD COLUMN IF NOT EXISTS powerups_used TEXT[] DEFAULT '{}';

ALTER TABLE games
  ADD COLUMN IF NOT EXISTS hot_potato JSONB DEFAULT NULL;

-- 3. Back-fill: assign all existing games to the super-admin.
--    Run AFTER creating your super-admin account.
--    Replace '00000000-0000-0000-0000-000000000000' with your real user UUID.
-- UPDATE games SET user_id = '00000000-0000-0000-0000-000000000000' WHERE user_id IS NULL;

-- 4. Enable RLS on games (defence-in-depth; API routes enforce auth separately)
ALTER TABLE games ENABLE ROW LEVEL SECURITY;

CREATE POLICY "games_owner_select" ON games FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "games_owner_insert" ON games FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "games_owner_update" ON games FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "games_owner_delete" ON games FOR DELETE
  USING (user_id = auth.uid());