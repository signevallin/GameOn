'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import GameOnLogo from '@/components/GameOnLogo';

type Team = {
  id: string;
  name: string;
  score: number;
  pending_notification: { msgKey: string; params?: Record<string, unknown> } | null;
};

type Photo = {
  id: string;
  photo_url: string;
  team_id: string;
  created_at: string;
};

type Game = {
  name: string;
  status: 'draft' | 'active' | 'finished';
  started_at: string | null;
  duration_minutes: number;
};

type PresentData = {
  game: Game;
  teams: Team[];
  photos: Photo[];
};

function useTimer(game: Game | null): string {
  const [display, setDisplay] = useState('');
  const status = game?.status ?? null;
  const startedAt = game?.started_at ?? null;
  const durationMinutes = game?.duration_minutes ?? 0;

  useEffect(() => {
    if (!status) return;

    function compute() {
      if (status === 'finished') { setDisplay('Avslutat'); return; }
      if (status === 'draft' || !startedAt) { setDisplay(''); return; }
      const end = new Date(startedAt).getTime() + durationMinutes * 60 * 1000;
      const diff = Math.max(0, end - Date.now());
      if (diff === 0) { setDisplay('Avslutat'); return; }
      const m = Math.floor(diff / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setDisplay(`${m}:${String(s).padStart(2, '0')} kvar`);
    }

    compute();
    const id = setInterval(compute, 1000);
    return () => clearInterval(id);
  }, [status, startedAt, durationMinutes]);

  return display;
}

const RANK_MEDALS = ['🥇', '🥈', '🥉'];

function buildOverlay(msgKey: string, params: Record<string, unknown> = {}, teamName: string): { emoji: string; title: string; subtitle: string } | null {
  const p = params as Record<string, string | number>;
  switch (msgKey) {
    case 'frozen_msg':             return { emoji: '❄️', title: 'FRYST!', subtitle: `${teamName} frös ett annat lag` };
    case 'double_trouble_msg':     return { emoji: '😈', title: 'DOUBLE TROUBLE!', subtitle: `${teamName} måste slutföra extrauppdrag` };
    case 'shield_msg':             return { emoji: '🛡️', title: 'SKÖLD AKTIVERAD!', subtitle: `${teamName} skyddade sig` };
    case 'all_in_lost_msg':        return { emoji: '🎲', title: 'GAMBLADE BORT!', subtitle: `${teamName} förlorade ${p.wager ?? ''} poäng` };
    case 'all_in_won_msg':         return { emoji: '🎲', title: 'JACKPOT!', subtitle: `${teamName} vann ${p.prize ?? ''} poäng` };
    case 'point_steal_from_msg':   return { emoji: '🤑', title: 'POÄNGTJUV!', subtitle: `${p.stolen ?? ''} poäng stals från ${teamName}` };
    case 'point_steal_to_msg':     return { emoji: '🤑', title: 'POÄNGTJUV!', subtitle: `${teamName} stal ${p.stolen ?? ''} poäng` };
    case 'robin_hood_from_msg':    return { emoji: '🏹', title: 'ROBIN HOOD!', subtitle: `Poäng omfördelades från ${teamName}` };
    case 'robin_hood_to_msg':      return { emoji: '🏹', title: 'ROBIN HOOD!', subtitle: `${teamName} fick omfördelade poäng` };
    case 'robin_hood_self_msg':    return { emoji: '🏹', title: 'ROBIN HOOD!', subtitle: `${teamName} omfördelade poäng` };
    case 'duel_received_msg':      return { emoji: '⚔️', title: 'DUEL!', subtitle: `${teamName} attackerades — ${p.stolen ?? ''} poäng stals` };
    case 'photo_rated_earned':     return { emoji: '📸', title: 'FOTO GODKÄNT!', subtitle: `${teamName} fick ${p.points ?? ''} poäng` };
    case 'photo_rated_earned_item':return { emoji: '📸', title: 'FOTO GODKÄNT!', subtitle: `${teamName} fick ${p.points ?? ''} poäng` };
    case 'sabotage_msg':           return { emoji: '💥', title: 'SABOTAGE!', subtitle: 'Alla lag tappar 100 poäng' };
    case 'double_points_msg':      return { emoji: '⚡', title: 'DUBBLA POÄNG!', subtitle: 'Alla lag får dubbelt nu' };
    case 'final_frenzy_msg':       return { emoji: '🔥', title: 'FINAL FRENZY!', subtitle: 'Alla poäng dubbleras direkt' };
    case 'hot_potato_msg':         return { emoji: '🥔', title: 'HET POTATIS!', subtitle: `${teamName} fick en het potatis` };
    case 'hot_potato_penalty_msg': return { emoji: '🥔', title: 'HET POTATIS!', subtitle: `${teamName} brändes av potatisen` };
    default: return null;
  }
}

export default function PresentPage({ params }: { params: { gameKey: string } }) {
  const [data, setData] = useState<PresentData | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [notFound, setNotFound] = useState(false);
  const prevNotifications = useRef<Record<string, string>>({});
  const [overlay, setOverlay] = useState<{ emoji: string; title: string; subtitle: string } | null>(null);
  const overlayTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timer = useTimer(data?.game ?? null);

  // Prevent body scroll on this full-screen page
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Clear overlay timer on unmount
  useEffect(() => () => { if (overlayTimer.current) clearTimeout(overlayTimer.current); }, []);

  const showOverlay = useCallback((emoji: string, title: string, subtitle: string) => {
    if (overlayTimer.current) clearTimeout(overlayTimer.current);
    setOverlay({ emoji, title, subtitle });
    overlayTimer.current = setTimeout(() => setOverlay(null), 4000);
  }, []);

  const poll = useCallback(async () => {
    try {
      const res = await fetch(`/api/present/${params.gameKey}`, { method: 'POST' });
      if (res.status === 404) { setNotFound(true); return; }
      if (!res.ok) return;
      const json: PresentData = await res.json();
      setData(json);
      setLastUpdated(new Date());

      for (const team of json.teams) {
        const notif = team.pending_notification;
        if (!notif) continue;
        const key = JSON.stringify(notif);
        if (prevNotifications.current[team.id] !== key) {
          prevNotifications.current[team.id] = key;
          const ov = buildOverlay(notif.msgKey, notif.params ?? {}, team.name);
          if (ov) showOverlay(ov.emoji, ov.title, ov.subtitle);
        }
      }
    } catch {
      // silently retry next poll
    }
  }, [params.gameKey, showOverlay]);

  useEffect(() => {
    poll();
    const id = setInterval(poll, 4000);
    return () => clearInterval(id);
  }, [poll]);

  if (notFound) {
    return (
      <div style={{ minHeight: '100vh', background: '#0a0e19', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8FA8C0', fontFamily: "'Sora', sans-serif", fontSize: '24px' }}>
        Spelet hittades inte
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ minHeight: '100vh', background: '#0a0e19', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: '40px', height: '40px', border: '3px solid #7CBDD4', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  const { game, teams, photos } = data;

  return (
    <div style={{
      minHeight: '100vh', height: '100vh', overflow: 'hidden',
      background: '#0a0e19', color: '#DCE4EE',
      fontFamily: "'Sora', sans-serif",
      display: 'flex', flexDirection: 'column',
    }}>
      {/* TOP BAR */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 40px', height: '72px', flexShrink: 0,
        background: 'rgba(10,14,26,0.9)', borderBottom: '1px solid rgba(124,189,212,0.12)',
      }}>
        <GameOnLogo size={28} />
        <span style={{ fontWeight: 800, fontSize: '22px', letterSpacing: '-.03em' }}>{game.name}</span>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', minWidth: '160px' }}>
          <span style={{ fontWeight: 700, fontSize: '20px', color: game.status === 'finished' ? '#8FA8C0' : '#7CBDD4', letterSpacing: '1px' }}>
            {game.status === 'draft' ? 'Väntar på start' : `⏱ ${timer}`}
          </span>
          {lastUpdated && (
            <span style={{ fontSize: '10px', color: '#4a5e75', letterSpacing: '.04em' }}>
              {lastUpdated.toLocaleTimeString('sv-SE')}
            </span>
          )}
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Leaderboard ~30% */}
        <div style={{
          width: '30%', flexShrink: 0, padding: '32px 28px',
          borderRight: '1px solid rgba(124,189,212,0.1)',
          overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px',
        }}>
          <div style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '.18em', color: '#7CBDD4', marginBottom: '8px', textTransform: 'uppercase' }}>Leaderboard</div>
          {teams.map((team, i) => (
            <div key={team.id} style={{
              display: 'flex', alignItems: 'center', gap: '14px',
              padding: '14px 18px', borderRadius: '12px',
              background: i === 0 ? 'rgba(222,187,107,0.07)' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${i === 0 ? 'rgba(222,187,107,0.3)' : 'rgba(124,189,212,0.1)'}`,
            }}>
              <span style={{ fontSize: '22px', width: '32px', textAlign: 'center', flexShrink: 0 }}>
                {i < 3 ? RANK_MEDALS[i] : <span style={{ fontWeight: 800, fontSize: '16px', color: '#6e82a5' }}>{i + 1}</span>}
              </span>
              <span style={{ flex: 1, fontWeight: 700, fontSize: '16px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: i === 0 ? '#debb6b' : '#DCE4EE' }}>
                {team.name}
              </span>
              <span style={{ fontWeight: 800, fontSize: '18px', flexShrink: 0, color: i === 0 ? '#debb6b' : '#7CBDD4' }}>
                {team.score.toLocaleString('sv-SE')} p
              </span>
            </div>
          ))}
          {teams.length === 0 && (
            <div style={{ color: '#8FA8C0', fontSize: '14px', textAlign: 'center', marginTop: '40px' }}>Inga lag ännu</div>
          )}
        </div>

        {/* Photo grid ~70% */}
        <div style={{ flex: 1, padding: '32px', overflowY: 'auto' }}>
          <div style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '.18em', color: '#7CBDD4', marginBottom: '16px', textTransform: 'uppercase' }}>Godkända foton</div>
          {photos.length === 0 ? (
            <div style={{ color: '#8FA8C0', fontSize: '14px', textAlign: 'center', marginTop: '40px' }}>Inga foton ännu</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px' }}>
              {photos.map(photo => (
                <div key={photo.id} style={{ aspectRatio: '1', borderRadius: '10px', overflow: 'hidden', border: '1px solid rgba(124,189,212,0.15)' }}>
                  <img src={photo.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* POWER-UP OVERLAY */}
      {overlay && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(8,12,22,0.93)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          animation: 'overlayIn .35s cubic-bezier(.16,1,.3,1)',
        }}>
          <style>{`@keyframes overlayIn { from { opacity: 0; transform: scale(.92); } to { opacity: 1; transform: scale(1); } }`}</style>
          <div style={{ fontSize: '96px', lineHeight: 1, marginBottom: '24px' }}>{overlay.emoji}</div>
          <div style={{ fontSize: '52px', fontWeight: 900, letterSpacing: '-.02em', color: '#DCE4EE', marginBottom: '16px', textAlign: 'center' }}>{overlay.title}</div>
          <div style={{ fontSize: '26px', color: '#8FA8C0', fontWeight: 600, textAlign: 'center', maxWidth: '600px' }}>{overlay.subtitle}</div>
        </div>
      )}
    </div>
  );
}
