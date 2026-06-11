// components/games/RelayMission.tsx
'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Mission } from '@/lib/missions';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type RelaySegmentResult = {
  completedAt?: string;
  elapsedMs?: number;
  skipped?: boolean;
};

type RelayMissionState = {
  activeIndex: number;
  startedAt: string;
  segments: RelaySegmentResult[];
};

type Member = { id: string; name: string };

type Props = {
  mission: Mission;
  team: { id: string };
  game: { duration_minutes: number };
  memberId: string;
  effectiveMaxPts: number;
  onFinish: (correct: boolean, pts: number) => void;
};

export default function RelayMission({ mission, team, game, memberId, effectiveMaxPts, onFinish }: Props) {
  const [members, setMembers] = useState<Member[]>([]);
  const [relayState, setRelayState] = useState<RelayMissionState | null>(null);
  const [typed, setTyped] = useState('');
  const [started, setStarted] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const segmentStartRef = useRef<number>(0);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const segments = mission.segments ?? [];
  const memberIndex = members.findIndex(m => m.id === memberId);
  const effectiveIndex = memberIndex < 0 ? 0 : memberIndex;
  const mySegmentIndex = Math.min(effectiveIndex, segments.length - 1);
  const mySegment = segments[mySegmentIndex];
  const active = relayState ? relayState.activeIndex : 0;
  const isMyTurn = active === mySegmentIndex;
  const isWaiting = active < mySegmentIndex;
  const isPast = active > mySegmentIndex;

  // Fetch team members ordered by join time
  useEffect(() => {
    supabase
      .from('team_members')
      .select('id, name')
      .eq('team_id', team.id)
      .order('created_at')
      .then(({ data }) => {
        if (data) setMembers(data as Member[]);
      });
  }, [team.id]);

  // Subscribe to relay-advance events on the shared channel
  useEffect(() => {
    const channel = supabase
      .channel(`remote-nav-${team.id}`)
      .on('broadcast', { event: 'relay-advance' }, ({ payload }: { payload: { missionId: string; relayState: RelayMissionState } }) => {
        if (payload.missionId !== mission.id) return;
        setRelayState(payload.relayState);
        setTyped('');
        setStarted(false);
        clearCountdown();
      })
      .subscribe();
    channelRef.current = channel;
    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [team.id, mission.id]);

  function clearCountdown() {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
    setCountdown(60);
  }

  function startCountdown() {
    clearCountdown();
    setCountdown(60);
    countdownRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countdownRef.current!);
          countdownRef.current = null;
          handleAutoSkip();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  function handleStart() {
    setStarted(true);
    segmentStartRef.current = Date.now();
    startCountdown();
    if (mission.relayMode === 'typerace') {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  const advance = useCallback(async (isSkip = false) => {
    if (loading) return;
    setLoading(true);
    clearCountdown();

    const elapsedMs = started ? Date.now() - segmentStartRef.current : 0;

    try {
      const res = await fetch('/api/team/relay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamId: team.id,
          missionId: mission.id,
          action: isSkip ? 'skip' : 'advance',
          elapsedMs,
          segmentCount: segments.length,
        }),
        cache: 'no-store',
      });
      const data = await res.json();
      if (!res.ok) { setLoading(false); return; }

      const newRelayState: RelayMissionState = data.relayState;
      setRelayState(newRelayState);
      setTyped('');
      setStarted(false);
      setLoading(false);

      // Broadcast to all other members
      channelRef.current?.send({
        type: 'broadcast',
        event: 'relay-advance',
        payload: { missionId: mission.id, relayState: newRelayState },
      });

      if (data.complete) {
        const startMs = new Date(newRelayState.startedAt).getTime();
        const completedSegs = newRelayState.segments.filter(s => s.completedAt);
        const lastMs = completedSegs.length > 0
          ? new Date(completedSegs[completedSegs.length - 1].completedAt!).getTime()
          : Date.now();
        const totalElapsedSeconds = (lastMs - startMs) / 1000;
        const decayPerSecond = effectiveMaxPts / (game.duration_minutes * 60);
        const pts = Math.max(0, effectiveMaxPts - Math.floor(totalElapsedSeconds * decayPerSecond));
        onFinish(true, pts);
      }
    } catch {
      setLoading(false);
    }
  }, [loading, started, team.id, mission.id, segments.length, effectiveMaxPts, game.duration_minutes, onFinish]);

  function handleAutoSkip() {
    advance(true);
  }

  function handleTyped(val: string) {
    setTyped(val);
    if (mySegment && val === mySegment.prompt) {
      advance(false);
    }
  }

  if (members.length === 0) {
    return <div style={{ textAlign: 'center', padding: '40px', color: 'var(--muted)' }}>Laddar stafetten…</div>;
  }

  const completedCount = relayState?.segments.length ?? 0;
  const pct = segments.length > 0 ? Math.round((completedCount / segments.length) * 100) : 0;

  return (
    <div>
      {/* Progress bar */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--muted)', marginBottom: '6px' }}>
          <span>Stafetten</span>
          <span>{completedCount}/{segments.length} klara</span>
        </div>
        <div style={{ height: '6px', background: 'var(--border)', borderRadius: '3px', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: 'var(--accent)', borderRadius: '3px', transition: 'width 0.4s ease' }} />
        </div>
      </div>

      {/* Queue view */}
      <div style={{ marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {members.map((m, i) => {
          const segIdx = Math.min(i, segments.length - 1);
          const isDone = relayState != null && i < active;
          const isActive = active === segIdx && i === active;
          const isNext = !isActive && !isDone;
          return (
            <div key={m.id} style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              padding: '10px 14px',
              borderRadius: '8px',
              border: `1px solid ${isActive ? 'var(--accent)' : 'var(--border)'}`,
              background: isActive ? 'rgba(99,102,241,0.08)' : 'var(--card)',
              opacity: isNext ? 0.5 : 1,
            }}>
              <span style={{ fontSize: '18px' }}>{isDone ? '✅' : isActive ? '▶️' : '⏳'}</span>
              <span style={{ fontWeight: isActive ? 700 : 400 }}>{m.name}{m.id === memberId ? ' (du)' : ''}</span>
              {isActive && started && (
                <span style={{ marginLeft: 'auto', fontSize: '12px', color: countdown <= 10 ? 'var(--accent2)' : 'var(--muted)' }}>
                  {countdown}s
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Active member interaction */}
      {isMyTurn && !isPast && (
        <div>
          <div className="challenge-question" style={{ marginBottom: '16px' }}>
            {mySegment?.prompt}
          </div>

          {!started ? (
            <button className="btn btn-primary" style={{ width: '100%' }} onClick={handleStart} disabled={loading}>
              {loading ? 'Laddar…' : 'Starta min del ▶'}
            </button>
          ) : mission.relayMode === 'typerace' ? (
            <>
              <div style={{
                fontSize: '18px', lineHeight: '1.8', fontFamily: "'Sora', sans-serif",
                letterSpacing: '1px', marginBottom: '16px', background: '#0d1422',
                padding: '16px', borderRadius: '8px', border: '1px solid var(--border)',
              }}>
                {(mySegment?.prompt ?? '').split('').map((ch, i) => {
                  let color = 'var(--muted)';
                  let bg = 'transparent';
                  let textDecoration = 'none';
                  if (i < typed.length) {
                    color = typed[i] === ch ? 'var(--accent3)' : 'var(--accent2)';
                    textDecoration = typed[i] !== ch ? 'underline' : 'none';
                  } else if (i === typed.length) {
                    bg = 'var(--accent)';
                    color = '#0a0e19';
                  }
                  return (
                    <span key={i} style={{ color, background: bg, borderRadius: '2px', textDecoration }}>
                      {ch}
                    </span>
                  );
                })}
              </div>
              <input
                ref={inputRef}
                type="text"
                value={typed}
                placeholder="Börja skriva här…"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                onChange={e => handleTyped(e.target.value)}
              />
              <p style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '8px' }}>
                {mySegment ? Math.round((typed.length / mySegment.prompt.length) * 100) : 0}% klar
              </p>
            </>
          ) : (
            <button
              className="btn btn-primary"
              style={{ width: '100%' }}
              onClick={() => advance(false)}
              disabled={loading}
            >
              {loading ? 'Sparar…' : 'Jag är klar ✓'}
            </button>
          )}
        </div>
      )}

      {isWaiting && (
        <div style={{ textAlign: 'center', padding: '24px', color: 'var(--muted)' }}>
          <div style={{ fontSize: '32px', marginBottom: '8px' }}>⏳</div>
          <p>Väntar på {members[active]?.name ?? '…'}…</p>
        </div>
      )}

      {isPast && (
        <div style={{ textAlign: 'center', padding: '24px', color: 'var(--accent3)' }}>
          <div style={{ fontSize: '32px', marginBottom: '8px' }}>✅</div>
          <p>Du har gjort din del! Väntar på de andra…</p>
        </div>
      )}
    </div>
  );
}
