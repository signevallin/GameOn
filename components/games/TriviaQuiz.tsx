'use client';
import { useState, useEffect } from 'react';
import { TriviaRound } from '@/lib/missions';

type Props = {
  rounds: TriviaRound[];
  maxPts: number;
  // Remote sync: remoteRoundIdx comes from team.relay_state via the main 3-second poll.
  // onRoundAdvance writes the new index to the DB so teammates catch up.
  remoteRoundIdx?: number;
  onRoundAdvance?: (idx: number) => void;
  onClearRound?: () => void;
  onFinish: (correct: boolean, pts?: number) => void;
  hidePts?: boolean;
};

export default function TriviaQuiz({ rounds, maxPts, remoteRoundIdx, onRoundAdvance, onClearRound, onFinish, hidePts }: Props) {
  const [qIdx, setQIdx] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [totalPts, setTotalPts] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [done, setDone] = useState(false);

  // Advance this player's view when a teammate advances.
  // remoteRoundIdx is driven by team.relay_state from the main poll —
  // same proven channel that drives nav-sync.
  useEffect(() => {
    if (remoteRoundIdx !== undefined && remoteRoundIdx > qIdx && !done) {
      // Show the correct answer briefly so remote players see the reveal, then advance.
      // qIdx/rounds are intentionally stale here — they point to the question just answered.
      setSelected(rounds[qIdx].answer);
      setTimeout(() => {
        setQIdx(remoteRoundIdx);
        setSelected(null);
      }, 900);
    }
  // qIdx/rounds deliberately omitted — we only want to react to incoming remote changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remoteRoundIdx]);

  const ptsPerQ = Math.round(maxPts / rounds.length);
  const q = rounds[qIdx];

  function choose(opt: string) {
    if (selected !== null) return;
    setSelected(opt);

    const correct = opt === q.answer;
    const earned = correct ? ptsPerQ : 0;
    const newTotal = totalPts + earned;
    const newCorrect = correctCount + (correct ? 1 : 0);

    setTimeout(() => {
      if (qIdx + 1 >= rounds.length) {
        onClearRound?.();
        setDone(true);
        onFinish(newTotal > 0, newTotal);
      } else {
        setTotalPts(newTotal);
        setCorrectCount(newCorrect);
        const nextIdx = qIdx + 1;
        setQIdx(nextIdx);
        setSelected(null);
        onRoundAdvance?.(nextIdx);
      }
    }, 900);
  }

  if (done) return null;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <span style={{ fontSize: '13px', color: 'var(--muted)', letterSpacing: '2px' }}>
          QUESTION {qIdx + 1}/{rounds.length}
        </span>
        {!hidePts && <span style={{ fontWeight: 800, color: 'var(--gold)' }}>{totalPts} pts</span>}
      </div>

      <div className="challenge-question">{q.question}</div>

      <div className="options-grid">
        {q.options.map((opt, i) => {
          let cls = 'option-btn';
          if (selected !== null) {
            if (opt === q.answer) cls += ' correct';
            else if (opt === selected) cls += ' wrong';
          } else if (selected === opt) {
            cls += ' selected';
          }
          return (
            <button
              key={i}
              className={cls}
              disabled={selected !== null}
              onClick={() => choose(opt)}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}
