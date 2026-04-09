'use client';
import { useRef } from 'react';
import { Mission } from '@/lib/missions';

type Props = { mission: Mission; onFinish: (correct: boolean) => void };

export default function TextInput({ mission, onFinish }: Props) {
  const ref = useRef<HTMLInputElement>(null);

  function submit() {
    const val = ref.current?.value.trim() ?? '';
    const correct = val.toLowerCase() === mission.answer?.toLowerCase();
    onFinish(correct);
  }

  return (
    <>
      <div className="challenge-question">{mission.question}</div>
      {mission.code && (
        <pre style={{ fontSize: '20px', textAlign: 'center', letterSpacing: '4px' }}>{mission.code}</pre>
      )}
      <div className="text-input-area">
        <input
          ref={ref}
          type="text"
          placeholder="Type your answer here..."
          onKeyDown={e => e.key === 'Enter' && submit()}
        />
        {mission.hint && (
          <p style={{ fontSize: '12px', color: 'var(--muted)' }}>{mission.hint}</p>
        )}
        <button className="btn btn-primary" onClick={submit}>SUBMIT ANSWER →</button>
      </div>
    </>
  );
}
