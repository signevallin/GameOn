// lib/photo-cleanup.ts
//
// Enforces the privacy-policy promise that player photos are deleted 30 days
// after a game ends. Finds games that ended more than `retentionDays` ago,
// removes their photo files from the `photos` storage bucket, and blanks the
// photo_url on the submission rows (scores/history are kept — only the images
// and their links are personal data we promised to purge).

import type { SupabaseClient } from '@supabase/supabase-js';

export const PHOTO_RETENTION_DAYS = 30;

/** Extracts the storage object path from a public URL for the photos bucket. */
export function storagePathFromPublicUrl(url: string): string | null {
  const marker = '/storage/v1/object/public/photos/';
  const i = url.indexOf(marker);
  if (i === -1) return null;
  const raw = url.slice(i + marker.length).split('?')[0];
  if (!raw) return null;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/** When a game is considered to have ended, for retention purposes. */
export function gameEndTime(game: {
  status: string;
  started_at: string | null;
  duration_minutes: number | null;
  created_at: string;
  deleted_at?: string | null;
}): Date | null {
  // Soft-deleted games count as ended at deletion time.
  if (game.deleted_at) return new Date(game.deleted_at);
  if (game.status !== 'finished') return null;
  if (game.started_at) {
    const ms = new Date(game.started_at).getTime() + (game.duration_minutes ?? 0) * 60_000;
    return new Date(ms);
  }
  return new Date(game.created_at);
}

export type CleanupResult = {
  gamesScanned: number;
  submissionsPurged: number;
  filesRemoved: number;
};

export async function cleanupExpiredPhotos(
  db: SupabaseClient,
  retentionDays: number = PHOTO_RETENTION_DAYS,
  now: Date = new Date()
): Promise<CleanupResult> {
  const cutoff = now.getTime() - retentionDays * 24 * 60 * 60 * 1000;

  // Finished or soft-deleted games are the only candidates.
  const { data: games } = await db
    .from('games')
    .select('id, status, started_at, duration_minutes, created_at, deleted_at')
    .or('status.eq.finished,deleted_at.not.is.null');

  const expiredGameIds = (games ?? [])
    .filter((g) => {
      const ended = gameEndTime(g);
      return ended !== null && ended.getTime() < cutoff;
    })
    .map((g) => g.id as string);

  const result: CleanupResult = {
    gamesScanned: games?.length ?? 0,
    submissionsPurged: 0,
    filesRemoved: 0,
  };
  if (expiredGameIds.length === 0) return result;

  const { data: teams } = await db.from('teams').select('id').in('game_id', expiredGameIds);
  const teamIds = (teams ?? []).map((t) => t.id as string);
  if (teamIds.length === 0) return result;

  for (const table of ['photo_submissions', 'scavenger_submissions'] as const) {
    const { data: rows } = await db
      .from(table)
      .select('id, photo_url')
      .in('team_id', teamIds)
      .neq('photo_url', '');

    const purgeable = (rows ?? []).filter((r) => r.photo_url);
    if (purgeable.length === 0) continue;

    // Delete the storage objects in batches.
    const paths = purgeable
      .map((r) => storagePathFromPublicUrl(r.photo_url as string))
      .filter((p): p is string => p !== null);
    for (let i = 0; i < paths.length; i += 100) {
      const batch = paths.slice(i, i + 100);
      const { error } = await db.storage.from('photos').remove(batch);
      if (!error) result.filesRemoved += batch.length;
    }

    // Blank the URLs so rows stop pointing at (now deleted) images and the
    // next run skips them.
    const ids = purgeable.map((r) => r.id as string);
    for (let i = 0; i < ids.length; i += 200) {
      await db.from(table).update({ photo_url: '' }).in('id', ids.slice(i, i + 200));
    }
    result.submissionsPurged += ids.length;
  }

  return result;
}
