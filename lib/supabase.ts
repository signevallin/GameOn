import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/** How long without a heartbeat before a team member is considered offline. */
export const ONLINE_THRESHOLD_MS = 60_000;

export type Team = {
  id: string;
  name: string;
  score: number;
  completed: string[];
  game_id: string;
  created_at: string;
  finished_at: string | null;
  mission_scores: Record<string, number>;
  pending_notification: { type: string; message?: string; msgKey?: string; params?: Record<string, unknown> } | null;
  double_points: boolean;
  active_effects: {
    freeze_until?: string;
    shield_until?: string;
    double_trouble_remaining?: number;
    double_trouble_missions?: string[];
  };
  team_powerups_used: string[];
  mission_answers: Record<string, string>;
  powerups_received: number;
  extra_powerups: string[];
  join_code?: string | null;
  members?: Array<{ id: string; name: string; online: boolean }>;
  synced_mission_id?: string | null;
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
  hide_leaderboard?: boolean;
  ai_photo_rating?: boolean;
  ai_photo_instructions?: string | null;
  user_id?: string;
  powerups_used?: string[];
  hot_potato?: {
    mission_id: string;
    expires_at: string;
    penalty_pts: number;
    game_id: string;
  } | null;
  mystery_box?: {
    created_at: string;
    expires_at: string;
    claimed_by: string | null;
  } | null;
  remote_mode?: boolean;
  teams_count?: number;
};

export type CustomMission = {
  id: string;
  user_id: string;
  category_name: string;
  category_id: string | null;
  name: string;
  icon: string;
  desc: string;
  difficulty: 'easy' | 'medium' | 'hard';
  max_pts: number;
  type: string;
  data: Record<string, unknown>;
  sort_order: number;
  created_at: string;
  active_from?: string | null;
  active_until?: string | null;
};

export type TeamMember = {
  id: string;
  team_id: string;
  name: string;
  last_seen_at: string;
  created_at: string;
};
