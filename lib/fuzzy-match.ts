export function normalizeAnswer(s: string): string {
  return s
    .toLowerCase()
    .replace(/^(the|a|an|den|det|en|ett)\s+/i, '')
    .replace(/[^a-z0-9åäö]/g, '');
}

export function fuzzyMatch(guess: string, answer: string): boolean {
  return normalizeAnswer(guess) === normalizeAnswer(answer);
}
