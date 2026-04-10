'use client';
import { useCallback, useEffect, useState } from 'react';
import { MISSIONS } from '@/lib/missions';
import { Team, Game } from '@/lib/supabase';

type Props = {
  team: Team;
  game: Game;
  onSelectMission: (id: string) => void;
  onLogout: () => void;
  onTeamUpdate: (team: Team) => void;
  onGameUpdate: (game: Game) => void;
};

const DIFF_CLS: Record<string, string> = { easy: 'tag-easy', medium: 'tag-medium', hard: 'tag-hard' };
const DIFF_LABEL: Record<string, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };

function useCountdown(game: Game) {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  useEffect(() => {
    if (game.status !== 'active' || !game.started_at) { setSecondsLeft(null); return; }
    const endTime = new Date(game.started_at).getTime() + game.duration_minutes * 60 * 1000;
    const tick = () => setSecondsLeft(Math.max(0, Math.floor((endTime - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [game]);

  return secondsLeft;
}

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

export default function MissionsScreen({ team, game, onSelectMission, onLogout, onTeamUpdate, onGameUpdate }: Props) {
  const secondsLeft = useCountdown(game);
  const isFinished = game.status === 'finished' || (secondsLeft !== null && secondsLeft <= 0);
  const isDraft = game.status === 'draft';

  // Poll game status
  const pollGame = useCallback(async () => {
    try {
      const res = await fetch(`/api/game?key=${game.game_key}`);
      const data = await res.json();
      if (data.game) onGameUpdate(data.game);
    } catch { /* ignore */ }
  }, [game.game_key, onGameUpdate]);

  // Poll team score
  const pollTeam = useCallback(async () => {
    try {
      const res = await fetch(`/api/team/status?teamId=${team.id}`);
      const data = await res.json();
      if (data.team) onTeamUpdate(data.team);
    } catch { /* ignore */ }
  }, [team.id, onTeamUpdate]);

  useEffect(() => {
    const id = setInterval(() => { pollGame(); pollTeam(); }, 5000);
    return () => clearInterval(id);
  }, [pollGame, pollTeam]);

  const visibleMissions = MISSIONS.filter(m => game.missions.includes(m.id));
  const categories = [...new Set(visibleMissions.map(m => m.category))];

  // Countdown color
  const urgentTime = secondsLeft !== null && secondsLeft < 300;
  const timerColor = isFinished ? 'var(--accent2)' : urgentTime ? 'var(--gold)' : 'var(--accent3)';

  return (
    <>
      <nav className="nav">
        <div className="nav-brand">GAMEON</div>
        <div className="nav-right">
          <span className="nav-team">{team.name}</span>
          <span className="nav-score">⭐ {team.score} pts</span>
          {game.status === 'active' && secondsLeft !== null && (
            <span style={{
              fontFamily: "'Sora', sans-serif",
              fontWeight: 700,
              fontSize: '16px',
              color: timerColor,
              minWidth: '60px',
              textAlign: 'center',
              animation: urgentTime ? 'pulse 0.5s infinite alternate' : 'none',
            }}>
              ⏱ {formatTime(secondsLeft)}
            </span>
          )}
          <button className="btn btn-ghost" style={{ padding: '8px 16px', fontSize: '12px' }} onClick={onLogout}>
            LOG OUT
          </button>
        </div>
      </nav>

      <div className="container fade-in">
        {/* WAITING STATE */}
        {isDraft && (
          <div style={{ textAlign: 'center', padding: '80px 20px' }}>
            <div style={{ fontSize: '64px', marginBottom: '24px' }}>⏳</div>
            <h2 style={{ marginBottom: '12px' }}>Waiting for the game to start...</h2>
            <p style={{ color: 'var(--muted)', fontSize: '14px' }}>
              The admin will start the game shortly. The page updates automatically.
            </p>
            <div style={{
              display: 'inline-block',
              marginTop: '32px',
              padding: '12px 24px',
              background: 'var(--card)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              fontFamily: "'Sora', sans-serif",
              fontSize: '13px',
              color: 'var(--muted)',
            }}>
              Game: <strong style={{ color: 'var(--accent)', letterSpacing: '3px' }}>{game.game_key}</strong>
            </div>
          </div>
        )}

        {/* GAME OVER STATE */}
        {isFinished && (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <div style={{ fontSize: '64px', marginBottom: '24px' }}>🏁</div>
            <h2 style={{ marginBottom: '12px', color: 'var(--accent2)' }}>Time&apos;s up!</h2>
            <p style={{ color: 'var(--muted)', fontSize: '14px', marginBottom: '24px' }}>
              The game is over. Final score:
            </p>
            <div style={{ fontSize: '56px', fontWeight: 700, color: 'var(--gold)' }}>{team.score} pts</div>
          </div>
        )}

        {/* ACTIVE MISSIONS */}
        {!isDraft && !isFinished && (
          <>
            <div style={{ padding: '40px 0 32px' }}>
              <h2>Choose your mission</h2>
              <p style={{ color: 'var(--muted)', marginTop: '8px', fontSize: '14px' }}>
                Faster answers = more points. Click a mission to begin.
              </p>
            </div>

            <div className="missions-grid">
              {categories.map(cat => {
                const catMissions = visibleMissions.filter(m => m.category === cat);
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
          </>
        )}
      </div>
    </>
  );
}
