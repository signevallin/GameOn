// lib/clue-guard.ts
//
// Safety net for AI-generated clue-based missions (pa_sparet, shared_secret):
// the answer must never appear in the clues. The generation prompt says so, but
// models occasionally slip — this guarantees it deterministically by redacting
// any occurrence of the answer (and close variants) from the clues before the
// mission is returned.

const REDACTION = '▢▢▢';

/** Lowercase and collapse punctuation to spaces, keeping accented letters
 *  (åäö, é, ć…) so Swedish/other answers match consistently with their clues. */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\p{L}\p{N} ]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Answer variants to catch: the whole answer, its article-stripped form, and
 * any *distinctive* word from it (≥ 6 chars — long enough to be a proper noun
 * like "Eiffel"/"Zlatan" rather than a generic word like "tower"/"city", which
 * would over-redact legitimate hints). One- and two-word answers are skipped.
 */
function answerVariants(answer: string): string[] {
  const full = normalize(answer);
  if (full.length < 2) return [];

  const variants = new Set<string>([full]);
  const stripArticle = full.replace(/^(the|a|an|den|det|en|ett|le|la|les|der|die|das)\s+/, '');
  if (stripArticle.length >= 2) variants.add(stripArticle);
  for (const word of stripArticle.split(' ')) {
    if (word.length >= 6) variants.add(word);
  }
  return [...variants].sort((a, b) => b.length - a.length); // longest first
}

/** Whole-word, accent/case-insensitive regex for a normalized term. */
function termRegex(term: string): RegExp {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = escaped.replace(/ /g, '[\\s-]+');
  return new RegExp(`(^|[^\\p{L}\\p{N}])(${pattern})(?=$|[^\\p{L}\\p{N}])`, 'giu');
}

/** True if any clue mentions the answer (or a distinctive variant of it). */
export function clueLeaksAnswer(clues: string[], answer: string): boolean {
  const variants = answerVariants(answer);
  if (variants.length === 0) return false;
  return clues.some((clue) => variants.some((v) => termRegex(v).test(clue)));
}

/** Returns the clues with every occurrence of the answer (and variants) redacted. */
export function redactAnswerFromClues(clues: string[], answer: string): string[] {
  const variants = answerVariants(answer);
  if (variants.length === 0) return clues;
  return clues.map((clue) => {
    let out = clue;
    for (const v of variants) {
      out = out.replace(termRegex(v), (_m, pre) => `${pre}${REDACTION}`);
    }
    return out;
  });
}

/**
 * If a mission is clue-based, redact its answer from the clues. Returns the
 * mission unchanged for other types. Handles both schema shapes:
 * pa_sparet ({ clues, paAnswer }) and shared_secret ({ clues, answer }).
 */
export function guardClueMission(mission: Record<string, unknown>): Record<string, unknown> {
  const type = mission.type;
  if (type !== 'pa_sparet' && type !== 'shared_secret') return mission;

  const clues = mission.clues;
  if (!Array.isArray(clues) || !clues.every((c) => typeof c === 'string')) return mission;

  const answer = type === 'pa_sparet' ? mission.paAnswer : mission.answer;
  if (typeof answer !== 'string' || !answer.trim()) return mission;

  return { ...mission, clues: redactAnswerFromClues(clues as string[], answer) };
}
