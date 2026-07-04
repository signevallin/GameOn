-- 20260704_rls_hardening.sql
-- Defence-in-depth: enable Row Level Security on every table and remove the
-- permissive `USING (true)` policies that let the public anon key read/write
-- data directly via PostgREST (bypassing the API's auth checks).
--
-- After this migration, tables are DENY-BY-DEFAULT for the anon/authenticated
-- roles. All game data is reached exclusively through the server API routes,
-- which use the service-role key (service role bypasses RLS). The only
-- exceptions are `games`/`custom_missions`, which additionally allow the
-- signed-in *owner* to operate on their own rows.
--
-- Idempotent: safe to run more than once.

-- ── teams ──────────────────────────────────────────────────────────────────
ALTER TABLE IF EXISTS teams ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read"   ON teams;
DROP POLICY IF EXISTS "Public insert" ON teams;
DROP POLICY IF EXISTS "Public update" ON teams;

-- ── team_members ───────────────────────────────────────────────────────────
ALTER TABLE IF EXISTS team_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read"   ON team_members;
DROP POLICY IF EXISTS "Public insert" ON team_members;
DROP POLICY IF EXISTS "Public update" ON team_members;

-- ── photo_submissions ──────────────────────────────────────────────────────
ALTER TABLE IF EXISTS photo_submissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read submissions"   ON photo_submissions;
DROP POLICY IF EXISTS "Public insert submissions" ON photo_submissions;
DROP POLICY IF EXISTS "Public update submissions" ON photo_submissions;

-- ── scavenger_submissions ──────────────────────────────────────────────────
ALTER TABLE IF EXISTS scavenger_submissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read"   ON scavenger_submissions;
DROP POLICY IF EXISTS "Public insert" ON scavenger_submissions;
DROP POLICY IF EXISTS "Public update" ON scavenger_submissions;

-- ── settings (legacy global row) ───────────────────────────────────────────
ALTER TABLE IF EXISTS settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read"   ON settings;
DROP POLICY IF EXISTS "Public insert" ON settings;
DROP POLICY IF EXISTS "Public update" ON settings;

-- ── games: owner-scoped access (players go through the API) ─────────────────
ALTER TABLE IF EXISTS games ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "games_owner_select" ON games;
DROP POLICY IF EXISTS "games_owner_insert" ON games;
DROP POLICY IF EXISTS "games_owner_update" ON games;
DROP POLICY IF EXISTS "games_owner_delete" ON games;
CREATE POLICY "games_owner_select" ON games FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "games_owner_insert" ON games FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "games_owner_update" ON games FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "games_owner_delete" ON games FOR DELETE USING (user_id = auth.uid());

-- ── custom_missions / categories: owner-scoped ─────────────────────────────
ALTER TABLE IF EXISTS custom_missions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "custom_missions_owner" ON custom_missions;
CREATE POLICY "custom_missions_owner" ON custom_missions
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

ALTER TABLE IF EXISTS custom_mission_categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "custom_mission_categories_owner" ON custom_mission_categories;
CREATE POLICY "custom_mission_categories_owner" ON custom_mission_categories
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ── admin_branding / game_templates: owner-scoped ──────────────────────────
ALTER TABLE IF EXISTS admin_branding ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_branding_owner" ON admin_branding;
CREATE POLICY "admin_branding_owner" ON admin_branding
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

ALTER TABLE IF EXISTS game_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "game_templates_owner" ON game_templates;
DROP POLICY IF EXISTS "Public read templates" ON game_templates;
CREATE POLICY "game_templates_owner" ON game_templates
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ── subscriptions: read-own only (writes happen via service role) ──────────
ALTER TABLE IF EXISTS subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "subscriptions_owner_select" ON subscriptions;
CREATE POLICY "subscriptions_owner_select" ON subscriptions
  FOR SELECT USING (user_id = auth.uid());

-- ── mission_translations / event_leads: no anon access (service role only) ──
ALTER TABLE IF EXISTS mission_translations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read" ON mission_translations;

ALTER TABLE IF EXISTS event_leads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public insert" ON event_leads;
