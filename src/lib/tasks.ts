import { parseDateOnly, today } from './date';
import type { Tone } from '../components/crm/ui';
import type { TaskPriority, TaskStatusRow } from '../types/database';

/* ── Priority ──────────────────────────────────────────────────
   Four levels, which is one more than most teams need and one fewer
   than the number at which nobody trusts any of them. Stored as 1–4
   so the database sorts them correctly without a CASE. */
export const PRIORITIES: Array<{
  value: TaskPriority;
  label: string;
  tone: Tone;
  /* Urgent and High get a visible mark on the card; Normal is the
     default and says nothing; Low is deliberately quiet. */
  marked: boolean;
}> = [
  { value: 1, label: 'Urgent', tone: 'danger', marked: true },
  { value: 2, label: 'High', tone: 'warning', marked: true },
  { value: 3, label: 'Normal', tone: 'neutral', marked: false },
  { value: 4, label: 'Low', tone: 'neutral', marked: false },
];

export const PRIORITY_LABEL: Record<TaskPriority, string> = {
  1: 'Urgent',
  2: 'High',
  3: 'Normal',
  4: 'Low',
};

export const PRIORITY_TONE: Record<TaskPriority, Tone> = {
  1: 'danger',
  2: 'warning',
  3: 'neutral',
  4: 'neutral',
};

export const priorityOf = (value: number): TaskPriority =>
  ([1, 2, 3, 4] as TaskPriority[]).includes(value as TaskPriority) ? (value as TaskPriority) : 3;

/* ── Statuses ──────────────────────────────────────────────────
   Rows come from the database so they stay configurable, but the tone
   string has to be validated before it reaches a component — a typo in
   the table shouldn't render an untoned badge. */
const TONES: Tone[] = ['neutral', 'copper', 'success', 'warning', 'danger', 'info', 'violet'];

export const toneOf = (value: string): Tone =>
  (TONES.includes(value as Tone) ? value : 'neutral') as Tone;

export const sortStatuses = (rows: TaskStatusRow[]) =>
  [...rows].sort((a, b) => a.position - b.position);

/* ── Duration ──────────────────────────────────────────────────
   Minutes in, human out. Hours only past 60 minutes, and never
   "0h 45m" — the leading zero reads as a rounding error. */
export const formatDuration = (minutes: number | null | undefined): string => {
  if (!minutes || minutes <= 0) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
};

/* Accepts what someone would actually type into a time box: "90",
   "1.5h", "1h30", "1h 30m", "45m". Returns null for anything it
   cannot read, so the caller can say so rather than logging a zero. */
export const parseDuration = (input: string): number | null => {
  const text = input.trim().toLowerCase();
  if (!text) return null;

  // Bare number → minutes.
  if (/^\d+(\.\d+)?$/.test(text)) {
    const n = Math.round(Number(text));
    return n > 0 ? n : null;
  }

  // Decimal hours: "1.5h"
  const decimalHours = text.match(/^(\d+(?:\.\d+)?)\s*h(?:ours?)?$/);
  if (decimalHours) {
    const n = Math.round(Number(decimalHours[1]) * 60);
    return n > 0 ? n : null;
  }

  // "1h30", "1h 30m", "2h", "45m"
  const parts = text.match(/^(?:(\d+)\s*h(?:ours?)?)?\s*(?:(\d+)\s*m(?:ins?|inutes?)?)?$/);
  if (parts && (parts[1] || parts[2])) {
    const total = Number(parts[1] ?? 0) * 60 + Number(parts[2] ?? 0);
    return total > 0 ? total : null;
  }

  const hAndBare = text.match(/^(\d+)\s*h\s*(\d+)$/);
  if (hAndBare) {
    const total = Number(hAndBare[1]) * 60 + Number(hAndBare[2]);
    return total > 0 ? total : null;
  }

  return null;
};

/* How far past the estimate this task has run. Null when there is no
   estimate to compare against — an unestimated task is not "over". */
export const estimateOverrun = (
  logged: number | null | undefined,
  estimate: number | null | undefined,
): number | null => {
  if (!estimate || estimate <= 0 || !logged) return null;
  return logged > estimate ? logged - estimate : null;
};

/* ── Ranking ───────────────────────────────────────────────────
   Same fractional scheme the pipeline uses. */
export const rankBetween = (before: number | null, after: number | null): number => {
  if (before === null && after === null) return 0;
  if (before === null) return (after as number) - 1;
  if (after === null) return before + 1;
  return (before + after) / 2;
};

/* ── Mentions ──────────────────────────────────────────────────
   Comment bodies are stored as typed. Mentioned members are extracted
   into a separate column so a later rename never orphans a mention,
   and so phase 05 can index on it. Matching is on the member's first
   token, case-insensitively — which is how people actually type. */
export const extractMentions = (
  body: string,
  members: Array<{ id: string; name: string }>,
): string[] => {
  const handles = new Set(
    (body.match(/@([\w.-]+)/g) ?? []).map(h => h.slice(1).toLowerCase()),
  );
  if (handles.size === 0) return [];
  return members
    .filter(m => {
      const first = m.name.trim().split(/\s+/)[0]?.toLowerCase();
      const full = m.name.trim().toLowerCase().replace(/\s+/g, '');
      return (first && handles.has(first)) || handles.has(full);
    })
    .map(m => m.id);
};

/* Whole days from today until a due date. Negative means overdue.
   Exported because the card and the column logic must agree on it. */
export const daysUntilDue = (iso: string): number =>
  Math.round((parseDateOnly(iso).getTime() - today().getTime()) / 86_400_000);
