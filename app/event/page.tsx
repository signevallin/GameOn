'use client';
import { useState, useEffect, useRef } from 'react';
import { Star } from 'lucide-react';
import TriviaQuiz from '@/components/games/TriviaQuiz';
import TrueFalse from '@/components/games/TrueFalse';
import ClosestWins from '@/components/games/ClosestWins';
import TimelineSort from '@/components/games/TimelineSort';
import { TriviaRound, Statement } from '@/lib/missions';

// ── Demo mission data ────────────────────────────────────────────────────────

const TRIVIA_ROUNDS: TriviaRound[] = [
  { question: 'Which country invented association football?', options: ['Brazil', 'England', 'France', 'Spain'], answer: 'England' },
  { question: 'How many planets are in our solar system?', options: ['7', '8', '9', '10'], answer: '8' },
  { question: 'Who co-founded Spotify?', options: ['Elon Musk', 'Daniel Ek', 'Mark Zuckerberg', 'Jack Dorsey'], answer: 'Daniel Ek' },
  { question: 'What is the fastest land animal?', options: ['Lion', 'Cheetah', 'Springbok', 'Greyhound'], answer: 'Cheetah' },
];

const TRUE_FALSE_STATEMENTS: Statement[] = [
  { text: 'The Great Wall of China is visible from space with the naked eye.', answer: false },
  { text: 'A group of flamingos is called a flamboyance.', answer: true },
  { text: 'Humans share 50% of their DNA with bananas.', answer: true },
];

// ClosestWins and TimelineSort use their own built-in default data

type DemoMission = {
  id: string;
  name: string;
  icon: string;
  desc: string;
  maxPts: number;
};

const DEMO_MISSIONS: DemoMission[] = [
  { id: 'truefalse',    name: 'True or False',       icon: '⚡', desc: '3 statements — true or false? Answer fast.',           maxPts: 300 },
  { id: 'trivia',       name: 'General Knowledge',   icon: '🧠', desc: 'Answer 4 trivia questions. One point per correct answer.', maxPts: 500 },
  { id: 'closest_wins', name: 'Closest Wins',        icon: '🎯', desc: 'Guess the number. The closer you are, the more points.', maxPts: 400 },
  { id: 'timeline',     name: 'Timeline Challenge',  icon: '📅', desc: 'Sort 5 historical events from oldest to newest.',      maxPts: 500 },
];

type Phase = 'landing' | 'playing' | 'between' | 'done';

// ── Share button ─────────────────────────────────────────────────────────────

