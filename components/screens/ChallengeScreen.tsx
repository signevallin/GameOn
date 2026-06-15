'use client';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Mission, calcPoints, MISSIONS } from '@/lib/missions';
import { Team, Game } from '@/lib/supabase';
import MultipleChoice from '@/components/games/MultipleChoice';
import TextInput from '@/components/games/TextInput';
import MemoryGame from '@/components/games/MemoryGame';
import ReactionTest from '@/components/games/ReactionTest';
import TypeRace from '@/components/games/TypeRace';
import Hangman from '@/components/games/Hangman';
import WouldYou from '@/components/games/WouldYou';
import TrueFalse from '@/components/games/TrueFalse';
import PhotoChallenge from '@/components/games/PhotoChallenge';
import PaSparet from '@/components/games/PaSparet';
import SolveCrime from '@/components/games/SolveCrime';
import CelebrityQuiz from '@/components/games/CelebrityQuiz';
import MusicEmoji from '@/components/games/MusicEmoji';
import CrackCode from '@/components/games/CrackCode';
import MusicQuiz from '@/components/games/MusicQuiz';
import ImageQuiz from '@/components/games/ImageQuiz';
import MemorySpeed from '@/components/games/MemorySpeed';
import ColorMemory from '@/components/games/ColorMemory';
import PixelReveal from '@/components/games/PixelReveal';
import ZoomIn from '@/components/games/ZoomIn';
import SimonSays from '@/components/games/SimonSays';
import TimelineSort from '@/components/games/TimelineSort';
import ClosestWins from '@/components/games/ClosestWins';
import DuelTrivia from '@/components/games/DuelTrivia';
import ScavengerHunt from '@/components/games/ScavengerHunt';
import TriviaQuiz from '@/components/games/TriviaQuiz';
import MovieEmoji from '@/components/games/MovieEmoji';
import TextQuiz from '@/components/games/TextQuiz';
import RelayMission from '@/components/games/RelayMission';
import SharedSecret from '@/components/games/SharedSecret';

type Props = {
  missionId: string;
  team: Team;
  game: Game;
  teams?: Team[];
  customMissions?: Mission[];
  memberId?: string;
  navBroadcastRoundIdx?: number;
  onNavRoundAdvance?: (idx: number) => void;
  onNavRoundClear?: () => void;
  onDone: (updatedTeam: Team, pts: number, correct: boolean, elapsed: number) => void;
  onBack: () => void;
};

