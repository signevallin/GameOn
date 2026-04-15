'use client';
import { useRef, useState } from 'react';

type Diff = { row: number; col: number };
type Scene = {
  name: string;
  cols: number;
  rows: number;
  gridA: string[][];
  gridB: string[][];
  diffs: Diff[]; // positions in gridB that differ from gridA
};

const SCENES: Scene[] = [
  {
    name: 'The Park',
    cols: 6, rows: 4,
    gridA: [
      ['☀️','🌤️','🌤️','🌤️','🌤️','🌤️'],
      ['🌳','🌳','🏠','🏠','🌳','🌳'],
      ['🌷','🌿','🚗','🌿','🌷','🌿'],
      ['🌱','🌱','🌱','🌱','🌱','🌱'],
    ],
    gridB: [
      ['🌙','🌤️','🌤️','🌤️','🌤️','🌤️'],  // ☀️→🌙
      ['🌳','🌳','🏡','🏠','🌳','🌳'],       // 🏠→🏡
      ['🌷','🌿','🚕','🌿','🌷','🌿'],       // 🚗→🚕
      ['🌱','🌱','🌱','🌱','🌱','🌱'],
    ],
    diffs: [{ row: 0, col: 0 }, { row: 1, col: 2 }, { row: 2, col: 2 }],
  },
  {
    name: 'The Harbour',
    cols: 6, rows: 4,
    gridA: [
      ['🌤️','🌤️','⛅','🌤️','🌤️','🌤️'],
      ['🌊','🚢','🌊','🌊','⛵','🌊'],
      ['🏖️','🏖️','🦀','🏖️','🏖️','🏖️'],
      ['🐚','🐚','🐚','🐚','🐚','🐚'],
    ],
    gridB: [
      ['🌤️','🌤️','⛈️','🌤️','🌤️','🌤️'],  // ⛅→⛈️
      ['🌊','🛳️','🌊','🌊','⛵','🌊'],       // 🚢→🛳️
      ['🏖️','🏖️','🐡','🏖️','🏖️','🏖️'],   // 🦀→🐡
      ['🐚','🐚','🐚','🐚','🐚','🐚'],
    ],
    diffs: [{ row: 0, col: 2 }, { row: 1, col: 1 }, { row: 2, col: 2 }],
  },
  {
    name: 'Outer Space',
    cols: 6, rows: 4,
    gridA: [
      ['⭐','⭐','🌙','⭐','⭐','⭐'],
      ['⭐','🚀','⭐','⭐','🪐','⭐'],
      ['⭐','⭐','⭐','👽','⭐','⭐'],
      ['🌑','⭐','⭐','⭐','⭐','🌑'],
    ],
    gridB: [
      ['⭐','⭐','☀️','⭐','⭐','⭐'],        // 🌙→☀️
      ['⭐','🚀','⭐','⭐','🌎','⭐'],        // 🪐→🌎
      ['⭐','⭐','⭐','🤖','⭐','⭐'],        // 👽→🤖
      ['🌑','⭐','⭐','⭐','⭐','🌑'],
    ],
    diffs: [{ row: 0, col: 2 }, { row: 1, col: 4 }, { row: 2, col: 3 }],
  },
];

const CELL_SIZE = 44; // px per cell

type Props = {
  maxPts: number;
  onFinish: (correct: boolean, pts?: number) => void;
};

