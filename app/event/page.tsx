'use client';
import { useState, useEffect, useRef } from 'react';
import { Star } from 'lucide-react';
import TriviaQuiz from '@/components/games/TriviaQuiz';
import { TriviaRound } from '@/lib/missions';

const DEMO_ROUNDS: TriviaRound[] = [
  {
    question: 'Which country invented association football?',
    options: ['Brazil', 'England', 'France', 'Spain'],
    answer: 'England',
  },
  {
    question: 'How many planets are in our solar system?',
    options: ['7', '8', '9', '10'],
    answer: '8',
  },
  {
    question: 'Who founded Spotify?',
    options: ['Apple', 'Google', 'Daniel Ek & Martin Lorentzon', 'Sony'],
    answer: 'Daniel Ek & Martin Lorentzon',
  },
  {
    question: 'What is the fastest land animal on Earth?',
    options: ['Lion', 'Cheetah', 'Springbok', 'Greyhound'],
    answer: 'Cheetah',
  },
  {
    question: 'In what year was Spotify founded?',
    options: ['2004', '2006', '2008', '2010'],
    answer: '2006',
  },
];

type Phase = 'landing' | 'playing' | 'done';

function ShareButton({ style }: { style?: React.CSSProperties }) {
  function share() {
    const url = `${window.location.origin}/event`;
    if (navigator.share) {
      navigator.share({
        title: 'GameOn – Live Team Building',
        text: 'Check out this incredibly smooth quiz and team building app!',
        url,
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(url).then(() => alert('Link copied to clipboard!')).catch(() => {});
    }
  }

  return (
    <button onClick={share} style={style}>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ flexShrink: 0 }}>
        <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
        <polyline points="16 6 12 2 8 6" />
        <line x1="12" y1="2" x2="12" y2="15" />
      </svg>
      Share with a colleague
    </button>
  );
}

