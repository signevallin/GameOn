'use client';
import { useCallback, useEffect, useState } from 'react';
import { MISSIONS } from '@/lib/missions';
import { Team } from '@/lib/supabase';

type Props = { onLogout: () => void };

const RANK_ICONS = ['🥇', '🥈', '🥉'];
const RANK_COLORS = ['var(--gold)', 'var(--silver)', 'var(--bronze)'];

export default function AdminScreen({ onLogout }: Props) {
  const [tab, setTab] = useState<'leaderboard' | 'progress'>('leaderboard');
  const [teams, setTeams] = useState<Team[]>([]);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/teams');
      const data = await res.json();
      if (data.teams) setTeams(data.teams);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, [load]);

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
      </div>
    </>
  );
}
