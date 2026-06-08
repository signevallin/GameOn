'use client';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Team } from '@/lib/supabase';

type PowerUp = {
  id: string;
  icon: string;
  label: string;
  desc: string;
  color: string;
  offensive: boolean;
};


type Props = {
  team: Team;
  teams: Team[];
  onBack: () => void;
  onTeamUpdate: (t: Team) => void;
};

export default function TeamPowerupsScreen({ team, teams, onBack, onTeamUpdate }: Props) {
  const { t } = useTranslation();

  const POWERUPS: PowerUp[] = [
    { id: 'shield',         icon: '🛡️', label: t('powerups.shield_label'),         desc: t('powerups.shield_desc'),         color: 'var(--accent)',  offensive: false },
    { id: 'freeze',         icon: '❄️', label: t('powerups.freeze_label'),          desc: t('powerups.freeze_desc'),          color: '#7ec8e3',        offensive: true  },
    { id: 'double_trouble', icon: '😈', label: t('powerups.double_trouble_label'),  desc: t('powerups.double_trouble_desc'),  color: 'var(--accent2)', offensive: true  },
    { id: 'all_in',         icon: '🎲', label: t('powerups.all_in_label'),          desc: t('powerups.all_in_desc'),          color: 'var(--gold)',    offensive: true  },
    { id: 'point_steal',    icon: '🎰', label: t('powerups.point_steal_label'),     desc: t('powerups.point_steal_desc'),     color: 'var(--gold)',    offensive: true  },
    { id: 'robin_hood',     icon: '🏹', label: t('powerups.robin_hood_label'),      desc: t('powerups.robin_hood_desc'),      color: 'var(--accent3)', offensive: true  },
  ];

  const [selected, setSelected] = useState<PowerUp | null>(null);
  const [targetId, setTargetId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ msg: string; ok: boolean } | null>(null);
  const [coinPhase, setCoinPhase] = useState<'spinning' | 'win' | 'lose' | null>(null);
  const [coinMsg, setCoinMsg] = useState('');

  const rivals = teams.filter(t => t.id !== team.id);
  const used = team.team_powerups_used ?? [];
  const extra = team.extra_powerups ?? [];

  async function send() {
    if (!selected) return;
    if (selected.offensive && !targetId) return;
    setLoading(true);
    setFeedback(null);

    // All In gets the coin flip visualisation
    if (selected.id === 'all_in') {
      setCoinPhase('spinning');
      const [res] = await Promise.all([
        fetch('/api/team/powerup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'all_in', senderTeamId: team.id, targetTeamId: targetId }),
          cache: 'no-store',
        }),
        new Promise(r => setTimeout(r, 2200)), // minimum spin time
      ]);
      const data = await res.json();
      setLoading(false);

      if (!res.ok) {
        setCoinPhase(null);
        setFeedback({ msg: data.error, ok: false });
        return;
      }

      setCoinMsg(data.resultMessage ?? (data.won ? '🎲 You won!' : '🎲 You lost…'));
      setCoinPhase(data.won ? 'win' : 'lose');
      onTeamUpdate({ ...team, team_powerups_used: [...used, 'all_in'], score: data.newSenderScore ?? team.score });

      setTimeout(() => {
        setCoinPhase(null);
        setSelected(null);
        setTargetId('');
        setFeedback({ msg: data.resultMessage ?? (data.won ? '🎲 You won!' : '🎲 You lost…'), ok: data.won });
      }, 2800);
      return;
    }

    try {
      const res = await fetch('/api/team/powerup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: selected.id, senderTeamId: team.id, targetTeamId: selected.offensive ? targetId : undefined }),
        cache: 'no-store',
      });
      const data = await res.json();
      if (!res.ok) {
        setFeedback({ msg: data.error, ok: false });
      } else if (data.blocked) {
        setFeedback({ msg: data.message, ok: false });
        onTeamUpdate({ ...team, team_powerups_used: [...used, selected.id] });
        setSelected(null);
      } else {
        const msg = data.resultMessage
          ?? (selected.offensive ? `${selected.icon} ${selected.label} sent!` : `${selected.icon} ${selected.label} activated!`);
        setFeedback({ msg, ok: data.won !== false });
        onTeamUpdate({ ...team, team_powerups_used: [...used, selected.id], score: data.newSenderScore ?? team.score });
        setSelected(null);
        setTargetId('');
      }
    } catch {
      setFeedback({ msg: t('powerups.networkError'), ok: false });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container fade-in" style={{ paddingTop: '24px', paddingBottom: '48px' }}>

      {/* ── COIN FLIP OVERLAY ── */}
      {coinPhase && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0,0,0,0.88)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: '32px',
        }}>
          {/* Coin */}
          <div style={{ perspective: '600px' }}>
            <div
              className={
                coinPhase === 'spinning' ? 'coin-spinning' :
                coinPhase === 'win'      ? 'coin-land-win' :
                                           'coin-land-lose'
              }
              style={{ width: '120px', height: '120px', position: 'relative', transformStyle: 'preserve-3d' }}
            >
              {/* Front face — WIN */}
              <div style={{
                position: 'absolute', inset: 0, borderRadius: '50%',
                backfaceVisibility: 'hidden',
                background: 'radial-gradient(circle at 35% 35%, #f5d87a, var(--gold) 60%, #a8800a)',
                border: '4px solid #c9a227',
                boxShadow: '0 0 30px rgba(222,187,107,0.6)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '52px',
              }}>🏆</div>
              {/* Back face — LOSE */}
              <div style={{
                position: 'absolute', inset: 0, borderRadius: '50%',
                backfaceVisibility: 'hidden',
                transform: 'rotateY(180deg)',
                background: 'radial-gradient(circle at 35% 35%, #c47a82, var(--accent2) 60%, #7a3038)',
                border: '4px solid #a04050',
                boxShadow: '0 0 30px rgba(208,117,125,0.5)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '52px',
              }}>💸</div>
            </div>
          </div>

          {/* Label */}
          {coinPhase === 'spinning' ? (
            <p style={{ color: 'var(--muted)', fontSize: '14px', letterSpacing: '2px', fontWeight: 700 }}>
              {t('powerups.flipping')}
            </p>
          ) : (
            <div style={{ textAlign: 'center', animation: 'coinResultFadeIn 0.4s ease forwards' }}>
              <div style={{
                fontSize: '20px', fontWeight: 800, letterSpacing: '1px',
                color: coinPhase === 'win' ? 'var(--gold)' : 'var(--accent2)',
                marginBottom: '8px',
              }}>
                {coinPhase === 'win' ? t('powerups.youWon') : t('powerups.youLost')}
              </div>
              <div style={{ fontSize: '14px', color: 'var(--muted)' }}>{coinMsg}</div>
            </div>
          )}
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '28px' }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '13px', fontFamily: "'Sora', sans-serif" }}>
          {t('powerups.backButton')}
        </button>
        <span style={{ color: 'var(--border)' }}>|</span>
        <span style={{ fontWeight: 800, fontSize: '18px' }}>{t('powerups.title')}</span>
      </div>

      <p style={{ color: 'var(--muted)', fontSize: '13px', marginBottom: '24px' }}>
        {t('powerups.desc')}
      </p>

      {feedback && (
        <div style={{
          padding: '14px 18px',
          borderRadius: '10px',
          marginBottom: '20px',
          background: feedback.ok ? 'rgba(140,191,155,0.12)' : 'rgba(208,117,125,0.12)',
          border: `1px solid ${feedback.ok ? 'var(--accent3)' : 'var(--accent2)'}`,
          color: feedback.ok ? 'var(--accent3)' : 'var(--accent2)',
          fontWeight: 700,
          fontSize: '14px',
        }}>
          {feedback.msg}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {POWERUPS.map(pu => {
          const isUsed = used.includes(pu.id) && !extra.includes(pu.id);
          const isSelected = selected?.id === pu.id;
          return (
            <div key={pu.id}>
              <div
                onClick={() => !isUsed && setSelected(isSelected ? null : pu)}
                style={{
                  background: isSelected ? `color-mix(in srgb, ${pu.color} 10%, var(--card))` : 'var(--card)',
                  border: `2px solid ${isSelected ? pu.color : isUsed ? 'var(--border)' : 'var(--border)'}`,
                  borderRadius: '12px',
                  padding: '16px',
                  cursor: isUsed ? 'default' : 'pointer',
                  opacity: isUsed ? 0.45 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px',
                  transition: 'border-color 0.15s',
                }}
              >
                <span style={{ fontSize: '28px', flexShrink: 0 }}>{pu.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 800, fontSize: '14px', color: isUsed ? 'var(--muted)' : pu.color, marginBottom: '3px' }}>
                    {pu.label}
                    {pu.offensive && !isUsed && <span style={{ marginLeft: '6px', fontSize: '10px', color: 'var(--muted)', fontWeight: 400 }}>{t('powerups.offensiveTag')}</span>}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--muted)' }}>{pu.desc}</div>
                </div>
                {isUsed
                  ? <span style={{ fontSize: '12px', color: 'var(--muted)', flexShrink: 0 }}>{t('powerups.usedTag')}</span>
                  : extra.includes(pu.id)
                    ? <span style={{ fontSize: '11px', color: 'var(--gold)', background: 'rgba(222,187,107,0.15)', border: '1px solid rgba(222,187,107,0.4)', borderRadius: '20px', padding: '2px 8px', flexShrink: 0 }}>+1 EXTRA</span>
                    : <span style={{ fontSize: '16px', color: pu.color, flexShrink: 0 }}>{isSelected ? '▾' : '▸'}</span>
                }
              </div>

              {/* Expanded: target selector + send button */}
              {isSelected && (
                <div style={{ background: 'var(--surface)', border: `1px solid ${pu.color}`, borderTop: 'none', borderRadius: '0 0 12px 12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {pu.offensive && (
                    <div>
                      <label style={{ fontSize: '11px', color: 'var(--muted)', letterSpacing: '2px', display: 'block', marginBottom: '8px' }}>{t('powerups.selectTargetLabel')}</label>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {rivals.length === 0 && <p style={{ fontSize: '13px', color: 'var(--muted)' }}>{t('powerups.noTeams')}</p>}
                        {rivals.map(tt => (
                          <button
                            key={tt.id}
                            onClick={() => setTargetId(tt.id)}
                            style={{
                              padding: '10px 14px',
                              borderRadius: '8px',
                              border: `1px solid ${targetId === tt.id ? pu.color : 'var(--border)'}`,
                              background: targetId === tt.id ? `color-mix(in srgb, ${pu.color} 12%, var(--card))` : 'var(--card)',
                              color: 'var(--text)',
                              fontFamily: "'Sora', sans-serif",
                              fontWeight: 700,
                              fontSize: '13px',
                              cursor: 'pointer',
                              textAlign: 'left',
                              display: 'flex',
                              justifyContent: 'space-between',
                            }}
                          >
                            <span>{tt.name}</span>
                            <span style={{ color: 'var(--muted)', fontWeight: 400 }}>{t('powerups.ptsValue', { pts: tt.score })}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <button
                    className="btn btn-primary"
                    onClick={send}
                    disabled={loading || (pu.offensive && !targetId)}
                    style={{ background: pu.color, borderColor: pu.color }}
                  >
                    {loading ? '...' : pu.offensive ? t('powerups.sendLabel', { icon: pu.icon, label: pu.label }) : t('powerups.activateLabel', { icon: pu.icon, label: pu.label })}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
