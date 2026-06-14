'use client';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';

type Item = { label: string; year: number };

const DEFAULT_ITEMS: Item[] = [
  { label: 'Titanic sinks',              year: 1912 },
  { label: 'Moon landing – Apollo 11',   year: 1969 },
  { label: 'Fall of the Berlin Wall',    year: 1989 },
  { label: 'World Wide Web launched',    year: 1991 },
  { label: 'First iPhone released',      year: 2007 },
];

type Props = {
  maxPts: number;
  items?: Item[];
  teamId?: string;
  missionId?: string;
  onFinish: (correct: boolean, pts?: number) => void;
};

export default function TimelineSort({ maxPts, items, teamId, missionId, onFinish }: Props) {
  const TIMELINE_ITEMS = items ?? DEFAULT_ITEMS;
  const [order, setOrder]         = useState<Item[]>(() => [...TIMELINE_ITEMS].sort(() => Math.random() - 0.5));
  const [submitted, setSubmitted] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [teamDone, setTeamDone]   = useState(false);

  const submittedRef = useRef(false);
  const channelRef   = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // In remote mode, listen for a teammate's submission.
  // When received, show a waiting overlay — the nav-sync broadcast from
  // the submitter's navigateSync(null) will pull us back to missions a
  // moment later, so we don't need to call onFinish ourselves.
  useEffect(() => {
    if (!teamId || !missionId) return;
    const channel = supabase
      .channel(`timeline-sync-${teamId}-${missionId}`)
      .on('broadcast', { event: 'done' }, () => {
        if (!submittedRef.current) setTeamDone(true);
      })
      .subscribe();
    channelRef.current = channel;
    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [teamId, missionId]);

  function moveItem(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= order.length) return;
    const next = [...order];
    [next[i], next[j]] = [next[j], next[i]];
    setOrder(next);
  }

  function submit() {
    if (submittedRef.current) return;
    submittedRef.current = true;

    const sorted = [...TIMELINE_ITEMS].sort((a, b) => a.year - b.year);
    let correct = 0;
    order.forEach((item, i) => { if (item.year === sorted[i].year) correct++; });
    const pts = Math.round(maxPts * correct / TIMELINE_ITEMS.length);
    setCorrectCount(correct);
    setSubmitted(true);

    // Notify teammates so they see a waiting overlay while we finish.
    channelRef.current?.send({ type: 'broadcast', event: 'done', payload: {} });

    setTimeout(() => onFinish(correct > 0, pts), 2200);
  }

  if (submitted) {
    const sorted = [...TIMELINE_ITEMS].sort((a, b) => a.year - b.year);
    return (
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '52px', marginBottom: '12px' }}>
          {correctCount === TIMELINE_ITEMS.length ? '🏆' : correctCount >= 3 ? '👍' : '😅'}
        </div>
        <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--gold)', marginBottom: '20px' }}>
          {correctCount}/{TIMELINE_ITEMS.length} in the right place!
        </div>
        <div style={{ textAlign: 'left' }}>
          {sorted.map((item, i) => {
            const wasCorrect = order[i]?.year === item.year;
            return (
              <div key={item.year} style={{
                padding: '10px 16px', marginBottom: '6px', borderRadius: '8px',
                background: wasCorrect ? 'rgba(140,191,155,0.12)' : 'rgba(208,117,125,0.10)',
                border: `1px solid ${wasCorrect ? 'var(--accent3)' : 'var(--accent2)'}`,
                fontSize: '13px', display: 'flex', justifyContent: 'space-between', gap: '12px',
              }}>
                <span>{i + 1}. {item.label}</span>
                <span style={{ color: 'var(--gold)', fontWeight: 700, flexShrink: 0 }}>{item.year}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative' }}>
      {teamDone && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 10,
          background: 'rgba(var(--surface-rgb, 18,18,26), 0.85)',
          borderRadius: '12px',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: '8px',
        }}>
          <div style={{ fontSize: '36px' }}>⏳</div>
          <div style={{ fontWeight: 700, fontSize: '15px' }}>Team submitted — loading result…</div>
        </div>
      )}

      <p style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '20px', lineHeight: 1.6 }}>
        Sort the events in chronological order — oldest at the top, newest at the bottom.<br />
        Use <strong>▲ ▼</strong> to move items.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px' }}>
        {order.map((item, i) => (
          <div
            key={item.year}
            style={{
              display: 'flex', alignItems: 'center', gap: '12px',
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: '10px', padding: '14px 16px',
            }}
          >
            <span style={{ color: 'var(--muted)', fontSize: '12px', fontWeight: 700, minWidth: '22px' }}>
              {i + 1}.
            </span>
            <span style={{ flex: 1, fontSize: '14px', lineHeight: 1.4 }}>{item.label}</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0px' }}>
              <button
                onClick={() => moveItem(i, -1)}
                disabled={i === 0}
                style={{
                  background: 'none', border: 'none', padding: '2px 8px',
                  cursor: i === 0 ? 'default' : 'pointer',
                  color: i === 0 ? 'var(--border)' : 'var(--accent)',
                  fontSize: '18px', lineHeight: 1, fontFamily: 'Sora, sans-serif',
                }}
              >▲</button>
              <button
                onClick={() => moveItem(i, 1)}
                disabled={i === order.length - 1}
                style={{
                  background: 'none', border: 'none', padding: '2px 8px',
                  cursor: i === order.length - 1 ? 'default' : 'pointer',
                  color: i === order.length - 1 ? 'var(--border)' : 'var(--accent)',
                  fontSize: '18px', lineHeight: 1, fontFamily: 'Sora, sans-serif',
                }}
              >▼</button>
            </div>
          </div>
        ))}
      </div>

      <button className="btn btn-primary btn-full" onClick={submit} disabled={teamDone}>
        CONFIRM ORDER ✓
      </button>
    </div>
  );
}
