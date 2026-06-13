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
  language: string;
};

type Lang = 'en' | 'sv' | 'no' | 'da' | 'de' | 'fr';

const UI: Record<Lang, {
  leaderboard: string; approvedPhotos: string; noTeams: string;
  noPhotos: string; waiting: string; finished: string; timeLeft: string; pts: string;
}> = {
  en: { leaderboard: 'Leaderboard', approvedPhotos: 'Approved Photos', noTeams: 'No teams yet', noPhotos: 'No photos yet', waiting: 'Waiting to start', finished: 'Finished', timeLeft: 'left', pts: 'pts' },
  sv: { leaderboard: 'Topplista', approvedPhotos: 'Godkända foton', noTeams: 'Inga lag ännu', noPhotos: 'Inga foton ännu', waiting: 'Väntar på start', finished: 'Avslutat', timeLeft: 'kvar', pts: 'p' },
  no: { leaderboard: 'Ledertavle', approvedPhotos: 'Godkjente bilder', noTeams: 'Ingen lag ennå', noPhotos: 'Ingen bilder ennå', waiting: 'Venter på start', finished: 'Avsluttet', timeLeft: 'igjen', pts: 'p' },
  da: { leaderboard: 'Resultatliste', approvedPhotos: 'Godkendte billeder', noTeams: 'Ingen hold endnu', noPhotos: 'Ingen billeder endnu', waiting: 'Venter på start', finished: 'Afsluttet', timeLeft: 'tilbage', pts: 'p' },
  de: { leaderboard: 'Bestenliste', approvedPhotos: 'Freigegebene Fotos', noTeams: 'Noch keine Teams', noPhotos: 'Noch keine Fotos', waiting: 'Warte auf Start', finished: 'Beendet', timeLeft: 'übrig', pts: 'Pkt' },
  fr: { leaderboard: 'Classement', approvedPhotos: 'Photos approuvées', noTeams: 'Aucune équipe', noPhotos: 'Aucune photo', waiting: 'En attente', finished: 'Terminé', timeLeft: 'restant', pts: 'pts' },
};

