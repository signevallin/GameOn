-- 20260704_rls_hardening.sql
-- Defence-in-depth: remove the permissive policies that let the public anon key
-- read/write data directly via PostgREST, so tables are DENY-BY-DEFAULT for the
-- anon/authenticated roles. All game data is reached through the server API
-- routes, which use the service-role key (service role bypasses RLS).
--
-- Policy names below were reconciled against the live database, so the DROPs
-- actually match. Idempotent: safe to run more than once.

-- ── Remove public (anon) access to game data ───────────────────────────────

-- Any anon client could read every customer's teams/scores.
ALTER TABLE IF EXISTS teams ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read" ON teams;

-- Any anon client could read every customer's photo submissions (URLs, names).
ALTER TABLE IF EXISTS photo_submissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read submissions" ON photo_submissions;

-- Named "Service role full access" but was granted to PUBLIC with USING(true)
-- AND WITH CHECK(true) — anon could read *and write* all scavenger submissions.
ALTER TABLE IF EXISTS scavenger_submissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access" ON scavenger_submissions;

-- event_leads had RLS disabled entirely — anon could read/write all leads (PII).
ALTER TABLE IF EXISTS event_leads ENABLE ROW LEVEL SECURITY;

-- Tables that should stay deny-by-default (service role only). RLS is already on;
-- ensure it and clear any stale permissive policies.
ALTER TABLE IF EXISTS team_members        ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS settings            ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS mission_translations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read" ON team_members;
DROP POLICY IF EXISTS "Public read" ON settings;
DROP POLICY IF EXISTS "Public read" ON mission_translations;

-- ── games: drop public read (COUPLED TO FRONTEND DEPLOY) ────────────────────
-- "Public read games" (USING true) let any anon client read every customer's
-- games. Dropping it is only safe once the LoginScreen change that reads game
-- metadata through /api/game (service role) is deployed — before that, the old
-- client reads `games` directly with the anon key to detect remote mode.
-- Apply this together with deploying this branch.
ALTER TABLE IF EXISTS games ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read games" ON games;

-- ── Owner-scoped policies (defence-in-depth for any future direct-client use) ─
-- Idempotent recreate. game_templates is intentionally left untouched: its
-- existing policies allow any signed-in user to read shared/builtin templates,
-- which the templates feature relies on.

DROP POLICY IF EXISTS "games_owner_select" ON games;
DROP POLICY IF EXISTS "games_owner_insert" ON games;
DROP POLICY IF EXISTS "games_owner_update" ON games;
DROP POLICY IF EXISTS "games_owner_delete" ON games;
CREATE POLICY "games_owner_select" ON games FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "games_owner_insert" ON games FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "games_owner_update" ON games FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "games_owner_delete" ON games FOR DELETE USING (user_id = auth.uid());

ALTER TABLE IF EXISTS custom_missions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "custom_missions_owner" ON custom_missions;
CREATE POLICY "custom_missions_owner" ON custom_missions
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

ALTER TABLE IF EXISTS custom_mission_categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "custom_mission_categories_owner" ON custom_mission_categories;
CREATE POLICY "custom_mission_categories_owner" ON custom_mission_categories
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

ALTER TABLE IF EXISTS subscriptions ENABLE ROW LEVEL SECURITY;
-- (Existing "Users can read their own subscription" already covers SELECT-own.)
