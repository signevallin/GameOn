import { useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';

/**
 * Syncs round/question index across all players in a remote game.
 *
 * Two-layer sync:
 * 1. Supabase Broadcast for real-time low-latency delivery
 * 2. DB persistence via /api/team/round as a fallback for late-joiners or
 *    dropped broadcasts (Player B fetches the current index on mount)
 *
 * highWaterRef tracks the highest index ever received so neither the
 * broadcast handler nor the poll can move a player *backward* (e.g. if a
 * player answers a question locally before the 3-second poll fires with an
 * older stored index).
 *
 * Pass `teamId` and `missionId` only in remote mode; leave undefined for local.
 */
export function useRemoteRoundSync({
  teamId,
  missionId,
  onRemoteAdvance,
}: {
  teamId: string | undefined;
  missionId: string | undefined;
  onRemoteAdvance: (roundIdx: number) => void;
}) {
  const enabled = !!teamId && !!missionId;
  const callbackRef = useRef(onRemoteAdvance);
  callbackRef.current = onRemoteAdvance;

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Highest round index seen from any source (broadcast or poll).
  // Prevents stale poll responses from resetting a player to a previous question.
  const highWaterRef = useRef(0);

  // Broadcast channel for real-time sync
  useEffect(() => {
    if (!enabled) return;
    highWaterRef.current = 0;
    const channel = supabase
      .channel(`round-sync-${teamId}-${missionId}`)
      .on('broadcast', { event: 'round' }, ({ payload }) => {
        const idx = payload.idx as number;
        if (idx > highWaterRef.current) {
          highWaterRef.current = idx;
          callbackRef.current(idx);
        }
      })
      .subscribe();
    channelRef.current = channel;
    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [enabled, teamId, missionId]);

  // Poll DB every 3 s so players who miss a broadcast catch up quickly.
  // Also fires immediately on mount for late-joiners.
  useEffect(() => {
    if (!enabled) return;
    highWaterRef.current = 0;
    function fetchRound() {
      fetch(`/api/team/round?teamId=${encodeURIComponent(teamId!)}&missionId=${encodeURIComponent(missionId!)}`, {
        cache: 'no-store',
      })
        .then(r => r.json())
        .then((data: { qIdx?: number }) => {
          const idx = typeof data.qIdx === 'number' ? data.qIdx : 0;
          if (idx > highWaterRef.current) {
            highWaterRef.current = idx;
            callbackRef.current(idx);
          }
        })
        .catch(() => {});
    }
    fetchRound();
    const id = setInterval(fetchRound, 3000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, teamId, missionId]);

  const broadcastRound = useCallback((idx: number) => {
    // Persist to DB (fallback for anyone who missed the broadcast)
    if (enabled && teamId && missionId) {
      fetch('/api/team/round', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId, missionId, qIdx: idx }),
      }).catch(() => {});
    }
    // Broadcast for real-time delivery
    if (!channelRef.current) return;
    channelRef.current.send({ type: 'broadcast', event: 'round', payload: { idx } });
  }, [enabled, teamId, missionId]);

  // Clear DB state when the mission completes so replays always start fresh
  const clearRound = useCallback(() => {
    if (!enabled || !teamId || !missionId) return;
    highWaterRef.current = 0;
    fetch(`/api/team/round?teamId=${encodeURIComponent(teamId)}&missionId=${encodeURIComponent(missionId)}`, {
      method: 'DELETE',
    }).catch(() => {});
  }, [enabled, teamId, missionId]);

  return { broadcastRound, clearRound };
}
