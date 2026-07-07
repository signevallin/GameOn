import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { createTrailingDebounce } from '@/lib/debounce';

/**
 * Subscribes to the game's realtime "update" pings (sent by the server after
 * any mutation, see lib/realtime-server.ts) and invokes `onUpdate` — debounced,
 * so a burst of pings collapses into one re-fetch. Pass gameId=null to disable
 * (e.g. before login). The caller keeps its own slow poll as fallback.
 */
export function useGameUpdates(gameId: string | null | undefined, onUpdate: () => void): void {
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  useEffect(() => {
    if (!gameId) return;

    const debounced = createTrailingDebounce(() => onUpdateRef.current(), 700);

    const channel = supabase
      .channel(`game-updates-${gameId}`)
      .on('broadcast', { event: 'update' }, () => debounced.trigger())
      .subscribe();

    return () => {
      debounced.cancel();
      supabase.removeChannel(channel);
    };
  }, [gameId]);
}
