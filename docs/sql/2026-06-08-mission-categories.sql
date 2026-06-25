-- docs/sql/2026-06-08-mission-categories.sql
-- 1. New table for categories
CREATE TABLE custom_mission_categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  emoji       TEXT NOT NULL DEFAULT '📋',
  sort_order  INT  NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE custom_mission_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "custom_mission_categories_owner"
  ON custom_mission_categories
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 2. Add category_id FK to custom_missions (nullable — existing rows default to NULL)
ALTER TABLE custom_missions
  ADD COLUMN category_id UUID REFERENCES custom_mission_categories(id) ON DELETE SET NULL;

-- 3. Create indexes for optimal query performance
CREATE INDEX idx_custom_mission_categories_user_id ON custom_mission_categories(user_id);
CREATE INDEX idx_custom_missions_category_id ON custom_missions(category_id);
