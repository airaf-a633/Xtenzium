export const isSameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

/* Postgres `date` columns and <input type="date"> both speak plain
   YYYY-MM-DD, with no timezone. Passing one to `new Date()` parses it
   as UTC midnight — which, for any viewer behind UTC, lands on the
   previous local day and makes a deal due today read as overdue.
   Karachi is UTC+5 so it happens to be safe there, but the bug is real
   and it travels the moment anyone opens this from elsewhere.

   Splitting the parts and building a local Date keeps a calendar date
   a calendar date. */
export const parseDateOnly = (value: string): Date => {
  const [y, m, d] = value.slice(0, 10).split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
};

/* Midnight local, for comparing two calendar days without letting the
   clock time on either side decide the answer. */
export const startOfDay = (d: Date): Date => new Date(d.getFullYear(), d.getMonth(), d.getDate());

export const today = (): Date => startOfDay(new Date());

/* Whole calendar days between two dates, ignoring time of day. */
export const daysBetween = (from: Date, to: Date): number =>
  Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / 86_400_000);

/* The inverse of parseDateOnly: what <input type="date"> expects, in
   local terms. `toISOString().slice(0,10)` is the trap this avoids —
   it silently shifts the date near midnight. */
export const toDateInput = (d: Date): string => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
