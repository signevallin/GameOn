'use client';
import { MISSIONS } from '@/lib/missions';
import { Team } from '@/lib/supabase';

type Props = {
  team: Team;
  onSelectMission: (id: string) => void;
  onLogout: () => void;
};

const DIFF_CLS: Record<string, string> = { easy: 'tag-easy', medium: 'tag-medium', hard: 'tag-hard' };
const DIFF_LABEL: Record<string, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };

export default function MissionsScreen({ team, onSelectMission, onLogout }: Props) {
  const categories = [...new Set(MISSIONS.map(m => m.category))];

  return (
    <>
      <nav className="nav">
        <div className="nav-brand">IT CHALLENGE</div>
        <div className="nav-right">
          <span className="nav-team">{team.name}</span>
          <span className="nav-score">⭐ {team.score} pts</span>
          <button className="btn btn-ghost" style={{ padding: '8px 16px', fontSize: '12px' }} onClick={onLogout}>
            LOG OUT
          </button>
        </div>
      </nav>

      <div className="container fade-in">
        <div style={{ padding: '40px 0 32px' }}>
          <h2>Choose your mission</h2>
          <p style={{ color: 'var(--muted)', marginTop: '8px', fontSize: '14px' }}>
            Faster answers = more points. Click a mission to begin.
          </p>
        </div>

        <div className="missions-grid">
          {categories.map(cat => {
            const catMissions = MISSIONS.filter(m => m.category === cat);
            const catIcon = cat === 'IT' ? '💻' : '🎉';
            return (
              <div key={cat} style={{ display: 'contents' }}>
                <div style={{ gridColumn: '1/-1', marginTop: '12px', marginBottom: '4px' }}>
                  <span style={{ fontSize: '12px', letterSpacing: '2px', color: 'var(--muted)', textTransform: 'uppercase' }}>
                    {catIcon} {cat} Missions
                  </span>
                </div>
                {catMissions.map(m => {
                  const done = team.completed?.includes(m.id);
                  return (
                    <div
                      key={m.id}
                      className={`mission-card${done ? ' done' : ''}`}
                      onClick={() => !done && onSelectMission(m.id)}
                    >
                      <span className="mission-icon">{m.icon}</span>
                      <div className="mission-name">{m.name}</div>
                      <div className="mission-desc">{m.desc}</div>
                      <div className="mission-meta">
                        <span className={`tag ${DIFF_CLS[m.difficulty]}`}>{DIFF_LABEL[m.difficulty]}</span>
                        <span className="mission-pts">up to {m.maxPts} pts</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
