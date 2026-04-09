'use client';
import { useEffect, useRef, useState } from 'react';

const PAIRS = [
  { term: 'API', def: 'Interface for applications' },
  { term: 'CI/CD', def: 'Automated delivery pipeline' },
  { term: 'DNS', def: 'Domain Name System' },
  { term: 'JWT', def: 'JSON Web Token' },
  { term: 'ORM', def: 'Object-relational mapping' },
  { term: 'CDN', def: 'Content Delivery Network' },
];

type Card = { idx: number; pairId: number; type: 'term' | 'def'; text: string };

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

type Props = { onFinish: (correct: boolean) => void };

export default function MemoryGame({ onFinish }: Props) {
  const [cards] = useState<Card[]>(() => {
    const raw: Card[] = [];
    PAIRS.forEach((p, i) => {
      raw.push({ idx: i, pairId: i, type: 'term', text: p.term });
      raw.push({ idx: i + PAIRS.length, pairId: i, type: 'def', text: p.def });
    });
    return shuffle(raw).map((c, i) => ({ ...c, idx: i }));
  });

  const [flipped, setFlipped] = useState<number[]>([]);
  const [matched, setMatched] = useState<Set<number>>(new Set());
  const lockRef = useRef(false);

  function flip(i: number) {
    if (lockRef.current) return;
    if (flipped.includes(i)) return;
    if (matched.has(cards[i].pairId)) return;

    const next = [...flipped, i];
    setFlipped(next);

    if (next.length === 2) {
      lockRef.current = true;
      const [a, b] = next;
      if (cards[a].pairId === cards[b].pairId && cards[a].type !== cards[b].type) {
        const newMatched = new Set(matched);
        newMatched.add(cards[a].pairId);
        setTimeout(() => {
          setMatched(newMatched);
          setFlipped([]);
          lockRef.current = false;
          if (newMatched.size === PAIRS.length) onFinish(true);
        }, 400);
      } else {
        setTimeout(() => { setFlipped([]); lockRef.current = false; }, 900);
      }
    }
  }

  return (
    <>
      <div className="challenge-question">Find all matching pairs of IT terms and their definitions!</div>
      <div style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '16px' }}>
        Matched: <strong style={{ color: 'var(--accent)' }}>{matched.size}</strong> / {PAIRS.length}
      </div>
      <div className="memory-grid">
        {cards.map((c, i) => {
          const isFlipped = flipped.includes(i) || matched.has(c.pairId);
          const isMatched = matched.has(c.pairId);
          return (
            <div
              key={i}
              className={`memory-card${isFlipped ? ' flipped' : ''}${isMatched ? ' matched' : ''}`}
              onClick={() => flip(i)}
            >
              <div className="memory-inner">
                <div className="memory-front">?</div>
                <div className="memory-back">{c.text}</div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
