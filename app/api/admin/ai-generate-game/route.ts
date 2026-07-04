import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { validateAdminToken, unauthorizedResponse } from '@/lib/auth-server';
import { getEffectivePlan } from '@/lib/subscription';

export const dynamic = 'force-dynamic';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function generateKey(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let key = '';
  for (let i = 0; i < 6; i++) key += chars[Math.floor(Math.random() * chars.length)];
  return key;
}

type AiMission = Record<string, unknown>;

function aiMissionToData(m: AiMission): Record<string, unknown> {
  switch (m.type) {
    case 'trivia_quiz':   return { rounds: m.triviaRounds ?? [] };
    case 'truefalse':     return { statements: m.statements ?? [] };
    case 'closest_wins':  return { questions: m.closestQuestions ?? [] };
    case 'pa_sparet':     return { clues: m.clues ?? [], answer: m.paAnswer ?? '' };
    case 'timeline':      return { items: m.timelineItems ?? [] };
    case 'photo':         return { prompt: m.photoPrompt ?? '' };
    case 'relay':         return { segments: m.segments ?? [], relayMode: m.relayMode ?? 'typerace' };
    case 'shared_secret': return { clues: m.clues ?? [], answer: m.answer ?? '', ...(m.hint ? { hint: m.hint } : {}) };
    case 'music_quiz':
    case 'easy_music_quiz': return { rounds: m.musicRounds ?? [] };
    default:              return {};
  }
}

export async function POST(req: Request) {
  const admin = await validateAdminToken(req).catch(() => null);
  if (!admin) return unauthorizedResponse();

  if (await getEffectivePlan(admin.userId) === 'free') {
    return NextResponse.json({ error: 'pro_required' }, { status: 403 });
  }

  const body = await req.json();
  const { language, gameConfig, missions } = body as {
    language: string;
    gameConfig: {
      name?: string;
      duration_minutes?: number;
      hide_leaderboard?: boolean;
      ai_photo_rating?: boolean;
      ai_photo_instructions?: string | null;
      remote_mode?: boolean;
    };
    missions: AiMission[];
  };

  if (!Array.isArray(missions) || missions.length === 0) {
    return NextResponse.json({ error: 'No missions provided.' }, { status: 400 });
  }

  const supabase = getSupabase();

  // Fetch branding
  const { data: branding } = await supabase
    .from('admin_branding')
    .select('brand_logo_url, brand_primary_color, brand_name, apply_to_all_games')
    .eq('user_id', admin.userId)
    .maybeSingle();

  const applyBranding = branding?.apply_to_all_games === true;

  // Generate unique game key
  let key = '';
  for (let i = 0; i < 10; i++) {
    key = generateKey();
    const { data: existing } = await supabase.from('games').select('id').eq('game_key', key).single();
    if (!existing) break;
  }

  // Create game with placeholder missions — we'll update after inserting missions
  const { data: newGame, error: gameErr } = await supabase
    .from('games')
    .insert({
      game_key: key,
      name: (gameConfig.name?.trim() || null),
      missions: [],
      duration_minutes: gameConfig.duration_minutes ?? 45,
      mission_max_pts: {},
      hide_leaderboard: gameConfig.hide_leaderboard ?? false,
      ai_photo_rating: gameConfig.ai_photo_rating ?? false,
      ai_photo_instructions: gameConfig.ai_photo_instructions ?? null,
      language: language ?? 'en',
      status: 'draft',
      user_id: admin.userId,
      powerups_used: [],
      remote_mode: gameConfig.remote_mode ?? false,
      brand_logo_url: applyBranding ? (branding?.brand_logo_url ?? null) : null,
      brand_primary_color: applyBranding ? (branding?.brand_primary_color ?? null) : null,
      brand_name: applyBranding ? (branding?.brand_name ?? null) : null,
    })
    .select()
    .single();

  if (gameErr || !newGame) {
    return NextResponse.json({ error: gameErr?.message ?? 'Failed to create game.' }, { status: 500 });
  }

  // Enforce 3-6 category limit: if AI returned too many, merge excess into existing ones
  const rawCategories = missions.map(m =>
    (typeof m.category === 'string' && m.category.trim()) ? m.category.trim() : '🤖 AI Generated'
  );
  const uniqueCats = [...new Set(rawCategories)];
  let categoryMap: Record<string, string> = {};
  if (uniqueCats.length <= 6) {
    uniqueCats.forEach(c => { categoryMap[c] = c; });
  } else {
    // Keep first 6, remap the rest round-robin into those 6
    const kept = uniqueCats.slice(0, 6);
    kept.forEach(c => { categoryMap[c] = c; });
    uniqueCats.slice(6).forEach((c, i) => { categoryMap[c] = kept[i % 6]; });
  }

  // Bulk-insert missions scoped to this game
  const rows = missions.map((m, i) => ({
    user_id: admin.userId,
    game_id: newGame.id,
    category_name: categoryMap[rawCategories[i]] ?? '🤖 AI Generated',
    category_id: null,
    name: typeof m.name === 'string' ? m.name : `Mission ${i + 1}`,
    icon: typeof m.icon === 'string' ? m.icon : '⭐',
    desc: typeof m.desc === 'string' ? m.desc : '',
    difficulty: ['easy', 'medium', 'hard'].includes(m.difficulty as string) ? m.difficulty : 'medium',
    max_pts: typeof m.maxPts === 'number' ? m.maxPts : 500,
    type: m.type,
    data: aiMissionToData(m),
    sort_order: i,
    deleted_at: null,
  }));

  const { data: insertedMissions, error: missionsErr } = await supabase
    .from('custom_missions')
    .insert(rows)
    .select('id');

  if (missionsErr || !insertedMissions) {
    // Clean up the game we just created
    await supabase.from('games').delete().eq('id', newGame.id);
    return NextResponse.json({ error: missionsErr?.message ?? 'Failed to save missions.' }, { status: 500 });
  }

  const missionIds = insertedMissions.map(m => m.id);

  // Update the game with the actual mission IDs
  const { data: updatedGame, error: updateErr } = await supabase
    .from('games')
    .update({ missions: missionIds })
    .eq('id', newGame.id)
    .select()
    .single();

  if (updateErr || !updatedGame) {
    return NextResponse.json({ error: updateErr?.message ?? 'Failed to update game.' }, { status: 500 });
  }

  return NextResponse.json({ game: { ...updatedGame, teams_count: 0 } });
}
