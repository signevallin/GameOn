'use client';
import { useEffect, useRef, useState } from 'react';
import { MISSIONS } from '@/lib/missions';
import { Team, Game } from '@/lib/supabase';
import { SUPER_CATEGORIES, MISSION_SUPER_CATEGORY, SuperCategoryKey } from '@/lib/superCategories';
import TeamPowerupsScreen from '@/components/screens/TeamPowerupsScreen';

type Notification = { type: string; message: string };

// ── Confetti ──────────────────────────────────────────────────────────────────
const CONFETTI_COLORS = ['#00e5ff', '#8cf5b5', '#debb6b', '#d0757d', '#b084cc', '#ff9f43'];

function Confetti() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const pieces = Array.from({ length: 120 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * -canvas.height,
      w: Math.random() * 10 + 6,
      h: Math.random() * 6 + 4,
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      rot: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.08,
      vx: (Math.random() - 0.5) * 2,
      vy: Math.random() * 3 + 2,
    }));

    let animId: number;
    function draw() {
      ctx.clearRect(0, 0, canvas!.width, canvas!.height);
      for (const p of pieces) {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.rotSpeed;
        if (p.y > canvas!.height) {
          p.y = -20;
          p.x = Math.random() * canvas!.width;
        }
      }
      animId = requestAnimationFrame(draw);
    }
    draw();
    return () => cancelAnimationFrame(animId);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 800 }}
    />
  );
}

// ── Notification overlay ──────────────────────────────────────────────────────
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
    sabotage:        { emoji: '💻', title: 'YOU HAVE BEEN HACKED!',  btnLabel: 'OK',        color: 'var(--accent2)' },
    double_points:   { emoji: '🎯', title: 'POWER-UP!',              btnLabel: "LET'S GO!", color: 'var(--accent3)' },
    final_frenzy:    { emoji: '🔥', title: 'FINAL FRENZY!',          btnLabel: "LET'S GO!", color: 'var(--gold)' },
    fake_hint:       { emoji: '🔍', title: 'SECRET TIP',             btnLabel: 'OK',        color: 'var(--accent)' },
    photo_rated:     { emoji: '📸', title: 'PHOTO RATED!',           btnLabel: 'NICE!',     color: 'var(--accent3)' },
    powerup_self:    { emoji: '⚡', title: 'POWER-UP ACTIVATED!',    btnLabel: "LET'S GO!", color: 'var(--accent3)' },
    powerup_received:{ emoji: '😈', title: 'INCOMING ATTACK!',       btnLabel: 'DAMN IT!',  color: 'var(--accent2)' },
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

// ── Leaderboard inline view ───────────────────────────────────────────────────
const RANK_ICONS = ['🥇', '🥈', '🥉'];
const RANK_COLORS = ['var(--gold)', 'var(--silver)', 'var(--bronze)'];