export default function SpotDifference({ maxPts, onFinish }: Props) {
  const [scenes]           = useState(() => [...SCENES].sort(() => Math.random() - 0.5).slice(0, 2));
  const [sceneIdx, setSceneIdx]   = useState(0);
  const [found, setFound]         = useState<Diff[]>([]);
  const [wrong, setWrong]         = useState<{ row: number; col: number } | null>(null);
  const [totalPts, setTotalPts]   = useState(0);
  const wrongTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scene = scenes[sceneIdx];
  const ptsPerDiff = Math.round(maxPts / (scenes.length * scene.diffs.length));

  function handleClickB(row: number, col: number) {
    const isDiff = scene.diffs.some(d => d.row === row && d.col === col);
    const alreadyFound = found.some(d => d.row === row && d.col === col);
    if (alreadyFound) return;

    if (isDiff) {
      const newFound = [...found, { row, col }];
      const newTotal = totalPts + ptsPerDiff;
      setFound(newFound);
      setTotalPts(newTotal);

      if (newFound.length >= scene.diffs.length) {
        // Scene complete
        setTimeout(() => {
          if (sceneIdx + 1 >= scenes.length) {
            onFinish(true, newTotal);
          } else {
            setSceneIdx(i => i + 1);
            setFound([]);
          }
        }, 900);
      }
    } else {
      // Wrong click
      setWrong({ row, col });
      if (wrongTimer.current) clearTimeout(wrongTimer.current);
      wrongTimer.current = setTimeout(() => setWrong(null), 700);
    }
  }

  function cellStyle(row: number, col: number, side: 'A' | 'B'): React.CSSProperties {
    const isFound = side === 'B' && found.some(d => d.row === row && d.col === col);
    const isWrong = side === 'B' && wrong?.row === row && wrong?.col === col;
    return {
      width: CELL_SIZE, height: CELL_SIZE,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 26,
      cursor: side === 'B' ? 'pointer' : 'default',
      background: isFound ? 'rgba(140,191,155,0.25)' : isWrong ? 'rgba(208,117,125,0.25)' : 'transparent',
      border: isFound ? '2px solid var(--accent3)' : isWrong ? '2px solid var(--accent2)' : '2px solid transparent',
      borderRadius: 8,
      transition: 'background 0.15s, border-color 0.15s',
      userSelect: 'none',
    };
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
        <span style={{ fontSize: '13px', color: 'var(--muted)', letterSpacing: '2px' }}>
          BILD {sceneIdx + 1}/{scenes.length} · {scene.name}
        </span>
        <span style={{ fontWeight: 800, color: 'var(--gold)' }}>{totalPts} pts</span>
      </div>

      <p style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '16px' }}>
        Click on the <strong style={{ color: 'var(--text)' }}>right image</strong> to mark the differences.
        {' '}<span style={{ color: 'var(--gold)' }}>{found.length}/{scene.diffs.length} found</span>
      </p>

      <div style={{ overflowX: 'auto', marginBottom: '8px' }}>
        <div style={{ display: 'flex', gap: '16px', minWidth: 'fit-content' }}>
          {/* Panel A — Original */}
          <div>
            <div style={{ fontSize: '11px', color: 'var(--muted)', letterSpacing: '1px', marginBottom: '6px', textAlign: 'center' }}>
              ORIGINAL
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${scene.cols}, ${CELL_SIZE}px)`,
              border: '1px solid var(--border)',
              borderRadius: 10, overflow: 'hidden',
              background: 'var(--surface)',
            }}>
              {scene.gridA.flat().map((emoji, idx) => {
                const row = Math.floor(idx / scene.cols);
                const col = idx % scene.cols;
                return (
                  <div key={idx} style={cellStyle(row, col, 'A')}>{emoji}</div>
                );
              })}
            </div>
          </div>

          {/* Panel B — Find differences */}
          <div>
            <div style={{ fontSize: '11px', color: 'var(--muted)', letterSpacing: '1px', marginBottom: '6px', textAlign: 'center' }}>
              FIND DIFFERENCES →
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${scene.cols}, ${CELL_SIZE}px)`,
              border: '1px solid var(--border)',
              borderRadius: 10, overflow: 'hidden',
              background: 'var(--surface)',
            }}>
              {scene.gridB.flat().map((emoji, idx) => {
                const row = Math.floor(idx / scene.cols);
                const col = idx % scene.cols;
                return (
                  <div key={idx} style={cellStyle(row, col, 'B')} onClick={() => handleClickB(row, col)}>
                    {emoji}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Found indicators */}
      <div style={{ display: 'flex', gap: '8px', marginTop: '16px', justifyContent: 'center' }}>
        {scene.diffs.map((_, i) => (
          <div key={i} style={{
            width: 28, height: 28, borderRadius: '50%',
            background: i < found.length ? 'var(--accent3)' : 'var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '14px', transition: 'background 0.3s',
          }}>
            {i < found.length ? '✓' : ''}
          </div>
        ))}
      </div>
    </div>
  );
}
