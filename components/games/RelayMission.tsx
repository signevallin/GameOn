// components/games/RelayMission.tsx
'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabase';
import { Mission } from '@/lib/missions';

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
  const { t } = useTranslation();
  const [members, setMembers] = useState<Member[]>([]);
  const [relayState, setRelayState] = useState<RelayMissionState | null>(null);
  const [typed, setTyped] = useState('');
  const [started, setStarted] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const segmentStartRef = useRef<number>(0);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const handleAutoSkipRef = useRef<() => void>(() => {});

  const segments = mission.segments ?? [];

  // ── Member position ───────────────────────────────────────────────────────
  const memberIndex = members.findIndex(m => m.id === memberId);
  const effectiveIndex = memberIndex < 0 ? 0 : memberIndex;
  const memberCount = members.length > 0 ? members.length : 1;

  // ── Relay state ───────────────────────────────────────────────────────────
  const active = relayState ? relayState.activeIndex : 0;
  const relayDone = active >= segments.length;

  // Round-robin: segment i is handled by member (i % memberCount).
  // This means with 2 members and 4 segments: member 0 → segs 0,2; member 1 → segs 1,3.
  const activeMemberIndex = relayDone ? -1 : active % memberCount;
  const isMyTurn = !relayDone && activeMemberIndex === effectiveIndex;

  // Current segment (only valid when isMyTurn)
  const myCurrentSegment = isMyTurn ? segments[active] : null;

  // Does this player have any more turns after the current active segment?
  const hasMoreTurns = segments.some((_, segIdx) => segIdx > active && segIdx % memberCount === effectiveIndex);
  const myPartsDone = !isMyTurn && !relayDone && !hasMoreTurns &&
    // Edge case: I'm waiting but my first turn hasn't come yet
    segments.filter((_, segIdx) => segIdx < active && segIdx % memberCount === effectiveIndex).length > 0;

  const isWaiting = !isMyTurn && !relayDone;

  // Fetch team members ordered by join time (via server route — bypasses RLS on team_members)
  useEffect(() => {
    fetch('/api/team/members', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teamId: team.id }),
      cache: 'no-store',
    })
      .then(r => r.json())
      .then(data => { if (data.members) setMembers(data.members as Member[]); });
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
        setShowAnswer(false);
        clearCountdown();
      })
      .subscribe();
    channelRef.current = channel;
    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [team.id, mission.id]);

  handleAutoSkipRef.current = () => advance(true);

  const clearCountdown = useCallback(() => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
    setCountdown(60);
  }, []);

  const startCountdown = useCallback(() => {
    clearCountdown();
    setCountdown(60);
    countdownRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countdownRef.current!);
          countdownRef.current = null;
          handleAutoSkipRef.current();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [clearCountdown]);

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
      setShowAnswer(false);
      setLoading(false);

      // Broadcast to all other members
      channelRef.current?.send({
        type: 'broadcast',
        event: 'relay-advance',
        payload: { missionId: mission.id, relayState: newRelayState },
      });

      if (data.complete) {
        const startMs = new Date(newRelayState.startedAt).getTime();
        const completedSegs = newRelayState.segments.filter(s => !s.skipped && s.completedAt);
        const lastMs = completedSegs.length > 0
          ? new Date(completedSegs[completedSegs.length - 1].completedAt!).getTime()
          : startMs + game.duration_minutes * 60 * 1000; // all skipped → 0 pts
        const totalElapsedSeconds = (lastMs - startMs) / 1000;
        const decayPerSecond = effectiveMaxPts / (game.duration_minutes * 60);
        const pts = Math.max(0, effectiveMaxPts - Math.floor(totalElapsedSeconds * decayPerSecond));
        onFinish(true, pts);
      }
    } catch {
      setLoading(false);
    }
  }, [loading, started, team.id, mission.id, segments.length, effectiveMaxPts, game.duration_minutes, onFinish]);

  function handleTyped(val: string) {
    setTyped(val);
    const currentSegment = segments[active];
    if (currentSegment && val === currentSegment.prompt) {
      advance(false);
    }
  }

  if (members.length === 0) {
    return <div style={{ textAlign: 'center', padding: '40px', color: 'var(--muted)' }}>{t('challenge.relay.loading')}</div>;
  }

  const completedCount = relayState?.segments.length ?? 0;
  const pct = segments.length > 0 ? Math.round((completedCount / segments.length) * 100) : 0;

  return (
    <div>
      {/* Progress bar */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--muted)', marginBottom: '6px' }}>
          <span>{t('challenge.relay.progress')}</span>
          <span>{completedCount}/{segments.length}</span>
        </div>
        <div style={{ height: '6px', background: 'var(--border)', borderRadius: '3px', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: 'var(--accent)', borderRadius: '3px', transition: 'width 0.4s ease' }} />
        </div>
      </div>

      {/* Queue view — shows members; active member highlighted by round-robin position */}
      <div style={{ marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {members.map((m, i) => {
          const isMemberActive = !relayDone && active % memberCount === i;
          // Has this member already completed at least one segment AND has no more turns?
          const memberSegmentsDone = segments.filter((_, si) => si < active && si % memberCount === i).length;
          const memberSegmentsFuture = segments.filter((_, si) => si >= active && si % memberCount === i).length;
          const memberPartsDone = !isMemberActive && memberSegmentsDone > 0 && memberSegmentsFuture === 0;
          const icon = relayDone
            ? '✅'
            : isMemberActive ? '▶️'
            : memberPartsDone ? '✅'
            : '⏳';
          const isWaitingMember = !relayDone && !isMemberActive && !memberPartsDone;
          return (
            <div key={m.id} style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              padding: '10px 14px',
              borderRadius: '8px',
              border: `1px solid ${isMemberActive ? 'var(--accent)' : 'var(--border)'}`,
              background: isMemberActive ? 'rgba(99,102,241,0.08)' : 'var(--card)',
              opacity: isWaitingMember ? 0.5 : 1,
            }}>
              <span style={{ fontSize: '18px' }}>{icon}</span>
              <span style={{ fontWeight: isMemberActive ? 700 : 400, color: memberPartsDone && !relayDone ? 'var(--muted)' : undefined }}>
                {m.name}{m.id === memberId ? ` ${t('challenge.relay.you')}` : ''}
              </span>
              {isMemberActive && started && (
                <span style={{ marginLeft: 'auto', fontSize: '12px', color: countdown <= 10 ? 'var(--accent2)' : 'var(--muted)' }}>
                  {countdown}s
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Active member interaction */}
      {isMyTurn && (
        <div>
          <div className="challenge-question" style={{ marginBottom: '16px' }}>
            {myCurrentSegment?.prompt}
          </div>

          {!started ? (
            <button className="btn btn-primary" style={{ width: '100%' }} onClick={handleStart} disabled={loading}>
              {loading ? t('challenge.relay.loadingBtn') : t('challenge.relay.start')}
            </button>
          ) : mission.relayMode === 'typerace' ? (
            <>
              <div style={{
                fontSize: '18px', lineHeight: '1.8', fontFamily: "'Sora', sans-serif",
                letterSpacing: '1px', marginBottom: '16px', background: '#0d1422',
                padding: '16px', borderRadius: '8px', border: '1px solid var(--border)',
              }}>
                {(myCurrentSegment?.prompt ?? '').split('').map((ch, idx) => {
                  let color = 'var(--muted)';
                  let bg = 'transparent';
                  let textDecoration = 'none';
                  if (idx < typed.length) {
                    color = typed[idx] === ch ? 'var(--accent3)' : 'var(--accent2)';
                    textDecoration = typed[idx] !== ch ? 'underline' : 'none';
                  } else if (idx === typed.length) {
                    bg = 'var(--accent)';
                    color = '#0a0e19';
                  }
                  return (
                    <span key={idx} style={{ color, background: bg, borderRadius: '2px', textDecoration }}>
                      {ch}
                    </span>
                  );
                })}
              </div>
              <input
                ref={inputRef}
                type="text"
                value={typed}
                placeholder={t('challenge.relay.typeHere')}
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                onChange={e => handleTyped(e.target.value)}
              />
              <p style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '8px' }}>
                {t('challenge.relay.pct', { pct: myCurrentSegment ? Math.round((typed.length / myCurrentSegment.prompt.length) * 100) : 0 })}
              </p>
            </>
          ) : myCurrentSegment?.answer ? (
            /* Trivia mode: reveal answer first, then mark correct or skip */
            <>
              {!showAnswer ? (
                <button
                  className="btn btn-primary"
                  style={{ width: '100%' }}
                  onClick={() => setShowAnswer(true)}
                >
                  {t('challenge.relay.revealAnswer')}
                </button>
              ) : (
                <>
                  <div style={{
                    marginBottom: '16px', padding: '16px 20px',
                    background: 'rgba(34,197,94,0.08)', border: '1px solid var(--accent3)',
                    borderRadius: '12px', textAlign: 'center',
                  }}>
                    <div style={{ fontSize: '11px', color: 'var(--accent3)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px' }}>
                      {t('challenge.relay.answerLabel')}
                    </div>
                    <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--fg)' }}>
                      {myCurrentSegment.answer}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                      className="btn"
                      style={{ flex: 1, borderColor: 'var(--accent2)', color: 'var(--accent2)' }}
                      onClick={() => advance(true)}
                      disabled={loading}
                    >
                      {t('challenge.relay.wrong')}
                    </button>
                    <button
                      className="btn btn-primary"
                      style={{ flex: 1 }}
                      onClick={() => advance(false)}
                      disabled={loading}
                    >
                      {loading ? t('challenge.relay.saving') : t('challenge.relay.correct')}
                    </button>
                  </div>
                </>
              )}
            </>
          ) : (
            <>
              <textarea
                value={typed}
                onChange={e => setTyped(e.target.value)}
                placeholder={t('challenge.relay.writePlaceholder')}
                rows={4}
                style={{
                  width: '100%', boxSizing: 'border-box',
                  background: 'var(--card)', border: '1px solid var(--border)',
                  borderRadius: '10px', padding: '12px 14px',
                  color: 'var(--text)', fontSize: '15px', lineHeight: 1.6,
                  fontFamily: "'Sora', sans-serif", resize: 'vertical',
                  marginBottom: '12px',
                }}
              />
              <button
                className="btn btn-primary"
                style={{ width: '100%' }}
                onClick={() => advance(false)}
                disabled={loading}
              >
                {loading ? t('challenge.relay.saving') : t('challenge.relay.doneBtn')}
              </button>
            </>
          )}
        </div>
      )}

      {/* Waiting — it's someone else's turn and I still have turns coming */}
      {isWaiting && !myPartsDone && (
        <div style={{ textAlign: 'center', padding: '24px', color: 'var(--muted)' }}>
          <div style={{ fontSize: '32px', marginBottom: '8px' }}>⏳</div>
          <p>{t('challenge.relay.waiting', { name: members[activeMemberIndex < 0 ? 0 : activeMemberIndex]?.name ?? '…' })}</p>
        </div>
      )}

      {/* My parts are done — waiting for relay to finish */}
      {myPartsDone && (
        <div style={{ textAlign: 'center', padding: '24px', color: 'var(--muted)' }}>
          <div style={{ fontSize: '32px', marginBottom: '8px' }}>✅</div>
          <p>{t('challenge.relay.myTurnsDone')}</p>
        </div>
      )}

      {/* Relay complete */}
      {relayDone && (
        <div style={{ textAlign: 'center', padding: '24px', color: 'var(--accent3)' }}>
          <div style={{ fontSize: '32px', marginBottom: '8px' }}>✅</div>
          <p>{t('challenge.relay.completed')}</p>
        </div>
      )}
    </div>
  );
}
