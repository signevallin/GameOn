import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Team = {
  id: string;
  name: string;
  score: number;
  completed: string[];
  game_id: string;
  created_at: string;
  finished_at: string | null;
  mission_scores: Record<string, number>;
  pending_notification: { type: string; message: string } | null;
  double_points: boolean;
  active_effects: {
    freeze_until?: string;
    shield_until?: string;
    double_trouble_remaining?: number;
  };
  team_powerups_used: string[];
};

export type Game = {
  id: string;
  game_key: string;
  name: string;
  missions: string[];
  duration_minutes: number;
  status: 'draft' | 'active' | 'finished';
  started_at: string | null;
  created_at: string;
  mission_max_pts: Record<string, number>;
};
