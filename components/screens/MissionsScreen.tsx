'use client';
import { useEffect, useState } from 'react';
import { MISSIONS } from '@/lib/missions';
import { Team, Game } from '@/lib/supabase';
import { SUPER_CATEGORIES, MISSION_SUPER_CATEGORY, SuperCategoryKey } from '@/lib/superCategories';
import TeamPowerupsScreen from '@/components/screens/TeamPowerupsScreen';

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
    sabotage:        { emoji: '💻', title: 'YOU HAVE BEEN HACKED!',  btnLabel: 'OK',        color: 'var(--accent2)' },
    double_points:   { emoji: '🎉', title: 'POWER-UP!',              btnLabel: "LET'S GO!", color: 'var(--accent3)' },
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

export default function MissionsScreen({ team, game, teams, onSelectMission, onLogout, onTeamUpdate }: Props) {
  const secondsLeft = useCountdown(game);
  const isFinished = game.status === 'finished' || (secondsLeft !== null && secondsLeft <= 0);
  const isDraft = game.status === 'draft';
  const [finishing, setFinishing] = useState(false);
  const [confirmDone, setConfirmDone] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<SuperCategoryKey | null>(null);
  const [showPowerups, setShowPowerups] = useState(false);

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

      <nav className="nav" style={{ gap: '4px' }}>
        <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)', flex: '1', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {team.name}
        </span>
        <span style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: '14px', color: 'var(--gold)', flexShrink: 0, textAlign: 'center', padding: '0 8px' }}>
          ⭐ {team.score}
        </span>
        {game.status === 'active' && secondsLeft !== null ? (
          <span style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: '14px', color: timerColor, flexShrink: 0, padding: '0 8px', animation: urgentTime ? 'pulse 0.5s infinite alternate' : 'none' }}>
            ⏱ {formatTime(secondsLeft)}
          </span>
        ) : (
          <span style={{ flexShrink: 0, width: '60px' }} />
        )}
        {!isDraft && !isFinished && (
          <button className="btn btn-ghost" style={{ padding: '6px 12px', fontSize: '11px', flexShrink: 0, color: 'var(--gold)' }} onClick={() => setShowPowerups(true)}>
            ⚡
          </button>
        )}
        <button className="btn btn-ghost" style={{ padding: '6px 12px', fontSize: '11px', flexShrink: 0 }} onClick={onLogout}>
          LOG OUT
        </button>
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

        {/* GAME OVER */}
        {isFinished && (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <div style={{ fontSize: '64px', marginBottom: '24px' }}>🏁</div>
            <h2 style={{ marginBottom: '12px', color: 'var(--accent2)' }}>Time&apos;s up!</h2>
            <p style={{ color: 'var(--muted)', fontSize: '14px', marginBottom: '24px' }}>The game is over. Final score:</p>
            <div style={{ fontSize: '56px', fontWeight: 700, color: 'var(--gold)' }}>{team.score} pts</div>
            {elapsedText && (
              <p style={{ color: 'var(--muted)', fontSize: '13px', marginTop: '12px' }}>
                Finished in <strong style={{ color: 'var(--accent3)' }}>{elapsedText}</strong>
              </p>
            )}
          </div>
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
            {/* ── CATEGORY VIEW ── */}
            {selectedCategory === null ? (
              <>
                <div style={{ padding: '32px 0 24px' }}>
                  <h2>Choose your mission</h2>
                  <p style={{ color: 'var(--muted)', marginTop: '8px', fontSize: '14px' }}>
                    Select a category to see missions.
                  </p>
                </div>

                {/* Category cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px', paddingBottom: '24px' }}>
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
                          padding: '20px 16px',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          position: 'relative',
                          overflow: 'hidden',
                        }}
                      >
                        {/* coloured top stripe */}
                        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: cat.color, borderRadius: '14px 14px 0 0' }} />

                        <div style={{ fontSize: '32px', marginBottom: '10px' }}>{cat.icon}</div>
                        <div style={{ fontWeight: 800, fontSize: '14px', color: 'var(--text)', marginBottom: '6px', lineHeight: 1.2 }}>
                          {cat.label}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '10px' }}>
                          {done}/{missions.length} missions
                        </div>
                        <div style={{ fontSize: '11px', fontWeight: 700, color: cat.color, letterSpacing: '0.5px' }}>
                          {minPts === maxPts ? `up to ${minPts}` : `${minPts}–${maxPts}`} pts
                        </div>

                        {/* done badge */}
                        {allCatDone && (
                          <div style={{ position: 'absolute', top: '12px', right: '12px', fontSize: '16px' }}>✅</div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* We're done — always at the bottom */}
                <div style={{ padding: '8px 0 48px' }}>
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
                        <button
                          className="btn btn-ghost"
                          style={{ flex: 1 }}
                          onClick={() => setConfirmDone(false)}
                        >
                          Cancel
                        </button>
                        <button
                          className="btn btn-primary"
                          style={{ flex: 1 }}
                          disabled={finishing}
                          onClick={async () => { setConfirmDone(false); await markDone(); }}
                        >
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
                <div style={{ padding: '24px 0 20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
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

                {effects.double_trouble_remaining && effects.double_trouble_remaining > 0 ? (
                  <div style={{ padding: '14px 18px', borderRadius: '10px', marginBottom: '16px', background: 'rgba(208,117,125,0.10)', border: '1px solid var(--accent2)', color: 'var(--accent2)', fontWeight: 700, fontSize: '13px' }}>
                    😈 Double Trouble! Complete {effects.double_trouble_remaining} more mission{effects.double_trouble_remaining > 1 ? 's' : ''} before unlocking new ones.
                  </div>
                ) : null}

                <div className="missions-grid" style={{ paddingBottom: '40px' }}>
                  {categoryStats.find(c => c.key === selectedCategory)?.missions.map(m => {
                    const done = team.completed?.includes(m.id);
                    const blocked = isFrozen || (!!effects.double_trouble_remaining && effects.double_trouble_remaining > 0 && !done);
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
            </>)}
          </>
        )}
      </div>
    </>
  );
}
