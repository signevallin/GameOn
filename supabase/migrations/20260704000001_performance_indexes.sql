-- 20260704000001_performance_indexes.sql
-- Indexes on the hot-path columns hit by the 3-5s client/admin/presenter polls.
-- Without these, every poll does a sequential scan that grows with total rows
-- across all customers' games. Idempotent.

-- teams are filtered by game on every admin/presenter poll and power-up action
CREATE INDEX IF NOT EXISTS idx_teams_game_id ON teams(game_id);

-- team_members are looked up per team on every members/heartbeat poll
CREATE INDEX IF NOT EXISTS idx_team_members_team_id ON team_members(team_id);

-- submissions are filtered by team (and status) on every review/present poll
CREATE INDEX IF NOT EXISTS idx_photo_submissions_team_id
  ON photo_submissions(team_id);
CREATE INDEX IF NOT EXISTS idx_scavenger_submissions_team_id
  ON scavenger_submissions(team_id);

-- game_key is the primary lookup when a player joins or a presenter/poll reads.
-- (Plain index, not unique: avoids failing the migration if legacy duplicate
--  keys exist. Add a UNIQUE constraint separately once duplicates are cleared.)
CREATE INDEX IF NOT EXISTS idx_games_game_key ON games(game_key);
