-- Run this in your Supabase project SQL editor

CREATE TABLE IF NOT EXISTS teams (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT UNIQUE NOT NULL,
  score      INTEGER NOT NULL DEFAULT 0,
  completed  TEXT[]  NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Row-level security (disable for simple setups, or use the policies below)
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read teams (for leaderboard)
CREATE POLICY "Public read" ON teams
  FOR SELECT USING (true);

-- Allow insert (team registration)
CREATE POLICY "Public insert" ON teams
  FOR INSERT WITH CHECK (true);

-- Allow update (score updates from server-side API only)
CREATE POLICY "Public update" ON teams
  FOR UPDATE USING (true);
