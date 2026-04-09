-- Run this in your Supabase project SQL editor

CREATE TABLE IF NOT EXISTS settings (
  id               INTEGER PRIMARY KEY DEFAULT 1,
  visible_missions TEXT[]  NOT NULL DEFAULT '{}',
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT single_row CHECK (id = 1)
);

-- Insert default row with all missions visible
INSERT INTO settings (id, visible_missions) VALUES (1, ARRAY[
  'code_quiz','binary','bug_hunt','terminal','memory','emoji_rebus',
  'reaction','trivia_fun','typerace','wordguess','wouldyou',
  'sequence','puzzle','true_false'
]) ON CONFLICT (id) DO NOTHING;

ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read settings" ON settings
  FOR SELECT USING (true);

CREATE POLICY "Public update settings" ON settings
  FOR UPDATE USING (true);