const OV: Record<Lang, Record<string, { emoji: string; title: string; subtitle: (p: Record<string, string | number>, team: string) => string }>> = {
  en: {
    frozen_msg:             { emoji: '❄️', title: 'FROZEN!',          subtitle: (_, t) => `${t} has been frozen!` },
    inverterad_skarm_msg:   { emoji: '🪞', title: 'INVERTED SCREEN!', subtitle: (_, t) => `${t}'s screen is now mirrored!` },
    double_agent_msg:       { emoji: '🕵️', title: 'DOUBLE AGENT!',   subtitle: (_, t) => `${t} activated Double Agent — 90s of double points!` },
    shield_msg:             { emoji: '🛡️', title: 'SHIELD ACTIVE!',   subtitle: (_, t) => `${t} is protected` },
    all_in_lost_msg:        { emoji: '🎲', title: 'BET LOST!',        subtitle: (p, t) => `${t} lost ${p.wager ?? ''} pts` },
    all_in_won_msg:         { emoji: '🎲', title: 'JACKPOT!',         subtitle: (p, t) => `${t} won ${p.prize ?? ''} pts` },
    robin_hood_from_msg:    { emoji: '🏹', title: 'ROBIN HOOD!',      subtitle: (_, t) => `Points redistributed from ${t}` },
    robin_hood_to_msg:      { emoji: '🏹', title: 'ROBIN HOOD!',      subtitle: (_, t) => `${t} received redistributed points` },
    robin_hood_self_msg:    { emoji: '🏹', title: 'ROBIN HOOD!',      subtitle: (_, t) => `${t} redistributed points` },
    duel_received_msg:      { emoji: '⚔️', title: 'DUEL!',            subtitle: (p, t) => `${t} was attacked — ${p.stolen ?? ''} pts stolen` },
    photo_rated_earned:     { emoji: '📸', title: 'PHOTO APPROVED!',  subtitle: (p, t) => `${t} earned ${p.points ?? ''} pts` },
    photo_rated_earned_item:{ emoji: '📸', title: 'PHOTO APPROVED!',  subtitle: (p, t) => `${t} earned ${p.points ?? ''} pts` },
    sabotage_msg:           { emoji: '💥', title: 'SABOTAGE!',        subtitle: () => 'All teams lose 100 pts' },
    double_points_msg:      { emoji: '⚡', title: 'DOUBLE POINTS!',   subtitle: () => 'All teams get double points' },
    final_frenzy_msg:       { emoji: '🔥', title: 'FINAL FRENZY!',   subtitle: () => 'All points are now doubled' },
    hot_potato_msg:         { emoji: '🥔', title: 'HOT POTATO!',      subtitle: (_, t) => `${t} got a hot potato` },
    hot_potato_penalty_msg: { emoji: '🥔', title: 'HOT POTATO!',      subtitle: (_, t) => `${t} got burned` },
  },
  sv: {
    frozen_msg:             { emoji: '❄️', title: 'FRYST!',              subtitle: (_, t) => `${t} har frysts!` },
    inverterad_skarm_msg:   { emoji: '🪞', title: 'INVERTERAD SKÄRM!',  subtitle: (_, t) => `${t}s skärm är nu spegelvänd!` },
    double_agent_msg:       { emoji: '🕵️', title: 'DOUBLE AGENT!',       subtitle: (_, t) => `${t} aktiverade Double Agent — 90s dubbla poäng!` },
    shield_msg:             { emoji: '🛡️', title: 'SKÖLD AKTIVERAD!',    subtitle: (_, t) => `${t} skyddade sig` },
    all_in_lost_msg:        { emoji: '🎲', title: 'GAMBLADE BORT!',      subtitle: (p, t) => `${t} förlorade ${p.wager ?? ''} poäng` },
    all_in_won_msg:         { emoji: '🎲', title: 'JACKPOT!',            subtitle: (p, t) => `${t} vann ${p.prize ?? ''} poäng` },
    robin_hood_from_msg:    { emoji: '🏹', title: 'ROBIN HOOD!',         subtitle: (_, t) => `Poäng omfördelades från ${t}` },
    robin_hood_to_msg:      { emoji: '🏹', title: 'ROBIN HOOD!',         subtitle: (_, t) => `${t} fick omfördelade poäng` },
    robin_hood_self_msg:    { emoji: '🏹', title: 'ROBIN HOOD!',         subtitle: (_, t) => `${t} omfördelade poäng` },
    duel_received_msg:      { emoji: '⚔️', title: 'DUEL!',               subtitle: (p, t) => `${t} attackerades — ${p.stolen ?? ''} poäng stals` },
    photo_rated_earned:     { emoji: '📸', title: 'FOTO GODKÄNT!',       subtitle: (p, t) => `${t} fick ${p.points ?? ''} poäng` },
    photo_rated_earned_item:{ emoji: '📸', title: 'FOTO GODKÄNT!',       subtitle: (p, t) => `${t} fick ${p.points ?? ''} poäng` },
    sabotage_msg:           { emoji: '💥', title: 'SABOTAGE!',           subtitle: () => 'Alla lag tappar 100 poäng' },
    double_points_msg:      { emoji: '⚡', title: 'DUBBLA POÄNG!',       subtitle: () => 'Alla lag får dubbelt nu' },
    final_frenzy_msg:       { emoji: '🔥', title: 'FINAL FRENZY!',       subtitle: () => 'Alla poäng dubbleras direkt' },
    hot_potato_msg:         { emoji: '🥔', title: 'HET POTATIS!',         subtitle: (_, t) => `${t} fick en het potatis` },
    hot_potato_penalty_msg: { emoji: '🥔', title: 'HET POTATIS!',         subtitle: (_, t) => `${t} brändes av potatisen` },
  },
  no: {
    frozen_msg:             { emoji: '❄️', title: 'FRYST!',              subtitle: (_, t) => `${t} har blitt fryst!` },
    inverterad_skarm_msg:   { emoji: '🪞', title: 'INVERTERT SKJERM!',  subtitle: (_, t) => `${t}s skjerm er nå speilvendt!` },
    double_agent_msg:       { emoji: '🕵️', title: 'DOUBLE AGENT!',       subtitle: (_, t) => `${t} aktiverte Double Agent — 90s doble poeng!` },
    shield_msg:             { emoji: '🛡️', title: 'SKJOLD AKTIVERT!',    subtitle: (_, t) => `${t} beskyttet seg` },
    all_in_lost_msg:        { emoji: '🎲', title: 'TAPTE INNSATSEN!',    subtitle: (p, t) => `${t} tapte ${p.wager ?? ''} poeng` },
    all_in_won_msg:         { emoji: '🎲', title: 'JACKPOT!',            subtitle: (p, t) => `${t} vant ${p.prize ?? ''} poeng` },
    robin_hood_from_msg:    { emoji: '🏹', title: 'ROBIN HOOD!',         subtitle: (_, t) => `Poeng omfordelt fra ${t}` },
    robin_hood_to_msg:      { emoji: '🏹', title: 'ROBIN HOOD!',         subtitle: (_, t) => `${t} fikk omfordelte poeng` },
    robin_hood_self_msg:    { emoji: '🏹', title: 'ROBIN HOOD!',         subtitle: (_, t) => `${t} omfordelte poeng` },
    duel_received_msg:      { emoji: '⚔️', title: 'DUELL!',              subtitle: (p, t) => `${t} ble angrepet — ${p.stolen ?? ''} poeng stjålet` },
    photo_rated_earned:     { emoji: '📸', title: 'FOTO GODKJENT!',      subtitle: (p, t) => `${t} fikk ${p.points ?? ''} poeng` },
    photo_rated_earned_item:{ emoji: '📸', title: 'FOTO GODKJENT!',      subtitle: (p, t) => `${t} fikk ${p.points ?? ''} poeng` },
    sabotage_msg:           { emoji: '💥', title: 'SABOTASJE!',          subtitle: () => 'Alle lag mister 100 poeng' },
    double_points_msg:      { emoji: '⚡', title: 'DOBLE POENG!',        subtitle: () => 'Alle lag får dobbelt nå' },
    final_frenzy_msg:       { emoji: '🔥', title: 'FINAL FRENZY!',       subtitle: () => 'Alle poeng dobles direkte' },
    hot_potato_msg:         { emoji: '🥔', title: 'VARM POTET!',          subtitle: (_, t) => `${t} fikk en varm potet` },
    hot_potato_penalty_msg: { emoji: '🥔', title: 'VARM POTET!',          subtitle: (_, t) => `${t} ble brent av poteten` },
  },
  da: {
    frozen_msg:             { emoji: '❄️', title: 'FROSSET!',            subtitle: (_, t) => `${t} er blevet frosset!` },
    inverterad_skarm_msg:   { emoji: '🪞', title: 'INVERTERET SKÆRM!',  subtitle: (_, t) => `${t}s skærm er nu spejlvendt!` },
    double_agent_msg:       { emoji: '🕵️', title: 'DOUBLE AGENT!',       subtitle: (_, t) => `${t} aktiverede Double Agent — 90s dobbelt point!` },
    shield_msg:             { emoji: '🛡️', title: 'SKJOLD AKTIVERET!',   subtitle: (_, t) => `${t} beskyttede sig` },
    all_in_lost_msg:        { emoji: '🎲', title: 'TABTE INDSATSEN!',    subtitle: (p, t) => `${t} tabte ${p.wager ?? ''} point` },
    all_in_won_msg:         { emoji: '🎲', title: 'JACKPOT!',            subtitle: (p, t) => `${t} vandt ${p.prize ?? ''} point` },
    robin_hood_from_msg:    { emoji: '🏹', title: 'ROBIN HOOD!',         subtitle: (_, t) => `Point omfordelt fra ${t}` },
    robin_hood_to_msg:      { emoji: '🏹', title: 'ROBIN HOOD!',         subtitle: (_, t) => `${t} modtog omfordelte point` },
    robin_hood_self_msg:    { emoji: '🏹', title: 'ROBIN HOOD!',         subtitle: (_, t) => `${t} omfordelte point` },
    duel_received_msg:      { emoji: '⚔️', title: 'DUEL!',               subtitle: (p, t) => `${t} blev angrebet — ${p.stolen ?? ''} point stjålet` },
    photo_rated_earned:     { emoji: '📸', title: 'FOTO GODKENDT!',      subtitle: (p, t) => `${t} fik ${p.points ?? ''} point` },
    photo_rated_earned_item:{ emoji: '📸', title: 'FOTO GODKENDT!',      subtitle: (p, t) => `${t} fik ${p.points ?? ''} point` },
    sabotage_msg:           { emoji: '💥', title: 'SABOTAGE!',           subtitle: () => 'Alle hold mister 100 point' },
    double_points_msg:      { emoji: '⚡', title: 'DOBBELT POINT!',      subtitle: () => 'Alle hold får dobbelt nu' },
    final_frenzy_msg:       { emoji: '🔥', title: 'FINAL FRENZY!',       subtitle: () => 'Alle point fordobles direkte' },
    hot_potato_msg:         { emoji: '🥔', title: 'VARM KARTOFFEL!',      subtitle: (_, t) => `${t} fik en varm kartoffel` },
    hot_potato_penalty_msg: { emoji: '🥔', title: 'VARM KARTOFFEL!',      subtitle: (_, t) => `${t} blev brændt af kartoflen` },
  },
  de: {
    frozen_msg:             { emoji: '❄️', title: 'EINGEFROREN!',        subtitle: (_, t) => `${t} wurde eingefroren!` },
    inverterad_skarm_msg:   { emoji: '🪞', title: 'INVERTIERTER BILDSCHIRM!', subtitle: (_, t) => `${t}s Bildschirm ist jetzt gespiegelt!` },
    double_agent_msg:       { emoji: '🕵️', title: 'DOUBLE AGENT!',       subtitle: (_, t) => `${t} hat Double Agent aktiviert — 90s doppelte Punkte!` },
    shield_msg:             { emoji: '🛡️', title: 'SCHILD AKTIV!',       subtitle: (_, t) => `${t} ist geschützt` },
    all_in_lost_msg:        { emoji: '🎲', title: 'VERLOREN!',           subtitle: (p, t) => `${t} verlor ${p.wager ?? ''} Punkte` },
    all_in_won_msg:         { emoji: '🎲', title: 'JACKPOT!',            subtitle: (p, t) => `${t} gewann ${p.prize ?? ''} Punkte` },
    robin_hood_from_msg:    { emoji: '🏹', title: 'ROBIN HOOD!',         subtitle: (_, t) => `Punkte umverteilt von ${t}` },
    robin_hood_to_msg:      { emoji: '🏹', title: 'ROBIN HOOD!',         subtitle: (_, t) => `${t} erhielt umverteilte Punkte` },
    robin_hood_self_msg:    { emoji: '🏹', title: 'ROBIN HOOD!',         subtitle: (_, t) => `${t} verteilte Punkte um` },
    duel_received_msg:      { emoji: '⚔️', title: 'DUELL!',              subtitle: (p, t) => `${t} wurde angegriffen — ${p.stolen ?? ''} Pkt gestohlen` },
    photo_rated_earned:     { emoji: '📸', title: 'FOTO GENEHMIGT!',     subtitle: (p, t) => `${t} erhielt ${p.points ?? ''} Pkt` },
    photo_rated_earned_item:{ emoji: '📸', title: 'FOTO GENEHMIGT!',     subtitle: (p, t) => `${t} erhielt ${p.points ?? ''} Pkt` },
    sabotage_msg:           { emoji: '💥', title: 'SABOTAGE!',           subtitle: () => 'Alle Teams verlieren 100 Pkt' },
    double_points_msg:      { emoji: '⚡', title: 'DOPPELTE PUNKTE!',    subtitle: () => 'Alle Teams bekommen jetzt doppelt' },
    final_frenzy_msg:       { emoji: '🔥', title: 'FINAL FRENZY!',       subtitle: () => 'Alle Punkte werden verdoppelt' },
    hot_potato_msg:         { emoji: '🥔', title: 'HEISSE KARTOFFEL!',    subtitle: (_, t) => `${t} hat eine heiße Kartoffel` },
    hot_potato_penalty_msg: { emoji: '🥔', title: 'HEISSE KARTOFFEL!',    subtitle: (_, t) => `${t} wurde verbrannt` },
  },
  fr: {
    frozen_msg:             { emoji: '❄️', title: 'GELÉ!',               subtitle: (_, t) => `${t} a été gelé!` },
    inverterad_skarm_msg:   { emoji: '🪞', title: 'ÉCRAN INVERSÉ!',      subtitle: (_, t) => `L'écran de ${t} est maintenant en miroir!` },
    double_agent_msg:       { emoji: '🕵️', title: 'DOUBLE AGENT!',       subtitle: (_, t) => `${t} a activé Double Agent — 90s de points doublés!` },
    shield_msg:             { emoji: '🛡️', title: 'BOUCLIER ACTIF!',     subtitle: (_, t) => `${t} est protégé` },
    all_in_lost_msg:        { emoji: '🎲', title: 'PARI PERDU!',         subtitle: (p, t) => `${t} a perdu ${p.wager ?? ''} pts` },
    all_in_won_msg:         { emoji: '🎲', title: 'JACKPOT!',            subtitle: (p, t) => `${t} a gagné ${p.prize ?? ''} pts` },
    robin_hood_from_msg:    { emoji: '🏹', title: 'ROBIN HOOD!',         subtitle: (_, t) => `Points redistribués depuis ${t}` },
    robin_hood_to_msg:      { emoji: '🏹', title: 'ROBIN HOOD!',         subtitle: (_, t) => `${t} a reçu des points redistribués` },
    robin_hood_self_msg:    { emoji: '🏹', title: 'ROBIN HOOD!',         subtitle: (_, t) => `${t} a redistribué des points` },
    duel_received_msg:      { emoji: '⚔️', title: 'DUEL!',               subtitle: (p, t) => `${t} attaqué — ${p.stolen ?? ''} pts volés` },
    photo_rated_earned:     { emoji: '📸', title: 'PHOTO APPROUVÉE!',    subtitle: (p, t) => `${t} a gagné ${p.points ?? ''} pts` },
    photo_rated_earned_item:{ emoji: '📸', title: 'PHOTO APPROUVÉE!',    subtitle: (p, t) => `${t} a gagné ${p.points ?? ''} pts` },
    sabotage_msg:           { emoji: '💥', title: 'SABOTAGE!',           subtitle: () => 'Toutes les équipes perdent 100 pts' },
    double_points_msg:      { emoji: '⚡', title: 'DOUBLE POINTS!',      subtitle: () => 'Toutes les équipes ont le double' },
    final_frenzy_msg:       { emoji: '🔥', title: 'FINAL FRENZY!',       subtitle: () => 'Tous les points sont doublés' },
    hot_potato_msg:         { emoji: '🥔', title: 'PATATE CHAUDE!',       subtitle: (_, t) => `${t} a reçu une patate chaude` },
    hot_potato_penalty_msg: { emoji: '🥔', title: 'PATATE CHAUDE!',       subtitle: (_, t) => `${t} s'est brûlé` },
  },
};

