'use client';
import { useCallback, useEffect, useState } from 'react';
import { MISSIONS } from '@/lib/missions';
import { Team } from '@/lib/supabase';

type Props = { onLogout: () => void };

const RANK_ICONS = ['🥇', '🥈', '🥉'];
const RANK_COLORS = ['var(--gold)', 'var(--silver)', 'var(--bronze)'];

export default function AdminScreen({ onLogout }: Props) {
  const [tab, setTab] = useState<'leaderboard' | 'progress' | 'missions'>('leaderboard');
  const [teams, setTeams] = useState<Team[]>([]);
  const [visibleIds, setVisibleIds] = useState<string[]>(MISSIONS.map(m => m.id));
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  const loadTeams = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/teams');
      const data = await res.json();
      if (data.teams) setTeams(data.teams);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    loadTeams();
    const id = setInterval(loadTeams, 5000);
    return () => clearInterval(id);
  }, [loadTeams]);

  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then(d => { if (d.visible_missions) setVisibleIds(d.visible_missions); })
      .catch(() => {});
  }, []);

  function toggleMission(id: string) {
    setVisibleIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
    setSaveMsg('');
  }

  function toggleAll(on: boolean) {
    setVisibleIds(on ? MISSIONS.map(m => m.id) : []);
    setSaveMsg('');
  }

  async function saveSettings() {
    setSaving(true);
    setSaveMsg('');
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visible_missions: visibleIds }),
      });
      setSaveMsg(res.ok ? '✓ Saved!' : '✗ Error saving.');
    } catch {
      setSaveMsg('✗ Network error.');
    } finally {
      setSaving(false);
    }
  }

  const sorted = [...teams].sort((a, b) => b.score - a.score);

  return (
    <>
      <nav className="nav">
        <div className="nav-brand">🛡️ ADMIN</div>
        <div className="nav-right">
          <span className="badge">Live</span>
          <button className="btn btn-ghost" style={{ padding: '8px 16px', fontSize: '12px' }} onClick={onLogout}>
            LOG OUT
          </button>
        </div>
      </nav>

      <div className="container fade-in">
        <div style={{ padding: '32px 0 24px' }}>
          <h2>Competition Overview</h2>
          <p style={{ color: 'var(--muted)', marginTop: '6px', fontSize: '14px' }}>Real-time – updates every 5s</p>
        </div>

        <div className="admin-tabs">
          <button className={`admin-tab${tab === 'leaderboard' ? ' active' : ''}`} onClick={() => setTab('leaderboard')}>
            🏆 Scores
          </button>
          <button className={`admin-tab${tab === 'progress' ? ' active' : ''}`} onClick={() => setTab('progress')}>
            📊 Progress
          </button>
          <button className={`admin-tab${tab === 'missions' ? ' active' : ''}`} onClick={() => setTab('missions')}>
            🎯 Missions
          </button>
        </div>

        {tab === 'leaderboard' && (
          <div className="fade-in">
            <div className="section-header">
              <h2 style={{ fontSize: '18px' }}>Leaderboard</h2>
              <span className="badge">{teams.length} teams</span>
            </div>
            <div className="leaderboard">
              {sorted.length === 0 ? (
                <div className="empty-state">No teams have logged in yet.</div>
              ) : (
                sorted.map((t, i) => (
                  <div className="lb-row" key={t.id}>
                    <div className="lb-rank" style={{ color: RANK_COLORS[i] ?? 'var(--muted)' }}>
                      {RANK_ICONS[i] ?? i + 1}
                    </div>
                    <div className="lb-name">{t.name}</div>
                    <div className="lb-completed">{t.completed?.length ?? 0}/{MISSIONS.length} missions</div>
                    <div className="lb-score">{t.score} p</div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {tab === 'progress' && (
          <div className="fade-in">
            <div className="section-header">
              <h2 style={{ fontSize: '18px' }}>Teams & Missions</h2>
            </div>
            <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'auto' }}>
              <table className="progress-table">
                <thead>
                  <tr>
                    <th>Team</th>
                    {MISSIONS.map(m => <th key={m.id}>{m.icon}</th>)}
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.length === 0 ? (
                    <tr>
                      <td colSpan={MISSIONS.length + 2} style={{ textAlign: 'center', padding: '40px', color: 'var(--muted)', fontSize: '12px' }}>
                        Waiting for teams...
                      </td>
                    </tr>
                  ) : (
                    sorted.map(t => (
                      <tr key={t.id}>
                        <td><strong>{t.name}</strong></td>
                        {MISSIONS.map(m => {
                          const done = t.completed?.includes(m.id);
                          return (
                            <td key={m.id}>
                              <span className={`status-dot ${done ? 'dot-done' : 'dot-pending'}`} />
                              {done ? '✓' : '–'}
                            </td>
                          );
                        })}
                        <td className="pts-cell">{t.score}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'missions' && (
          <div className="fade-in">
            <div className="section-header">
              <h2 style={{ fontSize: '18px' }}>Visible Missions</h2>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn btn-ghost" style={{ padding: '6px 14px', fontSize: '12px' }} onClick={() => toggleAll(true)}>
                  All on
                </button>
                <button className="btn btn-ghost" style={{ padding: '6px 14px', fontSize: '12px' }} onClick={() => toggleAll(false)}>
                  All off
                </button>
              </div>
            </div>

            <p style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '20px' }}>
              Toggle which missions teams can see and play. Changes take effect immediately after saving.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px' }}>
              {MISSIONS.map(m => {
                const on = visibleIds.includes(m.id);
                return (
                  <div
                    key={m.id}
                    onClick={() => toggleMission(m.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '16px',
                      padding: '14px 20px',
                      background: 'var(--card)',
                      border: `1px solid ${on ? 'var(--accent)' : 'var(--border)'}`,
                      borderRadius: '10px',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      opacity: on ? 1 : 0.45,
                    }}
                  >
                    <span style={{ fontSize: '24px', flexShrink: 0 }}>{m.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: '14px' }}>{m.name}</div>
                      <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>{m.category} · {m.difficulty} · {m.maxPts} pts</div>
                    </div>
                    <div style={{
                      width: '44px', height: '24px', borderRadius: '12px',
                      background: on ? 'var(--accent)' : 'var(--border)',
                      position: 'relative', transition: 'background 0.2s', flexShrink: 0,
                    }}>
                      <div style={{
                        position: 'absolute', top: '3px',
                        left: on ? '23px' : '3px',
                        width: '18px', height: '18px', borderRadius: '50%',
                        background: '#fff', transition: 'left 0.2s',
                      }} />
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <button className="btn btn-primary" onClick={saveSettings} disabled={saving}>
                {saving ? 'SAVING...' : 'SAVE CHANGES →'}
              </button>
              {saveMsg && (
                <span style={{ fontSize: '13px', color: saveMsg.startsWith('✓') ? 'var(--accent3)' : 'var(--accent2)' }}>
                  {saveMsg}
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
