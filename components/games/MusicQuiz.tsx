'use client';
import { useRef, useState } from 'react';
import { MusicRound } from '@/lib/missions';

type Props = {
  rounds: MusicRound[];
  maxPts: number;
  onFinish: (correct: boolean, pts: number) => void;
};

// ── Phase 1: Listen & Guess ────────────────────────────────────────────────

type GuessResult = { round: MusicRound; artistOk: boolean; titleOk: boolean };

function ListenPhase({ rounds, onDone }: { rounds: MusicRound[]; onDone: (results: GuessResult[]) => void }) {
  const [idx, setIdx] = useState(0);
  const [artistInput, setArtistInput] = useState('');
  const [titleInput, setTitleInput] = useState('');
  const [results, setResults] = useState<GuessResult[]>([]);
  const [revealed, setRevealed] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  const round = rounds[idx];
  const norm = (s: string) => s.trim().toLowerCase();
  // Strip parenthetical extras like "(Friends Forever)" or "(feat. The Weeknd)"
  const stripExtras = (s: string) => norm(s).replace(/\s*\(.*?\)\s*/g, '').trim();

  function matches(input: string, correct: string) {
    const n = norm(input);
    const c = norm(correct);
    return n === c || c.startsWith(n) || stripExtras(correct) === n;
  }

  function submit() {
    if (revealed) return;
    const artistOk = matches(artistInput, round.artist);
    const titleOk = matches(titleInput, round.title);
    setResults(r => [...r, { round, artistOk, titleOk }]);
    setRevealed(true);
  }

  function next() {
    if (idx + 1 >= rounds.length) {
      onDone([...results]);
    } else {
      setIdx(i => i + 1);
      setArtistInput('');
      setTitleInput('');
      setRevealed(false);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.load();
      }
    }
  }

  const correctCount = results.filter(r => r.artistOk && r.titleOk).length;

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div style={{ fontSize: '12px', color: 'var(--muted)', letterSpacing: '2px' }}>
          SONG {idx + 1} / {rounds.length}
        </div>
        <div style={{ fontSize: '12px', color: 'var(--accent)' }}>
          {correctCount} correct so far
        </div>
      </div>

      {/* Audio player */}
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '12px',
        padding: '20px',
        textAlign: 'center',
        marginBottom: '20px',
      }}>
        {round.audioUrl ? (
          <audio
            ref={audioRef}
            controls
            style={{ width: '100%' }}
            key={round.audioUrl}
          >
            <source src={round.audioUrl} />
            Your browser does not support audio.
          </audio>
        ) : (
          <p style={{ color: 'var(--muted)', fontSize: '13px' }}>🎵 Audio not yet uploaded for this song.</p>
        )}
      </div>

      {/* Inputs */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
        <div>
          <label style={{ fontSize: '11px', color: 'var(--muted)', letterSpacing: '2px', display: 'block', marginBottom: '6px' }}>ARTIST</label>
          <input
            type="text"
            value={artistInput}
            onChange={e => setArtistInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !revealed && submit()}
            placeholder="Who made this song?"
            disabled={revealed}
            style={{
              width: '100%',
              background: revealed
                ? results[results.length - 1]?.artistOk ? 'rgba(140,191,155,0.15)' : 'rgba(208,117,125,0.12)'
                : 'var(--surface)',
              border: `1px solid ${revealed
                ? results[results.length - 1]?.artistOk ? 'var(--accent3)' : 'var(--accent2)'
                : 'var(--border)'}`,
              borderRadius: '8px',
            }}
          />
          {revealed && (
            <p style={{ fontSize: '12px', marginTop: '4px', color: results[results.length - 1]?.artistOk ? 'var(--accent3)' : 'var(--accent2)' }}>
              {results[results.length - 1]?.artistOk ? '✓' : `✗ ${round.artist}`}
            </p>
          )}
        </div>

        <div>
          <label style={{ fontSize: '11px', color: 'var(--muted)', letterSpacing: '2px', display: 'block', marginBottom: '6px' }}>SONG TITLE</label>
          <input
            type="text"
            value={titleInput}
            onChange={e => setTitleInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !revealed && submit()}
            placeholder="What's the song called?"
            disabled={revealed}
            style={{
              width: '100%',
              background: revealed
                ? results[results.length - 1]?.titleOk ? 'rgba(140,191,155,0.15)' : 'rgba(208,117,125,0.12)'
                : 'var(--surface)',
              border: `1px solid ${revealed
                ? results[results.length - 1]?.titleOk ? 'var(--accent3)' : 'var(--accent2)'
                : 'var(--border)'}`,
              borderRadius: '8px',
            }}
          />
          {revealed && (
            <p style={{ fontSize: '12px', marginTop: '4px', color: results[results.length - 1]?.titleOk ? 'var(--accent3)' : 'var(--accent2)' }}>
              {results[results.length - 1]?.titleOk ? '✓' : `✗ ${round.title}`}
            </p>
          )}
        </div>
      </div>

      {!revealed ? (
        <button
          className="btn btn-primary btn-full"
          onClick={submit}
          disabled={!artistInput.trim() && !titleInput.trim()}
        >
          SUBMIT GUESS →
        </button>
      ) : (
        <button className="btn btn-primary btn-full" onClick={next}>
          {idx + 1 >= rounds.length ? 'GO TO TIMELINE →' : 'NEXT SONG →'}
        </button>
      )}
    </>
  );
}

// ── Phase 2: Timeline ──────────────────────────────────────────────────────