function LeaderboardView({ teams, myTeamId, totalMissions }: {
  teams: Team[];
  myTeamId: string;
  totalMissions: number;
}) {
  const sorted = [...teams].sort((a, b) => b.score - a.score);
  const myRank = sorted.findIndex(t => t.id === myTeamId);
  const myTeam = sorted[myRank];
  const leader = sorted[0];
  const gap = myTeam && leader && leader.id !== myTeamId ? leader.score - myTeam.score : 0;
  const maxScore = leader?.score || 1;

  return (
    <div style={{ paddingBottom: '32px' }}>
      {/* My position callout */}
      {myTeam && (
        <div style={{
          padding: '16px',
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderLeft: '3px solid var(--accent)',
          borderRadius: '12px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: '16px',
        }}>
          <div>
            <div style={{ fontSize: '11px', color: 'var(--muted)', letterSpacing: '1.5px', fontWeight: 700, textTransform: 'uppercase' }}>Your team</div>
            <div style={{ fontWeight: 800, fontSize: '16px', color: 'var(--text)', marginTop: '3px' }}>{myTeam.name}</div>
            <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '3px' }}>
              {myRank === 0 ? '🔥 Leading!' : gap > 0 ? `${gap} pts behind #1` : 'Tied for lead'}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontWeight: 800, fontSize: '26px', color: 'var(--gold)', lineHeight: 1 }}>{myTeam.score}</div>
            <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '3px' }}>pts · #{myRank + 1}</div>
          </div>
        </div>
      )}

      {/* Rankings */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {sorted.map((t, i) => {
          const isMe = t.id === myTeamId;
          const missionsDone = t.completed?.length ?? 0;
          const barPct = maxScore > 0 ? Math.max(4, Math.round((t.score / maxScore) * 100)) : 4;
          const barColor = i === 0 ? 'var(--gold)' : i === 1 ? 'var(--silver)' : i === 2 ? 'var(--bronze)' : 'var(--muted)';

          return (
            <div
              key={t.id}
              style={{
                padding: '12px 14px',
                background: 'var(--card)',
                border: `1px solid ${isMe ? 'var(--accent)' : 'var(--border)'}`,
                borderRadius: '12px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                <div style={{
                  width: '28px', flexShrink: 0, textAlign: 'center',
                  fontSize: i < 3 ? '18px' : '13px',
                  fontWeight: 800,
                  color: RANK_COLORS[i] ?? 'var(--muted)',
                }}>
                  {i < 3 ? RANK_ICONS[i] : i + 1}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontWeight: 700, fontSize: '14px',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    color: isMe ? 'var(--accent)' : 'var(--text)',
                  }}>
                    {t.name}{isMe ? ' · you' : ''}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>
                    {missionsDone}/{totalMissions} missions{t.finished_at ? ' · 🏁' : ''}
                  </div>
                </div>

                <div style={{ fontWeight: 800, fontSize: '17px', color: i === 0 ? 'var(--gold)' : 'var(--text)', flexShrink: 0 }}>
                  {t.score}
                </div>
              </div>

              {/* Score bar */}
              <div style={{ height: '3px', background: 'var(--border)', borderRadius: '2px', overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${barPct}%`,
                  background: isMe ? 'var(--accent)' : barColor,
                  borderRadius: '2px',
                  transition: 'width 0.6s ease',
                }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── End screen ────────────────────────────────────────────────────────────────
function EndScreen({ team, teams, game, onLogout }: { team: Team; teams: Team[]; game: Game; onLogout: () => void }) {
  const sorted = [...teams].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const fa = a.finished_at ? new Date(a.finished_at).getTime() : Infinity;
    const fb = b.finished_at ? new Date(b.finished_at).getTime() : Infinity;
    return fa - fb;
  });

  const winner = sorted[0];
  const myRank = sorted.findIndex(t => t.id === team.id) + 1;
  const isWinner = winner?.id === team.id;

  function bestMission(t: Team): { name: string; pts: number } | null {
    const scores = t.mission_scores as Record<string, number> | null;
    if (!scores) return null;
    const entries = Object.entries(scores);
    if (entries.length === 0) return null;
    const [mId, pts] = entries.sort(([, a], [, b]) => b - a)[0];
    const m = MISSIONS.find(x => x.id === mId);
    return { name: m ? `${m.icon} ${m.name}` : mId, pts };
  }

  const elapsedText = team.finished_at && game.started_at
    ? formatElapsed(new Date(team.finished_at).getTime() - new Date(game.started_at).getTime())
    : null;

  return (
    <>
      {isWinner && <Confetti />}

      <div style={{ padding: '32px 20px 48px', maxWidth: '560px', margin: '0 auto' }}>

        {/* Winner announcement */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ fontSize: '64px', marginBottom: '12px' }}>
            {isWinner ? '🏆' : myRank === 2 ? '🥈' : myRank === 3 ? '🥉' : '🏁'}
          </div>
          <h2 style={{ fontSize: '22px', marginBottom: '8px' }}>
            {isWinner ? 'You won!' : `${myRank}${myRank === 2 ? 'nd' : myRank === 3 ? 'rd' : 'th'} place`}
          </h2>
          {winner && !isWinner && (
            <p style={{ color: 'var(--muted)', fontSize: '14px' }}>
              🏆 <strong style={{ color: 'var(--gold)' }}>{winner.name}</strong> won with {winner.score} pts
            </p>
          )}
          <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <span style={{ fontSize: '40px', fontWeight: 800, color: 'var(--gold)' }}>{team.score}</span>
            <span style={{ color: 'var(--muted)', fontSize: '16px' }}>pts</span>
          </div>
          {elapsedText && (
            <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '6px' }}>
              Finished in <strong style={{ color: 'var(--accent3)' }}>{elapsedText}</strong>
            </div>
          )}
        </div>

        {/* Final rankings */}
        <div style={{ marginBottom: '28px' }}>
          <div style={{ fontSize: '11px', color: 'var(--muted)', letterSpacing: '1.5px', fontWeight: 700, marginBottom: '12px' }}>
            FINAL STANDINGS
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {sorted.map((t, i) => {
              const isMe = t.id === team.id;
              const best = bestMission(t);
              return (
                <div
                  key={t.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    padding: '12px 16px',
                    background: isMe ? 'var(--accent-dim)' : 'var(--card)',
                    border: `1px solid ${isMe ? 'var(--accent-border)' : i === 0 ? 'var(--gold-dim)' : 'var(--border)'}`,
                    borderRadius: '12px',
                  }}
                >
                  <div style={{
                    width: '28px', flexShrink: 0, textAlign: 'center',
                    fontSize: i < 3 ? '20px' : '13px',
                    fontWeight: 800,
                    color: RANK_COLORS[i] ?? 'var(--muted)',
                  }}>
                    {i < 3 ? RANK_ICONS[i] : i + 1}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontWeight: 700, fontSize: '14px',
                      color: isMe ? 'var(--accent)' : i === 0 ? 'var(--gold)' : 'var(--text)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {t.name}{isMe ? ' (you)' : ''}
                    </div>
                    {best && (
                      <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>
                        Best: {best.name} · {best.pts} pts
                      </div>
                    )}
                  </div>

                  <div style={{ fontWeight: 800, fontSize: '17px', color: i === 0 ? 'var(--gold)' : 'var(--text)', flexShrink: 0 }}>
                    {t.score}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* My stats */}
        <div style={{
          padding: '20px',
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: '14px',
          marginBottom: '32px',
        }}>
          <div style={{ fontSize: '11px', color: 'var(--muted)', letterSpacing: '1.5px', fontWeight: 700, marginBottom: '14px' }}>YOUR GAME</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            {[
              { label: 'Score', value: `${team.score} pts`, color: 'var(--gold)' },
              { label: 'Missions done', value: `${team.completed?.length ?? 0}`, color: 'var(--accent3)' },
              { label: 'Rank', value: `#${myRank} of ${teams.length}`, color: 'var(--accent)' },
              { label: 'Best mission', value: (() => { const b = bestMission(team); return b ? `${b.pts} pts` : '—'; })(), color: 'var(--text)' },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ background: 'var(--surface)', borderRadius: '10px', padding: '12px 14px' }}>
                <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '4px' }}>{label}</div>
                <div style={{ fontWeight: 800, fontSize: '16px', color }}>{value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Logout / new game */}
        <button
          onClick={onLogout}
          style={{
            width: '100%',
            padding: '14px',
            background: 'transparent',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            color: 'var(--muted)',
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer',
            letterSpacing: '0.5px',
          }}
        >
          ↩ Leave & start new game
        </button>
      </div>
    </>
  );
}

