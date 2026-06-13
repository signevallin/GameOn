'use client';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MISSIONS, Mission } from '@/lib/missions';
import { Team, Game } from '@/lib/supabase';
import { SUPER_CATEGORIES, MISSION_SUPER_CATEGORY, SuperCategoryKey } from '@/lib/superCategories';
import TeamPowerupsScreen from '@/components/screens/TeamPowerupsScreen';
import MysteryBoxAR from '@/components/MysteryBoxAR';

type Notification = { type: string; message?: string; msgKey?: string; params?: Record<string, unknown> };

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
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [dismissing, setDismissing] = useState(false);

  async function ack() {
    setLoading(true);
    try {
      const res = await fetch('/api/team/ack-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId }),
        cache: 'no-store',
      });
      if (res.ok) {
        setDismissing(true);
        setTimeout(onDismiss, 220);
      }
    } finally {
      setLoading(false);
    }
  }

  const CONFIG: Record<string, { emoji: string; title: string; btnLabel: string; color: string }> = {
    sabotage:           { emoji: '💻', title: t('notifications.sabotage'),          btnLabel: t('notifications.btn_ok'),     color: 'var(--accent2)' },
    double_points:      { emoji: '🎯', title: t('notifications.double_points'),     btnLabel: t('notifications.btn_letsGo'), color: 'var(--accent3)' },
    final_frenzy:       { emoji: '🔥', title: t('notifications.final_frenzy'),      btnLabel: t('notifications.btn_letsGo'), color: 'var(--gold)'    },
    fake_hint:          { emoji: '🔍', title: t('notifications.fake_hint'),          btnLabel: t('notifications.btn_ok'),     color: 'var(--accent)'  },
    photo_rated:        { emoji: '📸', title: t('notifications.photo_rated'),        btnLabel: t('notifications.btn_nice'),   color: 'var(--accent3)' },
    powerup_self:       { emoji: '⚡', title: t('notifications.powerup_self'),       btnLabel: t('notifications.btn_letsGo'), color: 'var(--accent3)' },
    powerup_received:   { emoji: '😈', title: t('notifications.powerup_received'),   btnLabel: t('notifications.btn_damnIt'), color: 'var(--accent2)' },
    point_steal_from:   { emoji: '😱', title: t('notifications.point_steal'),        btnLabel: t('notifications.btn_noWay'),  color: 'var(--accent2)' },
    point_steal_to:     { emoji: '🤑', title: t('notifications.point_steal'),        btnLabel: t('notifications.btn_yesss'),  color: 'var(--accent3)' },
    hot_potato:         { emoji: '💣', title: t('notifications.hot_potato'),         btnLabel: t('notifications.btn_letsGo'), color: 'var(--gold)'   },
    hot_potato_penalty: { emoji: '💥', title: t('notifications.hot_potato_penalty'), btnLabel: t('notifications.btn_damnIt'), color: 'var(--accent2)' },
    mystery_box_won:     { emoji: '🎁', title: t('notifications.mystery_box_won'),     btnLabel: t('notifications.btn_letsGo'), color: 'var(--gold)'    },
    mystery_box_taken:   { emoji: '💨', title: t('notifications.mystery_box_taken'),   btnLabel: t('notifications.btn_damnIt'), color: 'var(--accent2)' },
    mystery_box_expired: { emoji: '⏰', title: t('notifications.mystery_box_expired'), btnLabel: t('notifications.btn_ok'),     color: 'var(--muted)'   },
  };

  const cfg = CONFIG[notification.type] ?? CONFIG.fake_hint;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.75)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px',
      ...(dismissing ? { animation: 'fadeOut 0.22s ease forwards' } : {}),
    }}>
      <div style={{
        background: 'var(--card)',
        border: `2px solid ${cfg.color}`,
        borderRadius: '16px',
        padding: '40px 32px',
        maxWidth: '380px',
        width: '100%',
        textAlign: 'center',
        animation: 'popIn 0.25s cubic-bezier(0.34,1.56,0.64,1) forwards',
      }}>
        <div style={{ fontSize: '56px', marginBottom: '16px' }}>{cfg.emoji}</div>
        <h2 style={{ color: cfg.color, marginBottom: '16px', letterSpacing: '2px' }}>{cfg.title}</h2>
        <p style={{ fontSize: '15px', color: 'var(--text)', marginBottom: '32px', lineHeight: 1.6 }}>
          {notification.msgKey
            ? t(`notifications.${notification.msgKey}`, notification.params ?? {})
            : notification.message}
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
  const { t } = useTranslation();
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
            <div style={{ fontSize: '11px', color: 'var(--muted)', letterSpacing: '1.5px', fontWeight: 700, textTransform: 'uppercase' }}>{t('leaderboard.yourTeam')}</div>
            <div style={{ fontWeight: 800, fontSize: '16px', color: 'var(--text)', marginTop: '3px' }}>{myTeam.name}</div>
            <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '3px' }}>
              {myRank === 0 ? t('leaderboard.leading') : gap > 0 ? t('leaderboard.ptsBehind', { gap }) : t('leaderboard.tied')}
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
        {sorted.map((lbTeam, i) => {
          const isMe = lbTeam.id === myTeamId;
          const missionsDone = lbTeam.completed?.length ?? 0;
          const barPct = maxScore > 0 ? Math.max(4, Math.round((lbTeam.score / maxScore) * 100)) : 4;
          const barColor = i === 0 ? 'var(--gold)' : i === 1 ? 'var(--silver)' : i === 2 ? 'var(--bronze)' : 'var(--muted)';

          const isFirst = i === 0;
          return (
            <div
              key={lbTeam.id}
              style={{
                padding: isFirst ? '16px 18px' : '12px 14px',
                background: isFirst ? 'rgba(222,187,107,0.06)' : 'var(--card)',
                border: isFirst ? '2px solid var(--gold)' : `1px solid ${isMe ? 'var(--accent)' : 'var(--border)'}`,
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
                    fontWeight: 700, fontSize: isFirst ? '16px' : '14px',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    color: isMe ? 'var(--accent)' : isFirst ? 'var(--gold)' : 'var(--text)',
                  }}>
                    {lbTeam.name}{isMe ? t('leaderboard.youSuffix') : ''}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>
                    {t('leaderboard.missionsCount', { done: missionsDone, total: totalMissions })}{lbTeam.finished_at ? ' · 🏁' : ''}
                  </div>
                </div>

                <div style={{ fontWeight: 800, fontSize: isFirst ? '20px' : '17px', color: i === 0 ? 'var(--gold)' : 'var(--text)', flexShrink: 0 }}>
                  {lbTeam.score}
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
function confirmLogout(onLogout: () => void, confirmText: string) {
  if (window.confirm(confirmText)) onLogout();
}

function EndScreen({ team, teams, game, onLogout }: { team: Team; teams: Team[]; game: Game; onLogout: () => void }) {
  const { t } = useTranslation();
  const sorted = [...teams].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const fa = a.finished_at ? new Date(a.finished_at).getTime() : Infinity;
    const fb = b.finished_at ? new Date(b.finished_at).getTime() : Infinity;
    return fa - fb;
  });

  const winner = sorted[0];
  const myRank = sorted.findIndex(t => t.id === team.id) + 1;
  const isWinner = winner?.id === team.id;
  const hideResults = Boolean(game.hide_leaderboard);

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

  // ── Hidden results mode ───────────────────────────────────────────────────
  if (hideResults) {
    const best = bestMission(team);
    return (
      <>
        <Confetti />
        <div style={{ padding: '32px 20px 48px', maxWidth: '560px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <div style={{ fontSize: '64px', marginBottom: '12px' }}>🏁</div>
            <h2 style={{ fontSize: '22px', marginBottom: '8px' }}>{t('end.gameOverTitle')}</h2>
            <p style={{ color: 'var(--muted)', fontSize: '14px', lineHeight: 1.6 }}>
              {t('end.resultsAnnounced')}
            </p>
            <div style={{ marginTop: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <span style={{ fontSize: '40px', fontWeight: 800, color: 'var(--gold)' }}>{team.score}</span>
              <span style={{ color: 'var(--muted)', fontSize: '16px' }}>{t('end.ptsLabel')}</span>
            </div>
            {elapsedText && (
              <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '6px' }}>
                {t('end.finishedIn', { time: elapsedText })}
              </div>
            )}
          </div>

          <div style={{ padding: '20px', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '14px', marginBottom: '32px' }}>
            <div style={{ fontSize: '11px', color: 'var(--muted)', letterSpacing: '1.5px', fontWeight: 700, marginBottom: '14px' }}>{t('end.yourGame')}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              {[
                { label: t('end.statScore'), value: t('end.scoreValue', { score: team.score }), color: 'var(--gold)' },
                { label: t('end.statMissionsDone'), value: `${team.completed?.length ?? 0}`, color: 'var(--accent3)' },
                { label: t('end.statBestMission'), value: best ? `${best.pts} pts` : '—', color: 'var(--text)' },
                { label: 'Teams played', value: `${teams.length}`, color: 'var(--accent)' },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ background: 'var(--surface)', borderRadius: '10px', padding: '12px 14px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '4px' }}>{label}</div>
                  <div style={{ fontWeight: 800, fontSize: '16px', color }}>{value}</div>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={() => confirmLogout(onLogout, t('missions.logoutConfirm'))}
            style={{ width: '100%', padding: '14px', background: 'transparent', border: '1px solid var(--border)', borderRadius: '12px', color: 'var(--muted)', fontSize: '14px', fontWeight: 600, cursor: 'pointer', letterSpacing: '0.5px' }}
          >
            {t('end.leaveButton')}
          </button>
        </div>
      </>
    );
  }

  // ── Normal results mode ───────────────────────────────────────────────────
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
            {isWinner ? t('end.youWon') : myRank === 2 ? t('end.place_2') : myRank === 3 ? t('end.place_3') : t('end.place_other', { rank: myRank })}
          </h2>
          {winner && !isWinner && (
            <p style={{ color: 'var(--muted)', fontSize: '14px' }}>
              <strong style={{ color: 'var(--gold)' }}>{t('end.winnerLine', { name: winner.name, score: winner.score })}</strong>
            </p>
          )}
          <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <span style={{ fontSize: '40px', fontWeight: 800, color: 'var(--gold)' }}>{team.score}</span>
            <span style={{ color: 'var(--muted)', fontSize: '16px' }}>{t('end.ptsLabel')}</span>
          </div>
          {elapsedText && (
            <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '6px' }}>
              {t('end.finishedIn', { time: elapsedText })}
            </div>
          )}
        </div>

        {/* Final rankings */}
        <div style={{ marginBottom: '28px' }}>
          <div style={{ fontSize: '11px', color: 'var(--muted)', letterSpacing: '1.5px', fontWeight: 700, marginBottom: '12px' }}>
            {t('end.finalStandings')}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {sorted.map((rankTeam, i) => {
              const isMe = rankTeam.id === team.id;
              const best = bestMission(rankTeam);
              return (
                <div
                  key={rankTeam.id}
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
                      {rankTeam.name}{isMe ? t('end.youSuffixParen') : ''}
                    </div>
                    {best && (
                      <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>
                        {t('end.bestLine', { name: best.name, pts: best.pts })}
                      </div>
                    )}
                  </div>

                  <div style={{ fontWeight: 800, fontSize: '17px', color: i === 0 ? 'var(--gold)' : 'var(--text)', flexShrink: 0 }}>
                    {rankTeam.score}
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
          <div style={{ fontSize: '11px', color: 'var(--muted)', letterSpacing: '1.5px', fontWeight: 700, marginBottom: '14px' }}>{t('end.yourGame')}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            {[
              { label: t('end.statScore'), value: t('end.scoreValue', { score: team.score }), color: 'var(--gold)' },
              { label: t('end.statMissionsDone'), value: `${team.completed?.length ?? 0}`, color: 'var(--accent3)' },
              { label: t('end.statRank'), value: t('end.statRankValue', { rank: myRank, total: teams.length }), color: 'var(--accent)' },
              { label: t('end.statBestMission'), value: (() => { const b = bestMission(team); return b ? `${b.pts} pts` : '—'; })(), color: 'var(--text)' },
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
          onClick={() => confirmLogout(onLogout, t('missions.logoutConfirm'))}
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
          {t('end.leaveButton')}
        </button>
      </div>
    </>
  );
}

// ── Online member bar (remote mode) ──────────────────────────────────────────
function MemberBar({ members, currentMemberId }: {
  members: Array<{ id: string; name: string; online: boolean }>;
  currentMemberId?: string;
}) {
  if (members.length === 0) return null;
  return (
    <div style={{
      display: 'flex',
      flexWrap: 'wrap',
      gap: '8px',
      padding: '8px 16px',
      background: 'var(--surface)',
      borderBottom: '1px solid var(--border)',
    }}>
      {members.map(m => (
        <div key={m.id} style={{
          display: 'flex',
          alignItems: 'center',
          gap: '5px',
          padding: '4px 10px',
          borderRadius: '20px',
          background: m.id === currentMemberId ? 'rgba(124,189,212,0.12)' : 'var(--card)',
          border: `1px solid ${m.id === currentMemberId ? 'rgba(124,189,212,0.4)' : 'var(--border)'}`,
          fontSize: '12px',
          fontWeight: m.id === currentMemberId ? 700 : 500,
          color: 'var(--text)',
        }}>
          <span style={{ fontSize: '8px', color: m.online ? 'var(--accent3)' : 'var(--muted)' }}>●</span>
          {m.name}
        </div>
      ))}
    </div>
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
  customMissions?: Mission[];
  memberId?: string;
  members?: Array<{ id: string; name: string; online: boolean }>;
};

const DIFF_CLS: Record<string, string>   = { easy: 'tag-easy', medium: 'tag-medium', hard: 'tag-hard' };

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

function fmtMins(secs: number) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
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
export default function MissionsScreen({ team, game, teams, onSelectMission, onLogout, onTeamUpdate, onGameUpdate, customMissions = [], memberId, members = [] }: Props) {
  const { t } = useTranslation();
  const { t: tMissions } = useTranslation('missions');
  const secondsLeft = useCountdown(game);
  const isFinished = game.status === 'finished' || (secondsLeft !== null && secondsLeft <= 0);
  const isDraft = game.status === 'draft';
  const [finishing, setFinishing] = useState(false);
  const [confirmDone, setConfirmDone] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<SuperCategoryKey | null>(null);
  const [showPowerups, setShowPowerups] = useState(false);
  const [activeTab, setActiveTab] = useState<'missions' | 'leaderboard'>('missions');
  const [showMembers, setShowMembers] = useState(false);

  // Score count-up animation
  const [displayScore, setDisplayScore] = useState(team.score ?? 0);
  const [scoreDelta, setScoreDelta] = useState<number | null>(null);
  const prevScoreRef = useRef(team.score ?? 0);

  useEffect(() => {
    const newScore = team.score ?? 0;
    const oldScore = prevScoreRef.current;
    if (newScore === oldScore) return;
    prevScoreRef.current = newScore;

    if (newScore > oldScore) {
      setScoreDelta(newScore - oldScore);
      setTimeout(() => setScoreDelta(null), 1500);
    }

    // Animate displayScore from oldScore to newScore over ~600ms
    const duration = 600;
    const startTime = performance.now();
    const startVal = oldScore;
    const endVal = newScore;

    function step(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayScore(Math.round(startVal + (endVal - startVal) * eased));
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }, [team.score]);

  // Hide leaderboard in last 5 min if game.hide_leaderboard is on.
  // Uses a latch: starts false and can only flip to true once secondsLeft
  // actually drops to ≤300. This guarantees it is never true at game start,
  // regardless of polling glitches or short-duration test games.
  const [lbHiddenLatch, setLbHiddenLatch] = useState(false);
  useEffect(() => {
    if (
      Boolean(game.hide_leaderboard) &&
      game.status === 'active' &&
      secondsLeft !== null &&
      secondsLeft > 0 &&
      secondsLeft <= 300
    ) {
      setLbHiddenLatch(true);
    }
  }, [game.hide_leaderboard, game.status, secondsLeft]);
  const isLeaderboardHidden = lbHiddenLatch;

  useEffect(() => {
    if (isLeaderboardHidden && activeTab === 'leaderboard') setActiveTab('missions');
  }, [isLeaderboardHidden, activeTab]);

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
  const [showMysteryBoxAR, setShowMysteryBoxAR] = useState(false);
  const mysteryBoxExpiresAtRef = useRef<number>(0);
  const [mysteryBoxSecsLeft, setMysteryBoxSecsLeft] = useState(0);

  useEffect(() => {
    if (team.pending_notification) setNotification(team.pending_notification);
  }, [team.pending_notification]);

  // Drive countdown for mystery_box banner
  useEffect(() => {
    if (!notification || notification.type !== 'mystery_box') return;
    const expiresAt = notification.params?.expiresAt as string | undefined;
    mysteryBoxExpiresAtRef.current = expiresAt
      ? new Date(expiresAt).getTime()
      : Date.now() + 2 * 60 * 1000;

    const tick = () => {
      const secs = Math.max(0, Math.ceil((mysteryBoxExpiresAtRef.current - Date.now()) / 1000));
      setMysteryBoxSecsLeft(secs);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [notification]);

  const visibleMissions = MISSIONS.filter(m => game.missions.includes(m.id));
  const visibleCustomMissions = customMissions.filter(m => game.missions.includes(m.id));
  const allDone = visibleMissions.every(m => team.completed?.includes(m.id));
  const totalPowerups = 6; // shield, freeze, double_trouble, all_in, point_steal, robin_hood
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

  // Group custom missions by category — one card per distinct category
  const customCategoryGroups = (() => {
    const order: string[] = [];
    const map = new Map<string, typeof visibleCustomMissions>();
    for (const m of visibleCustomMissions) {
      const name = m.category ?? 'Custom';
      if (!map.has(name)) { order.push(name); map.set(name, []); }
      map.get(name)!.push(m);
    }
    return order.map(name => {
      const missions = map.get(name)!;
      const pts = missions.map(m => game.mission_max_pts?.[m.id] ?? m.maxPts);
      return {
        name,
        missions,
        minPts: Math.min(...pts),
        maxPts: Math.max(...pts),
        done: missions.filter(m => team.completed?.includes(m.id)).length,
      };
    });
  })();

  // Helpers for the selected custom category (selectedCategory = '__custom__:<name>')
  const isCustomCategory = typeof selectedCategory === 'string' && selectedCategory.startsWith('__custom__:');
  const selectedCustomCategoryName = isCustomCategory ? (selectedCategory as string).slice('__custom__:'.length) : null;

  return (
    <>
      {notification && notification.type === 'mystery_box' && !showMysteryBoxAR && (
        /* Mystery box countdown banner */
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0,0,0,0.85)',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          gap: '20px', padding: '32px',
        }}>
          <style>{`@keyframes float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }`}</style>
          <div style={{ fontSize: '72px', animation: 'float 2s ease-in-out infinite' }}>📦</div>
          <h2 style={{ color: 'var(--gold)', letterSpacing: '2px', textAlign: 'center' }}>
            MYSTERY BOX!
          </h2>
          <p style={{ color: 'var(--muted)', fontSize: '14px', textAlign: 'center', maxWidth: '260px' }}>
            A mystery box appeared! Race to open it before other teams!
          </p>
          <div style={{
            fontSize: '36px', fontWeight: 800,
            color: mysteryBoxSecsLeft <= 30 ? 'var(--accent2)' : 'var(--gold)',
            fontVariantNumeric: 'tabular-nums',
          }}>
            ⏱ {fmtMins(mysteryBoxSecsLeft)}
          </div>
          {mysteryBoxSecsLeft > 0 ? (
            <button
              className="btn btn-primary"
              style={{ fontSize: '16px', padding: '14px 32px', background: 'var(--gold)', borderColor: 'var(--gold)', color: '#000' }}
              onClick={() => setShowMysteryBoxAR(true)}
            >
              📷 Open AR Camera
            </button>
          ) : (
            <p style={{ color: 'var(--accent2)', fontSize: '14px' }}>Box expired ⏰</p>
          )}
          <button
            style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: '12px', cursor: 'pointer', fontFamily: "'Sora', sans-serif" }}
            onClick={() => setNotification(null)}
          >
            Dismiss
          </button>
        </div>
      )}

      {notification && notification.type === 'mystery_box' && showMysteryBoxAR && (
        <MysteryBoxAR
          mode="claim"
          teamId={team.id}
          onClaim={(result) => {
            setShowMysteryBoxAR(false);
            setNotification(null);
            if (result === 'won') {
              // notification will arrive via poll as mystery_box_won
            }
          }}
          onClose={() => setShowMysteryBoxAR(false)}
        />
      )}

      {notification && notification.type !== 'mystery_box' && (
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
          <h2 style={{ color: '#7ec8e3', letterSpacing: '2px' }}>{t('frozen.title')}</h2>
          <p style={{ color: 'var(--muted)', fontSize: '14px' }}>{t('frozen.subtitle')}</p>
          <div style={{ fontFamily: "'Sora', sans-serif", fontSize: '48px', fontWeight: 800, color: '#7ec8e3' }}>{freezeSecsLeft}s</div>
        </div>
      )}

      <nav className="nav" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr auto', alignItems: 'center', gap: '4px' }}>
        {/* Col 1: team name — button in remote mode, span otherwise */}
        {game.remote_mode ? (
          <button
            onClick={() => setShowMembers(v => !v)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '12px',
              fontWeight: 700,
              color: 'var(--text)',
              overflow: 'hidden',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {team.name}
            </span>
            <span style={{ fontSize: '9px', color: 'var(--muted)', flexShrink: 0 }}>
              {showMembers ? '▴' : '▾'}
            </span>
          </button>
        ) : (
          <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {team.name}
          </span>
        )}

        {/* Col 2: power-up pill */}
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          {!isDraft && !isFinished && (
            <button
              onClick={() => setShowPowerups(true)}
              aria-label="Power-Ups"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                background: availablePowerups > 0 ? 'rgba(255,200,0,0.18)' : 'rgba(255,255,255,0.06)',
                border: `1px solid ${availablePowerups > 0 ? 'rgba(255,200,0,0.6)' : 'var(--border)'}`,
                borderRadius: '20px',
                padding: '5px 10px 5px 8px',
                cursor: 'pointer',
                color: availablePowerups > 0 ? 'var(--gold)' : 'var(--muted)',
                fontFamily: "'Sora', sans-serif",
                fontWeight: 700,
                fontSize: '11px',
                lineHeight: 1,
                transition: 'all 0.15s',
                whiteSpace: 'nowrap',
                boxShadow: availablePowerups > 0 ? '0 2px 8px rgba(255,200,0,0.2)' : 'none',
                WebkitTapHighlightColor: 'transparent',
              }}
              onMouseEnter={e => { if (availablePowerups > 0) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,200,0,0.28)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = availablePowerups > 0 ? 'rgba(255,200,0,0.18)' : 'rgba(255,255,255,0.06)'; }}
              onMouseDown={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.94)'; }}
              onMouseUp={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
              onTouchStart={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.94)'; (e.currentTarget as HTMLButtonElement).style.background = availablePowerups > 0 ? 'rgba(255,200,0,0.28)' : 'rgba(255,255,255,0.06)'; }}
              onTouchEnd={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; (e.currentTarget as HTMLButtonElement).style.background = availablePowerups > 0 ? 'rgba(255,200,0,0.18)' : 'rgba(255,255,255,0.06)'; }}
            >
              <span style={{ fontSize: '14px', lineHeight: 1 }}>⚡</span>
              <span>{availablePowerups > 0 ? `${availablePowerups} left` : 'Used'}</span>
            </button>
          )}
        </div>

        {/* Col 3: score */}
        <div style={{ position: 'relative', display: 'inline-flex', justifyContent: 'center' }}>
          <span style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: '13px', color: 'var(--gold)', whiteSpace: 'nowrap', textAlign: 'center' }}>
            ⭐ {displayScore}
          </span>
          {scoreDelta !== null && (
            <span className="score-delta">+{scoreDelta}</span>
          )}
        </div>

        {/* Col 4: timer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          {game.status === 'active' && secondsLeft !== null && (
            <span style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: '13px', color: timerColor, animation: urgentTime ? 'pulse 0.5s infinite alternate' : 'none', whiteSpace: 'nowrap' }}>
              ⏱ {formatTime(secondsLeft)}
            </span>
          )}
        </div>

      </nav>

      {game.remote_mode && showMembers && members.length > 0 && (
        <div style={{
          background: 'var(--surface)',
          borderBottom: '1px solid var(--border)',
          padding: '8px 16px',
          display: 'flex',
          gap: '8px',
          flexWrap: 'wrap',
        }}>
          {members.map(m => (
            <div key={m.id} style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              padding: '4px 10px',
              borderRadius: '20px',
              background: m.id === memberId ? 'rgba(124,189,212,0.12)' : 'var(--card)',
              border: `1px solid ${m.id === memberId ? 'rgba(124,189,212,0.4)' : 'var(--border)'}`,
              fontSize: '12px',
              fontWeight: m.id === memberId ? 700 : 500,
              color: 'var(--text)',
            }}>
              <span style={{ fontSize: '8px', color: m.online ? 'var(--accent3)' : 'var(--muted)' }}>●</span>
              {m.name}
            </div>
          ))}
        </div>
      )}

      <div className="container fade-in">

        {/* WAITING */}
        {isDraft && (
          <div style={{ textAlign: 'center', padding: '80px 20px' }}>
            <div style={{ fontSize: '64px', marginBottom: '24px' }}>⏳</div>
            <h2 style={{ marginBottom: '12px' }}>{t('waiting.title')}</h2>
            <p style={{ color: 'var(--muted)', fontSize: '14px' }}>{t('waiting.subtitle')}</p>
            <div style={{ display: 'inline-block', marginTop: '32px', padding: '12px 24px', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px', fontFamily: "'Sora', sans-serif", fontSize: '13px', color: 'var(--muted)' }}>
              {t('waiting.gameLabel')} <strong style={{ color: 'var(--accent)', letterSpacing: '3px' }}>{game.game_key}</strong>
            </div>
            <div style={{ marginTop: '24px' }}>
              <button
                onClick={onLogout}
                style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: '12px', cursor: 'pointer', textDecoration: 'underline', opacity: 0.7 }}
              >
                {t('waiting.logout')}
              </button>
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
            {teams.length >= 1 && !isLeaderboardHidden && (
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
                    {tab === 'missions' ? t('missions.tabMissions') : t('missions.tabLeaderboard')}
                  </button>
                ))}
              </div>
            )}

            {/* ── LEADERBOARD TAB ── */}
            {activeTab === 'leaderboard' && !isLeaderboardHidden && (
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
                    <div style={{ fontWeight: 800, fontSize: '15px', color: 'var(--accent2)', letterSpacing: '1px', marginBottom: '6px' }}>{t('missions.doubleTroubleTitle')}</div>
                    <div style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: 1.6 }}>
                      {penaltyMissions.length === 1 ? t('missions.doubleTroubleDescSingular') : t('missions.doubleTroubleDesc', { count: penaltyMissions.length })}<br />
                      <strong style={{ color: 'var(--text)' }}>{t('missions.doubleTroubleRemaining', { remaining: effects.double_trouble_remaining as number })}</strong>
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
                          <div className="mission-name">{tMissions(`${m.id}.name`, { defaultValue: m.name })}</div>
                          <div className="mission-desc">{tMissions(`${m.id}.desc`, { defaultValue: m.desc })}</div>
                          <div className="mission-meta">
                            <span className={`tag ${DIFF_CLS[m.difficulty]}`}>{t(`difficulty.${m.difficulty}`)}</span>
                            <span className="mission-pts">{t('missions.upToPts', { pts: game.mission_max_pts?.[m.id] ?? m.maxPts })}</span>
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
                <div style={{ padding: '16px 0 14px' }}>
                  <h2 style={{ fontSize: '20px' }}>{t('missions.chooseTitle')}</h2>
                  <p style={{ color: 'var(--muted)', marginTop: '4px', fontSize: '13px' }}>
                    {t('missions.chooseSubtitle')}
                  </p>
                </div>

                {/* Category cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gridAutoRows: '1fr', gap: '12px', paddingBottom: '24px' }}>
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
                          minHeight: '120px',
                          height: '100%',
                          boxSizing: 'border-box',
                        }}
                      >
                        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: cat.color, borderRadius: '14px 14px 0 0' }} />
                        <div style={{ fontSize: '28px', marginBottom: '8px' }}>{cat.icon}</div>
                        <div style={{ fontWeight: 800, fontSize: '14px', color: 'var(--text)', marginBottom: '4px', lineHeight: 1.2 }}>
                          {cat.label}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '8px' }}>
                          {t('missions.missionsCount', { done, total: missions.length })}
                        </div>
                        <div style={{ fontSize: '11px', fontWeight: 700, color: cat.color, letterSpacing: '0.5px' }}>
                          {minPts === maxPts ? t('missions.upToPts', { pts: minPts }) : t('missions.ptsRange', { min: minPts, max: maxPts })}
                        </div>
                        {allCatDone && (
                          <div style={{ position: 'absolute', top: '12px', right: '12px', fontSize: '16px' }}>✅</div>
                        )}
                      </div>
                    );
                  })}

                  {/* ── Custom categories — one card per distinct category ── */}
                  {selectedCategory === null && customCategoryGroups.map(grp => (
                    <div
                      key={grp.name}
                      className="card"
                      style={{ cursor: 'pointer', borderColor: '#9b59b6', opacity: 1, minHeight: '120px', height: '100%', boxSizing: 'border-box', gridColumn: '1 / -1' }}
                      onClick={() => setSelectedCategory((`__custom__:${grp.name}`) as SuperCategoryKey)}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ fontSize: '24px' }}>⭐</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 800, fontSize: '14px', color: '#9b59b6' }}>{grp.name.toUpperCase()}</div>
                          <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>{grp.minPts}–{grp.maxPts} pts</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontWeight: 800, fontSize: '16px', color: '#9b59b6' }}>{grp.done}/{grp.missions.length}</div>
                          <div style={{ fontSize: '10px', color: 'var(--muted)' }}>done</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* We're done */}
                <div style={{ padding: '8px 0 32px' }}>
                  {alreadyFinished ? (
                    <div style={{ padding: '16px 20px', background: 'rgba(140,191,155,0.12)', border: '1px solid var(--accent3)', borderRadius: '12px', color: 'var(--accent3)', fontWeight: 700, fontSize: '14px', textAlign: 'center' }}>
                      {elapsedText ? t('missions.allDoneElapsed', { time: elapsedText }) : t('missions.allDoneLabel')}
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDone(true)}
                      style={{ width: '100%', padding: '16px', borderRadius: '12px', border: `2px solid ${allDone ? 'var(--accent3)' : 'var(--border)'}`, background: allDone ? 'rgba(140,191,155,0.08)' : 'transparent', color: allDone ? 'var(--accent3)' : 'var(--muted)', fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: '14px', cursor: 'pointer' }}
                    >
                      {t('missions.wereDoneButton')}
                    </button>
                  )}
                </div>

                {/* Confirm dialog */}
                {confirmDone && (
                  <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
                    <div style={{ background: 'var(--card)', border: '2px solid var(--border)', borderRadius: '16px', padding: '40px 32px', maxWidth: '360px', width: '100%', textAlign: 'center' }}>
                      <div style={{ fontSize: '48px', marginBottom: '16px' }}>🏁</div>
                      <h2 style={{ marginBottom: '12px' }}>{t('missions.confirmDoneTitle')}</h2>
                      <p style={{ color: 'var(--muted)', fontSize: '14px', marginBottom: '32px', lineHeight: 1.6 }}>
                        {t('missions.confirmDoneBody')}
                      </p>
                      <div style={{ display: 'flex', gap: '12px' }}>
                        <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setConfirmDone(false)}>{t('missions.confirmDoneCancel')}</button>
                        <button className="btn btn-primary" style={{ flex: 1 }} disabled={finishing} onClick={async () => { setConfirmDone(false); await markDone(); }}>
                          {finishing ? '...' : t('missions.confirmDoneConfirm')}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </>
            ) : (
              /* ── MISSION LIST VIEW ── */
              <>
                {/* ── Category header with breadcrumb ── */}
                <div style={{ padding: '14px 0 16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <button
                    onClick={() => setSelectedCategory(null)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: '10px',
                      color: 'var(--text)',
                      cursor: 'pointer',
                      fontSize: '13px',
                      fontFamily: "'Sora', sans-serif",
                      fontWeight: 700,
                      padding: '10px 14px',
                      minHeight: '44px',
                      flexShrink: 0,
                      transition: 'background 0.15s, border-color 0.15s',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--card)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--accent)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)'; }}
                  >
                    {t('missions.backButton')}
                  </button>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                    <span style={{ fontSize: '12px', color: 'var(--muted)', whiteSpace: 'nowrap', flexShrink: 0 }}>{t('missions.breadcrumbMissions')}</span>
                    <span style={{ fontSize: '12px', color: 'var(--muted)', flexShrink: 0 }}>›</span>
                    {!isCustomCategory ? (
                      <>
                        <span style={{ fontSize: '16px', flexShrink: 0 }}>{SUPER_CATEGORIES[selectedCategory!].icon}</span>
                        <span style={{
                          fontWeight: 800,
                          fontSize: '15px',
                          color: SUPER_CATEGORIES[selectedCategory!].color,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}>
                          {SUPER_CATEGORIES[selectedCategory!].label}
                        </span>
                      </>
                    ) : (
                      <>
                        <span style={{ fontSize: '16px', flexShrink: 0 }}>⭐</span>
                        <span style={{
                          fontWeight: 800,
                          fontSize: '15px',
                          color: '#9b59b6',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}>
                          {selectedCustomCategoryName ?? 'Custom'}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Standard category missions */}
                {!isCustomCategory && (
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
                          <div className="mission-name">{tMissions(`${m.id}.name`, { defaultValue: m.name })}</div>
                          <div className="mission-desc">{tMissions(`${m.id}.desc`, { defaultValue: m.desc })}</div>
                          <div className="mission-meta">
                            <span className={`tag ${DIFF_CLS[m.difficulty]}`}>{t(`difficulty.${m.difficulty}`)}</span>
                            <span className="mission-pts">{t('missions.upToPts', { pts: game.mission_max_pts?.[m.id] ?? m.maxPts })}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* ── Custom category missions list ── */}
                {isCustomCategory && (
                  <div className="missions-grid" style={{ paddingBottom: '40px' }}>
                    {(customCategoryGroups.find(g => g.name === selectedCustomCategoryName)?.missions ?? []).map(m => {
                      const done = team.completed?.includes(m.id);
                      const pts = game.mission_max_pts?.[m.id] ?? m.maxPts;
                      return (
                        <div
                          key={m.id}
                          className="card"
                          style={{ cursor: done ? 'default' : 'pointer', opacity: done ? 0.5 : 1, borderColor: done ? 'var(--border)' : '#9b59b6' }}
                          onClick={() => !done && onSelectMission(m.id)}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <span style={{ fontSize: '24px' }}>{m.icon}</span>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontWeight: 700, fontSize: '14px' }}>{m.name}</div>
                              <div style={{ fontSize: '11px', color: 'var(--muted)' }}>{m.difficulty} · {pts} pts</div>
                            </div>
                            {done && <span style={{ fontSize: '18px' }}>✅</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
            </>)}{/* closes double_trouble false-branch and ternary */}
            </>)}{/* closes activeTab missions */}
            </>)}{/* closes !showPowerups */}

            {/* ── LOGOUT AT BOTTOM ── */}
            <div style={{ padding: '8px 0 40px', textAlign: 'center' }}>
              <button
                onClick={() => confirmLogout(onLogout, t('missions.logoutConfirm'))}
                style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: '12px', cursor: 'pointer', fontFamily: "'Sora', sans-serif", letterSpacing: '0.5px', padding: '8px 16px' }}
              >
                {t('missions.logoutButton')}
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
