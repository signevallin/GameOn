-- docs/sql/2026-05-28-custom-missions.sql
-- Run once in the Supabase SQL Editor.

CREATE TABLE custom_missions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_name TEXT NOT NULL DEFAULT 'My Missions',
  name          TEXT NOT NULL,
  icon          TEXT NOT NULL DEFAULT '⭐',
  desc          TEXT NOT NULL DEFAULT '',
  difficulty    TEXT NOT NULL DEFAULT 'medium'
                  CHECK (difficulty IN ('easy','medium','hard')),
  max_pts       INT  NOT NULL DEFAULT 500,
  type          TEXT NOT NULL
                  CHECK (type IN ('trivia_quiz','truefalse','closest_wins',
                                  'pa_sparet','timeline','photo')),
  data          JSONB NOT NULL DEFAULT '{}',
  sort_order    INT  NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE custom_missions ENABLE ROW LEVEL SECURITY;

-- Customers can CRUD their own; service role bypasses RLS for admin API routes
CREATE POLICY "custom_missions_owner"
  ON custom_missions
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
