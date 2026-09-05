/* ────────────────────────────────────────────────────────────────
   Fuzzy matching for the command palette.

   Subsequence matching, not substring: typing "mzbnk" should find
   "Meezan Bank". Scoring rewards the things that make a match feel
   deliberate rather than coincidental — consecutive letters, matches
   at the start of a word, and a match at the very start of the string.

   Pure and self-contained, so the ranking can be pinned down without
   rendering anything.
   ──────────────────────────────────────────────────────────────── */

export interface FuzzyMatch {
  score: number;
  /* Indices of the matched characters, so the UI can bold exactly the
     letters that earned the match rather than guessing. */
  indices: number[];
}

const SCORE = {
  /* A letter immediately after a previous match. This is what makes
     "mee" rank "Meezan" above "M... e... e..." spread across a name. */
  consecutive: 8,
  /* First letter of a word — after a space, dash, slash or an
     uppercase boundary in camelCase. */
  wordStart: 10,
  /* The whole match begins at index 0. */
  leading: 12,
  /* Every unmatched character costs a little, so a short exact-ish
     match beats a long scattered one. */
  gapPenalty: 1,
  /* Nudges an exact substring hit above an equally-scoring
     subsequence, because it is almost always what was meant. */
  substringBonus: 25,
} as const;

const isWordBoundary = (text: string, i: number): boolean => {
  if (i === 0) return true;
  const prev = text[i - 1];
  if (prev === ' ' || prev === '-' || prev === '_' || prev === '/' || prev === '.') return true;
  /* camelCase / PascalCase boundary. */
  return prev === prev.toLowerCase() && text[i] === text[i].toUpperCase() && /[a-z]/i.test(prev);
};

export const fuzzyMatch = (query: string, text: string): FuzzyMatch | null => {
  const q = query.trim();
  if (!q) return { score: 0, indices: [] };
  if (!text) return null;

  const lowerQuery = q.toLowerCase();
  const lowerText = text.toLowerCase();

  const indices: number[] = [];
  let score = 0;
  let textIndex = 0;
  let lastMatch = -2;

  for (let qi = 0; qi < lowerQuery.length; qi += 1) {
    const ch = lowerQuery[qi];
    /* Spaces in the query are separators, not characters to find —
       "mee bank" should behave like "meebank" against "Meezan Bank". */
    if (ch === ' ') continue;

    const found = lowerText.indexOf(ch, textIndex);
    if (found === -1) return null;

    if (found === lastMatch + 1) score += SCORE.consecutive;
    if (isWordBoundary(text, found)) score += SCORE.wordStart;
    if (found === 0) score += SCORE.leading;
    score -= Math.min(found - textIndex, 10) * SCORE.gapPenalty;

    indices.push(found);
    lastMatch = found;
    textIndex = found + 1;
  }

  if (lowerText.includes(lowerQuery.replace(/\s+/g, ''))) score += SCORE.substringBonus;

  /* Shorter targets win ties: "Tasks" should outrank "Task attachments
     for the estimator rebuild" for the query "task". */
  score -= Math.min(text.length, 60) / 10;

  return { score, indices };
};

export interface Ranked<T> {
  item: T;
  score: number;
  indices: number[];
}

export const rank = <T>(
  query: string,
  items: T[],
  getText: (item: T) => string,
  limit = 8,
): Ranked<T>[] => {
  const results: Ranked<T>[] = [];
  for (const item of items) {
    const match = fuzzyMatch(query, getText(item));
    if (match) results.push({ item, score: match.score, indices: match.indices });
  }
  results.sort((a, b) => b.score - a.score);
  return results.slice(0, limit);
};

/* Splits a string into matched / unmatched runs so the UI can render
   emphasis without recomputing anything. */
export const highlight = (text: string, indices: number[]): Array<{ text: string; hit: boolean }> => {
  if (indices.length === 0) return [{ text, hit: false }];
  const set = new Set(indices);
  const parts: Array<{ text: string; hit: boolean }> = [];
  let current = '';
  let currentHit = set.has(0);

  for (let i = 0; i < text.length; i += 1) {
    const hit = set.has(i);
    if (hit === currentHit) {
      current += text[i];
    } else {
      if (current) parts.push({ text: current, hit: currentHit });
      current = text[i];
      currentHit = hit;
    }
  }
  if (current) parts.push({ text: current, hit: currentHit });
  return parts;
};
