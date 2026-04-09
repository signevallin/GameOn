'use client';
import { useState } from 'react';

type Props = { onFinish: (correct: boolean) => void };

const TARGET = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function Puzzle({ onFinish }: Props) {
  const [arr, setArr] = useState(() => shuffle(TARGET));
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const [wrongPos, setWrongPos] = useState<boolean[]>([]);

  function drop(i: number) {
    if (dragIdx === null || dragIdx === i) return;
    const next = [...arr];
    [next[dragIdx], next[i]] = [next[i], next[dragIdx]];
    setArr(next);
    setDragIdx(null);
    setOverIdx(null);
    setWrongPos([]);
  }

  function check() {
    const correct = arr.every((n, i) => n === TARGET[i]);
    if (correct) { onFinish(true); return; }
    setWrongPos(arr.map((n, i) => n !== TARGET[i]));
  }

  return (
    <>
      <div className="challenge-question">
        Sort the numbers <strong>1–16</strong> in the correct order by dragging and dropping!
      </div>
      <div className="puzzle-grid">
        {arr.map((n, i) => {
          let cls = 'puzzle-piece';
          if (dragIdx === i) cls += ' dragging';
          if (overIdx === i && overIdx !== dragIdx) cls += ' drag-over';
          if (wrongPos[i] === false) cls += ' correct-pos';
          return (
            <div
              key={i}
              className={cls}
              draggable
              onDragStart={() => setDragIdx(i)}
              onDragOver={e => { e.preventDefault(); setOverIdx(i); }}
              onDrop={() => drop(i)}
              onDragEnd={() => { setDragIdx(null); setOverIdx(null); }}
            >
              {n}
            </div>
          );
        })}
      </div>
      <button className="btn btn-primary" onClick={check}>CHECK →</button>
    </>
  );
}