function getLang(language: string): Lang {
  return (language in UI ? language : 'en') as Lang;
}

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
  const language = game?.language ?? 'en';

  useEffect(() => {
    if (!status) return;
    const ui = UI[getLang(language)];

    function compute() {
      if (status === 'finished') { setDisplay(ui.finished); return; }
      if (status === 'draft' || !startedAt) { setDisplay(''); return; }
      const end = new Date(startedAt).getTime() + durationMinutes * 60 * 1000;
      const diff = Math.max(0, end - Date.now());
      if (diff === 0) { setDisplay(ui.finished); return; }
      const m = Math.floor(diff / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setDisplay(`${m}:${String(s).padStart(2, '0')}`);
    }

    compute();
    const id = setInterval(compute, 1000);
    return () => clearInterval(id);
  }, [status, startedAt, durationMinutes, language]);

  return display;
}

const RANK_MEDALS = ['🥇', '🥈', '🥉'];

function buildOverlay(
  msgKey: string,
  params: Record<string, unknown> = {},
  teamName: string,
  lang: Lang
): { emoji: string; title: string; subtitle: string } | null {
  const p = params as Record<string, string | number>;
  const entry = OV[lang]?.[msgKey] ?? OV['en'][msgKey];
  if (!entry) return null;
  return { emoji: entry.emoji, title: entry.title, subtitle: entry.subtitle(p, teamName) };
}

