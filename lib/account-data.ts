// lib/account-data.ts
//
// Collect and delete all data belonging to one account (admin user), for GDPR
// data-portability (export) and erasure (delete) requests. Everything is scoped
// to the owner's user_id / their games' teams — never another tenant's data.

import type { SupabaseClient } from '@supabase/supabase-js';

/** The games owned by a user and the teams that belong to those games. */
export async function collectGameAndTeamIds(db: SupabaseClient, userId: string) {
  const { data: games } = await db.from('games').select('id').eq('user_id', userId);
  const gameIds = (games ?? []).map((g) => g.id as string);

  let teamIds: string[] = [];
  if (gameIds.length > 0) {
    const { data: teams } = await db.from('teams').select('id').in('game_id', gameIds);
    teamIds = (teams ?? []).map((t) => t.id as string);
  }
  return { gameIds, teamIds };
}

/** A JSON bundle of everything we hold for this account. */
export async function exportAccountData(db: SupabaseClient, userId: string, email: string | null) {
  const [games, customMissions, categories, branding, templates, subscription] = await Promise.all([
    db.from('games').select('*').eq('user_id', userId),
    db.from('custom_missions').select('*').eq('user_id', userId),
    db.from('custom_mission_categories').select('*').eq('user_id', userId),
    db.from('admin_branding').select('*').eq('user_id', userId),
    db.from('game_templates').select('*').eq('user_id', userId),
    db.from('subscriptions')
      .select('plan, status, current_period_end, created_at')
      .eq('user_id', userId)
      .maybeSingle(),
  ]);

  const { teamIds } = await collectGameAndTeamIds(db, userId);
  let teams: unknown[] = [];
  let members: unknown[] = [];
  let photos: unknown[] = [];
  let scavenger: unknown[] = [];
  if (teamIds.length > 0) {
    [teams, members, photos, scavenger] = await Promise.all([
      db.from('teams').select('*').in('id', teamIds).then((r) => r.data ?? []),
      db.from('team_members').select('*').in('team_id', teamIds).then((r) => r.data ?? []),
      db.from('photo_submissions').select('*').in('team_id', teamIds).then((r) => r.data ?? []),
      db.from('scavenger_submissions').select('*').in('team_id', teamIds).then((r) => r.data ?? []),
    ]);
  }

  return {
    exported_at: new Date().toISOString(),
    account: { user_id: userId, email },
    subscription: subscription.data ?? null,
    games: games.data ?? [],
    teams,
    team_members: members,
    photo_submissions: photos,
    scavenger_submissions: scavenger,
    custom_missions: customMissions.data ?? [],
    custom_mission_categories: categories.data ?? [],
    branding: branding.data ?? [],
    game_templates: templates.data ?? [],
  };
}

/**
 * Permanently deletes all data owned by the user, in foreign-key-safe order.
 * Does not delete the auth user itself — the caller does that last so a failure
 * here never orphans the login.
 */
export async function deleteAccountData(db: SupabaseClient, userId: string) {
  const { gameIds, teamIds } = await collectGameAndTeamIds(db, userId);

  if (teamIds.length > 0) {
    await db.from('photo_submissions').delete().in('team_id', teamIds);
    await db.from('scavenger_submissions').delete().in('team_id', teamIds);
    await db.from('team_members').delete().in('team_id', teamIds);
  }
  if (gameIds.length > 0) {
    await db.from('teams').delete().in('game_id', gameIds);
  }
  await db.from('games').delete().eq('user_id', userId);
  await db.from('custom_missions').delete().eq('user_id', userId);
  await db.from('custom_mission_categories').delete().eq('user_id', userId);
  await db.from('admin_branding').delete().eq('user_id', userId);
  await db.from('game_templates').delete().eq('user_id', userId);
  await db.from('subscriptions').delete().eq('user_id', userId);
}
