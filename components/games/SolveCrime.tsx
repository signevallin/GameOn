'use client';
import { useState } from 'react';
import { CrimeQuestion } from '@/lib/missions';

type Props = {
  story: string;
  questions: CrimeQuestion[];
  maxPts: number;
  onFinish: (correct: boolean, pts: number) => void;
};

export default function SolveCrime({ story, questions, maxPts, onFinish }: Props) {
  const [phase, setPhase] = useState<'read' | 'quiz'>('read');
  const [idx, setIdx] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);

  function choose(opt: string) {
    if (selected !== null) return;
    setSelected(opt);
    const isCorrect = opt === questions[idx].answer;
    if (isCorrect) setCorrect(c => c + 1);

    setTimeout(() => {
      if (idx + 1 >= questions.length) {
        const totalCorrect = isCorrect ? correct + 1 : correct;
        const pts = Math.round((totalCorrect / questions.length) * maxPts);
        onFinish(totalCorrect > 0, pts);
      } else {
        setIdx(i => i + 1);
        setSelected(null);
      }
    }, 900);
  }

  if (phase === 'read') {
    return (
      <>
        <div style={{ fontSize: '13px', color: 'var(--accent)', letterSpacing: '2px', marginBottom: '16px', fontWeight: 700 }}>
          📁 CASE FILE
        </div>
        <div style={{
          background: '#0d1422',
          border: '1px solid var(--border)',
          borderRadius: '10px',
          padding: '24px',
          fontSize: '14px',
          lineHeight: '1.8',
          color: 'var(--text)',
          whiteSpace: 'pre-line',
          marginBottom: '24px',
        }}>
          {story}
        </div>
        <p style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '16px' }}>
          Read the case carefully – then answer 3 questions to solve the crime!
        </p>
        <button className="btn btn-primary btn-full" onClick={() => setPhase('quiz')}>
          I'VE READ IT – START QUESTIONS →
        </button>
      </>
    );
  }

  const q = questions[idx];

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div style={{ fontSize: '12px', color: 'var(--muted)', letterSpacing: '2px' }}>
          QUESTION {idx + 1} / {questions.length}
        </div>
        <div style={{ fontSize: '12px', color: 'var(--accent)' }}>
          {correct} correct so far
        </div>
      </div>

      <div className="challenge-question" style={{ fontSize: '18px', marginBottom: '24px' }}>
        {q.question}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {q.options.map((opt, i) => {
          let cls = 'option-btn';
          if (selected !== null) {
            if (opt === q.answer) cls += ' correct';
            else if (opt === selected) cls += ' wrong';
          }
          return (
            <button key={i} className={cls} disabled={selected !== null} onClick={() => choose(opt)}
              style={{ textAlign: 'left' }}>
              {opt}
            </button>
          );
        })}
      </div>
    </>
  );
}