export default function PresentPage({ params }: { params: { gameKey: string } }) {
  const [data, setData] = useState<PresentData | null>(null);
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

      for (const team of json.teams) {
        const notif = team.pending_notification;
        if (!notif) continue;
        const key = JSON.stringify(notif);
        if (prevNotifications.current[team.id] !== key) {
          prevNotifications.current[team.id] = key;
          const lang = getLang(json.game.language);
          const ov = buildOverlay(notif.msgKey, notif.params ?? {}, team.name, lang);
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
  const lang = getLang(game.language);
  const ui = UI[lang];

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
        <span style={{ fontWeight: 700, fontSize: '20px', color: game.status === 'finished' ? '#8FA8C0' : '#8cbf9b', letterSpacing: '1px', minWidth: '160px', textAlign: 'right' }}>
          {game.status === 'draft' ? ui.waiting : `⏱ ${timer}`}
        </span>
      </div>

      {/* MAIN CONTENT */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Leaderboard ~30% */}
        <div style={{
          width: '30%', flexShrink: 0, padding: '32px 28px',
          borderRight: '1px solid rgba(124,189,212,0.1)',
          overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px',
        }}>
          <div style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '.18em', color: '#7CBDD4', marginBottom: '8px', textTransform: 'uppercase' }}>{ui.leaderboard}</div>
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
                {team.score.toLocaleString()} {ui.pts}
              </span>
            </div>
          ))}
          {teams.length === 0 && (
            <div style={{ color: '#8FA8C0', fontSize: '14px', textAlign: 'center', marginTop: '40px' }}>{ui.noTeams}</div>
          )}
        </div>

        {/* Photo grid ~70% */}
        <div style={{ flex: 1, padding: '32px', overflowY: 'auto' }}>
          <div style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '.18em', color: '#7CBDD4', marginBottom: '16px', textTransform: 'uppercase' }}>{ui.approvedPhotos}</div>
          {photos.length === 0 ? (
            <div style={{ color: '#8FA8C0', fontSize: '14px', textAlign: 'center', marginTop: '40px' }}>{ui.noPhotos}</div>
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
