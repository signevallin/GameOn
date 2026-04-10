'use client';
import { useState } from 'react';
import { Mission } from '@/lib/missions';

type Props = {
  mission: Mission;
  onFinish: (correct: boolean) => void;
};

export default function MultipleChoice({ mission, onFinish }: Props) {
  const [selected, setSelected] = useState<string | null>(null);

  function choose(opt: string) {
    if (selected !== null) return;
    setSelected(opt);
    const correct = opt === mission.answer;
    setTimeout(() => onFinish(correct), 400);
  }

  return (
    <>
      <div className="challenge-question">{mission.question?.split('\n').map((l, i) => <span key={i}>{l}<br /></span>)}</div>
      {mission.code && <pre>{mission.code}</pre>}
      <div className="options-grid">
        {mission.options?.map((opt, i) => (
          <button
            key={i}
            className="option-btn"
            disabled={selected !== null}
            onClick={() => choose(opt)}
          >
            {opt}
          </button>
        ))}
      </div>
    </>
  );
}
