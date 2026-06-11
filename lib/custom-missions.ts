// lib/custom-missions.ts
import { Mission } from '@/lib/missions';
import { CustomMission } from '@/lib/supabase';

/**
 * Converts a CustomMission DB row into the Mission shape
 * the game components expect. All game components work unchanged.
 */
export function toMission(cm: CustomMission): Mission {
  const base = {
    id: cm.id,
    icon: cm.icon,
    name: cm.name,
    category: cm.category_name,
    desc: cm.desc,
    difficulty: cm.difficulty as Mission['difficulty'],
    maxPts: cm.max_pts,
    type: cm.type as Mission['type'],
  };

  const d = cm.data as Record<string, unknown>;

  switch (cm.type) {
    case 'trivia_quiz':
      return { ...base, triviaRounds: (d.rounds as Mission['triviaRounds']) ?? [] };
    case 'truefalse':
      return { ...base, statements: (d.statements as Mission['statements']) ?? [] };
    case 'closest_wins':
      return { ...base, closestWinsQuestions: (d.questions as Mission['closestWinsQuestions']) ?? [] };
    case 'pa_sparet':
      return { ...base, clues: (d.clues as string[]) ?? [], answer: d.answer as string };
    case 'timeline':
      return { ...base, timelineItems: (d.items as Mission['timelineItems']) ?? [] };
    case 'photo':
      return { ...base, question: d.prompt as string };
    case 'relay':
      return {
        ...base,
        relayMode: (d.relayMode as 'typerace' | 'button') ?? 'button',
        segments: ((d.segments as string[]) ?? []).map((p: string) => ({ prompt: p })),
      };
    case 'shared_secret':
      return {
        ...base,
        clues: (d.clues as string[]) ?? [],
        answer: d.answer as string,
        hint: (d.hint as string) || undefined,
      };
    default:
      return base as Mission;
  }
}

/** Returns an error string or null if valid. */
export function validateMissionData(
  type: string,
  data: {
    triviaRounds: { question: string; options: string[]; answer: string }[];
    statements: { text: string; answer: boolean }[];
    closestQuestions: { q: string; answer: string; unit: string; hint: string }[];
    clues: string[];
    paAnswer: string;
    timelineItems: { label: string; year: string }[];
    photoPrompt: string;
    relaySegments?: string[];
    relayMode?: string;
    sharedSecretAnswer?: string;
    sharedSecretHint?: string;
  }
): string | null {
  switch (type) {
    case 'trivia_quiz':
      if (data.triviaRounds.length < 1) return 'Add at least 1 question.';
      for (const r of data.triviaRounds) {
        if (!r.question.trim()) return 'All questions need text.';
        if (r.options.some(o => !o.trim())) return 'All 4 options are required.';
        if (!r.answer) return 'Select the correct answer for each question.';
      }
      return null;
    case 'truefalse':
      if (data.statements.length < 2) return 'Add at least 2 statements.';
      for (const s of data.statements) {
        if (!s.text.trim()) return 'All statements need text.';
      }
      return null;
    case 'closest_wins':
      if (data.closestQuestions.length < 1) return 'Add at least 1 question.';
      for (const q of data.closestQuestions) {
        if (!q.q.trim()) return 'All questions need text.';
        if (!q.answer || isNaN(Number(q.answer))) return 'Answer must be a number.';
      }
      return null;
    case 'pa_sparet':
      if (data.clues.length < 2) return 'Add at least 2 clues.';
      if (data.clues.some(c => !c.trim())) return 'All clues need text.';
      if (!data.paAnswer.trim()) return 'Answer is required.';
      return null;
    case 'timeline':
      if (data.timelineItems.length < 3) return 'Add at least 3 events.';
      for (const i of data.timelineItems) {
        if (!i.label.trim()) return 'All events need a label.';
        if (!i.year || isNaN(Number(i.year))) return 'All events need a valid year.';
      }
      return null;
    case 'photo':
      if (!data.photoPrompt.trim()) return 'Photo prompt is required.';
      return null;
    case 'relay': {
      const segs = data.relaySegments ?? [];
      if (segs.length < 2) return 'Add at least 2 segments.';
      if (segs.some(s => !s.trim())) return 'All segments need text.';
      return null;
    }
    case 'shared_secret':
      if (!data.sharedSecretAnswer?.trim()) return 'Answer is required.';
      if (data.clues.length < 2) return 'Add at least 2 clues.';
      if (data.clues.some(c => !c.trim())) return 'All clues need text.';
      return null;
    default:
      return 'Unknown type.';
  }
}

/** Builds the JSONB `data` object to store in the DB from form state. */
export function buildMissionData(
  type: string,
  data: {
    triviaRounds: { question: string; options: string[]; answer: string }[];
    statements: { text: string; answer: boolean }[];
    closestQuestions: { q: string; answer: string; unit: string; hint: string }[];
    clues: string[];
    paAnswer: string;
    timelineItems: { label: string; year: string }[];
    photoPrompt: string;
    relaySegments?: string[];
    relayMode?: string;
    sharedSecretAnswer?: string;
    sharedSecretHint?: string;
  }
): Record<string, unknown> {
  switch (type) {
    case 'trivia_quiz':
      return { rounds: data.triviaRounds };
    case 'truefalse':
      return { statements: data.statements };
    case 'closest_wins':
      return {
        questions: data.closestQuestions.map(q => ({
          q: q.q,
          answer: Number(q.answer),
          unit: q.unit,
          hint: q.hint,
        })),
      };
    case 'pa_sparet':
      return { clues: data.clues.filter(c => c.trim()), answer: data.paAnswer };
    case 'timeline':
      return {
        items: data.timelineItems.map(i => ({ label: i.label, year: Number(i.year) })),
      };
    case 'photo':
      return { prompt: data.photoPrompt };
    case 'relay':
      return {
        segments: (data.relaySegments ?? []).filter(s => s.trim()),
        relayMode: data.relayMode ?? 'typerace',
      };
    case 'shared_secret':
      return {
        clues: data.clues.filter(c => c.trim()),
        answer: (data.sharedSecretAnswer ?? '').trim(),
        hint: (data.sharedSecretHint ?? '').trim() || undefined,
      };
    default:
      return {};
  }
}