function TimelinePhase({ results, maxPts, onDone }: {
  results: GuessResult[];
  maxPts: number;
  onDone: (pts: number) => void;
}) {
  const [order, setOrder] = useState<number[]>(results.map((_, i) => i));
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);

  function onDragStart(pos: number) { setDragIdx(pos); }
  function onDragOver(e: React.DragEvent, pos: number) {
    e.preventDefault();
    if (dragIdx === null || dragIdx === pos) return;
    const next = [...order];
    const [moved] = next.splice(dragIdx, 1);
    next.splice(pos, 0, moved);
    setOrder(next);
    setDragIdx(pos);
  }
  function onDragEnd() { setDragIdx(null); }

  // Touch support
  const touchStartPos = useRef<number | null>(null);
  function onTouchStart(pos: number) { touchStartPos.current = pos; }
  function onTouchEnd(e: React.TouchEvent, pos: number) {
    if (touchStartPos.current === null || touchStartPos.current === pos) return;
    const next = [...order];
    const [moved] = next.splice(touchStartPos.current, 1);
    next.splice(pos, 0, moved);
    setOrder(next);
    touchStartPos.current = null;
  }

  function submit() {
    // Correct order: sorted by year ascending
    const correctOrder = [...results.map((r, i) => i)].sort((a, b) => results[a].round.year - results[b].round.year);

    // Guessing score: each correct artist+title pair
    const guessPts = results.reduce((sum, r) => sum + (r.artistOk && r.titleOk ? 1 : 0), 0);
    const guessMaxPts = Math.round(maxPts * 0.6);
    const guessScore = Math.round((guessPts / results.length) * guessMaxPts);

    // Timeline score: count adjacent pairs in correct relative order
    const timelineMaxPts = Math.round(maxPts * 0.4);
    let timelineCorrect = 0;
    for (let i = 0; i < order.length - 1; i++) {
      const aYear = results[order[i]].round.year;
      const bYear = results[order[i + 1]].round.year;
      if (aYear <= bYear) timelineCorrect++;
    }
    const timelineScore = order.length > 1
      ? Math.round((timelineCorrect / (order.length - 1)) * timelineMaxPts)
      : timelineMaxPts;

    setSubmitted(true);
    setTimeout(() => onDone(guessScore + timelineScore), 800);
  }

  const correctOrder = [...results.map((_, i) => i)].sort((a, b) => results[a].round.year - results[b].round.year);

  return (
    <>
      <div style={{ marginBottom: '20px' }}>
        <p style={{ fontSize: '12px', color: 'var(--muted)', letterSpacing: '2px', marginBottom: '4px' }}>TIMELINE CHALLENGE</p>
        <p style={{ fontSize: '14px', color: 'var(--text)' }}>Drag the songs into order — oldest release first, newest last.</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
        {order.map((resultIdx, pos) => {
          const r = results[resultIdx];
          const isCorrect = submitted && correctOrder[pos] === resultIdx;
          const isWrong = submitted && correctOrder[pos] !== resultIdx;

          return (
            <div
              key={resultIdx}
              draggable={!submitted}
              onDragStart={() => onDragStart(pos)}
              onDragOver={e => onDragOver(e, pos)}
              onDragEnd={onDragEnd}
              onTouchStart={() => onTouchStart(pos)}
              onTouchEnd={e => onTouchEnd(e, pos)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 16px',
                background: isCorrect ? 'rgba(140,191,155,0.12)' : isWrong ? 'rgba(208,117,125,0.10)' : 'var(--card)',
                border: `1px solid ${isCorrect ? 'var(--accent3)' : isWrong ? 'var(--accent2)' : 'var(--border)'}`,
                borderRadius: '10px',
                cursor: submitted ? 'default' : 'grab',
                userSelect: 'none',
                transition: 'all 0.15s',
                opacity: dragIdx === pos ? 0.5 : 1,
              }}
            >
              <span style={{ fontSize: '18px', flexShrink: 0 }}>☰</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {r.artistOk && r.titleOk ? `${r.round.artist} — ${r.round.title}` : r.round.title}
                </div>
                {submitted && (
                  <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>
                    Released: {r.round.year}
                  </div>
                )}
              </div>
              <span style={{ fontSize: '12px', color: 'var(--muted)', flexShrink: 0 }}>#{pos + 1}</span>
              {submitted && (isCorrect
                ? <span style={{ color: 'var(--accent3)', fontSize: '16px' }}>✓</span>
                : <span style={{ color: 'var(--accent2)', fontSize: '16px' }}>✗</span>
              )}
            </div>
          );
        })}
      </div>

      <button
        className="btn btn-primary btn-full"
        onClick={submit}
        disabled={submitted}
      >
        {submitted ? '✓ SUBMITTED!' : 'LOCK IN ORDER →'}
      </button>
    </>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function MusicQuiz({ rounds, maxPts, onFinish }: Props) {
  const [phase, setPhase] = useState<'listen' | 'timeline'>('listen');
  const [shuffledRounds] = useState(() => shuffle(rounds));
  const [guessResults, setGuessResults] = useState<GuessResult[]>([]);

  function handleListenDone(results: GuessResult[]) {
    setGuessResults(results);
    setPhase('timeline');
  }

  function handleTimelineDone(pts: number) {
    onFinish(pts > 0, pts);
  }

  if (phase === 'listen') {
    return <ListenPhase rounds={shuffledRounds} onDone={handleListenDone} />;
  }

  return (
    <TimelinePhase
      results={guessResults}
      maxPts={maxPts}
      onDone={handleTimelineDone}
    />
  );
}
