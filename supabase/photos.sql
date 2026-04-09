-- Run this in your Supabase project SQL editor

CREATE TABLE IF NOT EXISTS photo_submissions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id      UUID NOT NULL,
  team_name    TEXT NOT NULL,
  mission_id   TEXT NOT NULL,
  photo_url    TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'pending',
  points_awarded INTEGER,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE photo_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read submissions" ON photo_submissions
  FOR SELECT USING (true);

CREATE POLICY "Public insert submissions" ON photo_submissions
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Public update submissions" ON photo_submissions
  FOR UPDATE USING (true);
