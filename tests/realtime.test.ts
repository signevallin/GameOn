import { describe, it, expect, vi, afterEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createTrailingDebounce } from '@/lib/debounce';
import { notifyGameUpdated, gameChannelTopic } from '@/lib/realtime-server';

afterEach(() => {
  vi.useRealTimers();
});

describe('createTrailingDebounce', () => {
  it('collapses a burst of triggers into one call', () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const d = createTrailingDebounce(fn, 500);
    d.trigger();
    d.trigger();
    d.trigger();
    vi.advanceTimersByTime(499);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('fires again for a later trigger', () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const d = createTrailingDebounce(fn, 100);
    d.trigger();
    vi.advanceTimersByTime(100);
    d.trigger();
    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('cancel stops a pending call', () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const d = createTrailingDebounce(fn, 100);
    d.trigger();
    d.cancel();
    vi.advanceTimersByTime(200);
    expect(fn).not.toHaveBeenCalled();
  });
});

function fakeDb(gameIdForTeam: string | null): SupabaseClient {
  return {
    from() {
      const chain = {
        select() { return chain; },
        eq() { return chain; },
        async single() { return { data: gameIdForTeam ? { game_id: gameIdForTeam } : null }; },
      };
      return chain;
    },
  } as unknown as SupabaseClient;
}

describe('notifyGameUpdated', () => {
  it('broadcasts on the game channel with only a ping payload (no data)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}'));
    await notifyGameUpdated(fakeDb(null), { gameId: 'g1' }, 'score', fetchMock);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/realtime/v1/api/broadcast');
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.messages[0].topic).toBe(gameChannelTopic('g1'));
    expect(body.messages[0].event).toBe('update');
    // Only timing metadata — never game data — travels on the channel.
    expect(Object.keys(body.messages[0].payload).sort()).toEqual(['at', 'source']);
  });

  it('resolves the game id from a team id', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}'));
    await notifyGameUpdated(fakeDb('g42'), { teamId: 't1' }, 'answer', fetchMock);
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.messages[0].topic).toBe(gameChannelTopic('g42'));
  });

  it('does nothing when the team has no game', async () => {
    const fetchMock = vi.fn();
    await notifyGameUpdated(fakeDb(null), { teamId: 't1' }, 'answer', fetchMock);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('never throws even when the broadcast fails', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('network down'));
    await expect(
      notifyGameUpdated(fakeDb(null), { gameId: 'g1' }, 'score', fetchMock)
    ).resolves.toBeUndefined();
  });
});
