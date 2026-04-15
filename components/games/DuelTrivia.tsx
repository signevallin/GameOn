'use client';
import { useState } from 'react';
import { Team } from '@/lib/supabase';

type Question = { q: string; options: string[]; answer: string };

const QUESTIONS: Question[] = [
  { q: 'Which country is the largest by area?',            options: ['USA','China','Russia','Canada'],          answer: 'Russia' },
  { q: 'What is 17 × 23?',                                options: ['381','391','401','411'],                  answer: '391' },
  { q: 'How many bits are in a byte?',                     options: ['4','8','16','32'],                        answer: '8' },
  { q: 'Which country invented the printing press?',       options: ['Japan','India','China','Korea'],          answer: 'China' },
  { q: 'In what year was the first iPhone released?',      options: ['2005','2006','2007','2008'],              answer: '2007' },
  { q: 'What is the hormone associated with fear?',        options: ['Serotonin','Dopamine','Adrenaline','Oxytocin'], answer: 'Adrenaline' },
  { q: 'How many planets are in our solar system?',        options: ['7','8','9','10'],                        answer: '8' },
  { q: 'Which country has the most people?',               options: ['India','China','USA','Russia'],           answer: 'India' },
  { q: 'What is the square root of 144?',                 options: ['11','12','13','14'],                      answer: '12' },
  { q: 'Which gas makes up most of the air we breathe?',  options: ['Oxygen','Nitrogen','Carbon dioxide','Argon'], answer: 'Nitrogen' },
];

const STEAL_PCT_PER_CORRECT = 0.10; // 10% per correct answer, max 30%
const NUM_QUESTIONS = 3;

type Props = {
  team: Team;
  teams: Team[];
  onFinish: (correct: boolean, pts?: number) => void;
};

