import { describe, it, expect } from 'vitest';
import { clueLeaksAnswer, redactAnswerFromClues, redactNumberFromHint, guardClueMission } from '@/lib/clue-guard';

describe('clueLeaksAnswer', () => {
  it('detects the answer stated verbatim in a clue', () => {
    expect(clueLeaksAnswer(['A tall tower', 'The Eiffel Tower is in Paris'], 'Eiffel Tower')).toBe(true);
  });

  it('detects a case/accent-insensitive match', () => {
    expect(clueLeaksAnswer(['Den ligger i ÅRE'], 'Åre')).toBe(true);
  });

  it('ignores the leading article', () => {
    expect(clueLeaksAnswer(['This beatles song is famous'], 'The Beatles')).toBe(true);
  });

  it('does not flag clues that only hint', () => {
    expect(clueLeaksAnswer(['A famous iron tower', 'A landmark in Paris'], 'Eiffel Tower')).toBe(false);
  });

  it('does not flag a short particle that happens to match', () => {
    // "en" (article) must not trigger on a two-letter answer fragment
    expect(clueLeaksAnswer(['en stor stad'], 'A')).toBe(false);
  });
});

describe('redactAnswerFromClues', () => {
  it('redacts the answer word but keeps the rest of the clue', () => {
    const out = redactAnswerFromClues(['The Eiffel Tower is tall', 'It is in France'], 'Eiffel Tower');
    expect(out[0]).not.toMatch(/eiffel/i);
    expect(out[0]).toContain('is tall');
    expect(out[1]).toBe('It is in France');
  });

  it('redacts a significant word from a multi-word answer', () => {
    const out = redactAnswerFromClues(['A famous Eiffel structure'], 'The Eiffel Tower');
    expect(out[0]).not.toMatch(/eiffel/i);
  });

  it('does not redact when the answer is absent', () => {
    const clues = ['A landmark', 'In a European capital'];
    expect(redactAnswerFromClues(clues, 'Eiffel Tower')).toEqual(clues);
  });

  it('leaves clues that only substring-overlap intact (whole word only)', () => {
    // answer "art" should not redact "Bartholomew"
    const out = redactAnswerFromClues(['Bartholomew made it'], 'art');
    expect(out[0]).toBe('Bartholomew made it');
  });
});

describe('redactNumberFromHint', () => {
  it('redacts the exact answer number', () => {
    expect(redactNumberFromHint('It is about 42 years', '42')).not.toMatch(/42/);
  });

  it('matches across thousands separators', () => {
    expect(redactNumberFromHint('roughly 1,000 people', '1000')).not.toMatch(/1[,.]?000/);
    expect(redactNumberFromHint('roughly 1000 people', '1,000')).not.toMatch(/1000/);
  });

  it('does not redact a different number that merely contains the digits', () => {
    // answer 42 must not touch the year 1942
    expect(redactNumberFromHint('back in 1942 it happened', '42')).toBe('back in 1942 it happened');
  });

  it('keeps non-numeric hints intact', () => {
    expect(redactNumberFromHint('somewhere in Europe', '42')).toBe('somewhere in Europe');
  });
});

describe('guardClueMission', () => {
  it('redacts paAnswer from a pa_sparet mission', () => {
    const m = guardClueMission({ type: 'pa_sparet', clues: ['Stockholm is the capital'], paAnswer: 'Stockholm' });
    expect((m.clues as string[])[0]).not.toMatch(/stockholm/i);
  });

  it('redacts answer from a shared_secret mission', () => {
    const m = guardClueMission({ type: 'shared_secret', clues: ['Your clue: apple'], answer: 'Apple' });
    expect((m.clues as string[])[0]).not.toMatch(/apple/i);
  });

  it('redacts the answer number from a closest_wins hint', () => {
    const m = guardClueMission({
      type: 'closest_wins',
      closestQuestions: [{ q: 'How tall in metres?', answer: '324', unit: 'm', hint: 'Just over 324 metres' }],
    });
    const qs = m.closestQuestions as Array<{ hint: string }>;
    expect(qs[0].hint).not.toMatch(/324/);
  });

  it('leaves non-clue missions untouched', () => {
    const trivia = { type: 'trivia_quiz', triviaRounds: [{ question: 'Capital of Sweden?', answer: 'Stockholm' }] };
    expect(guardClueMission({ ...trivia })).toEqual(trivia);
  });

  it('is a no-op when clues or answer are missing/malformed', () => {
    expect(guardClueMission({ type: 'pa_sparet', clues: ['x'] })).toEqual({ type: 'pa_sparet', clues: ['x'] });
    expect(guardClueMission({ type: 'pa_sparet', paAnswer: 'y' })).toEqual({ type: 'pa_sparet', paAnswer: 'y' });
  });
});