export default function ChallengeScreen({ missionId, team, game, teams = [], customMissions = [], memberId = '', navBroadcastRoundIdx = 0, onNavRoundAdvance, onNavRoundClear, onDone, onBack }: Props) {
  const { t } = useTranslation();
  const { t: tMissions } = useTranslation('missions');
  const mission = (MISSIONS.find(m => m.id === missionId) ?? customMissions.find(m => m.id === missionId))!;
  const effectiveMaxPts = game.mission_max_pts?.[missionId] ?? mission.maxPts;

  // ── Remote round-index sync ─────────────────────────────────────────────────
  // Two-layer sync so Player B stays in step with Player A:
  //   1. Nav channel broadcast (play/page.tsx) — instant, uses the already-subscribed
  //      nav WebSocket so there is no subscription race condition.
  //   2. relay_state via main 3 s poll — fallback for late-joiners / reconnects.
  // navBroadcastRoundIdx comes from play/page.tsx (updated when 'round' event arrives).
  // pollRoundIdx comes from team.relay_state written by advanceRemoteRound below.

  const remoteEnabled = !!(memberId && game.remote_mode);

  const relayState = (team as { relay_state?: Record<string, { qIdx?: number }> }).relay_state ?? {};
  const pollRoundIdx = remoteEnabled ? (relayState[`__round_${missionId}`]?.qIdx ?? 0) : 0;
  const remoteRoundIdx = Math.max(pollRoundIdx, navBroadcastRoundIdx);

  function advanceRemoteRound(idx: number) {
    if (!remoteEnabled) return;
    // Broadcast instantly via the nav channel (already subscribed in play/page.tsx)
    onNavRoundAdvance?.(idx);
    // Also persist to DB so late-joiners and the 3 s poll catch up
    fetch('/api/team/round', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teamId: team.id, missionId, qIdx: idx }),
    }).catch(() => {});
  }

  function clearRemoteRound() {
    if (!remoteEnabled) return;
    onNavRoundClear?.();
    fetch(`/api/team/round?teamId=${encodeURIComponent(team.id)}&missionId=${encodeURIComponent(missionId)}`, {
      method: 'DELETE',
    }).catch(() => {});
  }
  const [elapsed, setElapsed] = useState(0);
  const elapsedRef = useRef(0);
  const startedAtMsRef = useRef(Date.now());
  const [photoSubmitted, setPhotoSubmitted] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      elapsedRef.current += 1;
      setElapsed(e => e + 1);
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const display = elapsed < 60
    ? `${elapsed}s`
    : `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')}`;

  async function finish(correct: boolean, customPts?: number) {
    const pts = correct
      ? (customPts !== undefined ? customPts : calcPoints(mission, elapsedRef.current, effectiveMaxPts))
      : 0;

    if (team.completed?.includes(missionId)) {
      onDone(team, 0, correct, elapsedRef.current);
      return;
    }

    try {
      const res = await fetch('/api/team/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId: team.id, missionId, points: pts }),
      });
      const data = await res.json();
      // Use the actual awarded pts from the server (may be doubled by powerup)
      const actualPts = data.team?.mission_scores?.[missionId] ?? pts;
      onDone(data.team ?? team, actualPts, correct, elapsedRef.current);
    } catch {
      onDone(team, pts, correct, elapsedRef.current);
    }
  }

  function renderGame() {
    switch (mission.type) {
      case 'multiple_choice':
        return <MultipleChoice mission={mission} onFinish={finish} />;
      case 'text_input':
        return <TextInput mission={mission} onFinish={finish} />;
      case 'memory':
        return <MemoryGame onFinish={finish} />;
      case 'reaction':
        return <ReactionTest maxPts={effectiveMaxPts} missionId={missionId} onFinish={(correct, pts) => finish(correct, pts)} />;
      case 'typerace':
        return <TypeRace text={mission.text!} onFinish={finish} />;
      case 'hangman':
        return <Hangman word={mission.word!} hint={mission.hint!} onFinish={finish} />;
      case 'wouldyou':
        return <WouldYou question={mission.question!} maxPts={effectiveMaxPts} teamId={team.id} missionId={missionId} onFinish={(correct, pts) => finish(correct, pts)} />;
      case 'truefalse':
        return <TrueFalse statements={mission.statements!} maxPts={effectiveMaxPts} remoteRoundIdx={remoteRoundIdx} onRoundAdvance={advanceRemoteRound} onClearRound={clearRemoteRound} onFinish={(correct, pts) => finish(correct, pts)} />;
      case 'photo':
        if (photoSubmitted) {
          return (
            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
              <div style={{ fontSize: '56px', marginBottom: '16px' }}>⏳</div>
              <h2 style={{ marginBottom: '12px' }}>{t('challenge.photoSubmittedTitle')}</h2>
              <p style={{ color: 'var(--muted)', fontSize: '14px', marginBottom: '32px' }}>
                {t('challenge.photoWaiting')}
              </p>
              <button className="btn btn-primary" onClick={onBack}>{t('challenge.backToMissionsBtn')}</button>
            </div>
          );
        }
        return (
          <PhotoChallenge
            question={mission.question!}
            missionId={missionId}
            team={team}
            onSubmitted={() => setPhotoSubmitted(true)}
            revealWord={mission.revealWord}
            hexColour={mission.hexColour}
          />
        );
      case 'pa_sparet':
        return (
          <PaSparet
            clues={mission.clues!}
            answer={mission.answer!}
            maxPts={effectiveMaxPts}
            placeholder={mission.id === 'pa_sparet_destination' ? t('challenge.paSparet_city') : t('challenge.paSparet_person')}
            onFinish={(correct, pts) => finish(correct, pts)}
          />
        );
      case 'solve_crime':
        return (
          <SolveCrime
            story={mission.crimeStory!}
            questions={mission.crimeQuestions!}
            maxPts={effectiveMaxPts}
            onFinish={(correct, pts) => finish(correct, pts)}
          />
        );
      case 'celebrity_quiz':
        return (
          <CelebrityQuiz
            rounds={mission.celebRounds!}
            maxPts={effectiveMaxPts}
            onFinish={(correct, pts) => finish(correct, pts)}
          />
        );
      case 'music_emoji':
        return (
          <MusicEmoji
            rounds={mission.emojiRounds!}
            maxPts={effectiveMaxPts}
            onFinish={(correct, pts) => finish(correct, pts)}
          />
        );
      case 'crack_code':
        return (
          <CrackCode
            clues={mission.codeClues!}
            answer={mission.answer!}
            onFinish={finish}
          />
        );
      case 'music_quiz':
        return (
          <MusicQuiz
            rounds={mission.musicRounds!}
            maxPts={effectiveMaxPts}
            onFinish={(correct, pts) => finish(correct, pts)}
          />
        );
      case 'image_quiz':
        return (
          <ImageQuiz
            rounds={mission.imageRounds!}
            maxPts={effectiveMaxPts}
            onFinish={(correct, pts) => finish(correct, pts)}
          />
        );
      case 'memory_speed':
        return (
          <MemorySpeed
            rounds={mission.memorySpeedRounds!}
            maxPts={effectiveMaxPts}
            onFinish={(correct, pts) => finish(correct, pts)}
          />
        );
      case 'color_memory':
        return <ColorMemory maxPts={effectiveMaxPts} onFinish={(correct, pts) => finish(correct, pts)} />;
      case 'pixel_reveal':
        return <PixelReveal maxPts={effectiveMaxPts} onFinish={(correct, pts) => finish(correct, pts)} />;
      case 'zoom_in':
        return <ZoomIn maxPts={effectiveMaxPts} onFinish={(correct, pts) => finish(correct, pts)} />;
      case 'simon_says':
        return <SimonSays maxPts={effectiveMaxPts} onFinish={(correct, pts) => finish(correct, pts)} />;
      case 'timeline':
        return <TimelineSort maxPts={effectiveMaxPts} items={mission.timelineItems} teamId={memberId ? team.id : undefined} missionId={memberId ? missionId : undefined} onFinish={(correct, pts) => finish(correct, pts)} />;
      case 'closest_wins':
        return <ClosestWins maxPts={effectiveMaxPts} questions={mission.closestWinsQuestions} teamId={memberId ? team.id : undefined} missionId={memberId ? missionId : undefined} onFinish={(correct, pts) => finish(correct, pts)} />;
      case 'trivia_quiz':
        return <TriviaQuiz rounds={mission.triviaRounds!} maxPts={effectiveMaxPts} remoteRoundIdx={remoteRoundIdx} onRoundAdvance={advanceRemoteRound} onClearRound={clearRemoteRound} onFinish={(correct, pts) => finish(correct, pts)} />;
      case 'movie_emoji':
        return <MovieEmoji rounds={mission.emojiRounds!} maxPts={effectiveMaxPts} remoteRoundIdx={remoteRoundIdx} onRoundAdvance={advanceRemoteRound} onClearRound={clearRemoteRound} onFinish={(correct, pts) => finish(correct, pts)} />;
      case 'text_quiz':
        return <TextQuiz rounds={mission.textQuizRounds!} maxPts={effectiveMaxPts} remoteRoundIdx={remoteRoundIdx} onRoundAdvance={advanceRemoteRound} onClearRound={clearRemoteRound} onFinish={(correct, pts) => finish(correct, pts)} />;
      case 'duel_trivia':
        return <DuelTrivia team={team} teams={teams} onFinish={(correct, pts) => finish(correct, pts)} />;
      case 'scavenger_hunt':
        return <ScavengerHunt team={team} gameId={game.id} missionId={missionId} onBack={onBack} />;
      case 'relay':
        return (
          <RelayMission
            mission={mission}
            team={team}
            game={game}
            memberId={memberId}
            effectiveMaxPts={effectiveMaxPts}
            onFinish={(correct, pts) => finish(correct, pts)}
          />
        );
      case 'shared_secret':
        return (
          <SharedSecret
            mission={mission}
            team={team}
            game={game}
            memberId={memberId}
            effectiveMaxPts={effectiveMaxPts}
            startedAtMs={startedAtMsRef.current}
            onFinish={(correct, pts) => finish(correct, pts)}
          />
        );
      default:
        return null;
    }
  }

  return (
    <>
      <nav className="nav">
        <div className="nav-brand">{mission.icon} {tMissions(`${mission.id}.name`, { defaultValue: mission.name })}</div>
        <div className="nav-right">
          <span className="nav-score">⭐ {team.score} {t('challenge.ptsLabel')}</span>
          <button className="btn btn-ghost" style={{ padding: '8px 16px', fontSize: '12px' }} onClick={onBack}>
            {t('challenge.backToMissions')}
          </button>
        </div>
      </nav>

      <div className="challenge-wrap fade-in">
        <div className="challenge-header">
          <div>
            <h2>{tMissions(`${mission.id}.name`, { defaultValue: mission.name })}</h2>
            <p style={{ color: 'var(--muted)', marginTop: '6px', fontSize: '14px' }}>{tMissions(`${mission.id}.desc`, { defaultValue: mission.desc ?? '' })}</p>
          </div>
          <div className="timer-box">
            <div className="timer-label">{t('challenge.timerLabel')}</div>
            <div className={`timer-value${elapsed > 60 ? ' urgent' : ''}`}>{display}</div>
          </div>
        </div>

        <div className="challenge-card">
          {renderGame()}
        </div>
      </div>
    </>
  );
}