export default function DuelTrivia({ team, teams, onFinish }: Props) {
  const rivals = teams.filter(t => t.id !== team.id);
  const [questions]        = useState(() => [...QUESTIONS].sort(() => Math.random() - 0.5).slice(0, NUM_QUESTIONS));
  const [phase, setPhase]  = useState<'select' | 'playing' | 'result'>('select');
  const [targetId, setTargetId] = useState('');
  const [qIdx, setQIdx]    = useState(0);
  const [selected, setSelected]   = useState<string | null>(null);
  const [answered, setAnswered]   = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [results, setResults]     = useState<boolean[]>([]);
  const [stolen, setStolen]       = useState<number | null>(null);
  const [loading, setLoading]     = useState(false);

  function startDuel() {
    if (!targetId) return;
    setPhase('playing');
  }

  function selectOption(opt: string) {
    if (answered) return;
    setSelected(opt);
    setAnswered(true);
    const correct = opt === questions[qIdx].answer;
    const newCount = correctCount + (correct ? 1 : 0);
    const newResults = [...results, correct];
    setCorrectCount(newCount);
    setResults(newResults);

    setTimeout(() => {
      if (qIdx + 1 >= questions.length) {
        // All questions done — call duel API
        finalizeDuel(newCount);
      } else {
        setQIdx(i => i + 1);
        setSelected(null);
        setAnswered(false);
      }
    }, 1100);
  }

  async function finalizeDuel(correctAnswers: number) {
    setLoading(true);
    try {
      const res = await fetch('/api/team/duel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ senderTeamId: team.id, targetTeamId: targetId, correctCount: correctAnswers }),
        cache: 'no-store',
      });
      const data = await res.json();
      setStolen(data.stolen ?? 0);
    } catch {
      setStolen(0);
    } finally {
      setLoading(false);
      setPhase('result');
    }
  }

  // ── Phase: Select target ──
  if (phase === 'select') {
    return (
      <div>
        <div style={{
          padding: '14px 18px', marginBottom: '24px',
          background: 'rgba(208,117,125,0.08)', border: '1px solid var(--accent2)',
          borderRadius: '10px', fontSize: '13px', color: 'var(--accent2)', lineHeight: 1.6,
        }}>
          ⚔️ Choose a rival team to challenge! Answer trivia questions correctly to steal{' '}
          <strong>10% of their points per correct answer</strong> (max 30%).
        </div>

        <label style={{ fontSize: '11px', color: 'var(--muted)', letterSpacing: '2px', display: 'block', marginBottom: '10px' }}>
          SELECT RIVAL TEAM
        </label>

        {rivals.length === 0 ? (
          <p style={{ color: 'var(--muted)', fontSize: '13px' }}>No other teams in this game.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px' }}>
            {rivals.map(t => (
              <button
                key={t.id}
                onClick={() => setTargetId(t.id)}
                style={{
                  padding: '14px 16px', borderRadius: '10px',
                  border: `2px solid ${targetId === t.id ? 'var(--accent2)' : 'var(--border)'}`,
                  background: targetId === t.id ? 'rgba(208,117,125,0.12)' : 'var(--card)',
                  color: 'var(--text)', fontFamily: "'Sora', sans-serif",
                  fontWeight: 700, fontSize: '14px',
                  cursor: 'pointer', textAlign: 'left',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  transition: 'border-color 0.15s, background 0.15s',
                }}
              >
                <span>{t.name}</span>
                <span style={{ color: 'var(--muted)', fontWeight: 400 }}>{t.score} pts</span>
              </button>
            ))}
          </div>
        )}

        <button
          className="btn btn-primary btn-full"
          onClick={startDuel}
          disabled={!targetId}
          style={{ background: 'var(--accent2)', borderColor: 'var(--accent2)' }}
        >
          ⚔️ START THE DUEL →
        </button>
      </div>
    );
  }

  // ── Phase: Playing ──
  if (phase === 'playing') {
    const q = questions[qIdx];
    const target = rivals.find(t => t.id === targetId);
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
          <span style={{ fontSize: '13px', color: 'var(--muted)', letterSpacing: '2px' }}>
            QUESTION {qIdx + 1}/{questions.length}
          </span>
          <span style={{ fontSize: '13px', color: 'var(--accent2)', fontWeight: 700 }}>
            ⚔️ vs. {target?.name}
          </span>
        </div>

        {/* Correct streak */}
        <div style={{ display: 'flex', gap: '6px', marginBottom: '20px' }}>
          {results.map((r, i) => (
            <div key={i} style={{
              width: 24, height: 24, borderRadius: '50%',
              background: r ? 'rgba(140,191,155,0.25)' : 'rgba(208,117,125,0.25)',
              border: `1px solid ${r ? 'var(--accent3)' : 'var(--accent2)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px',
            }}>
              {r ? '✓' : '✗'}
            </div>
          ))}
        </div>

        <h3 style={{ fontSize: '16px', lineHeight: 1.55, marginBottom: '20px' }}>{q.q}</h3>

        <div className="options-grid">
          {q.options.map(opt => {
            let cls = 'option-btn';
            if (answered) {
              if (opt === q.answer) cls += ' correct';
              else if (opt === selected) cls += ' wrong';
            } else if (opt === selected) {
              cls += ' selected';
            }
            return (
              <button key={opt} className={cls} onClick={() => selectOption(opt)} disabled={answered}>
                {opt}
              </button>
            );
          })}
        </div>

        {loading && (
          <p style={{ textAlign: 'center', color: 'var(--muted)', fontSize: '13px', marginTop: '16px' }}>
            Calculating result…
          </p>
        )}
      </div>
    );
  }

  // ── Phase: Result ──
  const target = rivals.find(t => t.id === targetId);
  const won = (stolen ?? 0) > 0;

  return (
    <div style={{ textAlign: 'center', padding: '20px 0' }}>
      <div style={{ fontSize: '64px', marginBottom: '16px' }}>{won ? '⚔️' : '🛡️'}</div>
      <h2 style={{ marginBottom: '8px', color: won ? 'var(--gold)' : 'var(--accent2)' }}>
        {won ? 'Duel Won!' : 'Duel Lost…'}
      </h2>
      <p style={{ color: 'var(--muted)', fontSize: '14px', marginBottom: '20px' }}>
        {correctCount}/{questions.length} correct answers against <strong style={{ color: 'var(--text)' }}>{target?.name}</strong>
      </p>

      {(stolen ?? 0) > 0 ? (
        <div style={{
          display: 'inline-block', padding: '16px 32px',
          background: 'rgba(222,187,107,0.12)', border: '1px solid var(--gold)',
          borderRadius: '12px', marginBottom: '20px',
        }}>
          <div style={{ fontSize: '36px', fontWeight: 800, color: 'var(--gold)', lineHeight: 1 }}>
            +{stolen} pts
          </div>
          <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px' }}>
            stolen from {target?.name}
          </div>
        </div>
      ) : (
        <div style={{
          display: 'inline-block', padding: '16px 32px',
          background: 'rgba(208,117,125,0.10)', border: '1px solid var(--accent2)',
          borderRadius: '12px', marginBottom: '20px',
        }}>
          <div style={{ fontSize: '18px', color: 'var(--accent2)' }}>No points stolen</div>
        </div>
      )}

      <div>
        <button className="btn btn-primary" onClick={() => onFinish(won, stolen ?? 0)}>
          CONTINUE →
        </button>
      </div>
    </div>
  );
}
