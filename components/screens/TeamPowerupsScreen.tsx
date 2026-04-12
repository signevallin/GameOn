'use client';
import { useState } from 'react';
import { Team } from '@/lib/supabase';

type PowerUp = {
  id: string;
  icon: string;
  label: string;
  desc: string;
  color: string;
  offensive: boolean;
};

const POWERUPS: PowerUp[] = [
  { id: 'second_chance', icon: '🔄', label: 'Second Chance',   desc: 'Retry a mission you already failed.',                         color: 'var(--accent3)', offensive: false },
  { id: 'shield',        icon: '🛡️', label: 'Shield',          desc: 'Immune to sabotage & attacks for 2 minutes.',               color: 'var(--accent)',  offensive: false },
  { id: 'freeze',        icon: '❄️', label: 'Freeze',          desc: 'Lock a rival team for 60 seconds.',                         color: '#7ec8e3',        offensive: true  },
  { id: 'double_trouble',icon: '😈', label: 'Double Trouble',  desc: 'Force a rival to complete 2 missions before unlocking next.',color: 'var(--accent2)', offensive: true  },
  { id: 'all_in',        icon: '💸', label: 'All In',          desc: 'Steal 50% of a rival team\'s current points.',              color: 'var(--gold)',    offensive: true  },
];

type Props = {
  team: Team;
  teams: Team[];
  onBack: () => void;
  onTeamUpdate: (t: Team) => void;
};

export default function TeamPowerupsScreen({ team, teams, onBack, onTeamUpdate }: Props) {
  const [selected, setSelected] = useState<PowerUp | null>(null);
  const [targetId, setTargetId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ msg: string; ok: boolean } | null>(null);

  const rivals = teams.filter(t => t.id !== team.id);
  const used = team.team_powerups_used ?? [];

  async function send() {
    if (!selected) return;
    if (selected.offensive && !targetId) return;
    setLoading(true);
    setFeedback(null);
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
        // Still update local used list
        onTeamUpdate({ ...team, team_powerups_used: [...used, selected.id] });
        setSelected(null);
      } else {
        setFeedback({ msg: selected.offensive ? `${selected.icon} ${selected.label} sent!` : `${selected.icon} ${selected.label} activated!`, ok: true });
        onTeamUpdate({ ...team, team_powerups_used: [...used, selected.id] });
        setSelected(null);
        setTargetId('');
      }
    } catch {
      setFeedback({ msg: 'Network error, try again.', ok: false });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container fade-in" style={{ paddingTop: '24px', paddingBottom: '48px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '28px' }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '13px', fontFamily: "'Sora', sans-serif" }}>
          ← Back
        </button>
        <span style={{ color: 'var(--border)' }}>|</span>
        <span style={{ fontWeight: 800, fontSize: '18px' }}>⚡ Power-Ups</span>
      </div>

      <p style={{ color: 'var(--muted)', fontSize: '13px', marginBottom: '24px' }}>
        Each power-up can only be used once. Choose wisely!
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
          const isUsed = used.includes(pu.id);
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
                    {pu.offensive && !isUsed && <span style={{ marginLeft: '6px', fontSize: '10px', color: 'var(--muted)', fontWeight: 400 }}>OFFENSIVE</span>}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--muted)' }}>{pu.desc}</div>
                </div>
                {isUsed
                  ? <span style={{ fontSize: '12px', color: 'var(--muted)', flexShrink: 0 }}>USED</span>
                  : <span style={{ fontSize: '16px', color: pu.color, flexShrink: 0 }}>{isSelected ? '▾' : '▸'}</span>
                }
              </div>

              {/* Expanded: target selector + send button */}
              {isSelected && (
                <div style={{ background: 'var(--surface)', border: `1px solid ${pu.color}`, borderTop: 'none', borderRadius: '0 0 12px 12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {pu.offensive && (
                    <div>
                      <label style={{ fontSize: '11px', color: 'var(--muted)', letterSpacing: '2px', display: 'block', marginBottom: '8px' }}>SELECT TARGET TEAM</label>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {rivals.length === 0 && <p style={{ fontSize: '13px', color: 'var(--muted)' }}>No other teams in this game.</p>}
                        {rivals.map(t => (
                          <button
                            key={t.id}
                            onClick={() => setTargetId(t.id)}
                            style={{
                              padding: '10px 14px',
                              borderRadius: '8px',
                              border: `1px solid ${targetId === t.id ? pu.color : 'var(--border)'}`,
                              background: targetId === t.id ? `color-mix(in srgb, ${pu.color} 12%, var(--card))` : 'var(--card)',
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
                            <span>{t.name}</span>
                            <span style={{ color: 'var(--muted)', fontWeight: 400 }}>{t.score} pts</span>
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
                    {loading ? '...' : pu.offensive ? `${pu.icon} Send ${pu.label}` : `${pu.icon} Activate ${pu.label}`}
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
