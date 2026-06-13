import { useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';

/**
 * Syncs round/question index across all players in a remote game.
 *
 * When any player advances to a new round, they broadcast the new index on
 * `round-sync-{teamId}-{missionId}`. All other players' components receive
 * the event and jump to that index (Supabase does NOT echo back to the sender).
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

  useEffect(() => {
    if (!enabled) return;
    const channel = supabase
      .channel(`round-sync-${teamId}-${missionId}`)
      .on('broadcast', { event: 'round' }, ({ payload }) => {
        callbackRef.current(payload.idx as number);
      })
      .subscribe();
    channelRef.current = channel;
    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [enabled, teamId, missionId]);

  const broadcastRound = useCallback((idx: number) => {
    if (!enabled || !channelRef.current) return;
    channelRef.current.send({ type: 'broadcast', event: 'round', payload: { idx } });
  }, [enabled]);

  return { broadcastRound };
}
