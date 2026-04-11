'use client';
import { useEffect, useState } from 'react';
import { MISSIONS } from '@/lib/missions';
import { Team, Game } from '@/lib/supabase';

type Notification = { type: string; message: string };

function NotificationOverlay({ notification, teamId, onDismiss }: {
  notification: Notification;
  teamId: string;
  onDismiss: () => void;
}) {
  const [loading, setLoading] = useState(false);

  async function ack() {
    setLoading(true);
    try {
      const res = await fetch('/api/team/ack-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId }),
        cache: 'no-store',
      });
      if (res.ok) onDismiss();
    } finally {
      setLoading(false);
    }
  }

  const CONFIG: Record<string, { emoji: string; title: string; btnLabel: string; color: string }> = {
    sabotage: { emoji: '💥', title: 'SABOTAGE!', btnLabel: 'OK', color: 'var(--accent2)' },
    double_points: { emoji: '🎉', title: 'POWER-UP!', btnLabel: "LET'S GO!", color: 'var(--accent3)' },
    fake_hint: { emoji: '🔍', title: 'SECRET TIP', btnLabel: 'OK', color: 'var(--accent)' },
  };

  const cfg = CONFIG[notification.type] ?? CONFIG.fake_hint;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.75)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px',
    }}>
      <div style={{
        background: 'var(--card)',
        border: `2px solid ${cfg.color}`,
        borderRadius: '16px',
        padding: '40px 32px',
        maxWidth: '380px',
        width: '100%',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: '56px', marginBottom: '16px' }}>{cfg.emoji}</div>
        <h2 style={{ color: cfg.color, marginBottom: '16px', letterSpacing: '2px' }}>{cfg.title}</h2>
        <p style={{ fontSize: '15px', color: 'var(--text)', marginBottom: '32px', lineHeight: 1.6 }}>
          {notification.message}
        </p>
        <button
          className="btn btn-primary"
          style={{ padding: '12px 32px', fontSize: '14px' }}
          onClick={ack}
          disabled={loading}
        >
          {loading ? '...' : cfg.btnLabel}
        </button>
      </div>
    </div>
  );
}

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

// Format elapsed seconds as e.g. "1h 23m 45s" or "23m 45s"
function formatElapsed(ms: number) {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m ${sec}s`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

export default function MissionsScreen({ team, game, onSelectMission, onLogout, onTeamUpdate }: Props) {
  const secondsLeft = useCountdown(game);
  const isFinished = game.status === 'finished' || (secondsLeft !== null && secondsLeft <= 0);
  const isDraft = game.status === 'draft';
  const [finishing, setFinishing] = useState(false);
  const [notification, setNotification] = useState<Notification | null>(
    team.pending_notification ?? null
  );

  useEffect(() => {
    if (team.pending_notification) {
      setNotification(team.pending_notification);
    }
  }, [team.pending_notification]);

  const visibleMissions = MISSIONS.filter(m => game.missions.includes(m.id));
  const categories = [...new Set(visibleMissions.map(m => m.category))];
  const allDone = visibleMissions.every(m => team.completed?.includes(m.id));
  const alreadyFinished = Boolean(team.finished_at);

  // Countdown color
  const urgentTime = secondsLeft !== null && secondsLeft < 300;
  const timerColor = isFinished ? 'var(--accent2)' : urgentTime ? 'var(--gold)' : 'var(--accent3)';

  async function markDone() {
    setFinishing(true);
    try {
      const res = await fetch('/api/team/finish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId: team.id }),
        cache: 'no-store',
      });
      const data = await res.json();
      if (data.team) onTeamUpdate(data.team);
    } finally {
      setFinishing(false);
    }
  }

  // Elapsed time from game start to team finish
  const elapsedText = alreadyFinished && team.finished_at && game.started_at
    ? formatElapsed(new Date(team.finished_at).getTime() - new Date(game.started_at).getTime())
    : null;

  return (
    <>
      {notification && (
        <NotificationOverlay
          notification={notification}
          teamId={team.id}
          onDismiss={() => setNotification(null)}
        />
      )}
      <nav className="nav" style={{ gap: '4px' }}>
        {/* Team name – left */}
        <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)', flex: '1', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {team.name}
        </span>

        {/* Score – center */}
        <span style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: '14px', color: 'var(--gold)', flexShrink: 0, textAlign: 'center', padding: '0 8px' }}>
          ⭐ {team.score}
        </span>

        {/* Timer – center-right, only when active */}
        {game.status === 'active' && secondsLeft !== null ? (
          <span style={{
            fontFamily: "'Sora', sans-serif",
            fontWeight: 700,
            fontSize: '14px',
            color: timerColor,
            flexShrink: 0,
            padding: '0 8px',
            animation: urgentTime ? 'pulse 0.5s infinite alternate' : 'none',
          }}>
            ⏱ {formatTime(secondsLeft)}
          </span>
        ) : (
          <span style={{ flexShrink: 0, width: '60px' }} />
        )}

        {/* Logout – right */}
        <button className="btn btn-ghost" style={{ padding: '6px 12px', fontSize: '11px', flexShrink: 0 }} onClick={onLogout}>
          LOG OUT
        </button>
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
            {elapsedText && (
              <p style={{ color: 'var(--muted)', fontSize: '13px', marginTop: '12px' }}>
                Finished in <strong style={{ color: 'var(--accent3)' }}>{elapsedText}</strong>
              </p>
            )}
          </div>
        )}

        {/* ACTIVE MISSIONS */}
        {!isDraft && !isFinished && (
          <>
            <div style={{ padding: '40px 0 32px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
              <div>
                <h2>Choose your mission</h2>
                <p style={{ color: 'var(--muted)', marginTop: '8px', fontSize: '14px' }}>
                  Faster answers = more points. Click a mission to begin.
                </p>
              </div>

              {/* Mark all done button */}
              {alreadyFinished ? (
                <div style={{
                  padding: '12px 20px',
                  background: 'rgba(140,191,155,0.12)',
                  border: '1px solid var(--accent3)',
                  borderRadius: '10px',
                  color: 'var(--accent3)',
                  fontWeight: 700,
                  fontSize: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}>
                  ✅ All done!{elapsedText ? ` · ${elapsedText}` : ''}
                </div>
              ) : (
                <button
                  onClick={markDone}
                  disabled={finishing}
                  style={{
                    padding: '12px 24px',
                    borderRadius: '10px',
                    border: `2px solid ${allDone ? 'var(--accent3)' : 'var(--border)'}`,
                    background: allDone ? 'rgba(140,191,155,0.12)' : 'var(--card)',
                    color: allDone ? 'var(--accent3)' : 'var(--muted)',
                    fontFamily: "'Sora', sans-serif",
                    fontWeight: 700,
                    fontSize: '14px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    opacity: finishing ? 0.6 : 1,
                  }}
                >
                  {finishing ? '...' : '🏁 We\'re done!'}
                </button>
              )}
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
