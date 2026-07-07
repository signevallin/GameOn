// lib/realtime-server.ts
//
// Server-side "something changed" pings. After a mutation that affects what
// players/admin/presenter screens show, routes call notifyGameUpdated — a
// lightweight broadcast on the game's Realtime channel. Clients listening via
// hooks/useGameUpdates re-fetch through the normal (auth-checked) APIs, so no
// data travels over the channel itself; it only carries timing.
//
// This replaces tight 3-5s polling with event-driven refreshes; the clients
// keep a slow poll as fallback for missed broadcasts.

import type { SupabaseClient } from '@supabase/supabase-js';

export function gameChannelTopic(gameId: string): string {
  return `game-updates-${gameId}`;
}

type Target = { gameId: string; teamId?: never } | { teamId: string; gameId?: never };

/**
 * Broadcasts an update ping for a game. Accepts either the game id directly or
 * a team id (resolved to its game). Never throws — a lost ping only means the
 * client falls back to its slow poll.
 */
export async function notifyGameUpdated(
  db: SupabaseClient,
  target: Target,
  source: string,
  fetchImpl: typeof fetch = fetch
): Promise<void> {
  try {
    let gameId = 'gameId' in target ? target.gameId : undefined;
    if (!gameId && 'teamId' in target && target.teamId) {
      const { data } = await db.from('teams').select('game_id').eq('id', target.teamId).single();
      gameId = (data?.game_id as string | undefined) ?? undefined;
    }
    if (!gameId) return;

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return;

    await fetchImpl(`${url}/realtime/v1/api/broadcast`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        messages: [
          {
            topic: gameChannelTopic(gameId),
            event: 'update',
            payload: { source, at: Date.now() },
          },
        ],
      }),
      signal: AbortSignal.timeout(2000),
    });
  } catch {
    // Best-effort by design: the slow client poll covers missed pings.
  }
}
