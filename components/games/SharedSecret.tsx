'use client';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabase';
import { Mission } from '@/lib/missions';
import { fuzzyMatch } from '@/lib/fuzzy-match';

const HINT_COST = 50;
const HINT_UNLOCK_AFTER = 2;

type Props = {
  mission: Mission;
  team: { id: string };
  game: { duration_minutes: number };
  memberId: string;
  effectiveMaxPts: number;
  startedAtMs: number;
  onFinish: (correct: boolean, pts: number) => void;
};

export default function SharedSecret({ mission, team, game, memberId, effectiveMaxPts, startedAtMs, onFinish }: Props) {
  const { t } = useTranslation();
  const [members, setMembers] = useState<{ id: string }[]>([]);
  const [guess, setGuess] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const [hintUsed, setHintUsed] = useState(false);
  const [lastResult, setLastResult] = useState<'correct' | 'wrong' | null>(null);
  const [done, setDone] = useState(false);
  const hintUsedRef = useRef(false);
  const doneRef = useRef(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const clues = mission.clues ?? [];
  const answer = mission.answer ?? '';
  const hint = mission.hint ?? null;

  const memberIndex = members.findIndex(m => m.id === memberId);
  const clueIndex = memberIndex < 0 ? 0 : memberIndex;
  const memberCount = members.length > 0 ? members.length : 1;

  // Round-robin distribution: player i owns clues at positions i, i+memberCount, i+2*memberCount, …
  // E.g. 2 players, 4 clues → player 0 gets clues 0 & 2, player 1 gets clues 1 & 3.
  // This ensures every clue is always visible regardless of team size.
  const myClues = clues.filter((_, i) => i % memberCount === clueIndex);

  // Fetch team members via server route — bypasses RLS on team_members
  useEffect(() => {
    fetch('/api/team/members', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teamId: team.id }),
      cache: 'no-store',
    })
      .then(r => r.json())
      .then(data => { if (data.members) setMembers(data.members as { id: string }[]); });
  }, [team.id]);

  useEffect(() => {
    const channel = supabase
      .channel(`remote-nav-${team.id}`)
      .on('broadcast', { event: 'secret-attempt' }, ({ payload }: {
        payload: { missionId: string; attempts: number; correct: boolean }
      }) => {
        if (doneRef.current) return;
        if (payload.missionId !== mission.id) return;
        setAttempts(payload.attempts);
        if (payload.correct) {
          setLastResult('correct');
          setDone(true);
          doneRef.current = true;
          const elapsedSeconds = (Date.now() - startedAtMs) / 1000;
          const decayPerSecond = effectiveMaxPts / (game.duration_minutes * 60);
          const hintPenalty = hintUsedRef.current ? HINT_COST : 0;
          const attemptPenalty = 100 * (payload.attempts - 1);
          const pts = Math.max(0, effectiveMaxPts - Math.floor(elapsedSeconds * decayPerSecond) - attemptPenalty - hintPenalty);
          onFinish(true, pts);
        } else {
          setLastResult('wrong');
        }
      })
      .subscribe();
    channelRef.current = channel;
    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [team.id, mission.id, startedAtMs, effectiveMaxPts, game.duration_minutes, onFinish]);

  function handleSubmit() {
    if (!guess.trim() || done) return;
    const correct = fuzzyMatch(guess.trim(), answer);
    const newAttempts = attempts + 1;

    setLastResult(correct ? 'correct' : 'wrong');
    setAttempts(newAttempts);
    setGuess('');

    channelRef.current?.send({
      type: 'broadcast',
      event: 'secret-attempt',
      payload: { missionId: mission.id, attempts: newAttempts, correct },
    });

    if (correct) {
      setDone(true);
      doneRef.current = true;
      const elapsedSeconds = (Date.now() - startedAtMs) / 1000;
      const decayPerSecond = effectiveMaxPts / (game.duration_minutes * 60);
      const hintPenalty = hintUsedRef.current ? HINT_COST : 0;
      const attemptPenalty = 100 * (newAttempts - 1);
      const pts = Math.max(0, effectiveMaxPts - Math.floor(elapsedSeconds * decayPerSecond) - attemptPenalty - hintPenalty);
      onFinish(true, pts);
    }
  }

  function handleRevealHint() {
    setShowHint(true);
    setHintUsed(true);
    hintUsedRef.current = true;
  }

  if (members.length === 0) {
    return <div style={{ textAlign: 'center', padding: '40px', color: 'var(--muted)' }}>{t('challenge.sharedSecret.loading')}</div>;
  }

  return (
    <div>
      {/* Personal clue(s) — round-robin distributed */}
      <div style={{ marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {myClues.map((clue, idx) => (
          <div key={idx} style={{ padding: '16px 20px', background: '#0d1422', borderRadius: '12px', border: '1px solid var(--accent)', textAlign: 'center' }}>
            <p style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>
              {myClues.length > 1
                ? t('challenge.sharedSecret.yourClueN', { n: idx + 1 })
                : t('challenge.sharedSecret.yourClue')}
            </p>
            <p style={{ fontSize: '22px', fontWeight: 700, color: 'var(--accent3)' }}>{clue}</p>
          </div>
        ))}
      </div>

      <p style={{ fontSize: '14px', color: 'var(--muted)', marginBottom: '24px', textAlign: 'center' }}>
        {t('challenge.sharedSecret.discuss')}
      </p>

      {/* Attempt counter */}
      {attempts > 0 && (
        <div style={{ marginBottom: '16px', fontSize: '13px', color: 'var(--muted)', textAlign: 'center' }}>
          {t('challenge.sharedSecret.attempts', { n: attempts })}
          {attempts > 1 && <span style={{ color: 'var(--accent2)' }}> {t('challenge.sharedSecret.attemptPenalty', { pts: 100 * (attempts - 1) })}</span>}
        </div>
      )}

      {/* Feedback */}
      {lastResult === 'wrong' && (
        <div style={{ marginBottom: '16px', padding: '12px', background: 'rgba(239,68,68,0.1)', border: '1px solid var(--accent2)', borderRadius: '8px', textAlign: 'center', color: 'var(--accent2)' }}>
          {t('challenge.sharedSecret.wrong')}
        </div>
      )}

      {lastResult === 'correct' && (
        <div style={{ marginBottom: '16px', padding: '12px', background: 'rgba(34,197,94,0.1)', border: '1px solid var(--accent3)', borderRadius: '8px', textAlign: 'center', color: 'var(--accent3)' }}>
          {t('challenge.sharedSecret.correct')}
        </div>
      )}

      {/* Guess input */}
      {!done && (
        <>
          <input
            type="text"
            value={guess}
            placeholder={t('challenge.sharedSecret.placeholder')}
            onChange={e => setGuess(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            autoComplete="off"
          />
          <button
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '12px' }}
            onClick={handleSubmit}
            disabled={!guess.trim()}
          >
            {t('challenge.sharedSecret.submit')}
          </button>
        </>
      )}

      {/* Hint */}
      {hint && !showHint && attempts >= HINT_UNLOCK_AFTER && !done && (
        <button
          className="btn"
          style={{ width: '100%', marginTop: '12px', opacity: 0.8 }}
          onClick={handleRevealHint}
        >
          {t('challenge.sharedSecret.showHint', { cost: HINT_COST })}
        </button>
      )}

      {hint && showHint && (
        <div style={{ marginTop: '16px', padding: '12px', background: 'rgba(251,191,36,0.1)', border: '1px solid var(--gold)', borderRadius: '8px', textAlign: 'center' }}>
          <span style={{ fontSize: '12px', color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '1px' }}>{t('challenge.sharedSecret.hintLabel')}</span>
          <p style={{ marginTop: '6px', color: 'var(--fg)' }}>{hint}</p>
        </div>
      )}
    </div>
  );
}