function ShareButton({ style }: { style?: React.CSSProperties }) {
  function share() {
    const url = `${window.location.origin}/event`;
    if (navigator.share) {
      navigator.share({ title: 'GameOn – Live Team Building', text: 'Check out this incredibly smooth quiz and team building app!', url }).catch(() => {});
    } else {
      navigator.clipboard.writeText(url).then(() => alert('Link copied to clipboard!')).catch(() => {});
    }
  }
  return (
    <button onClick={share} style={style}>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ flexShrink: 0 }}>
        <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" /><polyline points="16 6 12 2 8 6" /><line x1="12" y1="2" x2="12" y2="15" />
      </svg>
      Share with a colleague
    </button>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export default function EventPage() {
  const [phase, setPhase] = useState<Phase>('landing');
  const [missionIdx, setMissionIdx] = useState(0);
  const [scores, setScores] = useState<number[]>([]);
  const [lastPts, setLastPts] = useState(0);
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [guestId, setGuestId] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const elapsedRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let id = localStorage.getItem('gameon_guest_id');
    if (!id) {
      id = `guest_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      localStorage.setItem('gameon_guest_id', id);
    }
    setGuestId(id);
  }, []);

  function startTimer() {
    elapsedRef.current = 0;
    setElapsed(0);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => { elapsedRef.current += 1; setElapsed(e => e + 1); }, 1000);
  }

  function stopTimer() {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }

  const timerDisplay = elapsed < 60 ? `${elapsed}s` : `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')}`;

  function beginDemo() {
    setMissionIdx(0);
    setScores([]);
    startTimer();
    setPhase('playing');
  }

  function handleMissionFinish(_correct: boolean, pts?: number) {
    stopTimer();
    const earned = pts ?? 0;
    setLastPts(earned);
    setScores(prev => [...prev, earned]);
    setPhase('between');
  }

  function nextMission() {
    const next = missionIdx + 1;
    if (next >= DEMO_MISSIONS.length) {
      setPhase('done');
    } else {
      setMissionIdx(next);
      startTimer();
      setPhase('playing');
    }
  }

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const totalPts = scores.reduce((a, b) => a + b, 0) + lastPts;
    try {
      await fetch('/api/event-interest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, guestId, score: totalPts }),
      });
    } catch { /* fail silently */ }
    setSubmitting(false);
    setEmailSent(true);
  }

  const mission = DEMO_MISSIONS[missionIdx];
  const totalPts = scores.reduce((a, b) => a + b, 0);
  const maxPossible = DEMO_MISSIONS.reduce((a, m) => a + m.maxPts, 0);

  const cardStyle: React.CSSProperties = {
    background: 'var(--card)',
    border: '1px solid var(--border)',
    borderRadius: '16px',
    padding: '28px 24px',
  };

  // ── Playing ──────────────────────────────────────────────────────────────

  if (phase === 'playing') {
    return (
      <>
        <nav className="nav">
          <div className="nav-brand">GAMEON</div>
          <div className="nav-right">
            <span className="nav-score" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <Star size={12} fill="var(--gold)" color="var(--gold)" /> {totalPts} pts
            </span>
            <button className="btn btn-ghost" style={{ padding: '8px 16px', fontSize: '12px' }} onClick={() => { stopTimer(); setPhase('landing'); }}>
              Exit demo
            </button>
          </div>
        </nav>

        <div className="challenge-wrap fade-in">
          <div className="challenge-header">
            <div>
              <div style={{ fontSize: '11px', color: 'var(--muted)', letterSpacing: '2px', marginBottom: '6px' }}>
                MISSION {missionIdx + 1} / {DEMO_MISSIONS.length}
              </div>
              <h2>{mission.icon} {mission.name}</h2>
              <p style={{ color: 'var(--muted)', marginTop: '6px', fontSize: '14px' }}>{mission.desc}</p>
            </div>
            <div className="timer-box">
              <div className="timer-label">Time</div>
              <div className={`timer-value${elapsed > 60 ? ' urgent' : ''}`}>{timerDisplay}</div>
            </div>
          </div>

          <div className="challenge-card">
            {mission.id === 'truefalse' && (
              <TrueFalse statements={TRUE_FALSE_STATEMENTS} maxPts={mission.maxPts} onFinish={handleMissionFinish} />
            )}
            {mission.id === 'trivia' && (
              <TriviaQuiz rounds={TRIVIA_ROUNDS} maxPts={mission.maxPts} hidePts onFinish={handleMissionFinish} />
            )}
            {mission.id === 'closest_wins' && (
              <ClosestWins maxPts={mission.maxPts} onFinish={handleMissionFinish} />
            )}
            {mission.id === 'timeline' && (
              <TimelineSort maxPts={mission.maxPts} onFinish={handleMissionFinish} />
            )}
          </div>
        </div>
      </>
    );
  }

  // ── Between missions ──────────────────────────────────────────────────────

  if (phase === 'between') {
    const isLast = missionIdx + 1 >= DEMO_MISSIONS.length;
    const pct = mission.maxPts > 0 ? Math.round((lastPts / mission.maxPts) * 100) : 0;
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
        <div style={{ width: '100%', maxWidth: '400px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

          <div style={{ ...cardStyle, textAlign: 'center' }}>
            <div style={{ fontSize: '40px', marginBottom: '10px' }}>{pct >= 80 ? '🏆' : pct >= 40 ? '🎉' : '💪'}</div>
            <div style={{ color: 'var(--muted)', fontSize: '11px', letterSpacing: '3px', marginBottom: '4px' }}>{mission.name.toUpperCase()} · COMPLETE</div>
            <div style={{ color: 'var(--text)', fontSize: '36px', fontWeight: 900 }}>
              {lastPts} <span style={{ fontSize: '15px', fontWeight: 400, color: 'var(--muted)' }}>/ {mission.maxPts} pts</span>
            </div>
          </div>

          {/* Running total */}
          <div style={{ ...cardStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px' }}>
            <span style={{ color: 'var(--muted)', fontSize: '13px' }}>Total so far</span>
            <span style={{ color: 'var(--gold)', fontWeight: 800, fontSize: '16px', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <Star size={13} fill="var(--gold)" color="var(--gold)" /> {totalPts} pts
            </span>
          </div>

          {/* Next mission preview */}
          {!isLast && (
            <div style={{ ...cardStyle, padding: '16px 24px' }}>
              <div style={{ color: 'var(--muted)', fontSize: '11px', letterSpacing: '2px', marginBottom: '8px' }}>UP NEXT</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '28px' }}>{DEMO_MISSIONS[missionIdx + 1].icon}</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '14px' }}>{DEMO_MISSIONS[missionIdx + 1].name}</div>
                  <div style={{ color: 'var(--muted)', fontSize: '12px' }}>{DEMO_MISSIONS[missionIdx + 1].desc}</div>
                </div>
              </div>
            </div>
          )}

          <button
            onClick={nextMission}
            className="btn btn-primary"
            style={{ padding: '16px', fontSize: '16px', fontWeight: 800, borderRadius: '12px' }}
          >
            {isLast ? 'See final score →' : `Next mission →`}
          </button>

          <button onClick={() => { stopTimer(); setPhase('landing'); }} style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: '13px', cursor: 'pointer' }}>
            Exit demo
          </button>
        </div>
      </div>
    );
  }

  // ── Done ─────────────────────────────────────────────────────────────────

  if (phase === 'done') {
    const grand = totalPts;
    const pct = Math.round((grand / maxPossible) * 100);
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px', textAlign: 'center' }}>
        <div style={{ width: '100%', maxWidth: '400px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Grand total */}
          <div style={{ ...cardStyle, textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>{pct >= 70 ? '🏆' : pct >= 40 ? '🎉' : '💪'}</div>
            <div style={{ color: 'var(--muted)', fontSize: '11px', letterSpacing: '3px', marginBottom: '6px' }}>DEMO COMPLETE</div>
            <div style={{ color: 'var(--text)', fontSize: '40px', fontWeight: 900, marginBottom: '4px' }}>
              {grand} <span style={{ fontSize: '16px', fontWeight: 400, color: 'var(--muted)' }}>/ {maxPossible} pts</span>
            </div>
            <div style={{ color: 'var(--muted)', fontSize: '14px' }}>
              {pct >= 70 ? "Impressive! You'd be the star of your team." : pct >= 40 ? "Nice work! Your team would have loved this." : "Stuck? Your team would have helped!"}
            </div>
          </div>

          {/* Per-mission breakdown */}
          <div style={cardStyle}>
            {DEMO_MISSIONS.map((m, i) => (
              <div key={m.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: i < DEMO_MISSIONS.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '18px' }}>{m.icon}</span>
                  <span style={{ fontSize: '13px', color: 'var(--muted)' }}>{m.name}</span>
                </div>
                <span style={{ fontWeight: 700, fontSize: '13px', color: 'var(--accent)' }}>{scores[i] ?? 0} pts</span>
              </div>
            ))}
          </div>

          {/* Email capture */}
          {!emailSent ? (
            <div style={cardStyle}>
              <p style={{ color: 'var(--text)', fontWeight: 700, fontSize: '15px', marginBottom: '4px' }}>Want to try this with your team?</p>
              <p style={{ color: 'var(--muted)', fontSize: '13px', marginBottom: '16px' }}>Drop your email and we'll show you how to set up GameOn for your team.</p>
              <form onSubmit={handleEmailSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <input
                  type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com"
                  style={{ padding: '13px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', color: 'var(--text)', fontSize: '15px', outline: 'none', width: '100%' }}
                />
                <button type="submit" disabled={submitting} className="btn btn-primary" style={{ padding: '14px', fontWeight: 800, fontSize: '15px', cursor: submitting ? 'wait' : 'pointer', opacity: submitting ? 0.7 : 1 }}>
                  {submitting ? 'Saving...' : 'Save my spot →'}
                </button>
              </form>
            </div>
          ) : (
            <div style={{ ...cardStyle, textAlign: 'left' }}>
              <div style={{ color: 'var(--accent3)', fontWeight: 700, marginBottom: '4px' }}>✓ You're on the list!</div>
              <div style={{ color: 'var(--muted)', fontSize: '13px' }}>We'll reach out to <strong style={{ color: 'var(--text)' }}>{email}</strong> with everything you need to set up GameOn for your team.</div>
            </div>
          )}

          <ShareButton
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '14px', background: 'rgba(124,189,212,0.08)', border: '1px solid var(--border)', borderRadius: '10px', color: 'var(--accent)', fontWeight: 700, fontSize: '14px', cursor: 'pointer', width: '100%' }}
          />

          <button onClick={() => { setScores([]); setMissionIdx(0); setEmailSent(false); setEmail(''); setPhase('landing'); }} style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: '13px', cursor: 'pointer', textDecoration: 'underline' }}>
            Play the demo again
          </button>
        </div>
      </div>
    );
  }

  // ── Landing ───────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 20px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: '30%', left: '50%', transform: 'translateX(-50%)', width: '500px', height: '300px', background: 'radial-gradient(ellipse, rgba(124,189,212,0.08) 0%, transparent 70%)', pointerEvents: 'none' }} />

      <div style={{ width: '100%', maxWidth: '400px', position: 'relative' }}>

        <div style={{ marginBottom: '52px' }}>
          <div style={{ fontSize: '22px', fontWeight: 900, color: 'var(--accent)', letterSpacing: '4px', marginBottom: '4px' }}>GAMEON</div>
          <div style={{ fontSize: '11px', color: 'var(--muted)', letterSpacing: '4px' }}>LIVE TEAM BUILDING</div>
        </div>

        <h1 style={{ color: 'var(--text)', fontSize: 'clamp(32px,8vw,52px)', fontWeight: 900, lineHeight: 1.05, marginBottom: '20px', letterSpacing: '-0.5px' }}>
          Compete live<br /><span style={{ color: 'var(--accent)' }}>with your team.</span>
        </h1>

        <p style={{ color: 'var(--muted)', fontSize: '16px', lineHeight: 1.65, maxWidth: '320px', margin: '0 auto 36px' }}>
          Answer questions, earn points and find out who's best — right in your browser. Nothing to download.
        </p>

        {/* Mission preview list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '36px', textAlign: 'left' }}>
          {DEMO_MISSIONS.map((m, i) => (
            <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '10px', padding: '12px 16px' }}>
              <span style={{ fontSize: '22px' }}>{m.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: '13px' }}>{m.name}</div>
                <div style={{ color: 'var(--muted)', fontSize: '12px' }}>{m.desc}</div>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--accent)', fontWeight: 700, whiteSpace: 'nowrap' }}>{m.maxPts} pts</div>
            </div>
          ))}
        </div>

        <button
          onClick={beginDemo}
          className="btn btn-primary"
          style={{ width: '100%', padding: '20px', fontSize: '19px', fontWeight: 900, borderRadius: '14px', boxShadow: '0 0 48px rgba(124,189,212,0.35), 0 8px 32px rgba(0,0,0,0.4)', marginBottom: '14px', letterSpacing: '0.3px' }}
        >
          Try it now →
        </button>

        <p style={{ color: 'var(--muted)', fontSize: '12px', marginBottom: '32px' }}>
          No account needed · 4 missions · ~5 min
        </p>

        <ShareButton
          style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'none', border: '1px solid var(--border)', borderRadius: '10px', padding: '11px 20px', color: 'var(--accent)', fontSize: '13px', cursor: 'pointer', fontWeight: 600 }}
        />
      </div>
    </div>
  );
}
