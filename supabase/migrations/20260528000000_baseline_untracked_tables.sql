-- 20260528000000_baseline_untracked_tables.sql
-- Baseline for tables/columns that previously existed only as one-off scripts
-- in docs/sql and were never tracked as migrations. Idempotent so it is safe
-- to apply to an existing project. Row Level Security policies for these
-- objects are (re)defined centrally in 20260704_rls_hardening.sql.

-- ── games: ownership + power-up/mystery-box state ──────────────────────────
ALTER TABLE IF EXISTS games
  ADD COLUMN IF NOT EXISTS user_id       UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS powerups_used TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS hot_potato    JSONB  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS mystery_box   JSONB  DEFAULT NULL;

-- ── teams: mystery-box power-up charges ────────────────────────────────────
ALTER TABLE IF EXISTS teams
  ADD COLUMN IF NOT EXISTS extra_powerups TEXT[] NOT NULL DEFAULT '{}';

-- ── custom_missions ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS custom_missions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_name TEXT NOT NULL DEFAULT 'My Missions',
  name          TEXT NOT NULL,
  icon          TEXT NOT NULL DEFAULT '⭐',
  "desc"        TEXT NOT NULL DEFAULT '',
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

-- ── custom_mission_categories ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS custom_mission_categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  emoji       TEXT NOT NULL DEFAULT '📋',
  sort_order  INT  NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE IF EXISTS custom_missions
  ADD COLUMN IF NOT EXISTS category_id UUID
    REFERENCES custom_mission_categories(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_custom_mission_categories_user_id
  ON custom_mission_categories(user_id);
CREATE INDEX IF NOT EXISTS idx_custom_missions_category_id
  ON custom_missions(category_id);
CREATE INDEX IF NOT EXISTS idx_custom_missions_user_id
  ON custom_missions(user_id);