export default function EventPage() {
  const [phase, setPhase] = useState<Phase>('landing');
  const [finalPts, setFinalPts] = useState(0);
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
    timerRef.current = setInterval(() => {
      elapsedRef.current += 1;
      setElapsed(e => e + 1);
    }, 1000);
  }

  function stopTimer() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  const timerDisplay = elapsed < 60
    ? `${elapsed}s`
    : `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')}`;

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await fetch('/api/event-interest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, guestId, score: finalPts }),
      });
    } catch {
      // fail silently — still show confirmation
    }
    setSubmitting(false);
    setEmailSent(true);
  }

  const cardStyle: React.CSSProperties = {
    background: '#162030',
    border: '1px solid rgba(124,189,212,0.15)',
    borderRadius: '16px',
    padding: '28px 24px',
  };

  if (phase === 'playing') {
    return (
      <>
        <nav className="nav">
          <div className="nav-brand">GAMEON</div>
          <div className="nav-right">
            <span className="nav-score" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <Star size={12} fill="var(--gold)" color="var(--gold)" /> Demo
            </span>
            <button
              className="btn btn-ghost"
              style={{ padding: '8px 16px', fontSize: '12px' }}
              onClick={() => { stopTimer(); setPhase('landing'); }}
            >
              Exit demo
            </button>
          </div>
        </nav>

        <div className="challenge-wrap fade-in">
          <div className="challenge-header">
            <div>
              <h2>General Knowledge</h2>
              <p style={{ color: 'var(--muted)', marginTop: '6px', fontSize: '14px' }}>
                Answer 5 questions — earn points for each correct answer.
              </p>
            </div>
            <div className="timer-box">
              <div className="timer-label">Time</div>
              <div className={`timer-value${elapsed > 60 ? ' urgent' : ''}`}>{timerDisplay}</div>
            </div>
          </div>

          <div className="challenge-card">
            <TriviaQuiz
              rounds={DEMO_ROUNDS}
              maxPts={500}
              onFinish={(_correct, pts) => {
                stopTimer();
                setFinalPts(pts ?? 0);
                setPhase('done');
              }}
            />
          </div>
        </div>
      </>
    );
  }

  if (phase === 'done') {
    const pct = Math.round((finalPts / 500) * 100);
    return (
      <div style={{ minHeight: '100vh', background: '#0D1520', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px', textAlign: 'center' }}>
        <div style={{ width: '100%', maxWidth: '400px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Score card */}
          <div style={{ ...cardStyle, textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>{pct >= 80 ? '🏆' : pct >= 50 ? '🎉' : '💪'}</div>
            <div style={{ color: '#7CBDD4', fontFamily: 'monospace', fontSize: '11px', letterSpacing: '3px', marginBottom: '4px' }}>DEMO COMPLETE</div>
            <div style={{ color: '#fff', fontSize: '36px', fontWeight: 900, marginBottom: '4px' }}>{finalPts} <span style={{ fontSize: '16px', fontWeight: 400, color: '#8FA8C0' }}>/ 500 pts</span></div>
            <div style={{ color: '#8FA8C0', fontSize: '14px' }}>
              {pct >= 80 ? 'Impressive! You\'d be the star of your team.' : pct >= 50 ? 'Nice work! Your team would have loved this.' : 'Stuck? Your team would have helped!'}
            </div>
          </div>

          {/* Email capture */}
          {!emailSent ? (
            <div style={cardStyle}>
              <p style={{ color: '#fff', fontWeight: 700, fontSize: '15px', marginBottom: '4px' }}>Want to try this with your team?</p>
              <p style={{ color: '#8FA8C0', fontSize: '13px', marginBottom: '16px' }}>Drop your email and we'll show you how to set up GameOn for your team.</p>
              <form onSubmit={handleEmailSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  style={{
                    padding: '13px 16px',
                    background: '#0D1520',
                    border: '1px solid rgba(124,189,212,0.25)',
                    borderRadius: '10px',
                    color: '#fff',
                    fontSize: '15px',
                    outline: 'none',
                    width: '100%',
                  }}
                />
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    padding: '14px',
                    background: '#7CBDD4',
                    color: '#0D1520',
                    border: 'none',
                    borderRadius: '10px',
                    fontWeight: 800,
                    fontSize: '15px',
                    cursor: submitting ? 'wait' : 'pointer',
                    opacity: submitting ? 0.7 : 1,
                  }}
                >
                  {submitting ? 'Saving...' : 'Save my spot →'}
                </button>
              </form>
            </div>
          ) : (
            <div style={{ ...cardStyle, textAlign: 'left' }}>
              <div style={{ color: '#7CBDD4', fontWeight: 700, marginBottom: '4px' }}>✓ You're on the list!</div>
              <div style={{ color: '#8FA8C0', fontSize: '13px' }}>We'll reach out to <strong style={{ color: '#fff' }}>{email}</strong> with everything you need to set up GameOn for your team.</div>
            </div>
          )}

          {/* Share */}
          <ShareButton
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '14px',
              background: 'rgba(124,189,212,0.08)',
              border: '1px solid rgba(124,189,212,0.25)',
              borderRadius: '10px',
              color: '#7CBDD4',
              fontWeight: 700,
              fontSize: '14px',
              cursor: 'pointer',
              width: '100%',
            }}
          />

          <button
            onClick={() => { setEmailSent(false); setEmail(''); setPhase('landing'); }}
            style={{ background: 'none', border: 'none', color: '#4A6580', fontSize: '13px', cursor: 'pointer', textDecoration: 'underline' }}
          >
            Play the demo again
          </button>
        </div>
      </div>
    );
  }

  // Landing
  return (
    <div style={{
      minHeight: '100vh',
      background: '#0D1520',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '32px 20px',
      textAlign: 'center',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Background glow */}
      <div style={{
        position: 'absolute',
        top: '30%',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '500px',
        height: '300px',
        background: 'radial-gradient(ellipse, rgba(124,189,212,0.08) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div style={{ width: '100%', maxWidth: '400px', position: 'relative' }}>

        {/* Logo */}
        <div style={{ marginBottom: '52px' }}>
          <div style={{ fontSize: '22px', fontWeight: 900, color: '#7CBDD4', letterSpacing: '4px', marginBottom: '4px' }}>GAMEON</div>
          <div style={{ fontSize: '11px', color: '#4A6580', letterSpacing: '4px' }}>LIVE TEAMBUILDING</div>
        </div>

        {/* Headline */}
        <h1 style={{ color: '#fff', fontSize: 'clamp(32px,8vw,52px)', fontWeight: 900, lineHeight: 1.05, marginBottom: '20px', letterSpacing: '-0.5px' }}>
          Compete live<br /><span style={{ color: '#7CBDD4' }}>with your team.</span>
        </h1>

        <p style={{ color: '#8FA8C0', fontSize: '16px', lineHeight: 1.65, marginBottom: '52px', maxWidth: '320px', margin: '0 auto 52px' }}>
          Answer questions, earn points and find out who's best — right in your browser. Nothing to download.
        </p>

        {/* CTA */}
        <button
          onClick={() => { startTimer(); setPhase('playing'); }}
          style={{
            width: '100%',
            padding: '20px',
            background: '#7CBDD4',
            color: '#0D1520',
            border: 'none',
            borderRadius: '14px',
            fontWeight: 900,
            fontSize: '19px',
            cursor: 'pointer',
            boxShadow: '0 0 48px rgba(124,189,212,0.35), 0 8px 32px rgba(0,0,0,0.4)',
            marginBottom: '14px',
            letterSpacing: '0.3px',
          }}
        >
          Try it now →
        </button>

        <p style={{ color: '#4A6580', fontSize: '12px', marginBottom: '40px' }}>
          No account needed · 5 questions · ~2 min
        </p>

        <ShareButton
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            background: 'none',
            border: '1px solid rgba(124,189,212,0.2)',
            borderRadius: '10px',
            padding: '11px 20px',
            color: '#7CBDD4',
            fontSize: '13px',
            cursor: 'pointer',
            fontWeight: 600,
          }}
        />
      </div>
    </div>
  );
}
