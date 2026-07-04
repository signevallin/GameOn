import { describe, it, expect } from 'vitest';
import { normalizeAnswer, fuzzyMatch } from '@/lib/fuzzy-match';

describe('normalizeAnswer', () => {
  it('lowercases and strips punctuation and spaces', () => {
    expect(normalizeAnswer('Hello, World!')).toBe('helloworld');
  });

  it('strips a leading article (English and Swedish)', () => {
    expect(normalizeAnswer('The Beatles')).toBe('beatles');
    expect(normalizeAnswer('en katt')).toBe('katt');
  });

  it('keeps Swedish letters åäö', () => {
    expect(normalizeAnswer('Mårten Ö!')).toBe('mårtenö');
  });
});

describe('fuzzyMatch', () => {
  it('matches despite case, punctuation and article differences', () => {
    expect(fuzzyMatch('the  BEATLES!', 'Beatles')).toBe(true);
    expect(fuzzyMatch('Stockholm', 'stockholm.')).toBe(true);
  });

  it('does not match genuinely different answers', () => {
    expect(fuzzyMatch('Stockholm', 'Gothenburg')).toBe(false);
  });
});