// ── Main props ────────────────────────────────────────────────────────────────
type Props = {
  team: Team;
  game: Game;
  teams: Team[];
  onSelectMission: (id: string) => void;
  onLogout: () => void;
  onTeamUpdate: (team: Team) => void;
  onGameUpdate: (game: Game) => void;
};

const DIFF_CLS: Record<string, string>   = { easy: 'tag-easy', medium: 'tag-medium', hard: 'tag-hard' };
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

function formatElapsed(ms: number) {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m ${sec}s`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

// ── Screen ────────────────────────────────────────────────────────────────────
export default function MissionsScreen({ team, game, teams, onSelectMission, onLogout, onTeamUpdate }: Props) {
  const secondsLeft = useCountdown(game);
  const isFinished = game.status === 'finished' || (secondsLeft !== null && secondsLeft <= 0);
  const isDraft = game.status === 'draft';
  const [finishing, setFinishing] = useState(false);
  const [confirmDone, setConfirmDone] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<SuperCategoryKey | null>(null);
  const [showPowerups, setShowPowerups] = useState(false);
  const [activeTab, setActiveTab] = useState<'missions' | 'leaderboard'>('missions');

  // Freeze effect
  const effects = team.active_effects ?? {};
  const freezeUntil = effects.freeze_until ? new Date(effects.freeze_until) : null;
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, []);
  const isFrozen = freezeUntil ? freezeUntil.getTime() > now : false;
  const freezeSecsLeft = isFrozen ? Math.ceil((freezeUntil!.getTime() - now) / 1000) : 0;
  const [notification, setNotification] = useState<Notification | null>(
    team.pending_notification ?? null
  );

  useEffect(() => {
    if (team.pending_notification) setNotification(team.pending_notification);
  }, [team.pending_notification]);

  const visibleMissions = MISSIONS.filter(m => game.missions.includes(m.id));
  const allDone = visibleMissions.every(m => team.completed?.includes(m.id));
  const totalPowerups = 4; // shield, freeze, double_trouble, all_in
  const usedPowerups = (team.team_powerups_used ?? []).length;
  const availablePowerups = totalPowerups - usedPowerups;
  const alreadyFinished = Boolean(team.finished_at);
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

  const elapsedText = alreadyFinished && team.finished_at && game.started_at
    ? formatElapsed(new Date(team.finished_at).getTime() - new Date(game.started_at).getTime())
    : null;

  // Build per-super-category stats from visible missions
  const categoryStats = (Object.keys(SUPER_CATEGORIES) as SuperCategoryKey[]).map(key => {
    const missions = visibleMissions.filter(m => MISSION_SUPER_CATEGORY[m.id] === key);
    if (missions.length === 0) return null;
    const pts = missions.map(m => game.mission_max_pts?.[m.id] ?? m.maxPts);
    const minPts = Math.min(...pts);
    const maxPts = Math.max(...pts);
    const doneMissions = missions.filter(m => team.completed?.includes(m.id));
    return { key, missions, minPts, maxPts, done: doneMissions.length };
  }).filter(Boolean) as { key: SuperCategoryKey; missions: typeof visibleMissions; minPts: number; maxPts: number; done: number }[];

  return (
    <>
      {notification && (
        <NotificationOverlay
          notification={notification}
          teamId={team.id}
          onDismiss={() => setNotification(null)}
        />
      )}

      {/* FREEZE overlay */}
      {isFrozen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 900, background: 'rgba(10,30,60,0.92)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
          <div style={{ fontSize: '72px' }}>❄️</div>
          <h2 style={{ color: '#7ec8e3', letterSpacing: '2px' }}>YOU ARE FROZEN</h2>
          <p style={{ color: 'var(--muted)', fontSize: '14px' }}>Another team froze you!</p>
          <div style={{ fontFamily: "'Sora', sans-serif", fontSize: '48px', fontWeight: 800, color: '#7ec8e3' }}>{freezeSecsLeft}s</div>
        </div>
      )}

      <nav className="nav" style={{ justifyContent: 'space-between' }}>
        {/* Team name + power-up */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', minWidth: 0, flex: 1 }}>
          <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {team.name}
          </span>
          {!isDraft && !isFinished && (
            <button
              onClick={() => setShowPowerups(true)}
              aria-label="Power-Ups"
              style={{
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                background: availablePowerups > 0 ? 'rgba(255,200,0,0.12)' : 'rgba(255,255,255,0.05)',
                border: `1px solid ${availablePowerups > 0 ? 'var(--gold)' : 'var(--border)'}`,
                borderRadius: '20px',
                padding: '4px 10px 4px 7px',
                cursor: 'pointer',
                color: availablePowerups > 0 ? 'var(--gold)' : 'var(--muted)',
                fontFamily: "'Sora', sans-serif",
                fontWeight: 700,
                fontSize: '12px',
                letterSpacing: '0.5px',
                lineHeight: 1,
                transition: 'all 0.2s',
              }}
            >
              <span style={{ fontSize: '14px', lineHeight: 1 }}>⚡</span>
              <span>{availablePowerups > 0 ? `${availablePowerups} left` : 'Used'}</span>
            </button>
          )}
        </div>

        {/* Score — centered */}
        <span style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: '14px', color: 'var(--gold)', whiteSpace: 'nowrap' }}>
          ⭐ {team.score}
        </span>

        {/* Timer — right aligned */}
        {game.status === 'active' && secondsLeft !== null ? (
          <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
            <span style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: '14px', color: timerColor, animation: urgentTime ? 'pulse 0.5s infinite alternate' : 'none' }}>
              ⏱ {formatTime(secondsLeft)}
            </span>
          </div>
        ) : (
          <div style={{ flex: 1 }} />
        )}
      </nav>

      <div className="container fade-in">

        {/* WAITING */}
        {isDraft && (
          <div style={{ textAlign: 'center', padding: '80px 20px' }}>
            <div style={{ fontSize: '64px', marginBottom: '24px' }}>⏳</div>
            <h2 style={{ marginBottom: '12px' }}>Waiting for the game to start...</h2>
            <p style={{ color: 'var(--muted)', fontSize: '14px' }}>The admin will start the game shortly.</p>
            <div style={{ display: 'inline-block', marginTop: '32px', padding: '12px 24px', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px', fontFamily: "'Sora', sans-serif", fontSize: '13px', color: 'var(--muted)' }}>
              Game: <strong style={{ color: 'var(--accent)', letterSpacing: '3px' }}>{game.game_key}</strong>
            </div>
          </div>
        )}

        {/* GAME OVER — full end screen */}
        {isFinished && (
          <EndScreen team={team} teams={teams} game={game} onLogout={onLogout} />
        )}

        {/* ACTIVE */}
        {!isDraft && !isFinished && (
          <>
            {showPowerups && (
              <TeamPowerupsScreen
                team={team}
                teams={teams}
                onBack={() => setShowPowerups(false)}
                onTeamUpdate={onTeamUpdate}
              />
            )}
            {!showPowerups && (<>

            {/* ── TAB SWITCHER ── */}
            {teams.length > 1 && (
              <div style={{
                display: 'flex',
                background: 'var(--card)',
                border: '1px solid var(--border)',
                borderRadius: '10px',
                padding: '3px',
                gap: '3px',
                marginTop: '16px',
                marginBottom: '4px',
              }}>
                {(['missions', 'leaderboard'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => { setActiveTab(tab); setSelectedCategory(null); }}
                    style={{
                      flex: 1,
                      padding: '9px',
                      borderRadius: '8px',
                      border: 'none',
                      cursor: 'pointer',
                      fontFamily: "'Sora', sans-serif",
                      fontWeight: 700,
                      fontSize: '13px',
                      letterSpacing: '0.5px',
                      background: activeTab === tab ? 'var(--accent)' : 'transparent',
                      color: activeTab === tab ? 'var(--bg)' : 'var(--muted)',
                      transition: 'all 0.15s',
                    }}
                  >
                    {tab === 'missions' ? '🎯 Missions' : '🏆 Leaderboard'}
                  </button>
                ))}
              </div>
            )}

            {/* ── LEADERBOARD TAB ── */}
            {activeTab === 'leaderboard' && (
              <div style={{ paddingTop: '16px' }}>
                <LeaderboardView
                  teams={teams}
                  myTeamId={team.id}
                  totalMissions={visibleMissions.length}
                />
              </div>
            )}

            {/* ── MISSIONS TAB ── */}
            {activeTab === 'missions' && (<>

            {/* ── DOUBLE TROUBLE PENALTY VIEW ── */}
            {effects.double_trouble_remaining && (effects.double_trouble_remaining as number) > 0 ? (() => {
              const penaltyIds = (effects.double_trouble_missions as string[] | undefined) ?? [];
              const penaltyMissions = MISSIONS.filter(m => penaltyIds.includes(m.id));
              return (
                <div style={{ paddingTop: '16px' }}>
                  <div style={{
                    padding: '16px 18px',
                    background: 'rgba(208,117,125,0.10)',
                    border: '1px solid var(--accent2)',
                    borderRadius: '12px',
                    marginBottom: '20px',
                    textAlign: 'center',
                  }}>
                    <div style={{ fontSize: '32px', marginBottom: '8px' }}>😈</div>
                    <div style={{ fontWeight: 800, fontSize: '15px', color: 'var(--accent2)', letterSpacing: '1px', marginBottom: '6px' }}>DOUBLE TROUBLE</div>
                    <div style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: 1.6 }}>
                      You must complete these {penaltyMissions.length} mission{penaltyMissions.length !== 1 ? 's' : ''} before you can play freely again.<br />
                      <strong style={{ color: 'var(--text)' }}>{(effects.double_trouble_remaining as number)} remaining</strong>
                    </div>
                  </div>
                  <div className="missions-grid">
                    {penaltyMissions.map(m => {
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
                            <span className="mission-pts">up to {game.mission_max_pts?.[m.id] ?? m.maxPts} pts</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })() : (<>
            {/* ── CATEGORY VIEW ── */}
            {selectedCategory === null ? (
              <>
                {/* Power-up banner */}
                {availablePowerups > 0 && (
                  <button
                    onClick={() => setShowPowerups(true)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      width: '100%',
                      marginTop: '16px',
                      padding: '12px 16px',
                      background: 'rgba(255,200,0,0.08)',
                      border: '1px solid var(--gold)',
                      borderRadius: '12px',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'background 0.2s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,200,0,0.15)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,200,0,0.08)')}
                  >
                    <span style={{ fontSize: '28px', lineHeight: 1, flexShrink: 0 }}>⚡</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: "'Sora', sans-serif", fontWeight: 800, fontSize: '13px', color: 'var(--gold)', letterSpacing: '1px' }}>
                        {availablePowerups} POWER-UP{availablePowerups !== 1 ? 'S' : ''} AVAILABLE
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>
                        Freeze rivals, steal points and more — tap to use
                      </div>
                    </div>
                    <span style={{ fontSize: '12px', color: 'var(--gold)', fontWeight: 700, flexShrink: 0 }}>USE →</span>
                  </button>
                )}

                <div style={{ padding: '16px 0 14px' }}>
                  <h2 style={{ fontSize: '20px' }}>Choose your mission</h2>
                  <p style={{ color: 'var(--muted)', marginTop: '4px', fontSize: '13px' }}>
                    Select a category to see missions.
                  </p>
                </div>

                {/* Category cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', paddingBottom: '24px' }}>
                  {categoryStats.map(({ key, missions, minPts, maxPts, done }) => {
                    const cat = SUPER_CATEGORIES[key];
                    const allCatDone = done === missions.length;
                    return (
                      <div
                        key={key}
                        onClick={() => setSelectedCategory(key)}
                        style={{
                          background: 'var(--card)',
                          border: `1px solid ${allCatDone ? cat.color : 'var(--border)'}`,
                          borderRadius: '14px',
                          padding: '16px 14px',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          position: 'relative',
                          overflow: 'hidden',
                        }}
                      >
                        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: cat.color, borderRadius: '14px 14px 0 0' }} />
                        <div style={{ fontSize: '28px', marginBottom: '8px' }}>{cat.icon}</div>
                        <div style={{ fontWeight: 800, fontSize: '14px', color: 'var(--text)', marginBottom: '4px', lineHeight: 1.2 }}>
                          {cat.label}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '8px' }}>
                          {done}/{missions.length} missions
                        </div>
                        <div style={{ fontSize: '11px', fontWeight: 700, color: cat.color, letterSpacing: '0.5px' }}>
                          {minPts === maxPts ? `up to ${minPts}` : `${minPts}–${maxPts}`} pts
                        </div>
                        {allCatDone && (
                          <div style={{ position: 'absolute', top: '12px', right: '12px', fontSize: '16px' }}>✅</div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* We're done */}
                <div style={{ padding: '8px 0 32px' }}>
                  {alreadyFinished ? (
                    <div style={{ padding: '16px 20px', background: 'rgba(140,191,155,0.12)', border: '1px solid var(--accent3)', borderRadius: '12px', color: 'var(--accent3)', fontWeight: 700, fontSize: '14px', textAlign: 'center' }}>
                      ✅ All done!{elapsedText ? ` · ${elapsedText}` : ''}
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDone(true)}
                      style={{ width: '100%', padding: '16px', borderRadius: '12px', border: `2px solid ${allDone ? 'var(--accent3)' : 'var(--border)'}`, background: allDone ? 'rgba(140,191,155,0.08)' : 'transparent', color: allDone ? 'var(--accent3)' : 'var(--muted)', fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: '14px', cursor: 'pointer' }}
                    >
                      🏁 We&apos;re done!
                    </button>
                  )}
                </div>

                {/* Confirm dialog */}
                {confirmDone && (
                  <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
                    <div style={{ background: 'var(--card)', border: '2px solid var(--border)', borderRadius: '16px', padding: '40px 32px', maxWidth: '360px', width: '100%', textAlign: 'center' }}>
                      <div style={{ fontSize: '48px', marginBottom: '16px' }}>🏁</div>
                      <h2 style={{ marginBottom: '12px' }}>Are you sure?</h2>
                      <p style={{ color: 'var(--muted)', fontSize: '14px', marginBottom: '32px', lineHeight: 1.6 }}>
                        This marks your team as finished. You won&apos;t be able to complete more missions after this.
                      </p>
                      <div style={{ display: 'flex', gap: '12px' }}>
                        <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setConfirmDone(false)}>Cancel</button>
                        <button className="btn btn-primary" style={{ flex: 1 }} disabled={finishing} onClick={async () => { setConfirmDone(false); await markDone(); }}>
                          {finishing ? '...' : "Yes, we're done!"}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </>
            ) : (
              /* ── MISSION LIST VIEW ── */
              <>
                <div style={{ padding: '16px 0 14px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <button
                    onClick={() => setSelectedCategory(null)}
                    style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '13px', padding: '0', fontFamily: "'Sora', sans-serif", display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    ← Back
                  </button>
                  <span style={{ color: 'var(--border)' }}>|</span>
                  <span style={{ fontSize: '16px' }}>{SUPER_CATEGORIES[selectedCategory].icon}</span>
                  <span style={{ fontWeight: 800, fontSize: '16px', color: 'var(--text)' }}>
                    {SUPER_CATEGORIES[selectedCategory].label}
                  </span>
                </div>

                <div className="missions-grid" style={{ paddingBottom: '40px' }}>
                  {categoryStats.find(c => c.key === selectedCategory)?.missions.map(m => {
                    const done = team.completed?.includes(m.id);
                    const blocked = isFrozen;
                    return (
                      <div
                        key={m.id}
                        className={`mission-card${done ? ' done' : ''}`}
                        style={{ opacity: blocked && !done ? 0.45 : 1 }}
                        onClick={() => !done && !blocked && onSelectMission(m.id)}
                      >
                        <span className="mission-icon">{m.icon}</span>
                        <div className="mission-name">{m.name}</div>
                        <div className="mission-desc">{m.desc}</div>
                        <div className="mission-meta">
                          <span className={`tag ${DIFF_CLS[m.difficulty]}`}>{DIFF_LABEL[m.difficulty]}</span>
                          <span className="mission-pts">up to {game.mission_max_pts?.[m.id] ?? m.maxPts} pts</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
            </>)}{/* closes double_trouble false-branch and ternary */}
            </>)}{/* closes activeTab missions */}
            </>)}{/* closes !showPowerups */}

            {/* ── LOGOUT AT BOTTOM ── */}
            <div style={{ padding: '8px 0 40px', textAlign: 'center' }}>
              <button
                onClick={onLogout}
                style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: '12px', cursor: 'pointer', fontFamily: "'Sora', sans-serif", letterSpacing: '0.5px', padding: '8px 16px' }}
              >
                Log out
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
