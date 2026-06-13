'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useIsMobile } from '@/hooks/useIsMobile';
import { MISSIONS } from '@/lib/missions';
import { toMission } from '@/lib/custom-missions';
import { Team, Game, supabase } from '@/lib/supabase';
import GameOnLogo from '@/components/GameOnLogo';
import { QRCodeSVG } from 'qrcode.react';
import { SUPER_CATEGORIES, MISSION_SUPER_CATEGORY, SuperCategoryKey } from '@/lib/superCategories';
import type { GameTemplate } from '@/lib/templates';
import JSZip from 'jszip';
import MysteryBoxAR from '@/components/MysteryBoxAR';

// ── Countdown hook (admin side) ──────────────────────────────────────────────
function useCountdown(game: Game | null) {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  useEffect(() => {
    if (!game || game.status !== 'active' || !game.started_at) { setSecondsLeft(null); return; }
    const endTime = new Date(game.started_at).getTime() + game.duration_minutes * 60 * 1000;
    const tick = () => setSecondsLeft(Math.max(0, Math.floor((endTime - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [game]);
  return secondsLeft;
}

function fmtTimer(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function fmtElapsed(ms: number) {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m ${sec}s`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

// Centered nav brand shared across all admin views
function NavCenter({ game }: { game: Game | null }) {
  const secondsLeft = useCountdown(game);
  const urgentTime = secondsLeft !== null && secondsLeft < 300;
  const timerColor = urgentTime ? 'var(--gold)' : 'var(--accent3)';
  return (
    <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', pointerEvents: 'none' }}>
      {game && (
        <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text)', letterSpacing: '1px', whiteSpace: 'nowrap' }}>
          {game.name}
        </span>
      )}
      {game && game.status === 'active' && secondsLeft !== null && (
        <span style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: '18px', color: timerColor, letterSpacing: '2px', lineHeight: 1, animation: urgentTime ? 'pulse 0.5s infinite alternate' : 'none' }}>
          ⏱ {fmtTimer(secondsLeft)}
        </span>
      )}
    </div>
  );
}

type HotPotatoState = {
  mission_id: string;
  expires_at: string;
  penalty_pts: number;
  game_id: string;
} | null;

type PowerUpsCardProps = {
  teams: Team[];
  gameId: string;
  gameMissionIds: string[];
  powerupsUsed: string[];
  puTargets: Record<string, string>;
  setPuTargets: (v: Record<string, string>) => void;
  puMessages: string;
  setPuMessages: (v: string) => void;
  puLoading: string | null;
  onActivate: (type: string) => void;
  // hot potato
  hotPotatoMissionId: string;
  setHotPotatoMissionId: (v: string) => void;
  onHotPotato: () => void;
  hotPotatoLoading: boolean;
  hotPotatoActive: HotPotatoState;
  // mystery box
  mysteryBoxActive: MysteryBoxState;
  mysteryBoxSecsLeft: number | null;
  mysteryBoxLoading: boolean;
  onLaunchMysteryBox: () => void;
  activeGameStatus: string | undefined;
};

function useHotPotatoCountdown(hotPotatoActive: HotPotatoState) {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  useEffect(() => {
    if (!hotPotatoActive) { setSecondsLeft(null); return; }
    const endTime = new Date(hotPotatoActive.expires_at).getTime();
    const tick = () => setSecondsLeft(Math.max(0, Math.floor((endTime - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [hotPotatoActive]);
  return secondsLeft;
}

type MysteryBoxState = {
  created_at: string;
  expires_at: string;
  claimed_by: string | null;
} | null;

function useMysteryBoxCountdown(mb: MysteryBoxState) {
  const [secsLeft, setSecsLeft] = useState<number | null>(null);
  useEffect(() => {
    if (!mb || mb.claimed_by !== null) { setSecsLeft(null); return; }
    const endTime = new Date(mb.expires_at).getTime();
    const tick = () => setSecsLeft(Math.max(0, Math.ceil((endTime - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [mb]);
  return secsLeft;
}

function PowerUpsCard({
  teams, gameId: _gameId, gameMissionIds, powerupsUsed, puTargets, setPuTargets, puMessages, setPuMessages, puLoading, onActivate,
  hotPotatoMissionId, setHotPotatoMissionId, onHotPotato, hotPotatoLoading, hotPotatoActive,
  mysteryBoxActive, mysteryBoxSecsLeft, mysteryBoxLoading, onLaunchMysteryBox, activeGameStatus,
}: PowerUpsCardProps) {
  const hotPotatoSecondsLeft = useHotPotatoCountdown(hotPotatoActive);

  function isUsedKey(key: string) {
    return powerupsUsed.includes(key);
  }

  function usedOnNames(type: string) {
    return powerupsUsed
      .filter(k => k.startsWith(`${type}_`) && k !== `${type}_all`)
      .map(k => teams.find(t => t.id === k.slice(type.length + 1))?.name)
      .filter(Boolean) as string[];
  }

  function setTarget(type: string, teamId: string) {
    setPuTargets({ ...puTargets, [type]: teamId });
  }

  const selectStyle = {
    padding: '6px 10px',
    borderRadius: '6px',
    border: '1px solid var(--border)',
    background: 'var(--surface)',
    color: 'var(--text)',
    fontFamily: "'Sora', sans-serif",
    fontSize: '12px',
    cursor: 'pointer',
    flex: 1,
    minWidth: 0,
  };

  const POWERS = [
    { type: 'sabotage', icon: '💻', label: 'Hack a team (-100p)', btn: 'HACK', allowAll: true },
    { type: 'double_points', icon: '🎯', label: 'Double points', btn: 'ACTIVATE', allowAll: true },
    { type: 'fake_hint', icon: '🔍', label: 'Fake hint', btn: 'SEND', allowAll: true },
  ];

  const finalFrenzyUsed = isUsedKey('final_frenzy_all');
  const finalFrenzyLoading = puLoading === 'final_frenzy';

  const hotPotatoMission = MISSIONS.find(m => m.id === hotPotatoActive?.mission_id);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* ── Final Frenzy (broadcast only) ── */}
      <div style={{
        background: finalFrenzyUsed ? 'var(--card)' : 'linear-gradient(135deg, rgba(208,117,125,0.12) 0%, rgba(222,187,107,0.10) 100%)',
        border: `1px solid ${finalFrenzyUsed ? 'var(--border)' : 'rgba(208,117,125,0.5)'}`,
        borderRadius: '12px',
        padding: '16px 20px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '22px', flexShrink: 0 }}>🔥</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '14px', fontWeight: 800, color: finalFrenzyUsed ? 'var(--muted)' : 'var(--accent2)' }}>Final Frenzy</div>
            <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>Doubles all points for ALL teams instantly</div>
          </div>
          {finalFrenzyUsed ? (
            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--accent3)', background: 'rgba(140,191,155,0.12)', borderRadius: '6px', padding: '6px 12px', border: '1px solid var(--accent3)', flexShrink: 0 }}>✓ ACTIVATED</span>
          ) : (
            <>
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)', background: 'var(--surface)', borderRadius: '4px', padding: '2px 7px', border: '1px solid var(--border)', flexShrink: 0 }}>ALL TEAMS</span>
              <button
                className="btn btn-primary"
                style={{ padding: '8px 16px', fontSize: '12px', flexShrink: 0, background: 'var(--accent2)', borderColor: 'var(--accent2)' }}
                disabled={finalFrenzyLoading}
                onClick={() => onActivate('final_frenzy')}
              >
                {finalFrenzyLoading ? '...' : 'ACTIVATE'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Per-team power-ups ── */}
      {POWERS.map(({ type, icon, label, btn, allowAll }) => {
        const selectedTeamId = puTargets[type] ?? '';
        const isAllSelected = selectedTeamId === 'all';
        const usedKey = isAllSelected ? `${type}_all` : selectedTeamId ? `${type}_${selectedTeamId}` : '';
        const alreadyUsed = usedKey ? isUsedKey(usedKey) : false;
        const isLoading = puLoading === type;
        const usedNames = usedOnNames(type);
        const allUsed = isUsedKey(`${type}_all`);

        return (
          <div key={type} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px 20px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '20px', flexShrink: 0 }}>{icon}</span>
                <span style={{ fontSize: '14px', fontWeight: 700 }}>{label}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <select
                value={selectedTeamId}
                onChange={e => setTarget(type, e.target.value)}
                style={{ ...selectStyle, flex: 1 }}
                disabled={allUsed}
              >
                <option value="">Select team…</option>
                {allowAll && (
                  <option value="all" disabled={allUsed}>{allUsed ? '✓ All teams (used)' : '📢 All teams'}</option>
                )}
                {teams.map(t => {
                  const tUsed = isUsedKey(`${type}_${t.id}`) || allUsed;
                  return (
                    <option key={t.id} value={t.id} disabled={tUsed}>
                      {t.name}{tUsed ? ' ✓' : ''}
                    </option>
                  );
                })}
              </select>
              <button
                className="btn btn-primary"
                style={{ padding: '8px 16px', fontSize: '12px', flexShrink: 0 }}
                disabled={!selectedTeamId || alreadyUsed || isLoading || (type === 'fake_hint' && !puMessages.trim())}
                onClick={() => onActivate(type)}
              >
                {isLoading ? '...' : isAllSelected ? `${btn} ALL` : btn}
              </button>
              </div>
            </div>
            {type === 'fake_hint' && (
              <input
                type="text"
                placeholder="Type your fake hint..."
                value={puMessages}
                onChange={e => setPuMessages(e.target.value)}
                style={{ marginTop: '10px', width: '100%', fontSize: '13px' }}
              />
            )}
            {allUsed && (
              <div style={{ fontSize: '12px', color: 'var(--accent3)', marginTop: '8px' }}>✓ Sent to all teams</div>
            )}
            {!allUsed && usedNames.length > 0 && (
              <div style={{ fontSize: '12px', color: 'var(--accent3)', marginTop: '8px' }}>
                ✓ Used on: {usedNames.join(', ')}
              </div>
            )}
          </div>
        );
      })}

      {/* ── Time Bomb ── */}
      <div style={{
        background: hotPotatoActive
          ? 'linear-gradient(135deg, rgba(208,117,125,0.15) 0%, rgba(222,150,80,0.12) 100%)'
          : 'var(--card)',
        border: `1px solid ${hotPotatoActive ? 'rgba(208,117,125,0.6)' : 'var(--border)'}`,
        borderRadius: '12px',
        padding: '16px 20px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '20px' }}>💣</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '14px', fontWeight: 800, color: hotPotatoActive ? 'var(--accent2)' : 'var(--text)' }}>Time Bomb</div>
            <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '1px' }}>Teams must complete a mission in 3 min or lose 500 pts</div>
          </div>
          {hotPotatoActive && hotPotatoSecondsLeft !== null && (
            <div
              className={hotPotatoSecondsLeft <= 60 ? 'urgent-pulse' : ''}
              style={{
                background: hotPotatoSecondsLeft <= 30 ? 'var(--accent2)' : 'rgba(208,117,125,0.8)',
                color: '#fff', borderRadius: '8px', padding: '4px 10px',
                fontFamily: "'Sora', sans-serif", fontWeight: 800, fontSize: '14px',
                letterSpacing: '1px', flexShrink: 0,
                animation: hotPotatoSecondsLeft <= 30 ? 'pulse 0.5s infinite alternate' : hotPotatoSecondsLeft <= 60 ? undefined : 'none',
              }}
            >
              ⏱ {fmtTimer(hotPotatoSecondsLeft)}
            </div>
          )}
        </div>

        {hotPotatoActive ? (
          <div style={{ fontSize: '13px', color: 'var(--muted)' }}>
            <span style={{ fontWeight: 700, color: 'var(--text)' }}>Active:</span>{' '}
            {hotPotatoMission ? `${hotPotatoMission.icon} ${hotPotatoMission.name}` : hotPotatoActive.mission_id}
            {hotPotatoSecondsLeft === 0 && (
              <span style={{ color: 'var(--accent2)', marginLeft: '8px', fontWeight: 700 }}>⏰ Expired — resolving...</span>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <select
              value={hotPotatoMissionId}
              onChange={e => setHotPotatoMissionId(e.target.value)}
              style={{ ...selectStyle }}
            >
              <option value="">Select mission…</option>
              {gameMissionIds.map(id => {
                const m = MISSIONS.find(x => x.id === id);
                if (!m) return null;
                return <option key={id} value={id}>{m.icon} {m.name}</option>;
              })}
            </select>
            <button
              className="btn btn-primary"
              style={{ padding: '8px 16px', fontSize: '12px', flexShrink: 0, background: 'var(--accent2)', borderColor: 'var(--accent2)' }}
              disabled={!hotPotatoMissionId || hotPotatoLoading}
              onClick={onHotPotato}
            >
              {hotPotatoLoading ? '...' : '💣 ACTIVATE'}
            </button>
          </div>
        )}
      </div>

      {/* ── MYSTERY BOX ───────────────────────────────────── */}
      <div style={{
        background: mysteryBoxActive && mysteryBoxActive.claimed_by === null
          ? 'rgba(222,187,107,0.08)' : 'var(--card)',
        border: `1px solid ${mysteryBoxActive && mysteryBoxActive.claimed_by === null
          ? 'rgba(222,187,107,0.6)' : 'var(--border)'}`,
        borderRadius: '12px', padding: '16px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
          <span style={{ fontSize: '22px' }}>🎁</span>
          <div style={{ fontSize: '14px', fontWeight: 800, color: mysteryBoxActive && mysteryBoxActive.claimed_by === null ? 'var(--gold)' : 'var(--text)' }}>
            AR Mystery Box
          </div>
          {mysteryBoxActive && mysteryBoxActive.claimed_by === null && mysteryBoxSecsLeft !== null && (
            <span style={{
              marginLeft: 'auto',
              fontSize: '13px', fontWeight: 800,
              color: mysteryBoxSecsLeft <= 30 ? 'var(--accent2)' : 'var(--gold)',
              background: 'rgba(222,187,107,0.15)',
              padding: '3px 10px', borderRadius: '20px',
            }}>
              ⏱ {fmtTimer(mysteryBoxSecsLeft)}
            </span>
          )}
        </div>

        {mysteryBoxActive && mysteryBoxActive.claimed_by === null ? (
          <p style={{ fontSize: '12px', color: 'var(--muted)', margin: 0 }}>
            Box is live — teams are racing to open it!
          </p>
        ) : mysteryBoxActive?.claimed_by ? (
          <p style={{ fontSize: '12px', color: 'var(--accent3)', margin: 0 }}>
            ✓ Claimed by a team
          </p>
        ) : (
          <button
            className="btn btn-primary"
            style={{ width: '100%', background: 'var(--gold)', borderColor: 'var(--gold)', color: '#000' }}
            disabled={mysteryBoxLoading || activeGameStatus !== 'active'}
            onClick={onLaunchMysteryBox}
          >
            {mysteryBoxLoading ? '...' : '🎁 Drop AR Mystery Box'}
          </button>
        )}
      </div>
    </div>
  );
}

type Props = { onLogout: () => void };
type AdminView = 'games' | 'create' | 'dashboard' | 'missions' | 'templates' | 'manage-templates' | 'analytics' | 'my-analytics' | 'branding';

type AdminCategory = { id: string; name: string; emoji: string; sort_order: number };

type MissionFormData = {
  name: string;
  icon: string;
  desc: string;
  difficulty: 'easy' | 'medium' | 'hard';
  maxPts: number;
  type: string;
  // trivia_quiz
  triviaRounds: { question: string; options: [string, string, string, string]; answer: string }[];
  // truefalse
  statements: { text: string; answer: boolean }[];
  // closest_wins
  closestQuestions: { q: string; answer: string; unit: string; hint: string }[];
  // pa_sparet
  clues: string[];
  paAnswer: string;
  // timeline
  timelineItems: { label: string; year: string }[];
  // photo
  photoPrompt: string;
  // relay
  relaySegments: string[];
  relayMode: 'typerace' | 'button';
  // shared_secret
  sharedSecretAnswer: string;
  sharedSecretHint: string;
  // seasonal window — ISO date strings ('' = unset)
  activeFrom: string;
  activeUntil: string;
};

const EMPTY_FORM: MissionFormData = {
  name: '', icon: '⭐', desc: '', difficulty: 'medium', maxPts: 500, type: '',
  triviaRounds: [], statements: [], closestQuestions: [],
  clues: [], paAnswer: '', timelineItems: [], photoPrompt: '',
  relaySegments: ['', '', '', ''],
  relayMode: 'typerace',
  sharedSecretAnswer: '',
  sharedSecretHint: '',
  activeFrom: '', activeUntil: '',
};

const RANK_ICONS = ['🥇', '🥈', '🥉'];
const RANK_COLORS = ['var(--gold)', 'var(--silver)', 'var(--bronze)'];

type PhotoSubmission = {
  id: string; team_id: string; team_name: string;
  mission_id: string; photo_url: string; status: string;
  points_awarded: number | null; ai_rated?: boolean; created_at: string;
};

type ScavengerSubmission = {
  id: string; team_id: string; team_name: string;
  game_id: string; mission_id: string;
  item_id: string; item_label: string;
  photo_url: string; status: string;
  points_awarded: number | null; ai_rated?: boolean; created_at: string;
};
function getPointOptions(maxPts: number): number[] {
  const steps = 5;
  const step = Math.ceil(maxPts / steps / 100) * 100;
  const opts: number[] = [0];
  for (let i = 1; i <= steps; i++) {
    const v = Math.min(i * step, maxPts);
    if (!opts.includes(v)) opts.push(v);
  }
  if (!opts.includes(maxPts)) opts.push(maxPts);
  return opts;
}

type MissionEntry = { id: string; name: string; icon: string };

function MissionProgressTable({ missions, sorted, accentColor }: {
  missions: MissionEntry[];
  sorted: Team[];
  accentColor: string;
}) {
  const borderColor = accentColor.startsWith('var(') ? 'var(--border)' : `${accentColor}33`;
  return (
    <div style={{ background: 'var(--card)', border: `1px solid ${borderColor}`, borderRadius: '12px', overflow: 'auto' }}>
      <table className="progress-table">
        <thead>
          <tr>
            <th>Team</th>
            {missions.map(m => (
              <th key={m.id} title={m.name}>{m.icon}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 ? (
            <tr><td colSpan={missions.length + 1} style={{ textAlign: 'center', padding: '24px', color: 'var(--muted)', fontSize: '12px' }}>Waiting for teams...</td></tr>
          ) : sorted.map(t => (
            <tr key={t.id}>
              <td><strong>{t.name}</strong></td>
              {missions.map(m => {
                const done = t.completed?.includes(m.id);
                const pts = done ? (t.mission_scores?.[m.id] ?? null) : null;
                return (
                  <td key={m.id}>
                    {done
                      ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: accentColor, fontWeight: 700, fontSize: '12px' }}>
                          <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: accentColor, display: 'inline-block', flexShrink: 0 }} />
                          {pts !== null ? pts : '✓'}
                        </span>
                      : <span style={{ color: 'var(--muted)' }}>–</span>
                    }
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const ONBOARDING_STEPS = [
  {
    icon: '🎮',
    title: 'Welcome to GameOn',
    subtitle: 'Create and run live scavenger hunts & team games in minutes. Here\'s how it works:',
    bullets: [
      'Pick missions from the library or create your own',
      'Share the game code — teams join on their phones',
      'Watch scores update live and control the game from here',
    ],
  },
  {
    icon: '🗺️',
    title: 'Create your first game',
    subtitle: 'Tap + New Game to pick a template, choose missions, and set a time limit. It takes less than 2 minutes.',
    bullets: [
      'Start from a template or build from scratch',
      'Mix standard missions with your own custom ones',
      'Add custom branding for your organisation',
    ],
  },
  {
    icon: '🚀',
    title: "You're ready to play",
    subtitle: 'Share the 4-letter game code with your teams. Once everyone\'s joined, hit Start Game from the dashboard.',
    bullets: [
      'Teams join at playgameon.app — no app download needed',
      'Live leaderboard updates as missions are completed',
      'Rate photo submissions manually or let AI do it automatically',
    ],
  },
];

function OnboardingModal({
  step,
  onNext,
  onBack,
  onSkip,
  onFinish,
}: {
  step: number;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
  onFinish: () => void;
}) {
  const s = ONBOARDING_STEPS[step];
  const isLast = step === ONBOARDING_STEPS.length - 1;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(10,14,25,0.75)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '16px',
    }}>
      <div style={{
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: '14px',
        width: '100%', maxWidth: '440px',
        position: 'relative',
        overflow: 'hidden',
        fontFamily: "'Sora', sans-serif",
      }}>
        {/* Top accent bar */}
        <div style={{
          height: '3px',
          background: 'linear-gradient(90deg, var(--accent), var(--accent-hover))',
        }} />

        <div style={{ padding: '28px 28px 24px' }}>
          {/* Close button */}
          <button
            onClick={onSkip}
            style={{
              position: 'absolute', top: '14px', right: '14px',
              background: 'transparent', border: 'none',
              color: 'var(--muted)', fontSize: '18px', cursor: 'pointer',
              lineHeight: 1, padding: '4px',
            }}
            aria-label="Close"
          >✕</button>

          {/* Progress bars */}
          <div style={{ display: 'flex', gap: '6px', marginBottom: '28px' }}>
            {ONBOARDING_STEPS.map((_, i) => (
              <div key={i} style={{
                height: '4px', flex: 1, borderRadius: '2px',
                background: i < step
                  ? 'rgba(117,171,200,0.45)'
                  : i === step
                    ? 'var(--accent)'
                    : 'var(--border)',
              }} />
            ))}
          </div>

          {/* Step icon */}
          <div style={{
            width: '52px', height: '52px', borderRadius: '14px',
            background: 'var(--accent-dim)',
            border: '1px solid var(--accent-border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '24px', marginBottom: '16px',
          }}>
            {s.icon}
          </div>

          {/* Title */}
          <h2 style={{
            fontSize: '18px', fontWeight: 700, color: 'var(--text)',
            marginBottom: '8px', lineHeight: 1.3,
          }}>
            {s.title}
          </h2>

          {/* Subtitle */}
          <p style={{
            fontSize: '13px', color: 'var(--muted)',
            lineHeight: 1.6, marginBottom: '20px',
          }}>
            {s.subtitle}
          </p>

          {/* Bullets */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '28px' }}>
            {s.bullets.map((b, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '13px', color: 'var(--text)' }}>
                <div style={{
                  width: '20px', height: '20px', borderRadius: '50%', flexShrink: 0,
                  background: 'var(--accent-dim)', border: '1px solid var(--accent-border)',
                  color: 'var(--accent)', fontSize: '11px', fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginTop: '1px',
                }}>
                  {i + 1}
                </div>
                <span>{b}</span>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            {isLast ? (
              <button className="btn btn-ghost" style={{ fontSize: '12px' }} onClick={onBack}>← Back</button>
            ) : step === 0 ? (
              <button className="btn btn-ghost" style={{ fontSize: '12px' }} onClick={onSkip}>Skip tour</button>
            ) : (
              <button className="btn btn-ghost" style={{ fontSize: '12px' }} onClick={onBack}>← Back</button>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '11px', color: 'var(--muted)' }}>{step + 1} / {ONBOARDING_STEPS.length}</span>
              {isLast ? (
                <button className="btn btn-primary" style={{ fontSize: '13px' }} onClick={onFinish}>
                  Create my first game 🎉
                </button>
              ) : (
                <button className="btn btn-primary" style={{ fontSize: '13px' }} onClick={onNext}>
                  {step === 0 ? 'Get started →' : 'Next →'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── BrandingView ──────────────────────────────────────────────────────────
function BrandingView({ authToken, onBack, profileMenu }: {
  authToken: string | null;
  onBack: () => void;
  profileMenu: React.ReactNode;
}) {
  const [logoUrl, setLogoUrl] = useState('');
  const [color, setColor] = useState('');
  const [name, setName] = useState('');
  const [applyToAll, setApplyToAll] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!authToken) return;
    fetch('/api/admin/branding', { headers: { Authorization: `Bearer ${authToken}` } })
      .then(r => r.json())
      .then(d => {
        setLogoUrl(d.brand_logo_url ?? '');
        setColor(d.brand_primary_color ?? '');
        setName(d.brand_name ?? '');
        setApplyToAll(d.apply_to_all_games ?? false);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, [authToken]);

  async function save() {
    setSaving(true);
    setSaved(false);
    setError('');
    const res = await fetch('/api/admin/branding', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}) },
      body: JSON.stringify({
        brand_logo_url: logoUrl || null,
        brand_primary_color: color || null,
        brand_name: name || null,
        apply_to_all_games: applyToAll,
      }),
    });
    setSaving(false);
    if (res.ok) { setSaved(true); setTimeout(() => setSaved(false), 3000); }
    else setError('Could not save. Please try again.');
  }

  return (
    <>
      <nav className="nav">
        <button className="btn btn-ghost" style={{ padding: '8px 14px', fontSize: '12px' }} onClick={onBack}>← Back</button>
        <div className="nav-brand" style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: '15px' }}>White-label Branding</div>
        {profileMenu}
      </nav>

      <div className="container" style={{ maxWidth: 560, paddingTop: '32px' }}>
        {!loaded ? (
          <p style={{ color: 'var(--muted)', textAlign: 'center', paddingTop: '60px' }}>Loading…</p>
        ) : (
          <>
            <p style={{ color: 'var(--muted)', fontSize: '13px', marginBottom: '28px', lineHeight: 1.6 }}>
              Add your company identity to the player view. The logo appears in a slim strip below the nav, and the primary color replaces the default GameOn accent color for buttons and highlights.
            </p>

            {/* Apply to all toggle */}
            <div
              onClick={() => setApplyToAll(v => !v)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', padding: '14px 16px', background: 'var(--surface)', border: `1px solid ${applyToAll ? 'var(--accent)' : 'var(--border)'}`, borderRadius: '10px', marginBottom: '24px' }}
            >
              <div>
                <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text)' }}>Apply to all my games</div>
                <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '3px' }}>
                  When on, every new game you create will automatically use this branding.
                </div>
              </div>
              <div style={{ width: '36px', height: '20px', borderRadius: '10px', background: applyToAll ? 'var(--accent)' : 'var(--border)', position: 'relative', flexShrink: 0, marginLeft: '16px' }}>
                <div style={{ position: 'absolute', top: '2px', left: applyToAll ? '18px' : '2px', width: '16px', height: '16px', borderRadius: '50%', background: '#fff', transition: 'left 0.15s' }} />
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Brand name */}
              <div>
                <label className="form-label">Brand name</label>
                <input
                  className="form-input"
                  placeholder="Acme Corp"
                  value={name}
                  onChange={e => { setName(e.target.value); setSaved(false); }}
                />
              </div>

              {/* Logo URL */}
              <div>
                <label className="form-label">Logo URL</label>
                <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '6px' }}>PNG or SVG with transparent background recommended</div>
                <input
                  className="form-input"
                  placeholder="https://example.com/logo.png"
                  value={logoUrl}
                  onChange={e => { setLogoUrl(e.target.value); setSaved(false); }}
                />
                {logoUrl && (
                  <div style={{ marginTop: '10px', padding: '12px 16px', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <img src={logoUrl} alt="Logo preview" style={{ height: '36px', maxWidth: '140px', objectFit: 'contain' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    <span style={{ fontSize: '11px', color: 'var(--muted)' }}>Preview</span>
                  </div>
                )}
              </div>

              {/* Primary color */}
              <div>
                <label className="form-label">Primary color</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <input
                    type="color"
                    value={color || '#7cbdd4'}
                    onChange={e => { setColor(e.target.value); setSaved(false); }}
                    style={{ width: '48px', height: '40px', padding: '2px', border: '1px solid var(--border)', borderRadius: '8px', background: 'var(--card)', cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: '13px', color: 'var(--muted)', fontFamily: 'monospace' }}>{color || '#7cbdd4'}</span>
                  {color && (
                    <button className="btn btn-ghost" style={{ padding: '6px 12px', fontSize: '11px' }} onClick={() => { setColor(''); setSaved(false); }}>
                      Reset
                    </button>
                  )}
                </div>
              </div>
            </div>

            {error && <p style={{ color: 'var(--accent2)', fontSize: '13px', marginTop: '16px' }}>{error}</p>}

            <button
              className="btn btn-primary btn-full"
              style={{ marginTop: '28px' }}
              onClick={save}
              disabled={saving}
            >
              {saving ? 'Saving…' : saved ? '✓ Saved!' : 'Save Branding'}
            </button>

            <p style={{ fontSize: '11px', color: 'var(--muted)', textAlign: 'center', marginTop: '12px', lineHeight: 1.5 }}>
              Changes apply to new games only. To update an existing game, contact support or re-create it.
            </p>
          </>
        )}
      </div>
    </>
  );
}

export default function AdminScreen({ onLogout }: Props) {
  const [view, setView] = useState<AdminView>('games');
  const [games, setGames] = useState<Game[]>([]);
  const [analyticsGames, setAnalyticsGames] = useState<Game[]>([]);
  const [activeGame, setActiveGame] = useState<Game | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [photos, setPhotos] = useState<PhotoSubmission[]>([]);
  const [scavengerSubs, setScavengerSubs] = useState<ScavengerSubmission[]>([]);
  const [tab, setTab] = useState<'leaderboard' | 'progress' | 'photos' | 'powerups' | 'stats'>('leaderboard');
  const isMobile = useIsMobile();
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  const [photoTeamFilter, setPhotoTeamFilter] = useState<string>('all');
  const [visiblePendingCount, setVisiblePendingCount] = useState(10);
  const [visibleScavengerCount, setVisibleScavengerCount] = useState(10);
  const [visibleRatedCount, setVisibleRatedCount] = useState(20);
  const [downloadingZip, setDownloadingZip] = useState(false);
  const [qrExpanded, setQrExpanded] = useState(false);
  const [photoModal, setPhotoModal] = useState<{ url: string; label: string } | null>(null);
  const [rated, setRated] = useState<Set<string>>(new Set());
  const [scavengerRated, setScavengerRated] = useState<Set<string>>(new Set());
  const [powerupsUsed, setPowerupsUsed] = useState<string[]>([]);
  const [puTargets, setPuTargets] = useState<Record<string, string>>({
    sabotage: '', double_points: '', fake_hint: '', final_frenzy: 'all',
  });
  const [puMessages, setPuMessages] = useState('');
  const [puLoading, setPuLoading] = useState<string | null>(null);
  // Time Bomb
  const [hotPotatoMissionId, setHotPotatoMissionId] = useState('');
  const [hotPotatoLoading, setHotPotatoLoading] = useState(false);
  const [hotPotatoActive, setHotPotatoActive] = useState<HotPotatoState>(null);
  const [mysteryBoxActive, setMysteryBoxActive] = useState<MysteryBoxState>(null);
  const [showMysteryBoxAR, setShowMysteryBoxAR] = useState(false);
  const [mysteryBoxLoading, setMysteryBoxLoading] = useState(false);
  const mysteryBoxSecsLeft = useMysteryBoxCountdown(mysteryBoxActive);

  const [authToken, setAuthToken] = useState<string | null>(null);
  // Ref so closures (polling interval, startOrStop) always read the latest token
  // without needing to be in useCallback/useEffect dependency arrays.
  const authTokenRef = useRef<string | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [templates, setTemplates] = useState<GameTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [saveTemplateId, setSaveTemplateId] = useState<string | null>(null);
  const [saveTemplateName, setSaveTemplateName] = useState('');
  const [saveTemplateIcon, setSaveTemplateIcon] = useState('🎮');
  const [saveTemplateLoading, setSaveTemplateLoading] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [editTemplateName, setEditTemplateName] = useState('');
  const [editTemplateIcon, setEditTemplateIcon] = useState('🎮');
  const [editTemplateMissions, setEditTemplateMissions] = useState<string[]>([]);
  const [editTemplateLoading, setEditTemplateLoading] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateIcon, setNewTemplateIcon] = useState('🎮');
  const [newTemplateMissions, setNewTemplateMissions] = useState<string[]>([]);
  const [showNewTemplateForm, setShowNewTemplateForm] = useState(false);
  const [manageTemplatesLoading, setManageTemplatesLoading] = useState(false);
  // New template form — extra fields
  const [newTemplateDesc, setNewTemplateDesc] = useState('');
  const [newTemplateActiveFrom, setNewTemplateActiveFrom] = useState('');
  const [newTemplateActiveTo, setNewTemplateActiveTo] = useState('');
  const [newTemplateDescLoading, setNewTemplateDescLoading] = useState(false);

  // Edit template form — extra fields
  const [editTemplateDesc, setEditTemplateDesc] = useState('');
  const [editTemplateActiveFrom, setEditTemplateActiveFrom] = useState('');
  const [editTemplateActiveTo, setEditTemplateActiveTo] = useState('');
  const [editTemplateDescLoading, setEditTemplateDescLoading] = useState(false);

  // AI generate modal
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [generatePrompt, setGeneratePrompt] = useState('');
  const [generateLoading, setGenerateLoading] = useState(false);
  const [generatePreview, setGeneratePreview] = useState<{
    name: string; icon: string; description: string;
    activeFrom: string | null; activeTo: string | null;
    selectedMissionIds: string[]; newMissions: Array<{ title: string; icon: string; type: string; points: number; description: string }>;
  } | null>(null);
  const [generateSaving, setGenerateSaving] = useState(false);
  const [generateIsBuiltin, setGenerateIsBuiltin] = useState(false);

  // AI photo rating
  const [aiPhotoRating, setAiPhotoRating] = useState(false);
  const [aiPhotoInstructions, setAiPhotoInstructions] = useState('');
  const [aiRatingEnabled, setAiRatingEnabled] = useState(false);
  const [aiRatingInstructions, setAiRatingInstructions] = useState('');
  const [overridingPhotoId, setOverridingPhotoId] = useState<string | null>(null);
  const [plan, setPlan] = useState<'free' | 'pro' | 'studio'>('free');
  const [upgradeLoading, setUpgradeLoading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [userName, setUserName] = useState('');
  const [showProfile, setShowProfile] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  // Analytics state
  type AnalyticsGame = { id: string; name: string | null; teamCount: number; topScore: number; finished: boolean; startedAt: string | null };
  type AnalyticsCustomer = { id: string; email: string; gameCount: number; avgTeams: number; completionRate: number; lastActive: string | null; plan: 'free' | 'pro' | 'studio'; games: AnalyticsGame[] };
  type AnalyticsMissionStat = { id: string; name: string; gameCount: number; completedCount: number; totalTeams: number; completionRate: number };
  type AnalyticsKPIs = { totalGames: number; finishedGames: number; activeCustomers: number; activeCustomers30d: number; completionRate: number; avgTeamsPerGame: number; totalTeams: number };
  type AnalyticsData = { kpis: AnalyticsKPIs; customers: AnalyticsCustomer[]; missionStats: AnalyticsMissionStat[]; gamesPerWeek: Array<{ weekLabel: string; count: number }>; planCounts: { free: number; pro: number; studio: number } };

  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [expandedCustomer, setExpandedCustomer] = useState<string | null>(null);
  const [analyticsTab, setAnalyticsTab] = useState<'customers' | 'missions'>('customers');
  const [analyticsError, setAnalyticsError] = useState(false);
  const [adminCustomMissions, setAdminCustomMissions] = useState<import('@/lib/supabase').CustomMission[]>([]);
  const [playedMissionIds, setPlayedMissionIds] = useState<string[]>([]);
  const [hidePlayedMissions, setHidePlayedMissions] = useState<boolean>(false);
  const [showMissionForm, setShowMissionForm] = useState(false);
  const [editingMissionId, setEditingMissionId] = useState<string | null>(null);
  const [missionForm, setMissionForm] = useState<MissionFormData>(EMPTY_FORM);
  const [missionFormError, setMissionFormError] = useState('');
  const [missionCategoryId, setMissionCategoryId] = useState<string | null>(null);
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiType, setAiType] = useState('');
  const [aiLanguage, setAiLanguage] = useState('en');
  const [aiCount, setAiCount] = useState(1);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiError, setAiError] = useState('');
  const [aiBulkPreview, setAiBulkPreview] = useState<Array<{ selected: boolean; mission: Record<string, unknown> }> | null>(null);
  const [aiBulkSaving, setAiBulkSaving] = useState(false);
  const [adminCategories, setAdminCategories] = useState<AdminCategory[]>([]);
  const [missionFilterCategory, setMissionFilterCategory] = useState<string | null>(null);
  const [missionFilterType, setMissionFilterType] = useState<string | null>(null);
  const [draggingMissionId, setDraggingMissionId] = useState<string | null>(null);
  const [dropTargetCatId, setDropTargetCatId] = useState<string | null>(null);
  const [categoryFormOpen, setCategoryFormOpen] = useState(false);
  const [categoryFormName, setCategoryFormName] = useState('');
  const [categoryFormEmoji, setCategoryFormEmoji] = useState('📋');
  const [categoryEmojiPickerOpen, setCategoryEmojiPickerOpen] = useState(false);
  const [categorySaving, setCategorySaving] = useState(false);
  const [categoryError, setCategoryError] = useState('');
  const [pendingDeleteCategoryId, setPendingDeleteCategoryId] = useState<string | null>(null);
  const [missionSaving, setMissionSaving] = useState(false);
  const [deletingMissionId, setDeletingMissionId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<{ id: string; msg: string; type: 'success' | 'error' }[]>([]);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);

  // Load auth token on mount and subscribe to changes
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const token = session?.access_token ?? null;
      authTokenRef.current = token;
      setAuthToken(token);
      // Load subscription plan and custom missions once we have a token
      if (token) {
        fetch('/api/admin/subscription', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        }).then(r => r.json()).then(d => { if (d.plan) setPlan(d.plan); }).catch(() => {});
        loadAdminCustomMissions();
        fetch('/api/admin/branding', { headers: { Authorization: `Bearer ${token}` } })
          .then(r => r.json())
          .then(d => { if (!d.onboarded_at) setShowOnboarding(true); })
          .catch(() => {});
      }
    });
    // Use getUser() for fresh server-side data (not cached JWT)
    supabase.auth.getUser().then(({ data: { user } }) => {
      setIsSuperAdmin(user?.app_metadata?.role === 'superadmin');
      setUserEmail(user?.email ?? '');
      setUserName(user?.user_metadata?.full_name ?? user?.user_metadata?.name ?? '');
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const token = session?.access_token ?? null;
      authTokenRef.current = token;
      setAuthToken(token);
      setIsSuperAdmin(session?.user?.app_metadata?.role === 'superadmin');
    });
    return () => subscription.unsubscribe();
  }, []);

  // Create form state
  const [gameName, setGameName] = useState('');
  const [duration, setDuration] = useState(45);
  const [selectedMissions, setSelectedMissions] = useState<string[]>(MISSIONS.map(m => m.id));
  const [missionMaxPts, setMissionMaxPts] = useState<Record<string, number>>(
    Object.fromEntries(MISSIONS.map(m => [m.id, m.maxPts]))
  );
  const [hideLeaderboard, setHideLeaderboard] = useState(false);
  const [remoteMode, setRemoteMode] = useState(false);
  const [gameLanguage, setGameLanguage] = useState('en');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [expandedTeamId, setExpandedTeamId] = useState<string | null>(null);

  // Timestamp of the last admin command (start/finish/restart).
  // Polls that started BEFORE a command are discarded to prevent race conditions.
  const lastCommandAtRef = useRef(0);
  const aiAbortRef = useRef<AbortController | null>(null);

  async function completeOnboarding(navigateToCreate = false) {
    setShowOnboarding(false);
    setOnboardingStep(0);
    await fetch('/api/admin/onboarding', {
      method: 'POST',
      headers: { Authorization: `Bearer ${authTokenRef.current}` },
    }).catch(() => {});
    if (navigateToCreate) { loadTemplates(); setView('templates'); }
  }

  const POST = useCallback((url: string, body?: object) => fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {}),
    },
    body: JSON.stringify(body ?? {}),
    cache: 'no-store',
  }), [authToken]);

  const loadGames = useCallback(async () => {
    const res = await POST('/api/admin/game', { action: 'list' });
    const data = await res.json();
    if (data.games) setGames(data.games);
  }, [POST]);

  const loadAnalyticsGames = useCallback(async () => {
    const res = await fetch('/api/admin/game?includeDeleted=true', {
      headers: { Authorization: `Bearer ${authToken}` },
      cache: 'no-store',
    });
    const data = await res.json();
    if (data.games) setAnalyticsGames(data.games);
  }, [authToken]);

  const loadGameData = useCallback(async (game: Game) => {
    const [teamsRes, photosRes, scavengerRes, gameRes, settingsRes] = await Promise.all([
      POST('/api/admin/teams', { gameId: game.id }),
      POST('/api/admin/photos'),
      POST('/api/scavenger/submissions'),
      POST('/api/game', { key: game.game_key }),
      POST('/api/settings', { gameId: game.id }),
    ]);
    const [td, pd, scvd, gd, sd] = await Promise.all([
      teamsRes.json(), photosRes.json(), scavengerRes.json(), gameRes.json(), settingsRes.json(),
    ]);
    if (td.teams) setTeams(td.teams);
    if (pd.submissions) setPhotos(pd.submissions.filter((s: PhotoSubmission) =>
      td.teams?.some((t: Team) => t.id === s.team_id)
    ));
    if (scvd.submissions) setScavengerSubs(scvd.submissions.filter((s: ScavengerSubmission) =>
      td.teams?.some((t: Team) => t.id === s.team_id)
    ));
    if (gd.game) {
      const STATUS_ORDER: Record<string, number> = { draft: 0, active: 1, finished: 2 };
      setActiveGame(prev => {
        if (!prev) return gd.game;
        return (STATUS_ORDER[gd.game.status] ?? 0) >= (STATUS_ORDER[prev.status] ?? 0) ? gd.game : prev;
      });
    }
    if (sd.powerups_used) setPowerupsUsed(sd.powerups_used);
    setHotPotatoActive(sd.hot_potato ?? null);
    setMysteryBoxActive(sd.mystery_box ?? null);
  }, [POST]);

  useEffect(() => { if (authToken) loadGames(); }, [loadGames, authToken]);

  useEffect(() => {
    if (view === 'my-analytics' && analyticsGames.length === 0) {
      loadAnalyticsGames();
    }
  }, [view, analyticsGames.length, loadAnalyticsGames]);

  useEffect(() => {
    if (!authToken) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/admin/played-missions', {
          headers: { 'Authorization': `Bearer ${authToken}` },
          cache: 'no-store',
        });
        if (!res.ok) return;
        const data = await res.json() as { playedIds?: string[] };
        if (!cancelled && Array.isArray(data.playedIds)) {
          setPlayedMissionIds(data.playedIds);
        }
      } catch {
        // Non-fatal — toggle simply has no effect.
      }
    })();
    return () => { cancelled = true; };
  }, [authToken]);

  // Only restart the polling interval when the game ID changes (not when game data updates).
  // Using activeGame?.id prevents an infinite loop where setActiveGame → effect re-runs → setActiveGame…
  const activeGameId = activeGame?.id;
  const activeGameKey = activeGame?.game_key;
  useEffect(() => {
    if (!activeGameId || !activeGameKey) return;
    // Snapshot id/key so the interval closure is stable
    const gameId = activeGameId;
    const gameKey = activeGameKey;
    // Status priority: draft(0) < active(1) < finished(2)
    // Never allow polling to downgrade status (fixes race between poll and startOrStop)
    const STATUS_ORDER: Record<string, number> = { draft: 0, active: 1, finished: 2 };
    function applyGame(fetched: Game) {
      setActiveGame(prev => {
        if (!prev) return fetched;
        const prevLevel = STATUS_ORDER[prev.status] ?? 0;
        const newLevel = STATUS_ORDER[fetched.status] ?? 0;
        // Allow upgrades (draft→active, active→finished) but never downgrades
        return newLevel >= prevLevel ? fetched : prev;
      });
    }

    // Helper that always reads the latest token from the ref — avoids stale closure bug
    // when the interval is set up before getSession() resolves.
    function postWithAuth(url: string, body?: object) {
      const token = authTokenRef.current;
      return fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body ?? {}),
        cache: 'no-store',
      });
    }

    async function poll() {
      const pollStartedAt = Date.now();

      const [teamsRes, photosRes, scavengerRes, gameRes, settingsRes] = await Promise.all([
        postWithAuth('/api/admin/teams', { gameId }),
        postWithAuth('/api/admin/photos'),
        postWithAuth('/api/scavenger/submissions'),
        postWithAuth('/api/game', { key: gameKey }),
        postWithAuth('/api/settings', { gameId }),
      ]);
      const [td, pd, scvd, gd, sd] = await Promise.all([
        teamsRes.json(), photosRes.json(), scavengerRes.json(), gameRes.json(), settingsRes.json(),
      ]);

      if (pollStartedAt < lastCommandAtRef.current) return;

      if (td.teams) setTeams(td.teams);
      if (pd.submissions) setPhotos(pd.submissions.filter((s: PhotoSubmission) =>
        td.teams?.some((t: Team) => t.id === s.team_id)
      ));
      if (scvd.submissions) setScavengerSubs(scvd.submissions.filter((s: ScavengerSubmission) =>
        td.teams?.some((t: Team) => t.id === s.team_id)
      ));
      if (gd.game) applyGame(gd.game);
      if (sd.powerups_used) setPowerupsUsed(sd.powerups_used);

      const hp = sd.hot_potato ?? null;
      setHotPotatoActive(hp);

      // Auto-resolve expired hot potato
      if (hp && new Date(hp.expires_at) <= new Date()) {
        await postWithAuth('/api/admin/powerup/resolve-hot-potato', { gameId });
        // Refresh settings after resolution
        const freshSd = await postWithAuth('/api/settings', { gameId }).then(r => r.json());
        if (freshSd.powerups_used) setPowerupsUsed(freshSd.powerups_used);
        setHotPotatoActive(freshSd.hot_potato ?? null);
      }

      const mb = sd.mystery_box ?? null;
      setMysteryBoxActive(mb);

      // Auto-expire mystery box when countdown reaches 0
      if (mb && mb.claimed_by === null && new Date(mb.expires_at) <= new Date()) {
        await postWithAuth('/api/admin/mystery-box', { gameId, action: 'expire' });
        const freshSd = await postWithAuth('/api/settings', { gameId }).then(r => r.json());
        setMysteryBoxActive(freshSd.mystery_box ?? null);
      }
    }
    poll();
    const id = setInterval(poll, 5000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeGameId]);

  // Sync AI rating live-toggle state when switching to a different game
  // eslint-disable-next-line react-hooks/exhaustive-deps
  // Intentionally keyed on activeGameId (not activeGame object) — avoids re-running on every
  // poll cycle. Matches the polling useEffect pattern above.
  useEffect(() => {
    if (activeGame) {
      setAiRatingEnabled(activeGame.ai_photo_rating ?? false);
      setAiRatingInstructions(activeGame.ai_photo_instructions ?? '');
    }
    setOverridingPhotoId(null);
    setExpandedTeamId(null);
  }, [activeGameId]);

  // Ensure custom missions + categories are loaded when the progress tab opens.
  // Guards against the rare race where loadAdminCustomMissions ran before the
  // auth token was ready on mount.
  useEffect(() => {
    if (tab === 'progress' && adminCustomMissions.length === 0) {
      loadAdminCustomMissions();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  async function createGame() {
    if (!gameName.trim()) { setCreateError('Enter a game name.'); return; }
    if (!selectedMissions.length) { setCreateError('Select at least one mission.'); return; }
    setCreating(true); setCreateError('');
    // Only include custom pts that differ from the mission default
    const customPts: Record<string, number> = {};
    for (const id of selectedMissions) {
      const builtIn = MISSIONS.find(x => x.id === id);
      const customM = adminCustomMissions.find(x => x.id === id);
      const defaultPts = builtIn?.maxPts ?? customM?.max_pts ?? 500;
      const currentPts = missionMaxPts[id] ?? defaultPts;
      if (currentPts !== defaultPts) customPts[id] = currentPts;
    }
    const res = await fetch('/api/admin/game', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {}) },
      body: JSON.stringify({ name: gameName, missions: selectedMissions, duration_minutes: duration, mission_max_pts: customPts, hide_leaderboard: hideLeaderboard, ai_photo_rating: aiPhotoRating, ai_photo_instructions: aiPhotoInstructions || null, language: gameLanguage, remote_mode: remoteMode }),
    });
    const data = await res.json();
    if (!res.ok) { setCreateError(data.error); setCreating(false); return; }
    setActiveGame(data.game);
    setView('dashboard');
    setCreating(false);
    loadGames();
  }

  async function startOrStop(action: 'start' | 'finish' | 'restart') {
    if (!activeGame) return;
    // Stamp the command time BEFORE the fetch so any poll in-flight right now
    // (which started before this stamp) gets discarded when it returns.
    lastCommandAtRef.current = Date.now();
    const token = authTokenRef.current;
    const res = await fetch('/api/admin/game/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
      body: JSON.stringify({ gameId: activeGame.id, action }),
    });
    const data = await res.json();
    // Directly set the authoritative state returned by the command.
    // This intentionally bypasses applyGame so a restart can go from
    // finished → draft without the status-priority guard blocking it.
    if (data.game) setActiveGame(data.game);
  }

  async function downloadReport() {
    if (!activeGame || !authToken) return;
    setReportLoading(true);
    setReportError(null);
    try {
      const res = await fetch(`/api/admin/game/${activeGame.id}/report`, {
        headers: { 'Authorization': `Bearer ${authToken}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: 'Unknown error' }));
        console.error('[report] failed:', body);
        setReportError('Kunde inte generera rapporten. Försök igen.');
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${activeGame.name.replace(/\s+/g, '-')}-report.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('[report] network error:', err);
      setReportError('Nätverksfel. Kontrollera anslutningen och försök igen.');
    } finally {
      setReportLoading(false);
    }
  }

  async function deleteGame(gameId: string) {
    setDeletingId(gameId);
    await POST('/api/admin/game', { action: 'delete', gameId });
    setDeletingId(null);
    setConfirmDeleteId(null);
    await loadGames();
  }

  async function downloadPhotosZip() {
    setDownloadingZip(true);
    try {
      const zip = new JSZip();
      const allPhotos: { url: string; filename: string }[] = [];

      const regularFiltered = photos.filter(s => photoTeamFilter === 'all' || s.team_id === photoTeamFilter);
      const scavengerFiltered = scavengerSubs.filter(s => photoTeamFilter === 'all' || s.team_id === photoTeamFilter);

      for (const sub of regularFiltered) {
        const ext = sub.photo_url.split('?')[0].split('.').pop() ?? 'jpg';
        const safeMission = sub.mission_id.replace(/[^a-z0-9_-]/gi, '_');
        const safeTeam = sub.team_name.replace(/[^a-z0-9_-]/gi, '_');
        allPhotos.push({ url: sub.photo_url, filename: `${safeTeam}/${safeMission}.${ext}` });
      }

      for (const sub of scavengerFiltered) {
        const ext = sub.photo_url.split('?')[0].split('.').pop() ?? 'jpg';
        const safeLabel = (sub.item_label ?? sub.item_id).replace(/[^a-z0-9_-]/gi, '_');
        const safeTeam = sub.team_name.replace(/[^a-z0-9_-]/gi, '_');
        allPhotos.push({ url: sub.photo_url, filename: `${safeTeam}/scavenger_${safeLabel}.${ext}` });
      }

      if (allPhotos.length === 0) return;

      await Promise.all(allPhotos.map(async ({ url, filename }) => {
        try {
          const res = await fetch(url);
          const blob = await res.blob();
          zip.file(filename, blob);
        } catch {
          // skip photos that fail to fetch
        }
      }));

      const content = await zip.generateAsync({ type: 'blob' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(content);
      const safeName = (activeGame?.name ?? 'game').replace(/[^a-z0-9_-]/gi, '-').replace(/-+/g, '-');
      a.download = `GameOn-photos-${safeName}.zip`;
      a.click();
      URL.revokeObjectURL(a.href);
    } finally {
      setDownloadingZip(false);
    }
  }

  async function ratePhoto(sub: PhotoSubmission, pts: number) {
    await fetch('/api/admin/photos/rate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {}) },
      body: JSON.stringify({ submissionId: sub.id, teamId: sub.team_id, missionId: sub.mission_id, points: pts }),
    });
    setRated(r => new Set([...r, sub.id]));
    if (activeGame) loadGameData(activeGame);
  }

  async function rateScavengerPhoto(sub: ScavengerSubmission, pts: number) {
    await fetch('/api/scavenger/review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {}) },
      body: JSON.stringify({ submissionId: sub.id, teamId: sub.team_id, missionId: sub.mission_id, itemLabel: sub.item_label, points: pts }),
    });
    setScavengerRated(r => new Set([...r, sub.id]));
    if (activeGame) loadGameData(activeGame);
  }

  async function activateHotPotato() {
    if (!hotPotatoMissionId || !activeGame) return;
    const mission = MISSIONS.find(m => m.id === hotPotatoMissionId);
    if (!mission) return;
    setHotPotatoLoading(true);
    try {
      const res = await POST('/api/admin/powerup', {
        type: 'hot_potato',
        missionId: hotPotatoMissionId,
        missionName: mission.name,
        gameId: activeGame.id,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Unknown error' }));
        showToast(`Time Bomb failed: ${err.error ?? res.statusText}`, 'error');
        return;
      }
      const data = await res.json();
      setHotPotatoActive({ mission_id: hotPotatoMissionId, expires_at: data.expiresAt, penalty_pts: 500, game_id: activeGame.id });
      setHotPotatoMissionId('');
    } finally {
      setHotPotatoLoading(false);
    }
  }

  async function launchMysteryBox() {
    if (!activeGame) return;
    setShowMysteryBoxAR(true);
  }

  async function onMysteryBoxPlaced() {
    if (!activeGame) return;
    setShowMysteryBoxAR(false);
    setMysteryBoxLoading(true);
    try {
      const res = await fetch('/api/admin/mystery-box', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}) },
        body: JSON.stringify({ gameId: activeGame.id }),
        cache: 'no-store',
      });
      const data = await res.json();
      if (res.ok) {
        setMysteryBoxActive({ created_at: new Date().toISOString(), expires_at: data.expiresAt, claimed_by: null });
      } else {
        showToast(`Mystery box failed: ${data.error ?? 'Unknown error'}`, 'error');
      }
    } finally {
      setMysteryBoxLoading(false);
    }
  }

  async function activatePowerup(type: string) {
    const targetTeamId = puTargets[type];
    const isBroadcast = type === 'final_frenzy' || targetTeamId === 'all';
    if (!targetTeamId && !isBroadcast) return;
    if (!isBroadcast && !targetTeamId) return;
    setPuLoading(type);
    try {
      const res = await POST('/api/admin/powerup', {
        type,
        targetTeamId: isBroadcast ? 'all' : targetTeamId,
        gameId: activeGame?.id,
        ...(type === 'fake_hint' ? { message: puMessages } : {}),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Unknown error' }));
        showToast(`Power-up failed: ${err.error ?? res.statusText}`, 'error');
        return;
      }
      const sd = await POST('/api/settings', { gameId: activeGame?.id }).then(r => r.json());
      if (sd.powerups_used) setPowerupsUsed(sd.powerups_used);
      showToast('Power-up activated ✓');
    } finally {
      setPuLoading(null);
    }
  }

  async function loadAnalytics() {
    setAnalyticsLoading(true);
    setAnalyticsError(false);
    try {
      const res = await POST('/api/admin/superadmin/analytics');
      const data = await res.json();
      if (data.kpis) {
        setAnalytics(data);
      } else {
        setAnalyticsError(true);
      }
    } catch (err) {
      console.error('Failed to load analytics:', err);
      setAnalyticsError(true);
    } finally {
      setAnalyticsLoading(false);
    }
  }

  async function toggleAiRating(enabled: boolean) {
    if (!activeGame || !authToken) return;
    if (aiRatingEnabled === enabled) return; // prevent double-toggle
    setAiRatingEnabled(enabled);
    const res = await fetch(`/api/admin/game/${activeGame.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        ai_photo_rating: enabled,
        ai_photo_instructions: aiRatingInstructions,
      }),
    });
    if (!res.ok) {
      setAiRatingEnabled(!enabled); // revert on failure
      showToast('Failed to update AI rating setting', 'error');
    }
  }

  async function loadTemplates() {
    setTemplatesLoading(true);
    try {
      const session = (await supabase.auth.getSession()).data.session;
      const res = await fetch('/api/admin/templates', {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      const data = await res.json();
      setTemplates(data.templates || []);
    } catch (err) {
      console.error('Failed to load templates:', err);
    } finally {
      setTemplatesLoading(false);
    }
  }

  async function saveAsTemplate(missionIds: string[], name: string, icon: string) {
    setSaveTemplateLoading(true);
    try {
      const session = (await supabase.auth.getSession()).data.session;
      const res = await fetch('/api/admin/templates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ name, icon, missionIds, isBuiltin: false }),
      });
      if (!res.ok) throw new Error('Failed to save template');
      setSaveTemplateId(null);
      setSaveTemplateName('');
      setSaveTemplateIcon('🎮');
      showToast('Template saved!');
    } catch (err) {
      console.error('Failed to save template:', err);
      showToast('Failed to save template', 'error');
    } finally {
      setSaveTemplateLoading(false);
    }
  }

  async function updateBuiltinTemplate(id: string, name: string, icon: string, missionIds: string[], description: string, activeFrom: string, activeTo: string) {
    setEditTemplateLoading(true);
    try {
      const session = (await supabase.auth.getSession()).data.session;
      const res = await fetch(`/api/admin/templates/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          name, icon, missionIds,
          description: description || null,
          activeFrom: activeFrom || null,
          activeTo: activeTo || null,
        }),
      });
      if (!res.ok) throw new Error('Failed to update template');
      const { template } = await res.json();
      setTemplates(prev => prev.map(t => t.id === id ? template : t));
      setEditingTemplateId(null);
      showToast('Template updated');
    } catch (err) {
      console.error('Failed to update template:', err);
      showToast('Failed to update template');
    } finally {
      setEditTemplateLoading(false);
    }
  }

  async function deleteBuiltinTemplate(id: string) {
    const session = (await supabase.auth.getSession()).data.session;
    const res = await fetch(`/api/admin/templates/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${session?.access_token}` },
    });
    if (!res.ok) {
      showToast('Failed to delete template');
      return;
    }
    setTemplates(prev => prev.filter(t => t.id !== id));
    showToast('Template deleted');
  }

  async function suggestTemplateDescription(
    name: string,
    missionIds: string[],
    setter: (v: string) => void,
    setLoading: (v: boolean) => void
  ) {
    setLoading(true);
    try {
      const session = (await supabase.auth.getSession()).data.session;
      const res = await fetch('/api/admin/templates/describe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ name, missionIds }),
      });
      const data = await res.json();
      if (data.description) setter(data.description);
      else showToast('Could not generate description', 'error');
    } catch {
      showToast('Could not generate description', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function generateTemplate() {
    if (!generatePrompt.trim()) return;
    setGenerateLoading(true);
    setGeneratePreview(null);
    try {
      const session = (await supabase.auth.getSession()).data.session;
      const res = await fetch('/api/admin/templates/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ prompt: generatePrompt }),
      });
      if (!res.ok) throw new Error('generation_failed');
      const data = await res.json();
      setGeneratePreview(data);
    } catch {
      showToast('Could not generate template', 'error');
    } finally {
      setGenerateLoading(false);
    }
  }

  async function saveGeneratedTemplate() {
    if (!generatePreview) return;
    setGenerateSaving(true);
    try {
      const session = (await supabase.auth.getSession()).data.session;
      const token = session?.access_token;

      // Create new missions first
      const createdIds: string[] = [];
      for (const nm of generatePreview.newMissions) {
        const res = await fetch('/api/admin/custom-missions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ name: nm.title, type: nm.type, max_pts: nm.points, desc: nm.description, icon: nm.icon || '⭐', difficulty: 'medium', data: {} }),
        });
        if (!res.ok) throw new Error('Failed to create mission');
        const { mission } = await res.json();
        createdIds.push(mission.id);
      }

      const allMissionIds = [...generatePreview.selectedMissionIds, ...createdIds];

      // Save template with cleanup on failure
      try {
        const res = await fetch('/api/admin/templates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            name: generatePreview.name,
            icon: generatePreview.icon,
            description: generatePreview.description,
            missionIds: allMissionIds,
            isBuiltin: generateIsBuiltin,
            activeFrom: generatePreview.activeFrom,
            activeTo: generatePreview.activeTo,
          }),
        });
        if (!res.ok) throw new Error('Failed to save template');
        const { template } = await res.json();
        setTemplates(prev => [...prev, template]);
        setShowGenerateModal(false);
        setGeneratePrompt('');
        setGeneratePreview(null);
        showToast('Template created!');
      } catch (err) {
        // Attempt to clean up orphaned missions if template save failed
        if (createdIds.length > 0) {
          await Promise.allSettled(
            createdIds.map(id =>
              fetch(`/api/admin/custom-missions/${id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
              })
            )
          );
        }
        throw err; // Re-throw to outer catch
      }
    } catch (err) {
      console.error(err);
      showToast('Failed to save template', 'error');
    } finally {
      setGenerateSaving(false);
    }
  }

  async function createBuiltinTemplate(name: string, icon: string, missionIds: string[], description: string, activeFrom: string, activeTo: string) {
    setManageTemplatesLoading(true);
    try {
      const session = (await supabase.auth.getSession()).data.session;
      const res = await fetch('/api/admin/templates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          name, icon, missionIds, isBuiltin: true,
          description: description || null,
          activeFrom: activeFrom || null,
          activeTo: activeTo || null,
        }),
      });
      if (!res.ok) throw new Error('Failed to create template');
      const { template } = await res.json();
      setTemplates(prev => [template, ...prev]);
      setShowNewTemplateForm(false);
      setNewTemplateName('');
      setNewTemplateIcon('🎮');
      setNewTemplateMissions([]);
      setNewTemplateDesc('');
      setNewTemplateActiveFrom('');
      setNewTemplateActiveTo('');
      showToast('Template created');
    } catch (err) {
      console.error('Failed to create template:', err);
      showToast('Failed to create template');
    } finally {
      setManageTemplatesLoading(false);
    }
  }

  async function handlePortal() {
    setPortalLoading(true);
    try {
      const res = await POST('/api/admin/portal');
      const data = await res.json();
      if (data.url) {
        window.open(data.url, '_blank', 'noopener,noreferrer');
      } else if (res.status === 404) {
        // No Stripe customer yet — send to upgrade flow instead
        handleUpgrade('pro');
      } else {
        showToast(data.error ?? 'Something went wrong. Please try again.', 'error');
      }
    } catch {
      showToast('Network error. Please try again.', 'error');
    } finally {
      setPortalLoading(false);
    }
  }

  async function handleUpgrade(targetPlan: 'pro' | 'studio') {
    setUpgradeLoading(true);
    try {
      const res = await POST('/api/stripe/checkout', { plan: targetPlan });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        showToast(data.error ?? 'Something went wrong. Please try again.', 'error');
      }
    } catch {
      showToast('Network error. Please try again.', 'error');
    } finally {
      setUpgradeLoading(false);
    }
  }

  function showToast(msg: string, type: 'success' | 'error' = 'success') {
    const id = Math.random().toString(36).slice(2);
    setToasts(t => [...t, { id, msg, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4000);
  }

  async function loadAdminCustomMissions() {
    // Use the ref so this works even when called before authToken state has updated
    const token = authTokenRef.current;
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    };
    const [missionsRes, catsRes] = await Promise.all([
      fetch('/api/admin/custom-missions', { method: 'GET', headers, cache: 'no-store' }),
      fetch('/api/admin/mission-categories', { method: 'GET', headers }),
    ]);
    const missionsData = await missionsRes.json();
    const catsData = await catsRes.json();
    if (missionsData.missions) {
      setAdminCustomMissions(missionsData.missions);
    }
    if (catsData.categories) setAdminCategories(catsData.categories);
  }

  // Sort: highest score first; if equal, earliest finish_time wins; unfinished last
  const sorted = [...teams].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const fa = a.finished_at ? new Date(a.finished_at).getTime() : Infinity;
    const fb = b.finished_at ? new Date(b.finished_at).getTime() : Infinity;
    return fa - fb;
  });

  async function handleChangePassword() {
    if (!userEmail) return;
    await supabase.auth.resetPasswordForEmail(userEmail, {
      redirectTo: `${window.location.origin}/admin`,
    });
    setResetSent(true);
    setTimeout(() => setResetSent(false), 5000);
  }

  const planLabel = plan === 'studio' ? '✦ Studio' : plan === 'pro' ? '⚡ Pro' : 'Starter';
  const initials = userName
    ? userName.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()
    : userEmail?.[0]?.toUpperCase() ?? '?';

  function ProfileMenu() {
    return (
      <div style={{ position: 'relative' }}>
        <button
          onClick={() => setShowProfile(p => !p)}
          style={{
            width: 34, height: 34, borderRadius: '50%',
            background: showProfile ? 'var(--accent)' : 'rgba(124,189,212,0.15)',
            border: '1px solid rgba(124,189,212,0.3)',
            color: showProfile ? '#0a0e19' : 'var(--accent)',
            fontWeight: 700, fontSize: '13px', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: "'Sora', sans-serif", letterSpacing: '0.5px',
            transition: 'background 0.15s, color 0.15s',
            flexShrink: 0,
          }}
          aria-label="Profile"
        >
          {initials}
        </button>
        {showProfile && (
          <>
            <div
              style={{ position: 'fixed', inset: 0, zIndex: 999 }}
              onClick={() => setShowProfile(false)}
            />
            <div style={{
              position: 'absolute', right: 0, top: 'calc(100% + 8px)',
              width: 280, background: 'var(--surface)',
              border: '1px solid var(--border)', borderRadius: '12px',
              zIndex: 1000, boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
              overflow: 'hidden',
            }}>
              {/* Header */}
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
                {userName && <div style={{ fontWeight: 700, fontSize: '15px', marginBottom: '2px' }}>{userName}</div>}
                <div style={{ fontSize: '13px', color: 'var(--muted)', wordBreak: 'break-all' }}>{userEmail}</div>
                <div style={{ marginTop: '8px' }}>
                  <span style={{
                    fontSize: '11px', fontWeight: 700, letterSpacing: '0.5px',
                    padding: '3px 8px', borderRadius: '20px',
                    background: plan === 'free' ? 'rgba(255,255,255,0.06)' : 'rgba(124,189,212,0.12)',
                    color: plan === 'free' ? 'var(--muted)' : 'var(--accent)',
                    border: `1px solid ${plan === 'free' ? 'var(--border)' : 'rgba(124,189,212,0.3)'}`,
                  }}>{planLabel}</span>
                </div>
              </div>

              {/* Actions */}
              <div style={{ padding: '8px' }}>
                <button
                  onClick={() => { setShowProfile(false); setOnboardingStep(0); setShowOnboarding(true); }}
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: '8px',
                    background: 'transparent', border: 'none', cursor: 'pointer',
                    color: 'var(--text)', fontSize: '13px', textAlign: 'left',
                    display: 'flex', alignItems: 'center', gap: '10px',
                    fontFamily: "'Sora', sans-serif",
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <span style={{ fontSize: '16px' }}>❓</span>
                  <span>How it works</span>
                </button>

                <button
                  onClick={() => { setShowProfile(false); setView('my-analytics'); }}
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: '8px',
                    background: 'transparent', border: 'none', cursor: 'pointer',
                    color: 'var(--text)', fontSize: '13px', textAlign: 'left',
                    display: 'flex', alignItems: 'center', gap: '10px',
                    fontFamily: "'Sora', sans-serif",
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <span style={{ fontSize: '16px' }}>📊</span>
                  <span>Analytics</span>
                </button>

                <button
                  onClick={() => { setShowProfile(false); setView('branding'); }}
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: '8px',
                    background: 'transparent', border: 'none', cursor: 'pointer',
                    color: 'var(--text)', fontSize: '13px', textAlign: 'left',
                    display: 'flex', alignItems: 'center', gap: '10px',
                    fontFamily: "'Sora', sans-serif",
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <span style={{ fontSize: '16px' }}>🎨</span>
                  <span>White-label Branding</span>
                </button>

                <button
                  onClick={() => { handleChangePassword(); }}
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: '8px',
                    background: 'transparent', border: 'none', cursor: 'pointer',
                    color: 'var(--text)', fontSize: '13px', textAlign: 'left',
                    display: 'flex', alignItems: 'center', gap: '10px',
                    fontFamily: "'Sora', sans-serif",
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <span style={{ fontSize: '16px' }}>🔑</span>
                  <span>{resetSent ? 'Reset link sent to your email!' : 'Change password'}</span>
                </button>

                {plan === 'free' ? (
                  <button
                    onClick={() => { setShowProfile(false); handleUpgrade('pro'); }}
                    style={{
                      width: '100%', padding: '10px 12px', borderRadius: '8px',
                      background: 'transparent', border: 'none', cursor: upgradeLoading ? 'not-allowed' : 'pointer',
                      color: 'var(--accent)', fontSize: '13px', textAlign: 'left',
                      display: 'flex', alignItems: 'center', gap: '10px',
                      fontFamily: "'Sora', sans-serif", fontWeight: 600,
                      opacity: upgradeLoading ? 0.6 : 1,
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    disabled={upgradeLoading}
                  >
                    <span style={{ fontSize: '16px' }}>⚡</span>
                    <span>{upgradeLoading ? 'Loading...' : 'Upgrade to Pro'}</span>
                  </button>
                ) : (
                  <button
                    onClick={() => { setShowProfile(false); handlePortal(); }}
                    style={{
                      width: '100%', padding: '10px 12px', borderRadius: '8px',
                      background: 'transparent', border: 'none', cursor: portalLoading ? 'not-allowed' : 'pointer',
                      color: 'var(--text)', fontSize: '13px', textAlign: 'left',
                      display: 'flex', alignItems: 'center', gap: '10px',
                      fontFamily: "'Sora', sans-serif",
                      opacity: portalLoading ? 0.6 : 1,
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    disabled={portalLoading}
                  >
                    <span style={{ fontSize: '16px' }}>💳</span>
                    <span>{portalLoading ? 'Loading...' : 'Manage subscription'}</span>
                  </button>
                )}

                <div style={{ height: '1px', background: 'var(--border)', margin: '8px 4px' }} />

                <button
                  onClick={() => { setShowProfile(false); onLogout(); }}
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: '8px',
                    background: 'transparent', border: 'none', cursor: 'pointer',
                    color: 'var(--muted)', fontSize: '13px', textAlign: 'left',
                    display: 'flex', alignItems: 'center', gap: '10px',
                    fontFamily: "'Sora', sans-serif",
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <span style={{ fontSize: '16px' }}>→</span>
                  <span>Log out</span>
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  // ── ANALYTICS PAGE (super admin only) ──
  if (view === 'analytics' && isSuperAdmin) {

    const timeAgo = (iso: string | null): string => {
      if (!iso) return '–';
      const diff = Date.now() - new Date(iso).getTime();
      const mins = Math.floor(diff / 60000);
      if (mins < 60) return `${mins}m sedan`;
      const hours = Math.floor(mins / 60);
      if (hours < 24) return `${hours}h sedan`;
      return `${Math.floor(hours / 24)}d sedan`;
    };

    const statusDotColor = (lastActive: string | null): string => {
      if (!lastActive) return '#555';
      const days = (Date.now() - new Date(lastActive).getTime()) / 86400000;
      if (days <= 7) return '#4ade80';
      if (days <= 30) return '#fbbf24';
      return '#555';
    };

    const kpiCardStyle: React.CSSProperties = {
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: '12px',
      padding: '16px 20px',
      minWidth: 0,
    };

    return (
      <>
        <nav className="nav" style={{ position: 'relative' }}>
          <button
            className="btn btn-ghost"
            style={{ padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}
            onClick={() => setView('games')}
          >
            ← Back
          </button>
          <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', fontWeight: 700, fontSize: '15px', color: 'var(--text)' }}>
            📊 Analytics
          </div>
          <div className="nav-right">
            <button
              className="btn btn-ghost"
              style={{ padding: '6px 12px', fontSize: '12px' }}
              onClick={loadAnalytics}
              disabled={analyticsLoading}
            >
              {analyticsLoading ? '...' : '↻ Uppdatera'}
            </button>
          </div>
        </nav>

        <div className="container fade-in" style={{ paddingTop: '24px', paddingBottom: '48px' }}>

          {/* Tab bar */}
          <div style={{ display: 'flex', gap: '4px', marginBottom: '28px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0' }}>
            {(['customers', 'missions'] as const).map(t => (
              <button
                key={t}
                onClick={() => setAnalyticsTab(t)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '10px 20px',
                  fontSize: '13px',
                  fontWeight: analyticsTab === t ? 700 : 400,
                  color: analyticsTab === t ? 'var(--text)' : 'var(--muted)',
                  borderBottom: analyticsTab === t ? '2px solid var(--accent)' : '2px solid transparent',
                  marginBottom: '-1px',
                  transition: 'color 0.15s',
                }}
              >
                {t === 'customers' ? 'Kunder' : 'Uppdrag'}
              </button>
            ))}
          </div>

          {/* Loading */}
          {analyticsLoading && (
            <div className="empty-state">Laddar analytics...</div>
          )}

          {/* Error */}
          {!analyticsLoading && analyticsError && (
            <div className="empty-state" style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center' }}>
              <span>Kunde inte ladda analytics.</span>
              <button className="btn btn-ghost" style={{ padding: '8px 16px', fontSize: '13px' }} onClick={loadAnalytics}>↻ Försök igen</button>
            </div>
          )}

          {/* ── KUNDER TAB ── */}
          {analytics && !analyticsLoading && analyticsTab === 'customers' && (() => {
            const { kpis, customers: cx, gamesPerWeek, planCounts } = analytics;
            const totalCustomers = planCounts.free + planCounts.pro + planCounts.studio;
            const proCustomers = planCounts.pro + planCounts.studio;
            const proRatePct = totalCustomers > 0 ? Math.round(proCustomers / totalCustomers * 100) : 0;
            const monthStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)).toISOString();
            const gamesThisMonth = cx.reduce((sum, c) => sum + c.games.filter(g => g.startedAt && g.startedAt >= monthStart).length, 0);
            const maxBarCount = Math.max(...gamesPerWeek.map(w => w.count), 1);
            const recentGames = cx
              .flatMap(c => c.games.map(g => ({ ...g, customerEmail: c.email })))
              .sort((a, b) => {
                if (!a.startedAt) return 1;
                if (!b.startedAt) return -1;
                return b.startedAt.localeCompare(a.startedAt);
              })
              .slice(0, 10);

            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

                {/* KPI row */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px' }}>
                  <div style={kpiCardStyle}>
                    <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Aktiva kunder</div>
                    <div style={{ fontSize: '28px', fontWeight: 800, color: '#6ec6f5', lineHeight: 1 }}>{kpis.activeCustomers}</div>
                    <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '4px' }}>↑ {kpis.activeCustomers30d} senaste 30d</div>
                  </div>
                  <div style={kpiCardStyle}>
                    <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Spel totalt</div>
                    <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text)', lineHeight: 1 }}>{kpis.totalGames}</div>
                    <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '4px' }}>{gamesThisMonth} den här månaden</div>
                  </div>
                  <div style={kpiCardStyle}>
                    <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Slutförandegrad</div>
                    <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--accent3)', lineHeight: 1 }}>{Math.round(kpis.completionRate * 100)}%</div>
                    <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '4px' }}>{kpis.finishedGames} av {kpis.totalGames} klara</div>
                  </div>
                  <div style={kpiCardStyle}>
                    <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Snitt lag/spel</div>
                    <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text)', lineHeight: 1 }}>{kpis.avgTeamsPerGame}</div>
                    <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '4px' }}>{kpis.totalTeams} lag totalt</div>
                  </div>
                  <div style={kpiCardStyle}>
                    <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Pro-kunder</div>
                    <div style={{ fontSize: '28px', fontWeight: 800, color: '#f59e0b', lineHeight: 1 }}>{proCustomers}</div>
                    <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '4px' }}>{proRatePct}% av alla</div>
                  </div>
                </div>

                {/* Row 1: Activity chart + Customer status list */}
                <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: '16px' }}>

                  {/* Activity chart */}
                  <div style={{ ...kpiCardStyle, padding: '20px 24px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '16px', color: 'var(--text)' }}>Aktivitet per vecka</div>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', height: '80px' }}>
                      {gamesPerWeek.map((w, i) => {
                        const barH = Math.max(4, Math.round((w.count / maxBarCount) * 80));
                        const opacity = 0.22 + (i / (gamesPerWeek.length - 1 || 1)) * 0.78;
                        return (
                          <div
                            key={w.weekLabel}
                            title={`${w.weekLabel}: ${w.count} spel`}
                            style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}
                          >
                            <div style={{ width: '100%', height: `${barH}px`, background: '#6ec6f5', opacity, borderRadius: '3px 3px 0 0', transition: 'height 0.2s' }} />
                          </div>
                        );
                      })}
                    </div>
                    <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                      {gamesPerWeek.map(w => (
                        <div key={w.weekLabel} style={{ flex: 1, textAlign: 'center', fontSize: '10px', color: 'var(--muted)' }}>{w.weekLabel}</div>
                      ))}
                    </div>
                  </div>

                  {/* Customer status list */}
                  <div style={{ ...kpiCardStyle, padding: '20px', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '12px', color: 'var(--text)' }}>Kundstatus</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', overflow: 'auto', maxHeight: '180px' }}>
                      {cx.map(c => (
                        <div
                          key={c.id}
                          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', borderRadius: '8px', cursor: 'pointer', background: expandedCustomer === c.id ? 'rgba(255,255,255,0.06)' : 'transparent', transition: 'background 0.15s' }}
                          onClick={() => setExpandedCustomer(expandedCustomer === c.id ? null : c.id)}
                        >
                          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: statusDotColor(c.lastActive), flexShrink: 0 }} />
                          <div style={{ width: '26px', height: '26px', borderRadius: '50%', background: 'rgba(110,198,245,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, color: '#6ec6f5', flexShrink: 0 }}>
                            {(c.email[0] ?? '?').toUpperCase()}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '12px', color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.email}</div>
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--muted)', flexShrink: 0 }}>{c.gameCount} spel</div>
                        </div>
                      ))}
                      {cx.length === 0 && <div style={{ fontSize: '13px', color: 'var(--muted)', textAlign: 'center', padding: '16px 0' }}>Inga kunder</div>}
                    </div>
                    {/* Expanded customer games */}
                    {expandedCustomer && (() => {
                      const customer = cx.find(c => c.id === expandedCustomer);
                      if (!customer) return null;
                      return (
                        <div style={{ marginTop: '12px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '12px' }}>
                          <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '8px', fontWeight: 600 }}>{customer.email}</div>
                          {customer.games.slice(0, 5).map(g => (
                            <div key={g.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '12px' }}>
                              <span style={{ color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{g.name ?? '(namnlöst)'}</span>
                              <span style={{ color: 'var(--muted)', flexShrink: 0, marginLeft: '8px' }}>{g.teamCount} lag</span>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* Row 2: Recent games feed + Plan distribution */}
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px' }}>

                  {/* Recent games feed */}
                  <div style={{ ...kpiCardStyle, padding: '20px 24px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '12px', color: 'var(--text)' }}>Senaste spelen</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                      {recentGames.map(g => {
                        const teamBadgeColor = g.teamCount >= 8 ? 'var(--accent3)' : g.teamCount >= 4 ? '#6ec6f5' : 'var(--muted)';
                        return (
                          <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: '13px', color: 'var(--text)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.name ?? '(namnlöst)'}</div>
                              <div style={{ fontSize: '11px', color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.customerEmail}</div>
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--muted)', flexShrink: 0 }}>{timeAgo(g.startedAt)}</div>
                            <div style={{ fontSize: '11px', fontWeight: 700, color: teamBadgeColor, background: 'rgba(255,255,255,0.06)', borderRadius: '20px', padding: '2px 8px', flexShrink: 0 }}>
                              {g.teamCount} lag
                            </div>
                          </div>
                        );
                      })}
                      {recentGames.length === 0 && <div style={{ fontSize: '13px', color: 'var(--muted)', textAlign: 'center', padding: '16px 0' }}>Inga spel</div>}
                    </div>
                  </div>

                  {/* Plan distribution */}
                  <div style={{ ...kpiCardStyle, padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)' }}>Planfördelning</div>
                    {totalCustomers > 0 ? (
                      <>
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                            <span style={{ color: '#f59e0b', fontWeight: 600 }}>Pro / Studio</span>
                            <span style={{ color: 'var(--muted)' }}>{proCustomers}</span>
                          </div>
                          <div style={{ height: '8px', background: 'rgba(255,255,255,0.08)', borderRadius: '4px', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${(proCustomers / totalCustomers) * 100}%`, background: '#f59e0b', borderRadius: '4px', transition: 'width 0.3s' }} />
                          </div>
                        </div>
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                            <span style={{ color: 'var(--muted)', fontWeight: 600 }}>Free</span>
                            <span style={{ color: 'var(--muted)' }}>{planCounts.free}</span>
                          </div>
                          <div style={{ height: '8px', background: 'rgba(255,255,255,0.08)', borderRadius: '4px', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${(planCounts.free / totalCustomers) * 100}%`, background: 'rgba(255,255,255,0.3)', borderRadius: '4px', transition: 'width 0.3s' }} />
                          </div>
                        </div>
                        <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '12px' }}>
                          <div style={{ fontSize: '22px', fontWeight: 800, color: '#f59e0b' }}>{proRatePct}%</div>
                          <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>pro-rate · {totalCustomers} kunder</div>
                        </div>
                      </>
                    ) : (
                      <div style={{ fontSize: '13px', color: 'var(--muted)', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Inga kunder</div>
                    )}
                  </div>
                </div>

              </div>
            );
          })()}

          {/* ── UPPDRAG TAB ── */}
          {analytics && !analyticsLoading && analyticsTab === 'missions' && (() => {
            const { missionStats } = analytics;

            const missionsInUse = missionStats.length;
            const avgCompletion = missionStats.length > 0
              ? missionStats.reduce((s, m) => s + m.completionRate, 0) / missionStats.length
              : 0;
            const mostPopular = missionStats[0] ?? null; // already sorted by gameCount desc
            const hardest = [...missionStats]
              .filter(m => m.gameCount >= 5)
              .sort((a, b) => a.completionRate - b.completionRate)[0] ?? null;

            const top10 = missionStats.slice(0, 10);
            const rarelyUsed = [...missionStats]
              .filter(m => m.gameCount < 5)
              .sort((a, b) => a.gameCount - b.gameCount)
              .slice(0, 5);

            // Per-category stats
            const categoryStats: Record<string, { completionSum: number; count: number }> = {};
            for (const m of missionStats) {
              const cat = MISSION_SUPER_CATEGORY[m.id];
              if (!cat) continue;
              if (!categoryStats[cat]) categoryStats[cat] = { completionSum: 0, count: 0 };
              categoryStats[cat].count++;
              categoryStats[cat].completionSum += m.completionRate;
            }
            const categoryRows = (Object.entries(categoryStats) as [SuperCategoryKey, { completionSum: number; count: number }][])
              .filter(([, s]) => s.count > 0)
              .map(([key, s]) => ({
                key,
                label: SUPER_CATEGORIES[key].label,
                icon: SUPER_CATEGORIES[key].icon,
                color: SUPER_CATEGORIES[key].color,
                avgCompletion: s.completionSum / s.count,
              }))
              .sort((a, b) => b.avgCompletion - a.avgCompletion);

            const missionIconById: Record<string, string> = {};
            for (const m of MISSIONS) missionIconById[m.id] = m.icon;

            const rankColors = ['#FFD700', '#C0C0C0', '#CD7F32'];

            const barColor = (rate: number) => {
              if (rate >= 0.8) return 'var(--accent3)';
              if (rate >= 0.5) return '#f59e0b';
              return 'var(--accent2)';
            };

            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

                {/* KPI row */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
                  <div style={kpiCardStyle}>
                    <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Uppdrag i bruk</div>
                    <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text)', lineHeight: 1 }}>{missionsInUse}</div>
                    <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '4px' }}>av {MISSIONS.length} tillgängliga</div>
                  </div>
                  <div style={kpiCardStyle}>
                    <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Snitt klarade/spel</div>
                    <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--accent3)', lineHeight: 1 }}>{Math.round(avgCompletion * 100)}%</div>
                    <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '4px' }}>av valda uppdrag</div>
                  </div>
                  <div style={kpiCardStyle}>
                    <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Populärast</div>
                    <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text)', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {mostPopular ? `${missionIconById[mostPopular.id] ?? ''} ${mostPopular.name}` : '–'}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '4px' }}>
                      {mostPopular ? `med i ${mostPopular.gameCount} av ${analytics.kpis.totalGames} spel` : ''}
                    </div>
                  </div>
                  <div style={kpiCardStyle}>
                    <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Svårast</div>
                    <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--accent2)', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {hardest ? `${missionIconById[hardest.id] ?? ''} ${hardest.name}` : '–'}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '4px' }}>
                      {hardest ? `${Math.round(hardest.completionRate * 100)}% klarar det` : 'Behöver ≥5 spel'}
                    </div>
                  </div>
                </div>

                {/* Row 1: Top missions (3fr) + Right column (2fr) */}
                <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: '16px' }}>

                  {/* Top missions ranked list */}
                  <div style={{ ...kpiCardStyle, padding: '20px 24px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '16px', color: 'var(--text)' }}>Topp 10 uppdrag</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      {top10.map((m, i) => (
                        <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 6px', borderRadius: '8px' }}>
                          <div style={{ width: '20px', textAlign: 'center', fontSize: '13px', fontWeight: 700, color: rankColors[i] ?? 'var(--muted)', flexShrink: 0 }}>
                            {i + 1}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                              <span style={{ fontSize: '14px' }}>{missionIconById[m.id] ?? '🎯'}</span>
                              <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</span>
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '4px' }}>
                              Med i {m.gameCount} spel · {m.totalTeams} lagförsök
                            </div>
                            <div style={{ height: '4px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px', overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${m.completionRate * 100}%`, background: barColor(m.completionRate), borderRadius: '2px', transition: 'width 0.3s' }} />
                            </div>
                          </div>
                          <div style={{ fontSize: '13px', fontWeight: 700, color: barColor(m.completionRate), flexShrink: 0, minWidth: '36px', textAlign: 'right' }}>
                            {Math.round(m.completionRate * 100)}%
                          </div>
                        </div>
                      ))}
                      {top10.length === 0 && <div style={{ fontSize: '13px', color: 'var(--muted)', textAlign: 'center', padding: '16px 0' }}>Ingen data</div>}
                    </div>
                  </div>

                  {/* Right column: category breakdown + rarely used */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

                    {/* Per kategori */}
                    <div style={{ ...kpiCardStyle, padding: '20px 24px' }}>
                      <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '14px', color: 'var(--text)' }}>Per kategori</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {categoryRows.map(cat => (
                          <div key={cat.key}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                              <span style={{ fontSize: '13px' }}>{cat.icon}</span>
                              <span style={{ fontSize: '12px', color: 'var(--text)', flex: 1 }}>{cat.label}</span>
                              <span style={{ fontSize: '12px', fontWeight: 700, color: cat.color }}>{Math.round(cat.avgCompletion * 100)}%</span>
                            </div>
                            <div style={{ height: '5px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px', overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${cat.avgCompletion * 100}%`, background: cat.color, borderRadius: '3px', transition: 'width 0.3s' }} />
                            </div>
                          </div>
                        ))}
                        {categoryRows.length === 0 && <div style={{ fontSize: '13px', color: 'var(--muted)' }}>Ingen data</div>}
                      </div>
                    </div>

                    {/* Sällan använda */}
                    <div style={{ ...kpiCardStyle, padding: '20px 24px' }}>
                      <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '12px', color: 'var(--text)' }}>Sällan använda</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {rarelyUsed.map(m => (
                          <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '14px', flexShrink: 0 }}>{missionIconById[m.id] ?? '🎯'}</span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: '12px', color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</div>
                              <div style={{ fontSize: '11px', color: 'var(--muted)' }}>{m.gameCount} spel · {m.totalTeams} lagförsök</div>
                            </div>
                            <div style={{ fontSize: '11px', fontWeight: 700, color: barColor(m.completionRate), flexShrink: 0 }}>{Math.round(m.completionRate * 100)}%</div>
                          </div>
                        ))}
                        {rarelyUsed.length === 0 && <div style={{ fontSize: '13px', color: 'var(--muted)' }}>Alla uppdrag används flitigt!</div>}
                      </div>
                    </div>

                  </div>
                </div>

              </div>
            );
          })()}

        </div>
      </>
    );
  }

  // ── MY ANALYTICS (per-user) ──
  if (view === 'my-analytics') {
    const isoWeekKey = (d: Date): string => {
      const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
      tmp.setUTCDate(tmp.getUTCDate() + 4 - (tmp.getUTCDay() || 7));
      const y = tmp.getUTCFullYear();
      const yearStart = new Date(Date.UTC(y, 0, 1));
      const w = Math.ceil((((tmp.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
      return `${y}-${w}`;
    };

    const timeAgoLocal = (dateStr: string): string => {
      const diff = Date.now() - new Date(dateStr).getTime();
      const days = Math.floor(diff / 86400000);
      if (days === 0) return 'idag';
      if (days === 1) return '1 dag sedan';
      if (days < 7) return `${days} dagar sedan`;
      const weeks = Math.floor(days / 7);
      if (weeks === 1) return '1 vecka sedan';
      return `${weeks} veckor sedan`;
    };

    const totalGames = analyticsGames.length;
    const finishedCount = analyticsGames.filter(g => g.status === 'finished').length;
    const completionRate = totalGames > 0 ? Math.round(finishedCount / totalGames * 100) : 0;
    const totalTeams = analyticsGames.reduce((sum, g) => sum + (g.teams_count ?? 0), 0);
    const avgTeams = totalGames > 0 ? (totalTeams / totalGames).toFixed(1) : '—';

    // Last 7 ISO weeks oldest → newest
    const gamesPerWeek: { label: string; key: string; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i * 7);
      const key = isoWeekKey(d);
      const weekNum = parseInt(key.split('-')[1]);
      gamesPerWeek.push({ label: `V${weekNum}`, key, count: 0 });
    }
    analyticsGames.forEach(g => {
      if (!g.started_at) return;
      const key = isoWeekKey(new Date(g.started_at));
      const entry = gamesPerWeek.find(e => e.key === key);
      if (entry) entry.count++;
    });
    const maxCount = Math.max(...gamesPerWeek.map(w => w.count), 1);

    // Last 5 started games
    const recentGames = [...analyticsGames]
      .filter(g => g.started_at)
      .sort((a, b) => new Date(b.started_at!).getTime() - new Date(a.started_at!).getTime())
      .slice(0, 5);

    const kpis = [
      { label: 'Spel totalt', value: String(totalGames), color: 'var(--accent)' },
      { label: 'Slutförandegrad', value: `${completionRate}%`, color: 'var(--accent3)' },
      { label: 'Snitt lag/spel', value: String(avgTeams), color: 'var(--text)' },
      { label: 'Lag totalt', value: String(totalTeams), color: 'var(--gold)' },
    ];

    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: '20px 16px' }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
            <button
              onClick={() => setView('games')}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--accent)', fontSize: 13, padding: '6px 0',
                fontFamily: "'Sora', sans-serif",
              }}
            >
              ← Tillbaka
            </button>
            <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: 'var(--text)' }}>
              📊 Din statistik
            </h1>
          </div>

          {/* KPI row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
            {kpis.map(kpi => (
              <div
                key={kpi.label}
                style={{
                  background: 'var(--card)', border: '1px solid var(--border)',
                  borderRadius: 10, padding: '14px 12px', textAlign: 'center',
                }}
              >
                <div style={{ fontSize: 24, fontWeight: 700, color: kpi.color }}>{kpi.value}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>{kpi.label}</div>
              </div>
            ))}
          </div>

          {/* Chart + Recent games */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '3fr 2fr', gap: 12 }}>
            {/* Activity bar chart */}
            <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, padding: 16 }}>
              <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>
                Spel per vecka
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', height: 80 }}>
                {gamesPerWeek.map((w, i) => {
                  const opacity = 0.22 + (i / (gamesPerWeek.length - 1 || 1)) * 0.78;
                  const heightPx = w.count === 0 ? 4 : Math.max(8, Math.round((w.count / maxCount) * 80));
                  return (
                    <div
                      key={w.key}
                      style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}
                    >
                      <div
                        style={{
                          width: '100%',
                          background: `rgba(110,198,245,${opacity})`,
                          borderRadius: '3px 3px 0 0',
                          height: heightPx,
                        }}
                      />
                      <div style={{ fontSize: 9, color: 'var(--muted)' }}>{w.label}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Recent games */}
            <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, padding: 16 }}>
              <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>
                Senaste spel
              </div>
              {recentGames.length === 0 ? (
                <div style={{ fontSize: 13, color: 'var(--muted)' }}>Inga spel ännu</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {recentGames.map(g => (
                    <div key={g.id}>
                      <div style={{
                        fontSize: 13, fontWeight: 600, color: 'var(--text)',
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>
                        {g.name || '(namnlöst)'}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                        {g.teams_count ?? 0} lag · {g.started_at ? timeAgoLocal(g.started_at) : 'Utkast'}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── BRANDING SETTINGS ──
  if (view === 'branding') return <BrandingView authToken={authToken} onBack={() => setView('games')} profileMenu={<ProfileMenu />} />;

  // ── GAMES LIST ──
  if (view === 'games') return (
    <>
      {showOnboarding && (
        <OnboardingModal
          step={onboardingStep}
          onNext={() => setOnboardingStep(s => Math.min(ONBOARDING_STEPS.length - 1, s + 1))}
          onBack={() => setOnboardingStep(s => Math.max(0, s - 1))}
          onSkip={() => completeOnboarding(false)}
          onFinish={() => completeOnboarding(true)}
        />
      )}
      <nav className="nav" style={{ position: 'relative' }}>
        <div className="nav-brand"><GameOnLogo size={22} /></div>
        <NavCenter game={null} />
        <div className="nav-right" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {plan === 'free' && (
            <button
              className="btn btn-primary"
              style={{ padding: '7px 14px', fontSize: '11px', fontWeight: 800, letterSpacing: '0.5px', background: 'linear-gradient(135deg, #7CBDD4, #4890aa)', color: '#0D1520', border: 'none', borderRadius: '8px', cursor: upgradeLoading ? 'not-allowed' : 'pointer', opacity: upgradeLoading ? 0.7 : 1, whiteSpace: 'nowrap' }}
              onClick={() => handleUpgrade('pro')}
              disabled={upgradeLoading}
            >
              {upgradeLoading ? '...' : '⚡ UPGRADE'}
            </button>
          )}
          <ProfileMenu />
        </div>
      </nav>
      <div className="container fade-in">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '32px 0 24px', flexWrap: 'wrap', gap: '12px' }}>
          <h2 style={{ margin: 0 }}>Your Games</h2>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {plan === 'free' ? (
              <button className="btn btn-ghost" style={{ padding: '8px 14px', fontSize: '12px', color: '#7CBDD4', border: '1px solid rgba(124,189,212,0.3)' }} onClick={() => handleUpgrade('pro')} disabled={upgradeLoading}>🔒 My Missions (Pro)</button>
            ) : (
              <button className="btn btn-ghost" style={{ padding: '8px 14px', fontSize: '12px' }} onClick={() => { loadAdminCustomMissions(); setView('missions'); }}>✏️ My Missions</button>
            )}
            {isSuperAdmin && (
              <button className="btn btn-ghost" style={{ padding: '8px 14px', fontSize: '12px' }} onClick={() => { setView('analytics'); loadAnalytics(); }}>📊 Analytics</button>
            )}
            {isSuperAdmin && (
              <button className="btn btn-ghost" style={{ padding: '8px 14px', fontSize: '12px' }} onClick={() => { loadTemplates(); setView('manage-templates'); }}>⚙️ Templates</button>
            )}
            <button className="btn btn-primary" onClick={() => { loadTemplates(); setView('templates'); }}>+ NEW GAME</button>
          </div>
        </div>
        {plan === 'free' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', background: 'rgba(124,189,212,0.06)', border: '1px solid rgba(124,189,212,0.15)', borderRadius: '10px', marginBottom: '16px' }}>
            <span style={{ fontSize: '13px', color: 'var(--muted)', flex: 1 }}>
              <span style={{ color: '#DCE4EE', fontWeight: 700 }}>Starter plan</span> — max 5 teams per game · <span style={{ color: '#7CBDD4', cursor: 'pointer', fontWeight: 600 }} onClick={() => handleUpgrade('pro')}>Upgrade to Pro →</span>
            </span>
          </div>
        )}
        {games.length === 0 ? (
          <div className="empty-state" style={{ paddingTop: '80px' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎮</div>
            <p>No games yet. Create your first game!</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {games.map(g => {
              const statusKey = g.status === 'active' ? 'active' : g.status === 'finished' ? 'finished' : 'draft';
              const statusText = g.status === 'active' ? 'Active' : g.status === 'finished' ? 'Finished' : 'Draft';
              const isConfirming = confirmDeleteId === g.id;
              const isDeleting = deletingId === g.id;
              return (
                <div key={g.id} className={`admin-game-card${isConfirming ? ' confirming' : ''}`}>
                  {/* Clickable info area */}
                  <div className="admin-game-card-info" onClick={() => { if (!isConfirming) { setActiveGame(g); setView('dashboard'); } }}>
                    <h3>{g.name}</h3>
                    <div className="meta">{g.missions.length} missions · {g.duration_minutes} min</div>
                    <div className="date">
                      {g.started_at
                        ? `▶ ${new Date(g.started_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} at ${new Date(g.started_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`
                        : `Created ${new Date(g.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
                      }
                    </div>
                  </div>

                  {/* Key + status + actions — stacks below info on mobile */}
                  <div className="admin-game-card-bottom">
                    <div className="admin-game-key">{g.game_key}</div>
                    <div className="admin-game-status">
                      <span className={`status-pill ${statusKey}`}>
                        <span className="status-pill-dot" />
                        {statusText}
                      </span>
                    </div>

                    {/* Delete / confirm */}
                    {isConfirming ? (
                      <div className="admin-game-confirm">
                        <span style={{ fontSize: '12px', color: 'var(--accent2)', fontWeight: 600 }}>Delete?</span>
                        <button onClick={() => deleteGame(g.id)} disabled={isDeleting}
                          style={{ padding: '6px 14px', borderRadius: '6px', border: 'none', background: 'var(--accent2)', color: '#fff', fontWeight: 700, fontSize: '12px', cursor: 'pointer', fontFamily: "'Sora', sans-serif" }}>
                          {isDeleting ? '...' : 'YES'}
                        </button>
                        <button onClick={() => setConfirmDeleteId(null)}
                          style={{ padding: '6px 14px', borderRadius: '6px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted)', fontWeight: 700, fontSize: '12px', cursor: 'pointer', fontFamily: "'Sora', sans-serif" }}>
                          NO
                        </button>
                      </div>
                    ) : (
                      <div className="admin-game-actions">
                        <div className="admin-game-actions-row">
                          <button
                            onClick={e => { e.stopPropagation(); setSaveTemplateId(g.id); setSaveTemplateName(g.name || 'My Template'); setSaveTemplateIcon('🎮'); }}
                            title="Save as template"
                            style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted)', cursor: 'pointer', fontSize: '13px', lineHeight: 1, flexShrink: 0, fontFamily: "'Sora', sans-serif", fontWeight: 600 }}
                          >
                            Save as template
                          </button>
                          <button onClick={e => { e.stopPropagation(); setConfirmDeleteId(g.id); }}
                            title="Delete game"
                            style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted)', cursor: 'pointer', fontSize: '16px', lineHeight: 1, flexShrink: 0 }}>
                            🗑
                          </button>
                        </div>
                        {saveTemplateId === g.id && (
                          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }} onClick={e => e.stopPropagation()}>
                            <input
                              value={saveTemplateIcon}
                              onChange={e => setSaveTemplateIcon(e.target.value)}
                              style={{ width: '36px', padding: '5px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--text)', fontSize: '16px', textAlign: 'center', fontFamily: "'Sora', sans-serif" }}
                            />
                            <input
                              value={saveTemplateName}
                              onChange={e => setSaveTemplateName(e.target.value)}
                              placeholder="Template name"
                              style={{ width: '140px', padding: '5px 8px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--text)', fontSize: '12px', fontFamily: "'Sora', sans-serif" }}
                            />
                            <button
                              onClick={() => saveAsTemplate(g.missions, saveTemplateName, saveTemplateIcon)}
                              disabled={saveTemplateLoading || !saveTemplateName.trim()}
                              style={{ padding: '5px 12px', borderRadius: '6px', border: 'none', background: 'var(--accent)', color: '#0a0e19', fontWeight: 700, fontSize: '11px', cursor: 'pointer', fontFamily: "'Sora', sans-serif" }}
                            >
                              {saveTemplateLoading ? '...' : 'SAVE'}
                            </button>
                            <button
                              onClick={() => setSaveTemplateId(null)}
                              style={{ padding: '5px 10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted)', fontSize: '11px', cursor: 'pointer', fontFamily: "'Sora', sans-serif" }}
                            >
                              ✕
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div style={{ paddingBottom: '32px' }} />
      </div>
    </>
  );

  // ── MY MISSIONS ──
  if (view === 'missions') {
    function openNewForm() {
      setEditingMissionId(null);
      setMissionForm(EMPTY_FORM);
      setMissionFormError('');
      setMissionCategoryId(null);
      setShowMissionForm(true);
    }

    function openEditForm(cm: import('@/lib/supabase').CustomMission) {
      setEditingMissionId(cm.id);
      const d = cm.data as Record<string, unknown>;
      setMissionForm({
        name: cm.name,
        icon: cm.icon,
        desc: cm.desc,
        difficulty: cm.difficulty,
        maxPts: cm.max_pts,
        type: cm.type,
        triviaRounds: cm.type === 'trivia_quiz' ? (d.rounds as MissionFormData['triviaRounds']) ?? [] : [],
        statements: cm.type === 'truefalse' ? (d.statements as MissionFormData['statements']) ?? [] : [],
        closestQuestions: cm.type === 'closest_wins'
          ? ((d.questions as { q: string; answer: number; unit: string; hint: string }[]) ?? []).map(q => ({ ...q, answer: String(q.answer) }))
          : [],
        clues: (cm.type === 'pa_sparet' || cm.type === 'shared_secret') ? (d.clues as string[]) ?? [] : [],
        paAnswer: cm.type === 'pa_sparet' ? (d.answer as string) ?? '' : '',
        timelineItems: cm.type === 'timeline'
          ? ((d.items as { label: string; year: number }[]) ?? []).map(i => ({ label: i.label, year: String(i.year) }))
          : [],
        photoPrompt: cm.type === 'photo' ? (d.prompt as string) ?? '' : '',
        relaySegments: cm.type === 'relay' ? ((d.segments as string[]) ?? []) : ['', '', '', ''],
        relayMode: cm.type === 'relay' ? ((d.relayMode as 'typerace' | 'button') ?? 'typerace') : 'typerace',
        sharedSecretAnswer: cm.type === 'shared_secret' ? ((d.answer as string) ?? '') : '',
        sharedSecretHint: cm.type === 'shared_secret' ? ((d.hint as string) ?? '') : '',
        activeFrom: (cm as { active_from?: string | null }).active_from
          ? new Date((cm as { active_from: string }).active_from).toISOString().slice(0, 10)
          : '',
        activeUntil: (cm as { active_until?: string | null }).active_until
          ? new Date((cm as { active_until: string }).active_until).toISOString().slice(0, 10)
          : '',
      });
      setMissionFormError('');
      setMissionCategoryId(cm.category_id ?? null);
      setShowMissionForm(true);
    }

    async function saveCategory() {
      if (!categoryFormName.trim()) return;
      setCategorySaving(true);
      setCategoryError('');
      try {
        const res = await fetch('/api/admin/mission-categories', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {}),
          },
          body: JSON.stringify({ name: categoryFormName.trim(), emoji: categoryFormEmoji || '📋' }),
        });
        if (!res.ok) { setCategoryError('Failed to save category.'); return; }
        const data = await res.json() as { category: AdminCategory };
        setAdminCategories(prev => [...prev, data.category]);
        setCategoryFormOpen(false);
        setCategoryFormName('');
        setCategoryFormEmoji('📋');
        setCategoryEmojiPickerOpen(false);
      } catch {
        setCategoryError('Failed to save category.');
      } finally {
        setCategorySaving(false);
      }
    }

    async function generateWithAI() {
      if (!aiPrompt.trim()) return;
      setAiGenerating(true);
      setAiError('');
      setAiBulkPreview(null);
      // Cancel any in-flight request
      aiAbortRef.current?.abort();
      const ctrl = new AbortController();
      aiAbortRef.current = ctrl;
      try {
        const excludedNames = (() => {
          const newest = [...games].sort(
            (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          )[0];
          if (!newest || !Array.isArray(newest.missions)) return [];
          const customById = new Map(adminCustomMissions.map(cm => [cm.id, cm.name] as const));
          const standardById = new Map(MISSIONS.map(m => [m.id, m.name] as const));
          const names: string[] = [];
          for (const id of newest.missions) {
            const n = customById.get(id) ?? standardById.get(id);
            if (n) names.push(n);
          }
          return names;
        })();

        const res = await fetch('/api/admin/ai-generate-mission', {
          method: 'POST',
          signal: ctrl.signal,
          headers: {
            'Content-Type': 'application/json',
            ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {}),
          },
          body: JSON.stringify({
            prompt: aiPrompt,
            ...(aiType ? { type: aiType } : {}),
            language: aiLanguage,
            excludedNames,
            ...(aiCount > 1 ? { count: aiCount } : {}),
          }),
        });

        if (res.status === 403) {
          setAiError('pro_required');
          return;
        }
        if (!res.ok) {
          setAiError('Generation failed — try rephrasing your prompt.');
          return;
        }

        const data = await res.json() as Record<string, unknown>;

        // Bulk mode — show preview list
        if (Array.isArray(data.missions)) {
          const missions = (data.missions as Record<string, unknown>[]).filter(
            m => typeof m.type === 'string' && typeof m.name === 'string'
          );
          if (missions.length === 0) {
            setAiError('Generation failed — try rephrasing your prompt.');
            return;
          }
          setAiBulkPreview(missions.map(m => ({ selected: true, mission: m })));
          return;
        }

        // Single mode — pre-fill form as before
        const mission = data as {
          type: string; name: string; icon: string; desc: string;
          difficulty: 'easy' | 'medium' | 'hard'; maxPts: number;
          triviaRounds?: { question: string; options: [string, string, string, string]; answer: string }[];
          statements?: { text: string; answer: boolean }[];
          closestQuestions?: { q: string; answer: string; unit: string; hint: string }[];
          clues?: string[];
          paAnswer?: string;
          timelineItems?: { label: string; year: string }[];
          photoPrompt?: string;
          segments?: { prompt: string }[];
          relayMode?: string;
          answer?: string;
          hint?: string;
        };

        if (!mission || typeof mission.type !== 'string' || typeof mission.name !== 'string') {
          setAiError('Generation failed — try rephrasing your prompt.');
          return;
        }

        setEditingMissionId(null);
        setMissionForm({
          name: mission.name ?? '',
          icon: mission.icon ?? '⭐',
          desc: mission.desc ?? '',
          difficulty: mission.difficulty ?? 'medium',
          maxPts: mission.maxPts ?? 500,
          type: mission.type ?? '',
          triviaRounds: mission.triviaRounds ?? [],
          statements: mission.statements ?? [],
          closestQuestions: mission.closestQuestions ?? [],
          clues: mission.clues ?? [],
          paAnswer: mission.paAnswer ?? '',
          timelineItems: mission.timelineItems ?? [],
          photoPrompt: mission.photoPrompt ?? '',
          relaySegments: mission.segments?.map((s: { prompt: string }) => s.prompt) ?? ['', '', '', ''],
          relayMode: (mission.relayMode as 'typerace' | 'button') ?? 'typerace',
          sharedSecretAnswer: mission.answer ?? '',
          sharedSecretHint: mission.hint ?? '',
          activeFrom: '',
          activeUntil: '',
        });
        setMissionFormError('');
        setMissionCategoryId(null);
        setShowMissionForm(true);
        setAiPanelOpen(false);
        setAiPrompt('');
        setAiType('');
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
        setAiError('Generation failed — try rephrasing your prompt.');
      } finally {
        setAiGenerating(false);
      }
    }

    async function saveBulkMissions() {
      if (!aiBulkPreview) return;
      const selected = aiBulkPreview.filter(p => p.selected).map(p => p.mission);
      if (selected.length === 0) return;
      setAiBulkSaving(true);
      try {
        const { buildMissionData } = await import('@/lib/custom-missions');
        for (const m of selected) {
          const type = String(m.type ?? '');
          // Build the nested `data` object the API expects
          const data = buildMissionData(type, {
            triviaRounds: (m.triviaRounds as { question: string; options: string[]; answer: string }[]) ?? [],
            statements: (m.statements as { text: string; answer: boolean }[]) ?? [],
            closestQuestions: (m.closestQuestions as { q: string; answer: string; unit: string; hint: string }[]) ?? [],
            clues: (m.clues as string[]) ?? [],
            paAnswer: String(m.paAnswer ?? ''),
            timelineItems: (m.timelineItems as { label: string; year: string }[]) ?? [],
            photoPrompt: String(m.photoPrompt ?? ''),
          });
          await POST('/api/admin/custom-missions', {
            name: String(m.name ?? '').trim(),
            icon: String(m.icon ?? '⭐'),
            desc: String(m.desc ?? ''),
            difficulty: String(m.difficulty ?? 'medium'),
            max_pts: Number(m.maxPts ?? 400),
            type,
            data,
            category_id: null,
            active_from: null,
            active_until: null,
            sort_order: adminCustomMissions.length,
          });
        }
        // Refresh missions list
        await loadAdminCustomMissions();
        setAiBulkPreview(null);
        setAiPanelOpen(false);
        setAiPrompt('');
        setAiType('');
        setAiCount(1);
      } finally {
        setAiBulkSaving(false);
      }
    }

    async function saveMission() {
      const { validateMissionData, buildMissionData } = await import('@/lib/custom-missions');
      const validationError = validateMissionData(missionForm.type, {
        triviaRounds: missionForm.triviaRounds,
        statements: missionForm.statements,
        closestQuestions: missionForm.closestQuestions,
        clues: missionForm.clues,
        paAnswer: missionForm.paAnswer,
        timelineItems: missionForm.timelineItems,
        photoPrompt: missionForm.photoPrompt,
        relaySegments: missionForm.relaySegments,
        relayMode: missionForm.relayMode,
        sharedSecretAnswer: missionForm.sharedSecretAnswer,
        sharedSecretHint: missionForm.sharedSecretHint,
      });
      if (validationError) { setMissionFormError(validationError); return; }

      if (missionForm.activeFrom && missionForm.activeUntil && missionForm.activeFrom > missionForm.activeUntil) {
        setMissionFormError('Active until must be on or after active from.');
        return;
      }

      setMissionSaving(true);
      setMissionFormError('');
      const data = buildMissionData(missionForm.type, {
        triviaRounds: missionForm.triviaRounds,
        statements: missionForm.statements,
        closestQuestions: missionForm.closestQuestions,
        clues: missionForm.clues,
        paAnswer: missionForm.paAnswer,
        timelineItems: missionForm.timelineItems,
        photoPrompt: missionForm.photoPrompt,
        relaySegments: missionForm.relaySegments,
        relayMode: missionForm.relayMode,
        sharedSecretAnswer: missionForm.sharedSecretAnswer,
        sharedSecretHint: missionForm.sharedSecretHint,
      });
      const payload = {
        name: missionForm.name.trim(),
        icon: missionForm.icon || '⭐',
        desc: missionForm.desc,
        difficulty: missionForm.difficulty,
        max_pts: missionForm.maxPts,
        type: missionForm.type,
        data,
        category_id: missionCategoryId,
        active_from: missionForm.activeFrom
          ? new Date(`${missionForm.activeFrom}T00:00:00Z`).toISOString()
          : null,
        active_until: missionForm.activeUntil
          ? new Date(`${missionForm.activeUntil}T23:59:59Z`).toISOString()
          : null,
      };

      if (editingMissionId) {
        const res = await fetch(`/api/admin/custom-missions/${editingMissionId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {}),
          },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          setMissionFormError(err.error ?? 'Could not save mission. Try again.');
          setMissionSaving(false);
          return;
        }
      } else {
        const res = await POST('/api/admin/custom-missions', { ...payload, sort_order: adminCustomMissions.length });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          setMissionFormError(err.error ?? 'Could not save mission. Try again.');
          setMissionSaving(false);
          return;
        }
      }
      setMissionSaving(false);
      setShowMissionForm(false);
      setEditingMissionId(null);
      setMissionCategoryId(null);
      showToast('Mission saved ✓');
      loadAdminCustomMissions();
    }

    async function deleteMission(id: string) {
      setDeletingMissionId(id);
      await fetch(`/api/admin/custom-missions/${id}`, {
        method: 'DELETE',
        headers: authToken ? { 'Authorization': `Bearer ${authToken}` } : {},
      });
      setDeletingMissionId(null);
      loadAdminCustomMissions();
    }

    async function moveMissionToCategory(missionId: string, categoryId: string | null) {
      // Optimistic update
      setAdminCustomMissions(prev =>
        prev.map(m => m.id === missionId ? { ...m, category_id: categoryId } : m)
      );
      await fetch(`/api/admin/custom-missions/${missionId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({ category_id: categoryId }),
      });
    }

    const setF = (patch: Partial<MissionFormData>) => setMissionForm(prev => ({ ...prev, ...patch }));
    const inputStyle = { width: '100%', padding: '8px 12px', fontSize: '13px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text)', fontFamily: "'Sora', sans-serif" };
    const labelStyle = { fontSize: '11px', fontWeight: 700, letterSpacing: '0.5px', color: 'var(--muted)', display: 'block', marginBottom: '4px' };

    return (
      <>
        <nav className="nav">
          <div className="nav-brand"><GameOnLogo size={22} /></div>
          <NavCenter game={null} />
          <div className="nav-right">
            <ProfileMenu />
          </div>
        </nav>
        <div className="container fade-in">
          <div style={{ padding: '32px 0 24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button className="btn btn-ghost" style={{ padding: '8px 14px', fontSize: '12px' }} onClick={() => { setView('games'); setShowMissionForm(false); setMissionCategoryId(null); }}>← Back</button>
            <h2 style={{ margin: 0 }}>My Missions</h2>
          </div>

          {/* Categories manager */}
          <div className="card" style={{ marginBottom: '20px' }}>
                  <div style={{ marginBottom: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                      <label style={labelStyle}>CATEGORIES</label>
                      <button
                        className="btn btn-ghost"
                        style={{ fontSize: '11px', padding: '4px 10px' }}
                        onClick={() => { setCategoryFormOpen(v => !v); setCategoryError(''); setCategoryFormName(''); setCategoryFormEmoji('📋'); setCategoryEmojiPickerOpen(false); }}
                      >
                        {categoryFormOpen ? '✕ Cancel' : '+ New category'}
                      </button>
                    </div>

                    {adminCategories.length === 0 && !categoryFormOpen && (
                      <p style={{ fontSize: '12px', color: 'var(--muted)', margin: '0 0 8px' }}>No categories yet. Create one to organise your missions.</p>
                    )}
                    {adminCategories.map(cat => (
                      <div key={cat.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                        <span style={{ fontSize: '18px', width: '28px', textAlign: 'center' }}>{cat.emoji}</span>
                        <span style={{ flex: 1, fontSize: '14px' }}>{cat.name}</span>
                        {pendingDeleteCategoryId === cat.id ? (
                          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                            <button
                              onClick={async () => {
                                const res = await fetch(`/api/admin/mission-categories?id=${cat.id}`, {
                                  method: 'DELETE',
                                  headers: authToken ? { 'Authorization': `Bearer ${authToken}` } : {},
                                });
                                if (res.ok) {
                                  setAdminCategories(prev => prev.filter(c => c.id !== cat.id));
                                  setAdminCustomMissions(prev => prev.map(m => m.category_id === cat.id ? { ...m, category_id: null } : m));
                                } else {
                                  setCategoryError('Failed to delete category.');
                                }
                                setPendingDeleteCategoryId(null);
                              }}
                              style={{ fontSize: '11px', color: 'var(--danger, #e74c3c)', background: 'none', border: '1px solid var(--danger, #e74c3c)', borderRadius: '4px', cursor: 'pointer', padding: '2px 8px', fontFamily: 'inherit' }}
                            >
                              Delete
                            </button>
                            <button
                              onClick={() => setPendingDeleteCategoryId(null)}
                              style={{ fontSize: '11px', color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setPendingDeleteCategoryId(cat.id)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: '16px', padding: '0 4px' }}
                            title="Delete category"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    ))}

                    {categoryFormOpen && (
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '10px' }}>
                        {/* Emoji picker button */}
                        <div style={{ position: 'relative', flexShrink: 0 }}>
                          <button
                            type="button"
                            onClick={() => setCategoryEmojiPickerOpen(v => !v)}
                            style={{ ...inputStyle, width: '48px', textAlign: 'center', fontSize: '20px', padding: '6px 4px', cursor: 'pointer', background: categoryEmojiPickerOpen ? 'var(--surface)' : undefined }}
                            title="Choose emoji"
                          >
                            {categoryFormEmoji}
                          </button>
                          {categoryEmojiPickerOpen && (
                            <div style={{
                              position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 50,
                              background: 'var(--card)', border: '1px solid var(--border)',
                              borderRadius: '10px', padding: '10px', boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                              width: '280px',
                            }}>
                              {/* Free-text input */}
                              <input
                                type="text"
                                placeholder="Type or paste any emoji…"
                                maxLength={4}
                                style={{ width: '100%', boxSizing: 'border-box', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '7px', padding: '6px 10px', color: 'var(--text)', fontSize: '14px', fontFamily: 'inherit', marginBottom: '10px' }}
                                onChange={e => {
                                  const v = [...e.target.value].filter(c => c.trim()).join('');
                                  if (v) { setCategoryFormEmoji(v); setCategoryEmojiPickerOpen(false); }
                                }}
                              />
                              {/* Grid */}
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: '2px', maxHeight: '240px', overflowY: 'auto' }}>
                                {[
                                  // Games & sports
                                  '🎮','🎯','🧩','🎲','🏆','🥇','🏅','🎳','♟️','🎱','🎰','🎪','🎭','🎨','🖼️','🎬',
                                  // Music & performance
                                  '🎵','🎶','🎸','🎤','🥁','🎹','🎺','🎻',
                                  // Nature & animals
                                  '🦁','🐯','🦊','🐺','🐻','🦝','🐲','🐉','🦋','🌿','🌲','🌋','🌊','🌈','⚡','🔥',
                                  // Space & science
                                  '🚀','🌍','🌙','⭐','🌟','💫','🔭','🧪','🧬','🧲','⚗️','💡',
                                  // Food & drink
                                  '🍕','🍔','🌮','🍣','🍩','🎂','🍺','🍻','☕','🧃',
                                  // People & activities
                                  '💪','🤝','🧠','🎓','👑','🎩','🦸','🕵️','🧙','🏋️','🤸','🧗',
                                  // Objects & symbols
                                  '💎','💰','🔮','🪄','🗺️','🧭','📸','📋','📚','🔑','🏠','🏰','🚗','✈️','🎁','🎊','🎉','🔐',
                                  // Misc fun
                                  '👻','💀','🤖','👾','🃏','🪅','🎠','🌺','🍀','🌸',
                                ].map(e => (
                                  <button
                                    key={e}
                                    type="button"
                                    onClick={() => { setCategoryFormEmoji(e); setCategoryEmojiPickerOpen(false); }}
                                    style={{ fontSize: '18px', padding: '5px', background: 'none', border: 'none', cursor: 'pointer', borderRadius: '6px', lineHeight: 1 }}
                                    onMouseEnter={ev => (ev.currentTarget.style.background = 'var(--surface)')}
                                    onMouseLeave={ev => (ev.currentTarget.style.background = 'none')}
                                  >
                                    {e}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                        <input
                          type="text"
                          value={categoryFormName}
                          onChange={e => setCategoryFormName(e.target.value)}
                          placeholder="Category name…"
                          style={{ ...inputStyle, flex: 1 }}
                          onKeyDown={async e => { if (e.key === 'Enter' && categoryFormName.trim()) await saveCategory(); }}
                          onClick={() => setCategoryEmojiPickerOpen(false)}
                        />
                        <button
                          className="btn btn-primary"
                          style={{ padding: '8px 14px', fontSize: '12px', flexShrink: 0 }}
                          disabled={!categoryFormName.trim() || categorySaving}
                          onClick={saveCategory}
                        >
                          {categorySaving ? '…' : 'Save'}
                        </button>
                      </div>
                    )}
                    {categoryError && <p style={{ fontSize: '12px', color: 'var(--danger, #e74c3c)', marginTop: '6px' }}>{categoryError}</p>}
                  </div>
          </div>

          {/* Mission filters / drag-and-drop targets */}
          {adminCustomMissions.length > 0 && (() => {
            const usedTypes = [...new Set(adminCustomMissions.map(m => m.type))].sort();
            const usedCatIds = [...new Set(adminCustomMissions.map(m => m.category_id).filter(Boolean))];
            const usedCats = adminCategories.filter(c => usedCatIds.includes(c.id));
            const chipStyle = (active: boolean): React.CSSProperties => ({
              padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 600, cursor: 'pointer', border: '1px solid',
              borderColor: active ? 'var(--accent)' : 'var(--border)',
              background: active ? 'rgba(124,189,212,0.15)' : 'transparent',
              color: active ? 'var(--accent)' : 'var(--muted)',
              fontFamily: "'Sora', sans-serif", whiteSpace: 'nowrap' as const,
            });
            const dropZoneStyle = (hovered: boolean): React.CSSProperties => ({
              padding: '6px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: 600,
              border: `2px dashed ${hovered ? 'var(--accent)' : 'rgba(124,189,212,0.35)'}`,
              background: hovered ? 'rgba(124,189,212,0.18)' : 'rgba(124,189,212,0.05)',
              color: hovered ? 'var(--accent)' : 'rgba(124,189,212,0.7)',
              fontFamily: "'Sora', sans-serif", whiteSpace: 'nowrap' as const,
              cursor: 'copy', transition: 'all .12s',
              transform: hovered ? 'scale(1.06)' : 'scale(1)',
            });
            const noneZoneStyle = (hovered: boolean): React.CSSProperties => ({
              padding: '6px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: 600,
              border: `2px dashed ${hovered ? 'var(--muted)' : 'rgba(128,128,128,0.3)'}`,
              background: hovered ? 'rgba(128,128,128,0.12)' : 'transparent',
              color: hovered ? 'var(--text)' : 'var(--muted)',
              fontFamily: "'Sora', sans-serif", whiteSpace: 'nowrap' as const,
              cursor: 'copy', transition: 'all .12s',
              transform: hovered ? 'scale(1.06)' : 'scale(1)',
            });

            if (draggingMissionId) {
              // DnD mode: show all categories as drop zones (all categories, not just used ones)
              const draggedMission = adminCustomMissions.find(m => m.id === draggingMissionId);
              const hasCat = !!draggedMission?.category_id;
              return (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 600, letterSpacing: '.05em', marginRight: '2px' }}>DROP TO:</span>
                  {adminCategories.map(cat => (
                    <div
                      key={cat.id}
                      style={dropZoneStyle(dropTargetCatId === cat.id)}
                      onDragOver={e => { e.preventDefault(); setDropTargetCatId(cat.id); }}
                      onDragLeave={() => setDropTargetCatId(null)}
                      onDrop={e => {
                        e.preventDefault();
                        moveMissionToCategory(draggingMissionId, cat.id);
                        setDraggingMissionId(null);
                        setDropTargetCatId(null);
                      }}
                    >
                      {cat.emoji} {cat.name}
                    </div>
                  ))}
                  {hasCat && (
                    <div
                      style={noneZoneStyle(dropTargetCatId === 'none')}
                      onDragOver={e => { e.preventDefault(); setDropTargetCatId('none'); }}
                      onDragLeave={() => setDropTargetCatId(null)}
                      onDrop={e => {
                        e.preventDefault();
                        moveMissionToCategory(draggingMissionId, null);
                        setDraggingMissionId(null);
                        setDropTargetCatId(null);
                      }}
                    >
                      ✕ Remove from category
                    </div>
                  )}
                </div>
              );
            }

            return (usedCats.length > 0 || usedTypes.length > 1) ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
                {usedCats.length > 0 && (<>
                  <button style={chipStyle(!missionFilterCategory && !missionFilterType)} onClick={() => { setMissionFilterCategory(null); setMissionFilterType(null); }}>All</button>
                  {usedCats.map(cat => (
                    <button key={cat.id} style={chipStyle(missionFilterCategory === cat.id)} onClick={() => setMissionFilterCategory(v => v === cat.id ? null : cat.id)}>
                      {cat.emoji} {cat.name}
                    </button>
                  ))}
                  {usedTypes.length > 1 && <span style={{ width: 1, background: 'var(--border)', alignSelf: 'stretch', margin: '0 2px' }} />}
                </>)}
                {usedTypes.length > 1 && usedTypes.map(type => (
                  <button key={type} style={chipStyle(missionFilterType === type)} onClick={() => setMissionFilterType(v => v === type ? null : type)}>
                    {type.replace(/_/g, ' ')}
                  </button>
                ))}
              </div>
            ) : null;
          })()}

          {/* Mission list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
            {adminCustomMissions.length === 0 && !showMissionForm && (
              <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '32px', fontSize: '14px' }}>
                No missions yet. Add your first one below.
              </div>
            )}
            {adminCustomMissions.filter(cm =>
              (!missionFilterCategory || cm.category_id === missionFilterCategory) &&
              (!missionFilterType || cm.type === missionFilterType)
            ).map(cm => {
              const cat = cm.category_id ? adminCategories.find(c => c.id === cm.category_id) : null;
              return (
              <div
                key={cm.id}
                draggable={adminCategories.length > 0}
                onDragStart={() => setDraggingMissionId(cm.id)}
                onDragEnd={() => { setDraggingMissionId(null); setDropTargetCatId(null); }}
                style={{
                  background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px 18px',
                  display: 'flex', alignItems: 'center', gap: '12px',
                  cursor: adminCategories.length > 0 ? 'grab' : 'default',
                  opacity: draggingMissionId === cm.id ? 0.4 : 1,
                  transition: 'opacity .1s',
                }}
              >
                <span style={{ fontSize: '22px' }}>{cm.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: '14px' }}>{cm.name}</div>
                  <div style={{ fontSize: '11px', color: 'var(--muted)', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                    {cat && (
                      <span style={{ background: 'rgba(155,89,182,0.12)', color: '#b07fd4', border: '1px solid rgba(155,89,182,0.25)', borderRadius: '4px', padding: '1px 6px', fontWeight: 600 }}>
                        {cat.emoji} {cat.name}
                      </span>
                    )}
                    <span>{cm.type.replace(/_/g, ' ')} · {cm.difficulty} · {cm.max_pts} pts</span>
                  </div>
                </div>
                <button className="btn btn-ghost" style={{ padding: '6px 12px', fontSize: '11px' }} onClick={() => openEditForm(cm)}>Edit</button>
                <button
                  className="btn btn-ghost"
                  style={{ padding: '6px 12px', fontSize: '11px', color: 'var(--accent3)' }}
                  disabled={deletingMissionId === cm.id}
                  onClick={() => deleteMission(cm.id)}
                >
                  {deletingMissionId === cm.id ? '...' : 'Delete'}
                </button>
              </div>
            );})}
          </div>

          {/* Add / Edit form */}
          {!showMissionForm && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {/* AI generate button */}
              <button
                className="btn btn-ghost"
                style={{ width: '100%', padding: '12px', border: '1px solid rgba(124,189,212,0.3)', color: '#7CBDD4' }}
                onClick={() => { setAiPanelOpen(v => !v); setAiError(''); }}
              >
                ✨ {aiPanelOpen ? 'Close AI Generator' : 'Generate with AI'}
              </button>

              {/* AI panel */}
              {aiPanelOpen && (
                <div className="card" style={{ marginBottom: '4px' }}>
                  <h3 style={{ marginBottom: '16px', fontSize: '15px', color: '#7CBDD4' }}>✨ Generate with AI</h3>

                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ fontSize: '11px', letterSpacing: '.1em', color: 'var(--muted)', display: 'block', marginBottom: '6px' }}>DESCRIBE YOUR MISSION</label>
                    <textarea
                      rows={3}
                      value={aiPrompt}
                      onChange={e => setAiPrompt(e.target.value)}
                      placeholder={'e.g. "5 trivia questions about our company history", "Famous landmarks timeline", "True or false about space exploration"'}
                      style={{ width: '100%', background: 'var(--input-bg)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 12px', color: 'var(--text)', fontSize: '13px', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 80px', gap: '12px', marginBottom: '16px' }}>
                    <div>
                      <label style={{ fontSize: '11px', letterSpacing: '.1em', color: 'var(--muted)', display: 'block', marginBottom: '6px' }}>TYPE (OPTIONAL)</label>
                      <select
                        value={aiType}
                        onChange={e => setAiType(e.target.value)}
                        style={{ width: '100%', background: 'var(--input-bg)', border: '1px solid var(--border)', borderRadius: '8px', padding: '8px 12px', color: 'var(--text)', fontSize: '13px' }}
                      >
                        <option value="">Let AI choose</option>
                        <option value="trivia_quiz">Trivia Quiz</option>
                        <option value="truefalse">True or False</option>
                        <option value="closest_wins">Closest Wins</option>
                        <option value="pa_sparet">På Spåret</option>
                        <option value="timeline">Timeline</option>
                        <option value="photo">Photo</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: '11px', letterSpacing: '.1em', color: 'var(--muted)', display: 'block', marginBottom: '6px' }}>LANGUAGE</label>
                      <select
                        value={aiLanguage}
                        onChange={e => setAiLanguage(e.target.value)}
                        style={{ width: '100%', background: 'var(--input-bg)', border: '1px solid var(--border)', borderRadius: '8px', padding: '8px 12px', color: 'var(--text)', fontSize: '13px' }}
                      >
                        <option value="en">English</option>
                        <option value="sv">Svenska</option>
                        <option value="no">Norsk</option>
                        <option value="da">Dansk</option>
                        <option value="de">Deutsch</option>
                        <option value="fr">Français</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: '11px', letterSpacing: '.1em', color: 'var(--muted)', display: 'block', marginBottom: '6px' }}>COUNT</label>
                      <select
                        value={aiCount}
                        onChange={e => { setAiCount(Number(e.target.value)); setAiBulkPreview(null); }}
                        style={{ width: '100%', background: 'var(--input-bg)', border: '1px solid var(--border)', borderRadius: '8px', padding: '8px 12px', color: 'var(--text)', fontSize: '13px' }}
                      >
                        <option value={1}>1</option>
                        <option value={2}>2</option>
                        <option value={3}>3</option>
                        <option value={4}>4</option>
                        <option value={5}>5</option>
                      </select>
                    </div>
                  </div>

                  {aiError === 'pro_required' ? (
                    <div style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '12px' }}>
                      AI mission generation requires Pro.{' '}
                      <span style={{ color: '#7CBDD4', cursor: 'pointer', fontWeight: 600 }} onClick={() => handleUpgrade('pro')}>Upgrade →</span>
                    </div>
                  ) : aiError ? (
                    <div style={{ fontSize: '13px', color: 'var(--danger, #e74c3c)', marginBottom: '12px' }}>{aiError}</div>
                  ) : null}

                  <button
                    className="btn btn-primary"
                    style={{ width: '100%', padding: '12px', opacity: (!aiPrompt.trim() || aiGenerating) ? 0.5 : 1 }}
                    disabled={!aiPrompt.trim() || aiGenerating}
                    onClick={generateWithAI}
                  >
                    {aiGenerating ? '✨ Generating…' : aiCount > 1 ? `✨ Generate ${aiCount} missions` : '✨ Generate'}
                  </button>

                  {/* Bulk preview */}
                  {aiBulkPreview && (
                    <div style={{ marginTop: '16px' }}>
                      <div style={{ fontSize: '11px', letterSpacing: '.1em', color: 'var(--muted)', marginBottom: '10px' }}>
                        SELECT MISSIONS TO SAVE
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '14px' }}>
                        {aiBulkPreview.map((item, idx) => (
                          <div
                            key={idx}
                            onClick={() => setAiBulkPreview(prev => prev ? prev.map((p, i) => i === idx ? { ...p, selected: !p.selected } : p) : prev)}
                            style={{
                              display: 'flex', alignItems: 'center', gap: '10px',
                              background: item.selected ? 'rgba(124,189,212,0.08)' : 'var(--surface)',
                              border: `1px solid ${item.selected ? 'rgba(124,189,212,0.35)' : 'var(--border)'}`,
                              borderRadius: '10px', padding: '10px 14px', cursor: 'pointer',
                              opacity: item.selected ? 1 : 0.55, transition: 'all .15s',
                            }}
                          >
                            <div style={{
                              width: '18px', height: '18px', borderRadius: '4px', flexShrink: 0,
                              border: `2px solid ${item.selected ? '#7CBDD4' : 'var(--muted)'}`,
                              background: item.selected ? '#7CBDD4' : 'transparent',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                              {item.selected && <span style={{ color: '#000', fontSize: '12px', fontWeight: 700, lineHeight: 1 }}>✓</span>}
                            </div>
                            <span style={{ fontSize: '20px', flexShrink: 0 }}>{String(item.mission.icon ?? '⭐')}</span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontWeight: 700, fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {String(item.mission.name ?? '')}
                              </div>
                              <div style={{ fontSize: '11px', color: 'var(--muted)' }}>
                                {String(item.mission.type ?? '').replace(/_/g, ' ')} · {String(item.mission.difficulty ?? '')} · {Number(item.mission.maxPts ?? 0)} pts
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          className="btn btn-primary"
                          style={{ flex: 1, padding: '11px', opacity: (aiBulkSaving || aiBulkPreview.every(p => !p.selected)) ? 0.5 : 1 }}
                          disabled={aiBulkSaving || aiBulkPreview.every(p => !p.selected)}
                          onClick={saveBulkMissions}
                        >
                          {aiBulkSaving ? 'Saving…' : `Save ${aiBulkPreview.filter(p => p.selected).length} mission${aiBulkPreview.filter(p => p.selected).length !== 1 ? 's' : ''}`}
                        </button>
                        <button
                          className="btn btn-ghost"
                          style={{ padding: '11px 16px' }}
                          onClick={() => { setAiBulkPreview(null); }}
                        >
                          Discard
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <button className="btn btn-ghost" style={{ width: '100%', padding: '12px' }} onClick={openNewForm}>+ Add Mission Manually</button>
            </div>
          )}

          {showMissionForm && (
            <div className="card" style={{ marginBottom: '32px' }}>
              <h3 style={{ marginBottom: '20px', fontSize: '16px' }}>{editingMissionId ? 'Edit Mission' : 'New Mission'}</h3>

              {/* Base fields */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <label style={labelStyle}>NAME</label>
                  <input type="text" value={missionForm.name} onChange={e => setF({ name: e.target.value })} placeholder="Mission name" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>ICON</label>
                  <input type="text" value={missionForm.icon} onChange={e => setF({ icon: e.target.value })} placeholder="⭐" style={inputStyle} />
                </div>
              </div>
              <div style={{ marginBottom: '12px' }}>
                <label style={labelStyle}>DESCRIPTION</label>
                <input type="text" value={missionForm.desc} onChange={e => setF({ desc: e.target.value })} placeholder="What teams see before starting" style={inputStyle} />
              </div>
              {adminCategories.length > 0 && (
                <div style={{ marginBottom: '12px' }}>
                  <label style={labelStyle}>CATEGORY</label>
                  <select
                    value={missionCategoryId ?? ''}
                    onChange={e => setMissionCategoryId(e.target.value || null)}
                    style={inputStyle}
                  >
                    <option value="">(No category)</option>
                    {adminCategories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.emoji} {cat.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <label style={labelStyle}>DIFFICULTY</label>
                  <select value={missionForm.difficulty} onChange={e => setF({ difficulty: e.target.value as MissionFormData['difficulty'] })} style={inputStyle}>
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>MAX PTS</label>
                  <input type="number" value={missionForm.maxPts} min={0} max={9999} step={50} onChange={e => setF({ maxPts: Number(e.target.value) })} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>TYPE</label>
                  <select value={missionForm.type} onChange={e => setF({ type: e.target.value })} style={inputStyle}>
                    <option value="">Select type…</option>
                    <option value="trivia_quiz">Trivia Quiz</option>
                    <option value="truefalse">True / False</option>
                    <option value="closest_wins">Closest Wins</option>
                    <option value="pa_sparet">På Spåret</option>
                    <option value="timeline">Timeline</option>
                    <option value="photo">Photo</option>
                    <option value="relay">Stafett (Relay)</option>
                    <option value="shared_secret">Hemligt ord (Shared Secret)</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '12px', marginBottom: '12px' }}>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--muted)', letterSpacing: '1px', display: 'block', marginBottom: '4px' }}>
                    ACTIVE FROM (OPTIONAL)
                  </label>
                  <input
                    type="date"
                    value={missionForm.activeFrom}
                    onChange={e => setF({ activeFrom: e.target.value })}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--muted)', letterSpacing: '1px', display: 'block', marginBottom: '4px' }}>
                    ACTIVE UNTIL (OPTIONAL)
                  </label>
                  <input
                    type="date"
                    value={missionForm.activeUntil}
                    onChange={e => setF({ activeUntil: e.target.value })}
                    style={inputStyle}
                  />
                </div>
              </div>
              {missionForm.activeFrom && missionForm.activeUntil && missionForm.activeFrom > missionForm.activeUntil && (
                <div style={{ marginBottom: '8px', fontSize: '11px', color: 'var(--danger, #d33)' }}>
                  Active until must be on or after active from.
                </div>
              )}

              {/* ── Type-specific fields ── */}

              {missionForm.type === 'photo' && (
                <div style={{ marginBottom: '12px' }}>
                  <label style={labelStyle}>WHAT SHOULD TEAMS PHOTOGRAPH?</label>
                  <input type="text" value={missionForm.photoPrompt} onChange={e => setF({ photoPrompt: e.target.value })} placeholder="e.g. A selfie in front of our logo" style={inputStyle} />
                </div>
              )}

              {missionForm.type === 'pa_sparet' && (
                <div style={{ marginBottom: '12px' }}>
                  <label style={labelStyle}>CLUES (revealed one at a time, most points for first clue)</label>
                  {missionForm.clues.map((clue, i) => (
                    <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '6px' }}>
                      <span style={{ fontSize: '12px', color: 'var(--muted)', alignSelf: 'center', width: '20px', flexShrink: 0 }}>{i + 1}.</span>
                      <input type="text" value={clue} onChange={e => { const c = [...missionForm.clues]; c[i] = e.target.value; setF({ clues: c }); }} placeholder={`Clue ${i + 1}`} style={{ ...inputStyle, flex: 1 }} />
                      <button onClick={() => setF({ clues: missionForm.clues.filter((_, j) => j !== i) })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: '16px', flexShrink: 0 }}>×</button>
                    </div>
                  ))}
                  <button className="btn btn-ghost" style={{ fontSize: '11px', padding: '4px 10px', marginBottom: '10px' }} onClick={() => setF({ clues: [...missionForm.clues, ''] })}>+ Add clue</button>
                  <label style={labelStyle}>ANSWER</label>
                  <input type="text" value={missionForm.paAnswer} onChange={e => setF({ paAnswer: e.target.value })} placeholder="The correct answer" style={inputStyle} />
                </div>
              )}

              {missionForm.type === 'truefalse' && (
                <div style={{ marginBottom: '12px' }}>
                  <label style={labelStyle}>STATEMENTS</label>
                  {missionForm.statements.map((s, i) => (
                    <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '6px', alignItems: 'center' }}>
                      <input type="text" value={s.text} onChange={e => { const arr = [...missionForm.statements]; arr[i] = { ...arr[i], text: e.target.value }; setF({ statements: arr }); }} placeholder="Statement text" style={{ ...inputStyle, flex: 1 }} />
                      <select value={s.answer ? 'true' : 'false'} onChange={e => { const arr = [...missionForm.statements]; arr[i] = { ...arr[i], answer: e.target.value === 'true' }; setF({ statements: arr }); }} style={{ ...inputStyle, width: '90px', flexShrink: 0 }}>
                        <option value="true">True</option>
                        <option value="false">False</option>
                      </select>
                      <button onClick={() => setF({ statements: missionForm.statements.filter((_, j) => j !== i) })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: '16px', flexShrink: 0 }}>×</button>
                    </div>
                  ))}
                  <button className="btn btn-ghost" style={{ fontSize: '11px', padding: '4px 10px' }} onClick={() => setF({ statements: [...missionForm.statements, { text: '', answer: true }] })}>+ Add statement</button>
                </div>
              )}

              {missionForm.type === 'closest_wins' && (
                <div style={{ marginBottom: '12px' }}>
                  <label style={labelStyle}>QUESTIONS</label>
                  {missionForm.closestQuestions.map((q, i) => (
                    <div key={i} style={{ background: 'var(--surface)', borderRadius: '8px', padding: '10px', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <span style={{ fontSize: '12px', color: 'var(--muted)' }}>Question {i + 1}</span>
                        <button onClick={() => setF({ closestQuestions: missionForm.closestQuestions.filter((_, j) => j !== i) })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: '14px' }}>×</button>
                      </div>
                      <input type="text" value={q.q} onChange={e => { const arr = [...missionForm.closestQuestions]; arr[i] = { ...arr[i], q: e.target.value }; setF({ closestQuestions: arr }); }} placeholder="Question" style={{ ...inputStyle, marginBottom: '6px' }} />
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                        <input type="number" value={q.answer} onChange={e => { const arr = [...missionForm.closestQuestions]; arr[i] = { ...arr[i], answer: e.target.value }; setF({ closestQuestions: arr }); }} placeholder="Correct answer (number)" style={inputStyle} />
                        <input type="text" value={q.unit} onChange={e => { const arr = [...missionForm.closestQuestions]; arr[i] = { ...arr[i], unit: e.target.value }; setF({ closestQuestions: arr }); }} placeholder="Unit (e.g. employees)" style={inputStyle} />
                      </div>
                      <input type="text" value={q.hint} onChange={e => { const arr = [...missionForm.closestQuestions]; arr[i] = { ...arr[i], hint: e.target.value }; setF({ closestQuestions: arr }); }} placeholder="Hint" style={{ ...inputStyle, marginTop: '6px' }} />
                    </div>
                  ))}
                  <button className="btn btn-ghost" style={{ fontSize: '11px', padding: '4px 10px' }} onClick={() => setF({ closestQuestions: [...missionForm.closestQuestions, { q: '', answer: '', unit: '', hint: '' }] })}>+ Add question</button>
                </div>
              )}

              {missionForm.type === 'timeline' && (
                <div style={{ marginBottom: '12px' }}>
                  <label style={labelStyle}>EVENTS (teams will sort these chronologically)</label>
                  {missionForm.timelineItems.map((item, i) => (
                    <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '6px', alignItems: 'center' }}>
                      <input type="text" value={item.label} onChange={e => { const arr = [...missionForm.timelineItems]; arr[i] = { ...arr[i], label: e.target.value }; setF({ timelineItems: arr }); }} placeholder="Event label" style={{ ...inputStyle, flex: 1 }} />
                      <input type="number" value={item.year} onChange={e => { const arr = [...missionForm.timelineItems]; arr[i] = { ...arr[i], year: e.target.value }; setF({ timelineItems: arr }); }} placeholder="Year" style={{ ...inputStyle, width: '90px', flexShrink: 0 }} />
                      <button onClick={() => setF({ timelineItems: missionForm.timelineItems.filter((_, j) => j !== i) })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: '16px', flexShrink: 0 }}>×</button>
                    </div>
                  ))}
                  <button className="btn btn-ghost" style={{ fontSize: '11px', padding: '4px 10px' }} onClick={() => setF({ timelineItems: [...missionForm.timelineItems, { label: '', year: '' }] })}>+ Add event</button>
                </div>
              )}

              {missionForm.type === 'trivia_quiz' && (
                <div style={{ marginBottom: '12px' }}>
                  <label style={labelStyle}>QUESTIONS</label>
                  {missionForm.triviaRounds.map((round, i) => (
                    <div key={i} style={{ background: 'var(--surface)', borderRadius: '8px', padding: '10px', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <span style={{ fontSize: '12px', color: 'var(--muted)' }}>Question {i + 1}</span>
                        <button onClick={() => setF({ triviaRounds: missionForm.triviaRounds.filter((_, j) => j !== i) })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: '14px' }}>×</button>
                      </div>
                      <input type="text" value={round.question} onChange={e => { const arr = [...missionForm.triviaRounds]; arr[i] = { ...arr[i], question: e.target.value }; setF({ triviaRounds: arr }); }} placeholder="Question" style={{ ...inputStyle, marginBottom: '8px' }} />
                      {([0, 1, 2, 3] as const).map(oi => (
                        <div key={oi} style={{ display: 'flex', gap: '8px', marginBottom: '4px', alignItems: 'center' }}>
                          <input
                            type="radio"
                            name={`correct-${i}`}
                            checked={round.answer === round.options[oi]}
                            onChange={() => { const arr = [...missionForm.triviaRounds]; arr[i] = { ...arr[i], answer: arr[i].options[oi] }; setF({ triviaRounds: arr }); }}
                            style={{ flexShrink: 0 }}
                          />
                          <input
                            type="text"
                            value={round.options[oi] ?? ''}
                            onChange={e => {
                              const arr = [...missionForm.triviaRounds];
                              const opts: [string, string, string, string] = [...arr[i].options] as [string, string, string, string];
                              opts[oi] = e.target.value;
                              const newAnswer = arr[i].answer === arr[i].options[oi] ? e.target.value : arr[i].answer;
                              arr[i] = { ...arr[i], options: opts, answer: newAnswer };
                              setF({ triviaRounds: arr });
                            }}
                            placeholder={`Option ${oi + 1}`}
                            style={{ ...inputStyle, flex: 1 }}
                          />
                        </div>
                      ))}
                      <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '4px' }}>Select the radio button next to the correct option</div>
                    </div>
                  ))}
                  <button className="btn btn-ghost" style={{ fontSize: '11px', padding: '4px 10px' }} onClick={() => setF({ triviaRounds: [...missionForm.triviaRounds, { question: '', options: ['', '', '', ''], answer: '' }] })}>+ Add question</button>
                </div>
              )}

              {missionForm.type === 'relay' && (
                <div style={{ marginBottom: '12px' }}>
                  <label style={labelStyle}>RELAY MODE</label>
                  <select
                    value={missionForm.relayMode}
                    onChange={e => setF({ relayMode: e.target.value as 'typerace' | 'button' })}
                    style={inputStyle}
                  >
                    <option value="typerace">Skrivstafett — deltagaren skriver texten exakt</option>
                    <option value="button">Knapptafett — deltagaren klickar Klar</option>
                  </select>
                  <label style={{ ...labelStyle, marginTop: '12px' }}>SEGMENTS (one per team member)</label>
                  {missionForm.relaySegments.map((seg, i) => (
                    <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '6px' }}>
                      <span style={{ fontSize: '12px', color: 'var(--muted)', alignSelf: 'center', width: '20px', flexShrink: 0 }}>{i + 1}.</span>
                      <input
                        type="text"
                        value={seg}
                        onChange={e => { const arr = [...missionForm.relaySegments]; arr[i] = e.target.value; setF({ relaySegments: arr }); }}
                        placeholder={`Segment ${i + 1}`}
                        style={{ ...inputStyle, flex: 1 }}
                      />
                      {missionForm.relaySegments.length > 2 && (
                        <button
                          onClick={() => setF({ relaySegments: missionForm.relaySegments.filter((_, j) => j !== i) })}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: '16px', flexShrink: 0 }}
                        >×</button>
                      )}
                    </div>
                  ))}
                  <button
                    className="btn btn-ghost"
                    style={{ fontSize: '11px', padding: '4px 10px' }}
                    onClick={() => setF({ relaySegments: [...missionForm.relaySegments, ''] })}
                  >+ Add segment</button>
                </div>
              )}

              {missionForm.type === 'shared_secret' && (
                <div style={{ marginBottom: '12px' }}>
                  <label style={labelStyle}>CLUES (one per team member)</label>
                  {missionForm.clues.map((clue, i) => (
                    <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '6px' }}>
                      <span style={{ fontSize: '12px', color: 'var(--muted)', alignSelf: 'center', width: '20px', flexShrink: 0 }}>{i + 1}.</span>
                      <input
                        type="text"
                        value={clue}
                        onChange={e => { const c = [...missionForm.clues]; c[i] = e.target.value; setF({ clues: c }); }}
                        placeholder={`Clue ${i + 1}`}
                        style={{ ...inputStyle, flex: 1 }}
                      />
                      {missionForm.clues.length > 2 && (
                        <button
                          onClick={() => setF({ clues: missionForm.clues.filter((_, j) => j !== i) })}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: '16px', flexShrink: 0 }}
                        >×</button>
                      )}
                    </div>
                  ))}
                  <button
                    className="btn btn-ghost"
                    style={{ fontSize: '11px', padding: '4px 10px', marginBottom: '10px' }}
                    onClick={() => setF({ clues: [...missionForm.clues, ''] })}
                  >+ Add clue</button>
                  <label style={labelStyle}>ANSWER (the secret word/code)</label>
                  <input
                    type="text"
                    value={missionForm.sharedSecretAnswer}
                    onChange={e => setF({ sharedSecretAnswer: e.target.value })}
                    placeholder="e.g. salt"
                    style={inputStyle}
                  />
                  <label style={{ ...labelStyle, marginTop: '10px' }}>HINT (optional — revealed after 2 wrong attempts, costs -50 pts)</label>
                  <input
                    type="text"
                    value={missionForm.sharedSecretHint}
                    onChange={e => setF({ sharedSecretHint: e.target.value })}
                    placeholder="e.g. Think cooking"
                    style={inputStyle}
                  />
                </div>
              )}

              {missionFormError && (
                <p style={{ color: 'var(--accent3)', fontSize: '13px', marginBottom: '12px' }}>{missionFormError}</p>
              )}

              <div style={{ display: 'flex', gap: '10px' }}>
                <button className="btn btn-primary" style={{ flex: 1, padding: '10px' }} disabled={missionSaving || !missionForm.name.trim() || !missionForm.type} onClick={saveMission}>
                  {missionSaving ? 'Saving…' : editingMissionId ? 'Save Changes' : 'Add Mission'}
                </button>
                <button className="btn btn-ghost" style={{ padding: '10px 16px' }} onClick={() => { setShowMissionForm(false); setEditingMissionId(null); setMissionFormError(''); setMissionCategoryId(null); }}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      </>
    );
  }

  if (view === 'manage-templates') return (
    <>
      {showGenerateModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: 24, width: '100%', maxWidth: 520, fontFamily: "'Sora', sans-serif" }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--text)' }}>✨ Generate with AI</div>
              <button onClick={() => { setShowGenerateModal(false); setGeneratePreview(null); setGeneratePrompt(''); }} style={{ background: 'transparent', border: 'none', color: 'var(--muted)', fontSize: 20, cursor: 'pointer' }}>✕</button>
            </div>
            {!generatePreview ? (
              <>
                <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12 }}>Describe your event — theme, duration, number of teams, vibe...</p>
                <textarea
                  value={generatePrompt}
                  onChange={e => setGeneratePrompt(e.target.value)}
                  placeholder="e.g. Halloween scavenger hunt for 8 teams, spooky and competitive, around 45 minutes"
                  rows={4}
                  style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13, fontFamily: "'Sora', sans-serif", resize: 'vertical', boxSizing: 'border-box' }}
                />
                <button
                  onClick={generateTemplate}
                  disabled={generateLoading || !generatePrompt.trim()}
                  style={{ marginTop: 12, width: '100%', padding: '10px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#0a0e19', fontWeight: 800, fontSize: 14, cursor: generateLoading || !generatePrompt.trim() ? 'not-allowed' : 'pointer', opacity: (generateLoading || !generatePrompt.trim()) ? 0.5 : 1, fontFamily: "'Sora', sans-serif" }}
                >
                  {generateLoading ? 'Generating...' : 'Generate →'}
                </button>
              </>
            ) : (
              <>
                <div style={{ background: 'var(--bg)', borderRadius: 10, padding: 16, marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <span style={{ fontSize: 24 }}>{generatePreview.icon}</span>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--text)' }}>{generatePreview.name}</div>
                      {generatePreview.activeFrom && generatePreview.activeTo && (
                        <div style={{ fontSize: 11, color: 'var(--accent)', marginTop: 2 }}>🗓 {generatePreview.activeFrom} – {generatePreview.activeTo}</div>
                      )}
                    </div>
                  </div>
                  <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 12px' }}>{generatePreview.description}</p>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>
                    Missions ({generatePreview.selectedMissionIds.length + generatePreview.newMissions.length} total)
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 200, overflowY: 'auto' }}>
                    {generatePreview.newMissions.map((m, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text)' }}>
                        <span style={{ fontSize: 10, fontWeight: 800, background: 'rgba(117,171,200,0.15)', color: 'var(--accent)', borderRadius: 4, padding: '1px 5px', flexShrink: 0 }}>NEW</span>
                        {m.title}
                      </div>
                    ))}
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>+ {generatePreview.selectedMissionIds.length} existing missions</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    onClick={() => setGeneratePreview(null)}
                    style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: "'Sora', sans-serif" }}
                  >
                    ← Back
                  </button>
                  <button
                    onClick={saveGeneratedTemplate}
                    disabled={generateSaving}
                    style={{ flex: 2, padding: '10px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#0a0e19', fontWeight: 800, fontSize: 13, cursor: generateSaving ? 'not-allowed' : 'pointer', fontFamily: "'Sora', sans-serif" }}
                  >
                    {generateSaving ? 'Saving...' : 'Save template'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      <nav className="nav" style={{ position: 'relative' }}>
        <div className="nav-brand"><GameOnLogo size={22} /></div>
        <div className="nav-right">
          <button className="btn btn-ghost" style={{ padding: '8px 16px', fontSize: '12px' }} onClick={() => { loadTemplates(); setView('games'); }}>← BACK</button>
        </div>
      </nav>
      <div className="container fade-in" style={{ maxWidth: '680px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '32px 0 24px' }}>
          <div>
            <h2 style={{ margin: '0 0 4px' }}>Manage Templates</h2>
            <p style={{ margin: 0, color: 'var(--muted)', fontSize: '14px' }}>Edit built-in templates visible to all admins</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => { setGenerateIsBuiltin(true); setShowGenerateModal(true); }}
              style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--accent)', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: "'Sora', sans-serif" }}
            >
              ✨ Generate with AI
            </button>
            <button className="btn btn-primary" onClick={() => setShowNewTemplateForm(true)} style={{ fontSize: '13px' }}>+ NEW TEMPLATE</button>
          </div>
        </div>

        {/* New template form */}
        {showNewTemplateForm && (
          <div style={{ background: 'var(--card)', border: '1px solid var(--accent)', borderRadius: '12px', padding: '20px', marginBottom: '16px' }}>
            <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '14px', color: 'var(--text)' }}>New built-in template</div>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
              <input
                value={newTemplateIcon}
                onChange={e => setNewTemplateIcon(e.target.value)}
                onFocus={e => e.target.select()}
                style={{ width: '44px', padding: '7px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: '20px', textAlign: 'center', fontFamily: "'Sora', sans-serif" }}
              />
              <input
                value={newTemplateName}
                onChange={e => setNewTemplateName(e.target.value)}
                placeholder="Template name"
                style={{ flex: 1, padding: '7px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: '13px', fontFamily: "'Sora', sans-serif" }}
              />
            </div>
            <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '8px' }}>
              Select missions ({newTemplateMissions.length} selected)
            </div>
            <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '14px' }}>
              {MISSIONS.map(m => {
                const on = newTemplateMissions.includes(m.id);
                return (
                  <button
                    key={m.id}
                    onClick={() => setNewTemplateMissions(prev => on ? prev.filter(id => id !== m.id) : [...prev, m.id])}
                    style={{ padding: '4px 8px', borderRadius: '6px', border: `1px solid ${on ? 'var(--accent)' : 'var(--border)'}`, background: on ? 'rgba(124,189,212,0.12)' : 'transparent', color: on ? 'var(--accent)' : 'var(--muted)', fontSize: '11px', cursor: 'pointer', fontFamily: "'Sora', sans-serif" }}
                  >
                    {m.icon} {m.name}
                  </button>
                );
              })}
            </div>
            {/* Description with AI suggest */}
            <div style={{ marginTop: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 700 }}>Description</span>
                <button
                  onClick={() => suggestTemplateDescription(newTemplateName, newTemplateMissions, setNewTemplateDesc, setNewTemplateDescLoading)}
                  disabled={newTemplateDescLoading || !newTemplateName.trim() || newTemplateMissions.length === 0}
                  style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--accent)', cursor: (newTemplateDescLoading || !newTemplateName.trim() || newTemplateMissions.length === 0) ? 'not-allowed' : 'pointer', fontFamily: "'Sora', sans-serif", opacity: (newTemplateDescLoading || !newTemplateName.trim() || newTemplateMissions.length === 0) ? 0.5 : 1 }}
                >
                  {newTemplateDescLoading ? '...' : '✨ Suggest'}
                </button>
              </div>
              <textarea
                value={newTemplateDesc}
                onChange={e => setNewTemplateDesc(e.target.value)}
                placeholder="What's this template about?"
                rows={3}
                style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: '13px', fontFamily: "'Sora', sans-serif", resize: 'vertical', boxSizing: 'border-box' }}
              />
            </div>

            {/* Seasonal date range */}
            <div style={{ marginTop: 10, marginBottom: 14 }}>
              <div style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 700, marginBottom: 6 }}>Show only between (optional)</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: '12px', color: 'var(--muted)' }}>From</span>
                <input
                  type="text"
                  value={newTemplateActiveFrom}
                  onChange={e => setNewTemplateActiveFrom(e.target.value)}
                  placeholder="MM-DD"
                  maxLength={5}
                  style={{ width: 70, padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: '13px', fontFamily: "'Sora', sans-serif" }}
                />
                <span style={{ fontSize: '12px', color: 'var(--muted)' }}>To</span>
                <input
                  type="text"
                  value={newTemplateActiveTo}
                  onChange={e => setNewTemplateActiveTo(e.target.value)}
                  placeholder="MM-DD"
                  maxLength={5}
                  style={{ width: 70, padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: '13px', fontFamily: "'Sora', sans-serif" }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => createBuiltinTemplate(newTemplateName, newTemplateIcon, newTemplateMissions, newTemplateDesc, newTemplateActiveFrom, newTemplateActiveTo)}
                disabled={manageTemplatesLoading || !newTemplateName.trim() || newTemplateMissions.length === 0}
                style={{ padding: '8px 20px', borderRadius: '8px', border: 'none', background: 'var(--accent)', color: '#0a0e19', fontWeight: 700, fontSize: '13px', cursor: manageTemplatesLoading || !newTemplateName.trim() || newTemplateMissions.length === 0 ? 'not-allowed' : 'pointer', opacity: manageTemplatesLoading || !newTemplateName.trim() || newTemplateMissions.length === 0 ? 0.6 : 1, fontFamily: "'Sora', sans-serif" }}
              >
                {manageTemplatesLoading ? 'Saving...' : 'CREATE'}
              </button>
              <button
                onClick={() => { setShowNewTemplateForm(false); setNewTemplateName(''); setNewTemplateIcon('🎮'); setNewTemplateMissions([]); setNewTemplateDesc(''); setNewTemplateActiveFrom(''); setNewTemplateActiveTo(''); }}
                style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted)', fontSize: '13px', cursor: 'pointer', fontFamily: "'Sora', sans-serif" }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Built-in template list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {templates.filter(t => t.isBuiltin).map(t => (
            <div key={t.id}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '16px 20px', background: 'var(--card)', border: `1px solid ${editingTemplateId === t.id ? 'var(--accent)' : 'var(--border)'}`, borderRadius: editingTemplateId === t.id ? '12px 12px 0 0' : '12px' }}>
                <span style={{ fontSize: '24px' }}>{t.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text)' }}>{t.name}</div>
                  <div style={{ fontSize: '12px', color: 'var(--muted)' }}>{t.missionIds.length} missions</div>
                  {t.activeFrom && t.activeTo && (
                    <div style={{ fontSize: '11px', color: 'var(--accent)', marginTop: 2 }}>
                      🗓 {t.activeFrom} – {t.activeTo}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    onClick={() => { setEditingTemplateId(t.id); setEditTemplateName(t.name); setEditTemplateIcon(t.icon); setEditTemplateMissions([...t.missionIds]); setEditTemplateDesc(t.description ?? ''); setEditTemplateActiveFrom(t.activeFrom ?? ''); setEditTemplateActiveTo(t.activeTo ?? ''); }}
                    style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted)', fontSize: '12px', cursor: 'pointer', fontFamily: "'Sora', sans-serif", fontWeight: 600 }}
                  >
                    ✏️ Edit
                  </button>
                  <button
                    onClick={() => { if (confirm(`Delete "${t.name}"?`)) deleteBuiltinTemplate(t.id); }}
                    style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'transparent', color: '#ef4444', fontSize: '14px', cursor: 'pointer' }}
                  >
                    🗑
                  </button>
                </div>
              </div>

              {/* Inline edit form */}
              {editingTemplateId === t.id && (
                <div style={{ background: 'var(--card)', border: '1px solid var(--accent)', borderTop: 'none', borderRadius: '0 0 12px 12px', padding: '16px 20px' }}>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                    <input
                      value={editTemplateIcon}
                      onChange={e => setEditTemplateIcon(e.target.value)}
                      onFocus={e => e.target.select()}
                      style={{ width: '44px', padding: '7px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: '20px', textAlign: 'center', fontFamily: "'Sora', sans-serif" }}
                    />
                    <input
                      value={editTemplateName}
                      onChange={e => setEditTemplateName(e.target.value)}
                      style={{ flex: 1, padding: '7px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: '13px', fontFamily: "'Sora', sans-serif" }}
                    />
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '8px' }}>Missions ({editTemplateMissions.length} selected)</div>
                  <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '14px' }}>
                    {MISSIONS.map(m => {
                      const on = editTemplateMissions.includes(m.id);
                      return (
                        <button
                          key={m.id}
                          onClick={() => setEditTemplateMissions(prev => on ? prev.filter(id => id !== m.id) : [...prev, m.id])}
                          style={{ padding: '4px 8px', borderRadius: '6px', border: `1px solid ${on ? 'var(--accent)' : 'var(--border)'}`, background: on ? 'rgba(124,189,212,0.12)' : 'transparent', color: on ? 'var(--accent)' : 'var(--muted)', fontSize: '11px', cursor: 'pointer', fontFamily: "'Sora', sans-serif" }}
                        >
                          {m.icon} {m.name}
                        </button>
                      );
                    })}
                  </div>
                  {/* Description with AI suggest */}
                  <div style={{ marginTop: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 700 }}>Description</span>
                      <button
                        onClick={() => suggestTemplateDescription(editTemplateName, editTemplateMissions, setEditTemplateDesc, setEditTemplateDescLoading)}
                        disabled={editTemplateDescLoading || !editTemplateName.trim() || editTemplateMissions.length === 0}
                        style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--accent)', cursor: (editTemplateDescLoading || !editTemplateName.trim() || editTemplateMissions.length === 0) ? 'not-allowed' : 'pointer', fontFamily: "'Sora', sans-serif", opacity: (editTemplateDescLoading || !editTemplateName.trim() || editTemplateMissions.length === 0) ? 0.5 : 1 }}
                      >
                        {editTemplateDescLoading ? '...' : '✨ Suggest'}
                      </button>
                    </div>
                    <textarea
                      value={editTemplateDesc}
                      onChange={e => setEditTemplateDesc(e.target.value)}
                      placeholder="What's this template about?"
                      rows={3}
                      style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: '13px', fontFamily: "'Sora', sans-serif", resize: 'vertical', boxSizing: 'border-box' }}
                    />
                  </div>

                  {/* Seasonal date range */}
                  <div style={{ marginTop: 10, marginBottom: 14 }}>
                    <div style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 700, marginBottom: 6 }}>Show only between (optional)</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: '12px', color: 'var(--muted)' }}>From</span>
                      <input
                        type="text"
                        value={editTemplateActiveFrom}
                        onChange={e => setEditTemplateActiveFrom(e.target.value)}
                        placeholder="MM-DD"
                        maxLength={5}
                        style={{ width: 70, padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: '13px', fontFamily: "'Sora', sans-serif" }}
                      />
                      <span style={{ fontSize: '12px', color: 'var(--muted)' }}>To</span>
                      <input
                        type="text"
                        value={editTemplateActiveTo}
                        onChange={e => setEditTemplateActiveTo(e.target.value)}
                        placeholder="MM-DD"
                        maxLength={5}
                        style={{ width: 70, padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: '13px', fontFamily: "'Sora', sans-serif" }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => updateBuiltinTemplate(t.id, editTemplateName, editTemplateIcon, editTemplateMissions, editTemplateDesc, editTemplateActiveFrom, editTemplateActiveTo)}
                      disabled={editTemplateLoading || !editTemplateName.trim() || editTemplateMissions.length === 0}
                      style={{ padding: '8px 20px', borderRadius: '8px', border: 'none', background: 'var(--accent)', color: '#0a0e19', fontWeight: 700, fontSize: '13px', cursor: editTemplateLoading || !editTemplateName.trim() || editTemplateMissions.length === 0 ? 'not-allowed' : 'pointer', opacity: editTemplateLoading || !editTemplateName.trim() || editTemplateMissions.length === 0 ? 0.6 : 1, fontFamily: "'Sora', sans-serif" }}
                    >
                      {editTemplateLoading ? 'Saving...' : 'SAVE'}
                    </button>
                    <button
                      onClick={() => { setEditingTemplateId(null); setEditTemplateDescLoading(false); }}
                      style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted)', fontSize: '13px', cursor: 'pointer', fontFamily: "'Sora', sans-serif" }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </>
  );

  if (view === 'templates') return (
    <>
      {showGenerateModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: 24, width: '100%', maxWidth: 520, fontFamily: "'Sora', sans-serif" }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--text)' }}>✨ Generate with AI</div>
              <button onClick={() => { setShowGenerateModal(false); setGeneratePreview(null); setGeneratePrompt(''); }} style={{ background: 'transparent', border: 'none', color: 'var(--muted)', fontSize: 20, cursor: 'pointer' }}>✕</button>
            </div>

            {!generatePreview ? (
              <>
                <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12 }}>Describe your event — theme, duration, number of teams, vibe...</p>
                <textarea
                  value={generatePrompt}
                  onChange={e => setGeneratePrompt(e.target.value)}
                  placeholder="e.g. Halloween scavenger hunt for 8 teams, spooky and competitive, around 45 minutes"
                  rows={4}
                  style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13, fontFamily: "'Sora', sans-serif", resize: 'vertical', boxSizing: 'border-box' }}
                />
                <button
                  onClick={generateTemplate}
                  disabled={generateLoading || !generatePrompt.trim()}
                  style={{ marginTop: 12, width: '100%', padding: '10px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#0a0e19', fontWeight: 800, fontSize: 14, cursor: generateLoading || !generatePrompt.trim() ? 'not-allowed' : 'pointer', opacity: (generateLoading || !generatePrompt.trim()) ? 0.5 : 1, fontFamily: "'Sora', sans-serif" }}
                >
                  {generateLoading ? 'Generating...' : 'Generate →'}
                </button>
              </>
            ) : (
              <>
                <div style={{ background: 'var(--bg)', borderRadius: 10, padding: 16, marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <span style={{ fontSize: 24 }}>{generatePreview.icon}</span>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--text)' }}>{generatePreview.name}</div>
                      {generatePreview.activeFrom && generatePreview.activeTo && (
                        <div style={{ fontSize: 11, color: 'var(--accent)', marginTop: 2 }}>🗓 {generatePreview.activeFrom} – {generatePreview.activeTo}</div>
                      )}
                    </div>
                  </div>
                  <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 12px' }}>{generatePreview.description}</p>

                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>
                    Missions ({generatePreview.selectedMissionIds.length + generatePreview.newMissions.length} total)
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 200, overflowY: 'auto' }}>
                    {generatePreview.newMissions.map((m, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text)' }}>
                        <span style={{ fontSize: 10, fontWeight: 800, background: 'rgba(117,171,200,0.15)', color: 'var(--accent)', borderRadius: 4, padding: '1px 5px', flexShrink: 0 }}>NEW</span>
                        {m.title}
                      </div>
                    ))}
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>+ {generatePreview.selectedMissionIds.length} existing missions</div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    onClick={() => setGeneratePreview(null)}
                    style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: "'Sora', sans-serif" }}
                  >
                    ← Back
                  </button>
                  <button
                    onClick={saveGeneratedTemplate}
                    disabled={generateSaving}
                    style={{ flex: 2, padding: '10px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#0a0e19', fontWeight: 800, fontSize: 13, cursor: generateSaving ? 'not-allowed' : 'pointer', fontFamily: "'Sora', sans-serif" }}
                  >
                    {generateSaving ? 'Saving...' : 'Save template'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      <nav className="nav" style={{ position: 'relative' }}>
        <div className="nav-brand"><GameOnLogo size={22} /></div>
        <div className="nav-right">
          <button className="btn btn-ghost" style={{ padding: '8px 16px', fontSize: '12px' }} onClick={() => setView('games')}>← BACK</button>
        </div>
      </nav>
      <div className="container fade-in" style={{ maxWidth: '680px' }}>
        <div style={{ padding: '32px 0 24px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ margin: '0 0 4px' }}>Choose a starting point</h2>
            <p style={{ margin: 0, color: 'var(--muted)', fontSize: '14px' }}>Pick a template or start from scratch</p>
          </div>
          <button
            onClick={() => { setGenerateIsBuiltin(false); setShowGenerateModal(true); }}
            style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--accent)', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: "'Sora', sans-serif", flexShrink: 0, marginTop: 4 }}
          >
            ✨ Generate with AI
          </button>
        </div>

        {templatesLoading ? (
          <div style={{ color: 'var(--muted)', fontSize: '14px', padding: '40px 0', textAlign: 'center' }}>Loading templates...</div>
        ) : (
          <>
            {/* Built-in templates */}
            <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '1px', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '12px' }}>Built-in templates</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '28px' }}>
              {templates.filter(t => t.isBuiltin).map(t => (
                <button
                  key={t.id}
                  onClick={() => { setSelectedMissions(t.missionIds); setAiPhotoRating(false); setAiPhotoInstructions(''); loadAdminCustomMissions(); setView('create'); }}
                  style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '16px 20px', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', cursor: 'pointer', textAlign: 'left', width: '100%', transition: 'border-color 0.2s' }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
                >
                  <span style={{ fontSize: '28px', flexShrink: 0 }}>{t.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text)' }}>{t.name}</div>
                    <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>{t.missionIds.length} missions{t.description ? ` · ${t.description}` : ''}</div>
                  </div>
                  <span style={{ color: 'var(--muted)', fontSize: '18px' }}>→</span>
                </button>
              ))}
            </div>

            {/* My templates */}
            <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '1px', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '12px' }}>My templates</div>
            {templates.filter(t => !t.isBuiltin).length === 0 ? (
              <div style={{ background: 'var(--card)', border: '1px dashed var(--border)', borderRadius: '12px', padding: '24px', textAlign: 'center', color: 'var(--muted)', fontSize: '13px', marginBottom: '24px' }}>
                No saved templates yet — save a game as a template from the games list
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
                {templates.filter(t => !t.isBuiltin).map(t => (
                  <div
                    key={t.id}
                    style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '16px 20px', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px' }}
                  >
                    <button
                      onClick={() => { setSelectedMissions(t.missionIds); setAiPhotoRating(false); setAiPhotoInstructions(''); loadAdminCustomMissions(); setView('create'); }}
                      style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0 }}
                    >
                      <span style={{ fontSize: '24px', flexShrink: 0 }}>{t.icon}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text)' }}>{t.name}</div>
                        <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>{t.missionIds.length} missions</div>
                      </div>
                      <span style={{ color: 'var(--muted)', fontSize: '18px' }}>→</span>
                    </button>
                    <button
                      onClick={async () => {
                        const session = (await supabase.auth.getSession()).data.session;
                        await fetch(`/api/admin/templates/${t.id}`, {
                          method: 'DELETE',
                          headers: { Authorization: `Bearer ${session?.access_token}` },
                        });
                        setTemplates(prev => prev.filter(x => x.id !== t.id));
                      }}
                      title="Delete template"
                      style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted)', cursor: 'pointer', fontSize: '16px', lineHeight: 1, flexShrink: 0 }}
                    >
                      🗑
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Blank game */}
            <button
              onClick={() => { setSelectedMissions(MISSIONS.map(m => m.id)); setAiPhotoRating(false); setAiPhotoInstructions(''); loadAdminCustomMissions(); setView('create'); }}
              style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '16px 20px', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', cursor: 'pointer', textAlign: 'left', width: '100%', transition: 'border-color 0.2s' }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
            >
              <span style={{ fontSize: '28px', flexShrink: 0 }}>✏️</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text)' }}>Blank game</div>
                <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>Choose missions manually</div>
              </div>
              <span style={{ color: 'var(--muted)', fontSize: '18px' }}>→</span>
            </button>
          </>
        )}
      </div>
    </>
  );

  // ── CREATE GAME ──
  if (view === 'create') return (
    <>
      <nav className="nav" style={{ position: 'relative' }}>
        <div className="nav-brand"><GameOnLogo size={22} /></div>
        <NavCenter game={null} />
        <div className="nav-right">
          <button className="btn btn-ghost" style={{ padding: '8px 16px', fontSize: '12px' }} onClick={() => { loadGames(); setView('games'); }}>← BACK</button>
        </div>
      </nav>
      <div className="container fade-in" style={{ maxWidth: '720px' }}>
        <div style={{ padding: '32px 0 24px' }}>
          <h2>Create a New Game</h2>
          <p style={{ color: 'var(--muted)', marginTop: '6px', fontSize: '14px' }}>Configure the game and share the key with your teams.</p>
        </div>

        <div className="card" style={{ marginBottom: '24px' }}>
          <div className="form-group">
            <label className="form-label">Game Name (optional)</label>
            <input type="text" placeholder="E.g. Offsite 2026" value={gameName} onChange={e => setGameName(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Duration: {duration} minutes</label>
            <input type="range" min={15} max={120} step={5} value={duration} onChange={e => setDuration(Number(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--accent)' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--muted)', marginTop: '4px' }}>
              <span>15 min</span><span>120 min</span>
            </div>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <div
              onClick={() => setHideLeaderboard(v => !v)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', padding: '12px 14px', background: 'var(--surface)', border: `1px solid ${hideLeaderboard ? 'var(--accent)' : 'var(--border)'}`, borderRadius: '10px' }}
            >
              <div>
                <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text)' }}>🙈 Hide leaderboard in last 5 min</div>
                <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '3px' }}>
                  Teams won&apos;t see the leaderboard in the last 5 minutes, and won&apos;t see final placements when the game ends.
                </div>
              </div>
              <div style={{ width: '36px', height: '20px', borderRadius: '10px', background: hideLeaderboard ? 'var(--accent)' : 'var(--border)', position: 'relative', flexShrink: 0, marginLeft: '12px' }}>
                <div style={{ position: 'absolute', top: '2px', left: hideLeaderboard ? '18px' : '2px', width: '16px', height: '16px', borderRadius: '50%', background: '#fff', transition: 'left 0.15s' }} />
              </div>
            </div>
          </div>
          <div className="form-group" style={{ marginBottom: 0, marginTop: '10px' }}>
            <div
              onClick={() => setAiPhotoRating(v => !v)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', padding: '12px 14px', background: 'var(--surface)', border: `1px solid ${aiPhotoRating ? 'var(--accent)' : 'var(--border)'}`, borderRadius: aiPhotoRating ? '10px 10px 0 0' : '10px' }}
            >
              <div>
                <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text)' }}>✨ AI photo rating</div>
                <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '3px' }}>
                  Photos rated automatically by AI — you can override anytime
                </div>
              </div>
              <div style={{ width: '36px', height: '20px', borderRadius: '10px', background: aiPhotoRating ? 'var(--accent)' : 'var(--border)', position: 'relative', flexShrink: 0, marginLeft: '12px' }}>
                <div style={{ position: 'absolute', top: '2px', left: aiPhotoRating ? '18px' : '2px', width: '16px', height: '16px', borderRadius: '50%', background: '#fff', transition: 'left 0.15s' }} />
              </div>
            </div>
            {aiPhotoRating && (
              <div style={{ padding: '12px 14px', background: 'var(--surface)', border: `1px solid var(--accent)`, borderTop: 'none', borderRadius: '0 0 10px 10px' }} onClick={e => e.stopPropagation()}>
                <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '6px', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.5px' }}>
                  Scoring focus <span style={{ fontWeight: 400, textTransform: 'none' as const, letterSpacing: 0 }}>(optional)</span>
                </div>
                <input
                  type="text"
                  value={aiPhotoInstructions}
                  onChange={e => setAiPhotoInstructions(e.target.value)}
                  placeholder="e.g. Reward creativity and humor extra highly"
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '7px', border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--text)', fontSize: '12px', fontFamily: "'Sora', sans-serif", boxSizing: 'border-box' as const }}
                />
                <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '5px' }}>
                  Passed to the AI as extra context when rating photos
                </div>
              </div>
            )}
          </div>
          <div className="form-group" style={{ marginBottom: 0, marginTop: '10px' }}>
            <div style={{ padding: '12px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px' }}>
              <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text)', marginBottom: '8px' }}>
                🌐 Game language
              </div>
              <select
                value={gameLanguage}
                onChange={e => setGameLanguage(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: '7px',
                  border: '1px solid var(--border)',
                  background: 'var(--card)',
                  color: 'var(--text)',
                  fontSize: '13px',
                  fontFamily: "'Sora', sans-serif",
                  cursor: 'pointer',
                }}
              >
                <option value="en">🇬🇧 English</option>
                <option value="sv">🇸🇪 Svenska</option>
                <option value="no">🇳🇴 Norsk</option>
                <option value="da">🇩🇰 Dansk</option>
                <option value="de">🇩🇪 Deutsch</option>
                <option value="fr">🇫🇷 Français</option>
              </select>
              <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '6px' }}>
                Players see the game UI in this language. They can override it for themselves.
              </div>
            </div>
          </div>
          <div className="form-group" style={{ marginBottom: 0, marginTop: '10px' }}>
            <div
              onClick={() => setRemoteMode(v => !v)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', padding: '12px 14px', background: 'var(--surface)', border: `1px solid ${remoteMode ? 'var(--accent)' : 'var(--border)'}`, borderRadius: '10px' }}
            >
              <div>
                <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text)' }}>🌍 Remote / Distributed mode</div>
                <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '3px' }}>
                  Each team member joins on their own device.
                </div>
              </div>
              <div style={{ width: '36px', height: '20px', borderRadius: '10px', background: remoteMode ? 'var(--accent)' : 'var(--border)', position: 'relative', flexShrink: 0, marginLeft: '12px' }}>
                <div style={{ position: 'absolute', top: '2px', left: remoteMode ? '18px' : '2px', width: '16px', height: '16px', borderRadius: '50%', background: '#fff', transition: 'left 0.15s' }} />
              </div>
            </div>
          </div>
        </div>

        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <label className="form-label" style={{ margin: 0 }}>Select Missions ({selectedMissions.length} selected)</label>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--muted)', cursor: 'pointer', userSelect: 'none' }}>
                <input
                  type="checkbox"
                  checked={hidePlayedMissions}
                  onChange={e => setHidePlayedMissions(e.target.checked)}
                  style={{ margin: 0 }}
                />
                Hide already played{playedMissionIds.length > 0 ? ` (${playedMissionIds.length})` : ''}
              </label>
              <button className="btn btn-ghost" style={{ padding: '6px 12px', fontSize: '11px' }} onClick={() => setSelectedMissions([...MISSIONS.map(m => m.id), ...adminCustomMissions.map(m => m.id)])}>All on</button>
              <button className="btn btn-ghost" style={{ padding: '6px 12px', fontSize: '11px' }} onClick={() => setSelectedMissions([])}>All off</button>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {(Object.keys(SUPER_CATEGORIES) as SuperCategoryKey[]).map(catKey => {
              if (catKey === 'gkn' && !isSuperAdmin) return null;
              const cat = SUPER_CATEGORIES[catKey];
              const playedSet = new Set(playedMissionIds);
              const catMissions = MISSIONS
                .filter(m => MISSION_SUPER_CATEGORY[m.id] === catKey)
                .filter(m => !hidePlayedMissions || !playedSet.has(m.id));
              if (catMissions.length === 0) return null;
              const allOn = catMissions.every(m => selectedMissions.includes(m.id));
              return (
                <div key={catKey}>
                  {/* Category header */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '1.5px', color: cat.color }}>
                      {cat.icon} {cat.label.toUpperCase()}
                    </span>
                    <button
                      onClick={() => {
                        const ids = catMissions.map(m => m.id);
                        setSelectedMissions(prev => allOn
                          ? prev.filter(x => !ids.includes(x))
                          : [...new Set([...prev, ...ids])]);
                      }}
                      style={{ fontSize: '11px', color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'Sora', sans-serif" }}
                    >
                      {allOn ? 'Deselect all' : 'Select all'}
                    </button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {catMissions.map(m => {
                      const on = selectedMissions.includes(m.id);
                      const pts = missionMaxPts[m.id] ?? m.maxPts;
                      const isCustom = pts !== m.maxPts;
                      return (
                        <div key={m.id} style={{ background: 'var(--card)', border: `1px solid ${on ? cat.color : 'var(--border)'}`, borderRadius: '8px', opacity: on ? 1 : 0.45, overflow: 'hidden' }}>
                          <div onClick={() => setSelectedMissions(prev => on ? prev.filter(x => x !== m.id) : [...prev, m.id])}
                            style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '10px 14px', cursor: 'pointer' }}>
                            <span style={{ fontSize: '18px' }}>{m.icon}</span>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontWeight: 700, fontSize: '13px' }}>{m.name}</div>
                              <div style={{ fontSize: '11px', color: 'var(--muted)' }}>{m.difficulty} · {m.maxPts} pts</div>
                            </div>
                            <div style={{ width: '36px', height: '20px', borderRadius: '10px', background: on ? cat.color : 'var(--border)', position: 'relative', flexShrink: 0 }}>
                              <div style={{ position: 'absolute', top: '2px', left: on ? '18px' : '2px', width: '16px', height: '16px', borderRadius: '50%', background: '#fff', transition: 'left 0.15s' }} />
                            </div>
                          </div>
                          {on && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 14px 10px', borderTop: '1px solid var(--border)' }}
                              onClick={e => e.stopPropagation()}>
                              <span style={{ fontSize: '11px', color: 'var(--muted)', letterSpacing: '1px', flexShrink: 0 }}>MAX PTS</span>
                              <input
                                type="number" min={0} max={9999} step={50} value={pts}
                                onChange={e => setMissionMaxPts(prev => ({ ...prev, [m.id]: Math.max(0, Number(e.target.value)) }))}
                                style={{ width: '90px', padding: '4px 8px', fontSize: '13px', fontWeight: 700, fontFamily: "'Sora', sans-serif", background: 'var(--surface)', border: `1px solid ${isCustom ? cat.color : 'var(--border)'}`, borderRadius: '6px', color: isCustom ? cat.color : 'var(--text)' }}
                              />
                              {isCustom
                                ? <button onClick={() => setMissionMaxPts(prev => ({ ...prev, [m.id]: m.maxPts }))} style={{ fontSize: '11px', color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px', fontFamily: "'Sora', sans-serif" }}>reset</button>
                                : <span style={{ fontSize: '11px', color: 'var(--muted)' }}>default</span>
                              }
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            {/* ── Custom missions — grouped by category ── */}
            {adminCustomMissions.length > 0 && (() => {
              const playedSet = new Set(playedMissionIds);
              const visibleCustom = hidePlayedMissions
                ? adminCustomMissions.filter(m => !playedSet.has(m.id))
                : adminCustomMissions;
              if (visibleCustom.length === 0) return null;
              const buckets = new Map<string | null, typeof visibleCustom>();
              for (const m of visibleCustom) {
                const key = m.category_id ?? null;
                if (!buckets.has(key)) buckets.set(key, []);
                buckets.get(key)!.push(m);
              }
              const groups: { cat: AdminCategory | null; missions: typeof adminCustomMissions }[] = [];
              for (const cat of adminCategories) {
                if (buckets.has(cat.id)) groups.push({ cat, missions: buckets.get(cat.id)! });
              }
              if (buckets.has(null)) groups.push({ cat: null, missions: buckets.get(null)! });

              return (
                <>
                  {groups.map(({ cat, missions }) => {
                    const label = cat ? `${cat.emoji} ${cat.name.toUpperCase()}` : '📋 ÖVRIGT';
                    const groupIds = missions.map(m => m.id);
                    const allOn = groupIds.every(id => selectedMissions.includes(id));
                    return (
                      <div key={cat?.id ?? '__uncategorized'} style={{ marginBottom: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                          <span style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '1.5px', color: '#9b59b6' }}>
                            {label}
                          </span>
                          <button
                            onClick={() => {
                              setSelectedMissions(prev => allOn
                                ? prev.filter(x => !groupIds.includes(x))
                                : [...new Set([...prev, ...groupIds])]);
                            }}
                            style={{ fontSize: '11px', color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'Sora', sans-serif" }}
                          >
                            {allOn ? 'Deselect all' : 'Select all'}
                          </button>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {missions.map(m => {
                            const on = selectedMissions.includes(m.id);
                            return (
                              <div key={m.id} style={{ background: 'var(--card)', border: `1px solid ${on ? '#9b59b6' : 'var(--border)'}`, borderRadius: '8px', opacity: on ? 1 : 0.45 }}>
                                <div
                                  onClick={() => {
                                    setSelectedMissions(prev => on ? prev.filter(x => x !== m.id) : [...prev, m.id]);
                                    if (!missionMaxPts[m.id]) setMissionMaxPts(prev => ({ ...prev, [m.id]: m.max_pts }));
                                  }}
                                  style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '10px 14px', cursor: 'pointer' }}
                                >
                                  <span style={{ fontSize: '18px' }}>{m.icon}</span>
                                  <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 700, fontSize: '13px' }}>{m.name}</div>
                                    <div style={{ fontSize: '11px', color: 'var(--muted)' }}>{m.difficulty} · {m.max_pts} pts</div>
                                  </div>
                                  <div style={{ width: '36px', height: '20px', borderRadius: '10px', background: on ? '#9b59b6' : 'var(--border)', position: 'relative', flexShrink: 0 }}>
                                    <div style={{ position: 'absolute', top: '2px', left: on ? '18px' : '2px', width: '16px', height: '16px', borderRadius: '50%', background: '#fff', transition: 'left 0.15s' }} />
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </>
              );
            })()}
          </div>
        </div>

        {createError && <p style={{ color: 'var(--accent2)', fontSize: '13px', marginBottom: '12px' }}>{createError}</p>}
        <button className="btn btn-primary btn-full" onClick={createGame} disabled={creating}>
          {creating ? 'CREATING...' : '🎮 CREATE GAME →'}
        </button>
      </div>
    </>
  );

  // ── GAME DASHBOARD ──
  if (!activeGame) return null;
  const pendingPhotos = photos.filter(s => s.status === 'pending' && !rated.has(s.id));
  const pendingScavenger = scavengerSubs.filter(s => s.status === 'pending' && !scavengerRated.has(s.id));
  const totalPendingPhotos = pendingPhotos.length + pendingScavenger.length;

  return (
    <>
      <nav className="nav" style={{ position: 'relative' }}>
        <div className="nav-brand"><GameOnLogo size={22} /></div>
        <NavCenter game={activeGame} />
        <div className="nav-right">
          <ProfileMenu />
        </div>
      </nav>

      <div className="container fade-in" style={{ paddingBottom: isMobile ? '80px' : undefined }}>
        {!isMobile && (
          <button
            onClick={() => { loadGames(); setTeams([]); setPhotos([]); setView('games'); }}
            style={{ background: 'none', border: 'none', padding: '4px 0', marginTop: '16px', fontSize: '13px', color: 'var(--muted)', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', opacity: 0.7 }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '0.7')}
          >
            ← Games
          </button>
        )}
        {/* GAME KEY + QR + START */}
        <div style={{ padding: isMobile ? '16px 0 16px' : '28px 0 24px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: isMobile ? '14px' : '24px', alignItems: 'flex-start' }}>
            {/* QR code — click to expand */}
            <div
              onClick={() => setQrExpanded(true)}
              title="Click to enlarge"
              style={{ background: '#fff', borderRadius: '10px', padding: isMobile ? '7px' : '10px', flexShrink: 0, cursor: 'zoom-in', position: 'relative' }}
            >
              <QRCodeSVG
                value={`${typeof window !== 'undefined' ? window.location.origin : ''}/play?key=${activeGame.game_key}`}
                size={isMobile ? 72 : 100}
                bgColor="#ffffff"
                fgColor="#0f1724"
                level="M"
              />
              <div style={{ position: 'absolute', bottom: '4px', right: '6px', fontSize: '10px', color: '#aaa' }}>🔍</div>
            </div>

            {/* QR expanded modal */}
            {qrExpanded && (
              <div
                onClick={() => setQrExpanded(false)}
                style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.85)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '20px', padding: '32px' }}
              >
                <div style={{ background: '#fff', borderRadius: '20px', padding: '24px' }}>
                  <QRCodeSVG
                    value={`${typeof window !== 'undefined' ? window.location.origin : ''}/play?key=${activeGame.game_key}`}
                    size={280}
                    bgColor="#ffffff"
                    fgColor="#0f1724"
                    level="M"
                  />
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontFamily: "'Sora', sans-serif", fontSize: '36px', fontWeight: 700, color: '#fff', letterSpacing: '8px', marginBottom: '8px' }}>
                    {activeGame.game_key}
                  </div>
                  <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)' }}>Tap anywhere to close</p>
                </div>
              </div>
            )}
            {/* Photo fullscreen modal */}
            {photoModal && (
              <div
                onClick={() => setPhotoModal(null)}
                style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.92)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', padding: '24px' }}
              >
                <img
                  src={photoModal.url}
                  alt={photoModal.label}
                  style={{ maxWidth: '100%', maxHeight: '80vh', borderRadius: '12px', objectFit: 'contain', boxShadow: '0 8px 48px rgba(0,0,0,0.6)' }}
                  onClick={e => e.stopPropagation()}
                />
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontWeight: 700, fontSize: '15px', color: '#fff' }}>{photoModal.label}</div>
                  <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginTop: '6px' }}>Tap anywhere to close</p>
                </div>
              </div>
            )}

            {/* Key + status */}
            <div>
              <p style={{ fontSize: '12px', color: 'var(--muted)', letterSpacing: '2px', marginBottom: '6px' }}>GAME KEY — share with teams</p>
              <div className="mobile-game-key" style={{ fontFamily: "'Sora', sans-serif", fontSize: '48px', fontWeight: 700, color: 'var(--accent)', letterSpacing: '8px', lineHeight: 1 }}>
                {activeGame.game_key}
              </div>
              <p style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '8px' }}>
                {activeGame.missions.length} missions · {activeGame.duration_minutes} min ·{' '}
                <span className={`status-pill ${activeGame.status === 'active' ? 'active' : activeGame.status === 'finished' ? 'finished' : 'draft'}`} style={{ verticalAlign: 'middle' }}>
                  <span className="status-pill-dot" />
                  {activeGame.status === 'active' ? 'Running' : activeGame.status === 'finished' ? 'Finished' : 'Draft'}
                </span>
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: isMobile ? 'flex-start' : 'flex-end', alignItems: 'center' }}>
            {(activeGame.status === 'active' || activeGame.status === 'finished') && (
              <button
                className="btn btn-ghost"
                onClick={() => window.open(`/present/${activeGame.game_key}`, '_blank', 'noopener,noreferrer')}
                style={{ fontSize: '13px', padding: isMobile ? '10px 14px' : '12px 20px', border: '1px solid rgba(124,189,212,0.3)', color: '#7CBDD4' }}
                title="Open presenter view (for projector or TV)"
              >
                📺{isMobile ? '' : ' Presenter'}
              </button>
            )}
            {activeGame.status === 'draft' && (
              <button className="btn btn-primary" onClick={() => startOrStop('start')} style={{ fontSize: isMobile ? '14px' : '15px', padding: isMobile ? '12px 22px' : '14px 28px' }}>
                ▶ START GAME
              </button>
            )}
            {activeGame.status === 'active' && (
              <button className="btn btn-danger" onClick={() => startOrStop('finish')} style={{ fontSize: '13px', padding: isMobile ? '10px 14px' : '12px 20px' }}>
                ⏹{isMobile ? ' END' : ' END GAME'}
              </button>
            )}
            {(activeGame.status === 'finished' || activeGame.status === 'active') && (
              <button className="btn btn-ghost" onClick={() => startOrStop('restart')}
                style={{ fontSize: '13px', padding: isMobile ? '10px 14px' : '12px 20px', border: '1px solid var(--border)' }}
                title="Reset game to Draft so you can start it again">
                ↺{isMobile ? '' : ' RESTART'}
              </button>
            )}
            {activeGame.status === 'finished' && (
              <>
                {plan === 'free' ? (
                  <button
                    className="btn btn-ghost"
                    onClick={() => handleUpgrade('pro')}
                    disabled={upgradeLoading}
                    title="Upgrade to Pro to download PDF reports"
                    style={{ fontSize: '13px', padding: isMobile ? '10px 14px' : '12px 20px', border: '1px solid rgba(124,189,212,0.3)', color: '#7CBDD4' }}
                  >
                    🔒{isMobile ? ' Report' : ' Download Report (Pro)'}
                  </button>
                ) : (
                  <button
                    className="btn btn-ghost"
                    disabled={reportLoading}
                    onClick={downloadReport}
                    style={{ fontSize: '13px', padding: isMobile ? '10px 14px' : '12px 20px', border: '1px solid var(--border)' }}
                  >
                    {reportLoading ? '⏳' : '📄'}{isMobile ? (reportLoading ? '' : ' Report') : (reportLoading ? ' Generating…' : ' Download Report')}
                  </button>
                )}
                {reportError && (
                  <p style={{ color: 'var(--danger, #e74c3c)', fontSize: '12px', margin: '4px 0 0' }}>
                    {reportError}
                  </p>
                )}
              </>
            )}
          </div>
        </div>

        {/* TABS */}
        <div className="admin-tabs">
          <button className={`admin-tab${tab === 'leaderboard' ? ' active' : ''}`} onClick={() => setTab('leaderboard')}>🏆 Scores</button>
          <button className={`admin-tab${tab === 'progress' ? ' active' : ''}`} onClick={() => setTab('progress')}>📊 Progress</button>
          <button className={`admin-tab${tab === 'photos' ? ' active' : ''}`} onClick={() => setTab('photos')} style={{ position: 'relative' }}>
            📸 Photos
            {totalPendingPhotos > 0 && (
              <span style={{ position: 'absolute', top: '-4px', right: '-4px', background: 'var(--accent2)', color: '#fff', borderRadius: '50%', width: '18px', height: '18px', fontSize: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
                {totalPendingPhotos}
              </span>
            )}
          </button>
          <button className={`admin-tab${tab === 'stats' ? ' active' : ''}`} onClick={() => setTab('stats')}>📈 Stats</button>
          {activeGame.status === 'active' && (
            <button className={`admin-tab${tab === 'powerups' ? ' active' : ''}`} onClick={() => setTab('powerups')}>⚡ Power-ups{plan === 'free' ? ' 🔒' : ''}</button>
          )}
        </div>

        {/* LEADERBOARD */}
        {tab === 'leaderboard' && (
          <div className="fade-in">
            <div className="section-header">
              <h2 style={{ fontSize: '18px' }}>Leaderboard</h2>
              <span className="badge">{teams.length} teams</span>
            </div>
            <div className="leaderboard">
              {sorted.length === 0 ? <div className="empty-state">No teams yet.</div> : sorted.map((t, i) => {
                const finishElapsed = t.finished_at && activeGame.started_at
                  ? fmtElapsed(new Date(t.finished_at).getTime() - new Date(activeGame.started_at).getTime())
                  : null;
                const isExpanded = expandedTeamId === t.id;
                const teamMembers = activeGame.remote_mode ? (t.members ?? []) : [];
                const hasMembers = activeGame.remote_mode && teamMembers.length > 0;
                const showPanel = isExpanded && hasMembers;
                return (
                  <div key={t.id} style={{ marginBottom: '4px' }}>
                    <div
                      className="lb-row"
                      style={{ cursor: activeGame.remote_mode ? 'pointer' : 'default', borderRadius: showPanel ? '10px 10px 0 0' : '10px' }}
                      onClick={() => activeGame.remote_mode && setExpandedTeamId(isExpanded ? null : t.id)}
                    >
                      <div className="lb-rank" style={{ color: RANK_COLORS[i] ?? 'var(--muted)' }}>{RANK_ICONS[i] ?? i + 1}</div>
                      <div className="lb-name">{t.name}</div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px', marginLeft: 'auto' }}>
                        <div className="lb-score">{t.score} p</div>
                        {finishElapsed ? (
                          <div style={{ fontSize: '11px', color: 'var(--accent3)', letterSpacing: '0.5px' }}>🏁 {finishElapsed}</div>
                        ) : (
                          <div style={{ fontSize: '11px', color: 'var(--muted)' }}>{t.completed?.length ?? 0}/{activeGame.missions.length} done</div>
                        )}
                      </div>
                      {activeGame.remote_mode && (
                        <div style={{ marginLeft: '10px', color: 'var(--muted)', fontSize: '12px', transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>▾</div>
                      )}
                    </div>
                    {showPanel && (
                      <div style={{
                        background: 'var(--surface)',
                        border: '1px solid var(--border)',
                        borderTop: 'none',
                        borderRadius: '0 0 10px 10px',
                        padding: '10px 14px',
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '8px',
                      }}>
                        {teamMembers.map(m => (
                          <div key={m.id} style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px',
                            fontSize: '12px',
                            color: m.online ? 'var(--text)' : 'var(--muted)',
                          }}>
                            <span style={{ fontSize: '8px', color: m.online ? 'var(--accent3)' : 'var(--muted)' }}>●</span>
                            {m.name}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* PROGRESS */}
        {tab === 'progress' && (() => {
          // Group active missions by super-category (built-in missions only)
          const catGroups = (Object.keys(SUPER_CATEGORIES) as SuperCategoryKey[]).map(catKey => ({
            catKey,
            cat: SUPER_CATEGORIES[catKey],
            missions: activeGame.missions
              .map(id => MISSIONS.find(x => x.id === id))
              .filter((m): m is NonNullable<typeof m> => !!m && MISSION_SUPER_CATEGORY[m.id] === catKey),
          })).filter(g => g.missions.length > 0);

          // Group custom missions in this game by their admin category
          const customInGame = adminCustomMissions.filter(cm =>
            activeGame.missions.includes(cm.id)
          );
          const customByCatId = new Map<string | null, typeof customInGame>();
          for (const cm of customInGame) {
            const key = cm.category_id ?? null;
            if (!customByCatId.has(key)) customByCatId.set(key, []);
            customByCatId.get(key)!.push(cm);
          }
          const customGroups: { cat: AdminCategory | null; missions: typeof customInGame }[] = [];
          for (const cat of [...adminCategories].sort((a, b) => a.sort_order - b.sort_order)) {
            const missions = customByCatId.get(cat.id) ?? [];
            if (missions.length > 0) customGroups.push({ cat, missions });
          }
          const uncategorized = customByCatId.get(null) ?? [];
          if (uncategorized.length > 0) customGroups.push({ cat: null, missions: uncategorized });

          return (
            <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Built-in mission groups */}
              {catGroups.map(({ catKey, cat, missions }) => (
                <div key={catKey}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                    <span style={{ fontSize: '16px' }}>{cat.icon}</span>
                    <span style={{ fontWeight: 800, fontSize: '13px', color: cat.color, textTransform: 'uppercase', letterSpacing: '0.8px' }}>{cat.label}</span>
                    <span style={{ fontSize: '11px', color: 'var(--muted)', marginLeft: '4px' }}>{missions.length} mission{missions.length !== 1 ? 's' : ''}</span>
                  </div>
                  <MissionProgressTable missions={missions} sorted={sorted} accentColor={cat.color} />
                </div>
              ))}

              {/* Custom mission groups */}
              {customGroups.map(({ cat, missions }) => {
                const label = cat ? cat.name : 'Övriga';
                const emoji = cat ? cat.emoji : '📋';
                return (
                  <div key={cat ? cat.id : '__uncategorized__'}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                      <span style={{ fontSize: '16px' }}>{emoji}</span>
                      <span style={{ fontWeight: 800, fontSize: '13px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>{label}</span>
                      <span style={{ fontSize: '11px', color: 'var(--muted)', marginLeft: '4px' }}>{missions.length} mission{missions.length !== 1 ? 's' : ''}</span>
                    </div>
                    <MissionProgressTable missions={missions} sorted={sorted} accentColor="var(--muted)" />
                  </div>
                );
              })}

              {/* Total score summary */}
              {sorted.length > 0 && (
                <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden' }}>
                  <div style={{ padding: '10px 14px', background: 'var(--surface)', borderBottom: '1px solid var(--border)', fontWeight: 800, fontSize: '12px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                    Total Score
                  </div>
                  <table className="progress-table">
                    <tbody>
                      {sorted.map(t => (
                        <tr key={t.id}>
                          <td><strong>{t.name}</strong></td>
                          <td className="pts-cell" style={{ textAlign: 'right' }}>{t.score} p</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })()}

        {/* PHOTOS */}
        {tab === 'photos' && (
          <div className="fade-in">
            <div className="section-header">
              <div>
                <h2 style={{ fontSize: '18px', margin: 0 }}>Photo Submissions</h2>
                <span className="badge" style={{ marginTop: '4px' }}>{pendingPhotos.length} pending</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                {(photos.filter(s => photoTeamFilter === 'all' || s.team_id === photoTeamFilter).length > 0 ||
                  scavengerSubs.filter(s => photoTeamFilter === 'all' || s.team_id === photoTeamFilter).length > 0) && (
                  <button
                    className="btn btn-ghost"
                    onClick={downloadPhotosZip}
                    disabled={downloadingZip}
                    style={{ fontSize: '13px', padding: '8px 14px', border: '1px solid var(--border)' }}
                  >
                    {downloadingZip ? '⏳' : '📦'} {downloadingZip ? 'Downloading…' : 'Download ZIP'}
                  </button>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--muted)' }}>AI rating</span>
                  <div
                    onClick={() => toggleAiRating(!aiRatingEnabled)}
                    style={{ width: '36px', height: '20px', borderRadius: '10px', background: aiRatingEnabled ? 'var(--accent)' : 'var(--border)', position: 'relative', cursor: 'pointer', flexShrink: 0 }}
                  >
                    <div style={{ position: 'absolute', top: '2px', left: aiRatingEnabled ? '18px' : '2px', width: '16px', height: '16px', borderRadius: '50%', background: '#fff', transition: 'left 0.15s' }} />
                  </div>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: aiRatingEnabled ? 'var(--accent)' : 'var(--muted)' }}>
                    {aiRatingEnabled ? 'ON' : 'OFF'}
                  </span>
                </div>
              </div>
            </div>

            {/* AI info card */}
            {aiRatingEnabled && (
              <div style={{ background: 'rgba(124,189,212,0.06)', border: '1px solid rgba(124,189,212,0.2)', borderRadius: '10px', padding: '12px 14px', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                  <span>✨</span>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--accent)' }}>AI rating is on</span>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--muted)' }}>Photos are rated automatically when submitted</div>
                {aiRatingInstructions && (
                  <div style={{ marginTop: '8px', background: 'var(--surface)', borderRadius: '6px', padding: '6px 10px', fontSize: '11px' }}>
                    <span style={{ color: 'var(--muted)', marginRight: '4px' }}>Focus:</span>
                    <span style={{ fontStyle: 'italic', color: 'var(--text)' }}>{aiRatingInstructions}</span>
                  </div>
                )}
              </div>
            )}

            {/* Team filter */}
            {teams.length > 0 && (
              <div style={{ marginBottom: '20px' }}>
                <select
                  value={photoTeamFilter}
                  onChange={e => { setPhotoTeamFilter(e.target.value); setVisiblePendingCount(10); setVisibleScavengerCount(10); setVisibleRatedCount(20); }}
                  style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontFamily: "'Sora', sans-serif", fontSize: '13px', width: '100%', cursor: 'pointer' }}
                >
                  <option value="all">All teams</option>
                  {teams.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
            )}

            {photos.filter(s => photoTeamFilter === 'all' || s.team_id === photoTeamFilter).length === 0 &&
             scavengerSubs.filter(s => photoTeamFilter === 'all' || s.team_id === photoTeamFilter).length === 0
              ? <div className="empty-state">No photos submitted yet.</div>
              : null}

            {/* Pending regular photos */}
            {(() => {
              const pendingFiltered = photos.filter(s => s.status !== 'rated' && !rated.has(s.id) && (photoTeamFilter === 'all' || s.team_id === photoTeamFilter));
              return pendingFiltered.length > 0 && (
              <>
              <div className="mobile-photo-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
                {pendingFiltered.slice(0, visiblePendingCount).map(sub => {
                  const _customM = adminCustomMissions.find(cm => cm.id === sub.mission_id);
                  const mission = MISSIONS.find(m => m.id === sub.mission_id) ?? (_customM ? toMission(_customM) : undefined);
                  const missionMaxPts = activeGame.mission_max_pts?.[sub.mission_id] ?? mission?.maxPts ?? 500;
                  const pointOptions = getPointOptions(missionMaxPts);
                  return (
                    <div key={sub.id} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                      <div style={{ padding: '8px 12px', background: 'var(--surface)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '14px' }}>{mission?.icon ?? '📸'}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--accent)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{mission?.name ?? sub.mission_id}</div>
                          <div style={{ fontSize: '11px', color: 'var(--muted)' }}>{sub.team_name}</div>
                        </div>
                      </div>
                      <div
                        style={{ height: '200px', overflow: 'hidden', flexShrink: 0, cursor: 'zoom-in' }}
                        onClick={() => setPhotoModal({ url: sub.photo_url, label: `${sub.team_name} — ${mission?.name ?? sub.mission_id}` })}
                      >
                        <img src={sub.photo_url} alt={sub.team_name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                      </div>
                      <div style={{ padding: '10px 12px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {pointOptions.map(pts => (
                          <button key={pts} onClick={() => ratePhoto(sub, pts)}
                            style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--border)', background: pts === missionMaxPts ? 'rgba(222,187,107,0.15)' : pts === 0 ? 'rgba(208,117,125,0.10)' : 'var(--surface)', color: pts === missionMaxPts ? 'var(--gold)' : pts === 0 ? 'var(--accent2)' : 'var(--text)', cursor: 'pointer', fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: '12px' }}>
                            {pts}p
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
              {pendingFiltered.length > visiblePendingCount && (
                <button onClick={() => setVisiblePendingCount(n => n + 10)}
                  style={{ marginTop: '16px', width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--muted)', cursor: 'pointer', fontFamily: "'Sora', sans-serif", fontSize: '13px' }}>
                  Visa 10 till ({pendingFiltered.length - visiblePendingCount} kvar)
                </button>
              )}
              </>
              );
            })()}

            {/* Pending scavenger photos */}
            {(() => {
              const scavFiltered = scavengerSubs.filter(s => s.status !== 'rated' && !scavengerRated.has(s.id) && (photoTeamFilter === 'all' || s.team_id === photoTeamFilter));
              return scavFiltered.length > 0 && (
              <>
                <div className="section-header" style={{ marginTop: '32px' }}>
                  <h2 style={{ fontSize: '18px' }}>📍 Scavenger Hunt</h2>
                  <span className="badge">{scavFiltered.length} pending</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '16px' }}>
                  {scavFiltered.slice(0, visibleScavengerCount).map(sub => (
                    <div key={sub.id} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                      <div style={{ padding: '8px 12px', background: 'var(--surface)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '14px' }}>📍</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--accent)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub.item_label}</div>
                          <div style={{ fontSize: '11px', color: 'var(--muted)' }}>{sub.team_name}</div>
                        </div>
                      </div>
                      <div
                        style={{ height: '180px', overflow: 'hidden', flexShrink: 0, cursor: 'zoom-in' }}
                        onClick={() => setPhotoModal({ url: sub.photo_url, label: `${sub.team_name} — ${sub.item_label}` })}
                      >
                        <img src={sub.photo_url} alt={sub.item_label} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                      </div>
                      <div style={{ padding: '10px 12px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {[0, 25, 50, 75, 100].map(pts => (
                          <button key={pts} onClick={() => rateScavengerPhoto(sub, pts)}
                            style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--border)', background: pts === 100 ? 'rgba(222,187,107,0.15)' : pts === 0 ? 'rgba(208,117,125,0.10)' : 'var(--surface)', color: pts === 100 ? 'var(--gold)' : pts === 0 ? 'var(--accent2)' : 'var(--text)', cursor: 'pointer', fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: '12px' }}>
                            {pts}p
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                {scavFiltered.length > visibleScavengerCount && (
                  <button onClick={() => setVisibleScavengerCount(n => n + 10)}
                    style={{ marginTop: '16px', width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--muted)', cursor: 'pointer', fontFamily: "'Sora', sans-serif", fontSize: '13px' }}>
                    Visa 10 till ({scavFiltered.length - visibleScavengerCount} kvar)
                  </button>
                )}
              </>
              );
            })()}

            {/* Rated archive — regular + scavenger combined */}
            {(() => {
              const ratedRegular = photos.filter(s => (s.status === 'rated' || rated.has(s.id)) && (photoTeamFilter === 'all' || s.team_id === photoTeamFilter));
              const ratedScav = scavengerSubs.filter(s => (s.status === 'rated' || scavengerRated.has(s.id)) && (photoTeamFilter === 'all' || s.team_id === photoTeamFilter));
              const allRated = [...ratedRegular.map(s => ({ ...s, _type: 'regular' as const })), ...ratedScav.map(s => ({ ...s, _type: 'scavenger' as const }))];
              return allRated.length > 0 && (
              <>
                <div className="section-header" style={{ marginTop: '28px' }}>
                  <h2 style={{ fontSize: '16px', color: 'var(--muted)' }}>✓ Rated</h2>
                  <span style={{ fontSize: '12px', color: 'var(--muted)' }}>{allRated.length} photos</span>
                </div>
                <div className="mobile-photo-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '10px', opacity: 0.7 }}>
                  {allRated.slice(0, visibleRatedCount).map(sub => {
                    if (sub._type === 'regular') {
                      const _rMissionId = (sub as typeof ratedRegular[0]).mission_id;
                      const _rCustomM = adminCustomMissions.find(cm => cm.id === _rMissionId);
                      const mission = MISSIONS.find(m => m.id === _rMissionId) ?? (_rCustomM ? toMission(_rCustomM) : undefined);
                      return (
                        <div key={sub.id} style={{ background: 'var(--card)', border: '1px solid var(--accent3)', borderRadius: '12px', overflow: 'hidden' }}>
                          <div style={{ padding: '6px 10px', background: 'var(--surface)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '12px' }}>{mission?.icon ?? '📸'}</span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub.team_name}</div>
                            </div>
                            <span style={{
                              background: (sub as typeof ratedRegular[0]).ai_rated ? 'rgba(124,189,212,0.15)' : 'transparent',
                              borderRadius: '4px',
                              padding: (sub as typeof ratedRegular[0]).ai_rated ? '2px 5px' : '0',
                              color: (sub as typeof ratedRegular[0]).ai_rated ? 'var(--accent)' : 'var(--accent3)',
                              fontWeight: 700, fontSize: '11px', flexShrink: 0,
                            }}>
                              {(sub as typeof ratedRegular[0]).ai_rated ? '✨' : '✓'} {(sub as typeof ratedRegular[0]).points_awarded ?? 0}p
                            </span>
                          </div>
                          <div style={{ height: '140px', overflow: 'hidden', cursor: 'zoom-in' }}
                            onClick={() => setPhotoModal({ url: sub.photo_url, label: `${sub.team_name} — ${mission?.name ?? (sub as typeof ratedRegular[0]).mission_id}` })}>
                            <img src={sub.photo_url} alt={sub.team_name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                          </div>
                          {overridingPhotoId === sub.id ? (
                            <div style={{ padding: '6px 8px', display: 'flex', gap: '4px', flexWrap: 'wrap', borderTop: '1px solid var(--border)', background: 'var(--surface)' }}>
                              {getPointOptions(activeGame.mission_max_pts?.[_rMissionId] ?? mission?.maxPts ?? 500).map(pts => (
                                <button key={pts} onClick={() => { ratePhoto(sub as PhotoSubmission, pts); setOverridingPhotoId(null); }}
                                  style={{ padding: '4px 8px', borderRadius: '5px', border: '1px solid var(--border)', background: pts === ((sub as typeof ratedRegular[0]).points_awarded ?? 0) ? 'var(--accent)' : 'var(--surface)', color: pts === ((sub as typeof ratedRegular[0]).points_awarded ?? 0) ? '#0a0e19' : 'var(--text)', cursor: 'pointer', fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: '11px' }}>
                                  {pts}p
                                </button>
                              ))}
                              <button onClick={() => setOverridingPhotoId(null)} style={{ padding: '4px 8px', borderRadius: '5px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted)', cursor: 'pointer', fontSize: '11px' }}>✕</button>
                            </div>
                          ) : (
                            <button onClick={() => setOverridingPhotoId(sub.id)} style={{ width: '100%', padding: '5px', background: 'transparent', border: 'none', borderTop: '1px solid var(--border)', color: 'var(--muted)', cursor: 'pointer', fontSize: '10px', fontFamily: "'Sora', sans-serif" }}>
                              {(sub as typeof ratedRegular[0]).ai_rated ? 'Override ✨' : '✏️ Change'}
                            </button>
                          )}
                        </div>
                      );
                    } else {
                      const s = sub as typeof ratedScav[0];
                      return (
                        <div key={sub.id} style={{ background: 'var(--card)', border: '1px solid var(--accent3)', borderRadius: '12px', overflow: 'hidden' }}>
                          <div style={{ padding: '6px 10px', background: 'var(--surface)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '12px' }}>📍</span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub.team_name}</div>
                            </div>
                            <span style={{
                              background: s.ai_rated ? 'rgba(124,189,212,0.15)' : 'transparent',
                              borderRadius: '4px',
                              padding: s.ai_rated ? '2px 5px' : '0',
                              color: s.ai_rated ? 'var(--accent)' : 'var(--accent3)',
                              fontWeight: 700, fontSize: '11px', flexShrink: 0,
                            }}>
                              {s.ai_rated ? '✨' : '✓'} {s.points_awarded ?? 0}p
                            </span>
                          </div>
                          <div style={{ height: '140px', overflow: 'hidden', cursor: 'zoom-in' }}
                            onClick={() => setPhotoModal({ url: sub.photo_url, label: `${sub.team_name} — ${s.item_label}` })}>
                            <img src={sub.photo_url} alt={s.item_label} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                          </div>
                          {overridingPhotoId === sub.id ? (
                            <div style={{ padding: '6px 8px', display: 'flex', gap: '4px', flexWrap: 'wrap', borderTop: '1px solid var(--border)', background: 'var(--surface)' }}>
                              {getPointOptions(activeGame.mission_max_pts?.[(sub as typeof ratedScav[0]).mission_id] ?? 500).map(pts => (
                                <button key={pts} onClick={() => { rateScavengerPhoto(sub as ScavengerSubmission, pts); setOverridingPhotoId(null); }}
                                  style={{ padding: '4px 8px', borderRadius: '5px', border: '1px solid var(--border)', background: pts === (s.points_awarded ?? 0) ? 'var(--accent)' : 'var(--surface)', color: pts === (s.points_awarded ?? 0) ? '#0a0e19' : 'var(--text)', cursor: 'pointer', fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: '11px' }}>
                                  {pts}p
                                </button>
                              ))}
                              <button onClick={() => setOverridingPhotoId(null)} style={{ padding: '4px 8px', borderRadius: '5px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted)', cursor: 'pointer', fontSize: '11px' }}>✕</button>
                            </div>
                          ) : (
                            <button onClick={() => setOverridingPhotoId(sub.id)} style={{ width: '100%', padding: '5px', background: 'transparent', border: 'none', borderTop: '1px solid var(--border)', color: 'var(--muted)', cursor: 'pointer', fontSize: '10px', fontFamily: "'Sora', sans-serif" }}>
                              {s.ai_rated ? 'Override ✨' : '✏️ Change'}
                            </button>
                          )}
                        </div>
                      );
                    }
                  })}
                </div>
                {allRated.length > visibleRatedCount && (
                  <button onClick={() => setVisibleRatedCount(n => n + 20)}
                    style={{ marginTop: '16px', width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--muted)', cursor: 'pointer', fontFamily: "'Sora', sans-serif", fontSize: '13px' }}>
                    Visa 20 till ({allRated.length - visibleRatedCount} kvar)
                  </button>
                )}
              </>
              );
            })()}
          </div>
        )}

        {/* STATS */}
        {tab === 'stats' && (() => {
          const gameMissions = (activeGame.missions ?? [])
            .map(id => MISSIONS.find(m => m.id === id))
            .filter(Boolean) as typeof MISSIONS;

          // 1. Mission completion — top 10
          const completionStats = gameMissions
            .map(m => ({ m, value: teams.filter(t => t.completed?.includes(m.id)).length }))
            .filter(x => x.value > 0)
            .sort((a, b) => b.value - a.value)
            .slice(0, 10);

          // 2. Total points per mission — top 10
          const pointStats = gameMissions
            .map(m => ({ m, value: teams.reduce((s, t) => s + (t.mission_scores?.[m.id] ?? 0), 0) }))
            .filter(x => x.value > 0)
            .sort((a, b) => b.value - a.value)
            .slice(0, 10);

          // 3. Would You answers
          const wouldYouMissions = gameMissions.filter(m => m.type === 'wouldyou');
          const wouldYouAnswers = wouldYouMissions.map(m => ({
            m,
            answers: teams
              .filter(t => t.mission_answers?.[m.id])
              .map(t => ({ team: t.name, answer: t.mission_answers[m.id] })),
          })).filter(x => x.answers.length > 0);

          // 4. Duel stolen — top 3
          const duelStats = teams
            .map(t => ({ name: t.name, value: t.mission_scores?.['duel_trivia'] ?? 0 }))
            .filter(x => x.value > 0)
            .sort((a, b) => b.value - a.value)
            .slice(0, 3);

          // 5. Most targeted by other teams (powerups_received) — top 3
          const puTargetStats = teams
            .map(t => ({ name: t.name, value: t.powerups_received ?? 0 }))
            .filter(x => x.value > 0)
            .sort((a, b) => b.value - a.value)
            .slice(0, 3);

          const statCard = (children: React.ReactNode) => (
            <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px', marginBottom: '16px' }}>
              {children}
            </div>
          );

          const statTitle = (icon: string, label: string) => (
            <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--muted)', letterSpacing: '1px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>{icon}</span>{label}
            </div>
          );

          // Vertical bar chart with mission on X-axis
          const BarChart = ({ data, maxValue, color, unit }: {
            data: { m: typeof MISSIONS[0]; value: number }[];
            maxValue: number;
            color: string;
            unit: string;
          }) => (
            <div style={{ overflowX: 'auto', paddingBottom: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', minWidth: 'max-content' }}>
                {data.map(({ m, value }) => {
                  const barH = maxValue > 0 ? Math.max(4, Math.round((value / maxValue) * 96)) : 4;
                  return (
                    <div key={m.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '58px', gap: '3px' }}>
                      {/* Fixed-height bar area — all bars share the same 116px container */}
                      <div style={{ height: '116px', width: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', gap: '3px' }}>
                        <span style={{ fontSize: '10px', fontWeight: 800, color, lineHeight: 1 }}>{value}{unit}</span>
                        <div style={{ width: '100%', height: `${barH}px`, background: color, borderRadius: '4px 4px 0 0', opacity: 0.85 }} />
                      </div>
                      {/* Baseline */}
                      <div style={{ width: '100%', height: '1px', background: 'var(--border)' }} />
                      {/* Labels below — don't affect bar height */}
                      <span style={{ fontSize: '18px', lineHeight: 1 }}>{m.icon}</span>
                      <span style={{ fontSize: '9px', color: 'var(--muted)', textAlign: 'center', lineHeight: 1.2, maxWidth: '58px', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                        {m.name}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          );

          const top3Medal = (i: number) => i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉';

          return (
            <div className="fade-in">
              <div className="section-header">
                <h2 style={{ fontSize: '18px' }}>Statistics</h2>
                <span className="badge">{teams.length} teams</span>
              </div>

              {/* 1. Mission completion bar chart */}
              {statCard(<>
                {statTitle('🏆', 'MOST COMPLETED MISSIONS (TOP 10)')}
                {completionStats.length === 0
                  ? <div style={{ fontSize: '13px', color: 'var(--muted)' }}>No completions yet.</div>
                  : <BarChart data={completionStats} maxValue={teams.length} color="var(--accent)" unit={`/${teams.length}`} />}
              </>)}

              {/* 2. Points per mission bar chart */}
              {statCard(<>
                {statTitle('💰', 'MOST POINTS AWARDED (TOP 10)')}
                {pointStats.length === 0
                  ? <div style={{ fontSize: '13px', color: 'var(--muted)' }}>No points yet.</div>
                  : <BarChart data={pointStats} maxValue={pointStats[0]?.value ?? 1} color="var(--gold)" unit=" pts" />}
              </>)}

              {/* 3. Would You answers */}
              {statCard(<>
                {statTitle('💬', 'WHO ON THE TEAM')}
                {wouldYouAnswers.length === 0
                  ? <div style={{ fontSize: '13px', color: 'var(--muted)' }}>No answers submitted yet.</div>
                  : wouldYouAnswers.map(({ m, answers }) => (
                    <div key={m.id} style={{ marginBottom: '14px' }}>
                      <div style={{ fontSize: '12px', color: 'var(--accent)', fontWeight: 700, marginBottom: '8px' }}>{m.question}</div>
                      {answers.map(({ team, answer }) => (
                        <div key={team} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                          <span style={{ color: 'var(--muted)' }}>{team}</span>
                          <span style={{ fontWeight: 700 }}>{answer}</span>
                        </div>
                      ))}
                    </div>
                  ))}
              </>)}

              {/* 4. Duel stolen — top 3 */}
              {statCard(<>
                {statTitle('⚔️', 'DUEL — MOST POINTS STOLEN (TOP 3)')}
                {duelStats.length === 0
                  ? <div style={{ fontSize: '13px', color: 'var(--muted)' }}>No duels completed yet.</div>
                  : duelStats.map(({ name, value }, i) => (
                    <div key={name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '14px', padding: '9px 0', borderBottom: i < duelStats.length - 1 ? '1px solid var(--border)' : 'none' }}>
                      <span>{top3Medal(i)} {name}</span>
                      <span style={{ fontWeight: 800, color: 'var(--accent2)' }}>+{value} pts</span>
                    </div>
                  ))}
              </>)}

              {/* 5. Power-up targets — top 3 */}
              {statCard(<>
                {statTitle('🎯', 'MOST TARGETED BY OTHER TEAMS (TOP 3)')}
                {puTargetStats.length === 0
                  ? <div style={{ fontSize: '13px', color: 'var(--muted)' }}>No team power-ups used yet.</div>
                  : puTargetStats.map(({ name, value }, i) => (
                    <div key={name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '14px', padding: '9px 0', borderBottom: i < puTargetStats.length - 1 ? '1px solid var(--border)' : 'none' }}>
                      <span>{top3Medal(i)} {name}</span>
                      <span style={{ fontWeight: 800, color: 'var(--accent)' }}>{value}× targeted</span>
                    </div>
                  ))}
              </>)}
            </div>
          );
        })()}

        {/* POWER-UPS */}
        {tab === 'powerups' && activeGame.status === 'active' && (
          <div className="fade-in">
            <div className="section-header">
              <h2 style={{ fontSize: '18px' }}>Power-ups</h2>
              <span className="badge">{teams.length} teams</span>
            </div>
            {plan === 'free' && (
              <div style={{ background: 'rgba(124,189,212,0.08)', border: '1px solid rgba(124,189,212,0.2)', borderRadius: '12px', padding: '24px', textAlign: 'center', marginBottom: '20px' }}>
                <div style={{ fontSize: '32px', marginBottom: '8px' }}>⚡</div>
                <div style={{ fontWeight: 700, fontSize: '16px', marginBottom: '8px', color: 'var(--text)' }}>Power-ups ingår i Pro</div>
                <div style={{ fontSize: '14px', color: 'var(--muted)', marginBottom: '16px' }}>Sabotage, dubbelpoäng, falsk ledtråd och mer — uppgradera för att aktivera dem live under spelet.</div>
                <button className="btn btn-primary" style={{ background: 'linear-gradient(135deg, #7CBDD4, #4890aa)', color: '#0D1520', border: 'none', fontWeight: 800 }} onClick={() => handleUpgrade('pro')} disabled={upgradeLoading}>
                  {upgradeLoading ? '...' : '⚡ Upgrade to Pro'}
                </button>
              </div>
            )}
            <PowerUpsCard
              teams={teams}
              gameId={activeGame.id}
              gameMissionIds={activeGame.missions}
              powerupsUsed={powerupsUsed}
              puTargets={puTargets}
              setPuTargets={setPuTargets}
              puMessages={puMessages}
              setPuMessages={setPuMessages}
              puLoading={puLoading}
              onActivate={activatePowerup}
              hotPotatoMissionId={hotPotatoMissionId}
              setHotPotatoMissionId={setHotPotatoMissionId}
              onHotPotato={activateHotPotato}
              hotPotatoLoading={hotPotatoLoading}
              hotPotatoActive={hotPotatoActive}
              mysteryBoxActive={mysteryBoxActive}
              mysteryBoxSecsLeft={mysteryBoxSecsLeft}
              mysteryBoxLoading={mysteryBoxLoading}
              onLaunchMysteryBox={launchMysteryBox}
              activeGameStatus={activeGame.status}
            />
          </div>
        )}
      </div>
      {/* ── Toast notifications ── */}
      {toasts.length > 0 && (
        <div style={{ position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', gap: '8px', zIndex: 9999, pointerEvents: 'none', alignItems: 'center' }}>
          {toasts.map(t => (
            <div key={t.id} style={{
              background: t.type === 'error' ? 'rgba(42,10,10,0.95)' : 'rgba(22,32,48,0.95)',
              border: `1px solid ${t.type === 'error' ? 'rgba(255,100,100,0.35)' : 'rgba(124,189,212,0.35)'}`,
              color: t.type === 'error' ? '#ff8888' : '#DCE4EE',
              padding: '11px 20px',
              borderRadius: '10px',
              fontSize: '14px',
              fontWeight: 600,
              boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
              whiteSpace: 'nowrap',
            }}>
              {t.msg}
            </div>
          ))}
        </div>
      )}

      {/* ── MOBILE BOTTOM NAV ── */}
      {isMobile && (
        <>
          {/* More sheet overlay */}
          {mobileMoreOpen && (
            <>
              <div
                role="presentation"
                style={{ position: 'fixed', inset: 0, zIndex: 98 }}
                onClick={() => setMobileMoreOpen(false)}
                onKeyDown={(e) => { if (e.key === 'Escape') setMobileMoreOpen(false); }}
              />
              <div className="mobile-more-sheet" role="dialog" aria-label="More options">
                <button
                  className="mobile-more-sheet-item"
                  onClick={() => { setTab('progress'); setMobileMoreOpen(false); }}
                >
                  📊 Progress
                </button>
                <button
                  className="mobile-more-sheet-item"
                  onClick={() => { setTab('stats'); setMobileMoreOpen(false); }}
                >
                  📈 Stats
                </button>
              </div>
            </>
          )}

          {/* FAB — create new game */}
          <button
            className="mobile-fab"
            onClick={() => { setMobileMoreOpen(false); loadAdminCustomMissions(); setView('create'); }}
            aria-label="Create new game"
          >
            +
          </button>

          {/* Bottom navigation */}
          <nav className="mobile-bottom-nav">
            <button
              className="mobile-bottom-nav-item"
              onClick={() => { loadGames(); setTeams([]); setPhotos([]); setView('games'); }}
            >
              <span className="mobile-nav-icon">🎮</span>
              <span className="mobile-nav-label">Games</span>
            </button>
            <button
              className={`mobile-bottom-nav-item${tab === 'leaderboard' ? ' active' : ''}`}
              onClick={() => { setTab('leaderboard'); setMobileMoreOpen(false); }}
            >
              <span className="mobile-nav-icon">🏆</span>
              <span className="mobile-nav-label">Leaderboard</span>
            </button>
            <button
              className={`mobile-bottom-nav-item${tab === 'photos' ? ' active' : ''}`}
              onClick={() => { setTab('photos'); setMobileMoreOpen(false); }}
              style={{ position: 'relative' }}
            >
              <span className="mobile-nav-icon">📸</span>
              <span className="mobile-nav-label">
                Photos{totalPendingPhotos > 0 ? ` · ${totalPendingPhotos}` : ''}
              </span>
            </button>
            <button
              className={`mobile-bottom-nav-item${tab === 'powerups' ? ' active' : ''}`}
              onClick={() => { setTab('powerups'); setMobileMoreOpen(false); }}
            >
              <span className="mobile-nav-icon">⚡</span>
              <span className="mobile-nav-label">Power-ups</span>
            </button>
            <button
              className={`mobile-bottom-nav-item${mobileMoreOpen ? ' active' : ''}`}
              onClick={() => setMobileMoreOpen(o => !o)}
              aria-expanded={mobileMoreOpen}
            >
              <span className="mobile-nav-icon" style={{ letterSpacing: '-2px' }}>···</span>
              <span className="mobile-nav-label">More</span>
            </button>
          </nav>
        </>
      )}
      {showMysteryBoxAR && (
        <MysteryBoxAR
          mode="place"
          onPlace={onMysteryBoxPlaced}
          onClose={() => setShowMysteryBoxAR(false)}
        />
      )}
    </>
  );
}
