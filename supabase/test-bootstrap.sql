-- supabase/test-bootstrap.sql
--
-- Self-contained schema for standing up a DISPOSABLE TEST project (e.g. a free
-- Supabase project) to run the full E2E suite against. Run this once in the
-- test project's SQL editor — it creates every table the app touches, so you do
-- NOT need to also apply the migrations.
--
-- Reconstructed from the application's actual usage. The base `games`, `teams`,
-- `team_members` and `scavenger_submissions` tables never existed as tracked
-- migrations (they were created ad-hoc in the SQL editor), which is why a fresh
-- project needs this file. Security mirrors production after RLS hardening:
-- deny-by-default, owner-scoped policies where the app allows direct access;
-- everything else is reached via the service-role key (which bypasses RLS).
--
-- Idempotent: safe to run more than once.

-- ── games ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS games (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_key              TEXT NOT NULL,
  name                  TEXT NOT NULL,
  missions              TEXT[] NOT NULL DEFAULT '{}',
  duration_minutes      INTEGER NOT NULL DEFAULT 60,
  status                TEXT NOT NULL DEFAULT 'draft',
  started_at            TIMESTAMPTZ,
  mission_max_pts       JSONB DEFAULT '{}',
  hide_leaderboard      BOOLEAN DEFAULT false,
  remote_mode           BOOLEAN DEFAULT false,
  brand_logo_url        TEXT,
  brand_primary_color   TEXT,
  brand_name            TEXT,
  user_id               UUID REFERENCES auth.users(id),
  powerups_used         TEXT[] DEFAULT '{}',
  hot_potato            JSONB DEFAULT NULL,
  mystery_box           JSONB DEFAULT NULL,
  language              TEXT NOT NULL DEFAULT 'en',
  ai_photo_rating       BOOLEAN NOT NULL DEFAULT false,
  ai_photo_instructions TEXT,
  deleted_at            TIMESTAMPTZ,
  teams_count           INTEGER NOT NULL DEFAULT 0,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_games_game_key ON games(game_key);
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "games_owner_select" ON games;
DROP POLICY IF EXISTS "games_owner_insert" ON games;
DROP POLICY IF EXISTS "games_owner_update" ON games;
DROP POLICY IF EXISTS "games_owner_delete" ON games;
CREATE POLICY "games_owner_select" ON games FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "games_owner_insert" ON games FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "games_owner_update" ON games FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "games_owner_delete" ON games FOR DELETE USING (user_id = auth.uid());

-- ── teams ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS teams (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                 TEXT NOT NULL,
  score                INTEGER NOT NULL DEFAULT 0,
  completed            TEXT[] NOT NULL DEFAULT '{}',
  game_id              UUID REFERENCES games(id) ON DELETE CASCADE,
  finished_at          TIMESTAMPTZ,
  mission_scores       JSONB DEFAULT '{}',
  pending_notification JSONB,
  double_points        BOOLEAN DEFAULT false,
  active_effects       JSONB DEFAULT '{}',
  team_powerups_used   TEXT[] DEFAULT '{}',
  mission_answers      JSONB DEFAULT '{}',
  powerups_received    INTEGER DEFAULT 0,
  extra_powerups       TEXT[] NOT NULL DEFAULT '{}',
  join_code            TEXT,
  synced_mission_id    TEXT,
  relay_state          JSONB,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_teams_game_id ON teams(game_id);
ALTER TABLE teams ENABLE ROW LEVEL SECURITY; -- deny-by-default; API uses service role

-- ── team_members (remote mode) ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS team_members (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id      UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_team_members_team_id ON team_members(team_id);
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

-- ── photo_submissions ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS photo_submissions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id        UUID NOT NULL,
  team_name      TEXT NOT NULL,
  mission_id     TEXT NOT NULL,
  photo_url      TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'pending',
  points_awarded INTEGER,
  ai_rated       BOOLEAN NOT NULL DEFAULT false,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_photo_submissions_team_id ON photo_submissions(team_id);
ALTER TABLE photo_submissions ENABLE ROW LEVEL SECURITY;

-- ── scavenger_submissions ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS scavenger_submissions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id        UUID NOT NULL,
  team_name      TEXT,
  game_id        UUID,
  mission_id     TEXT NOT NULL,
  item_id        TEXT,
  item_label     TEXT,
  photo_url      TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'pending',
  points_awarded INTEGER,
  ai_rated       BOOLEAN NOT NULL DEFAULT false,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_scavenger_submissions_team_id ON scavenger_submissions(team_id);
ALTER TABLE scavenger_submissions ENABLE ROW LEVEL SECURITY;

-- ── settings (legacy single-row) ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS settings (
  id               INTEGER PRIMARY KEY DEFAULT 1,
  visible_missions TEXT[] NOT NULL DEFAULT '{}',
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT single_row CHECK (id = 1)
);
INSERT INTO settings (id, visible_missions) VALUES (1, '{}') ON CONFLICT (id) DO NOTHING;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- ── event_leads ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS event_leads (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email      TEXT NOT NULL,
  guest_id   TEXT,
  score      INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE event_leads ENABLE ROW LEVEL SECURITY;

-- ── custom_missions + categories ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS custom_mission_categories (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  emoji      TEXT NOT NULL DEFAULT '📋',
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS custom_missions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_name TEXT NOT NULL DEFAULT 'My Missions',
  category_id   UUID REFERENCES custom_mission_categories(id) ON DELETE SET NULL,
  name          TEXT NOT NULL,
  icon          TEXT NOT NULL DEFAULT '⭐',
  "desc"        TEXT NOT NULL DEFAULT '',
  difficulty    TEXT NOT NULL DEFAULT 'medium',
  max_pts       INT NOT NULL DEFAULT 500,
  type          TEXT NOT NULL,
  data          JSONB NOT NULL DEFAULT '{}',
  sort_order    INT NOT NULL DEFAULT 0,
  active_from   TIMESTAMPTZ,
  active_until  TIMESTAMPTZ,
  seasonal      BOOLEAN DEFAULT false,
  game_id       UUID,
  deleted_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_custom_missions_user_id ON custom_missions(user_id);
ALTER TABLE custom_mission_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_missions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "custom_missions_owner" ON custom_missions;
CREATE POLICY "custom_missions_owner" ON custom_missions
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "custom_mission_categories_owner" ON custom_mission_categories;
CREATE POLICY "custom_mission_categories_owner" ON custom_mission_categories
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ── subscriptions ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS subscriptions (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  stripe_customer_id     TEXT,
  stripe_subscription_id TEXT,
  plan                   TEXT NOT NULL DEFAULT 'free',
  status                 TEXT NOT NULL DEFAULT 'active',
  current_period_end     TIMESTAMPTZ,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "subscriptions_owner_select" ON subscriptions;
CREATE POLICY "subscriptions_owner_select" ON subscriptions
  FOR SELECT USING (auth.uid() = user_id);

-- ── stripe_events (webhook idempotency) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS stripe_events (
  id           TEXT PRIMARY KEY,
  type         TEXT NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE stripe_events ENABLE ROW LEVEL SECURITY;

-- ── Role grants ─────────────────────────────────────────────────────────────
-- Tables created via the SQL editor don't always inherit Supabase's default
-- privileges, so the API roles get "permission denied" even though the
-- service_role bypasses RLS. Grant them explicitly. (RLS still governs what the
-- anon/authenticated roles can actually see; service_role bypasses RLS.)
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
