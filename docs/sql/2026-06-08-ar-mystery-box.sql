-- docs/sql/2026-06-08-ar-mystery-box.sql

-- 1. mystery_box column on games
ALTER TABLE games ADD COLUMN mystery_box jsonb DEFAULT NULL;

-- 2. extra_powerups column on teams (power-up charges earned from mystery boxes)
ALTER TABLE teams ADD COLUMN extra_powerups text[] NOT NULL DEFAULT '{}';
