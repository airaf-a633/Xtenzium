/* Which times can a meeting be offered at?

   A slot has to satisfy four things at once:
     1. it is inside the PROSPECT's business day (9–17 local, Mon–Fri —
        or 12–17 Eastern when their zone is unknown, the one window every
        US zone shares);
     2. it is inside the hours the OWNER takes meetings (set in Dialer
        settings, in the owner's own timezone, and allowed to wrap past
        midnight: 18 → 2 is a perfectly normal evening for someone
        selling to the US from Karachi);
     3. it doesn't overlap anything already on the owner's calendar;
     4. it isn't too soon to be real.

   Pure and dependency-free so the same function runs on the server
   (which holds the calendar) and in checks (which hold nothing). */

export interface BusyBlock {
  start: string;
  end: string;
}

export interface Slot {
  start: string;
  end: string;
}

export interface SlotRequest {
  now: Date;
  /** How many of the prospect's business days to look across. */
  businessDays: number;
  durationMin: number;
  /** null = unknown; the 12:00–17:00 Eastern overlap window is used. */
  prospectTz: string | null;
  ownerTz: string;
  /** Owner's available hours, in ownerTz. `to` may be less than `from` (wraps midnight). */
  ownerFrom: number;
  ownerTo: number;
  busy: BusyBlock[];
  stepMin?: number;
  /** Don't offer anything sooner than this many minutes from now. */
  minLeadMin?: number;
}

const ET = 'America/New_York';

interface Local {
  date: string;
  weekday: number; // 1 = Mon … 7 = Sun
  minutes: number; // minutes since local midnight
  hour: number;
}

const WEEKDAYS: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

const localOf = (d: Date, tz: string): Local => {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hourCycle: 'h23', weekday: 'short', year: 'numeric', month: '2-digit',
      day: '2-digit', hour: '2-digit', minute: '2-digit',
    }).formatToParts(d).map(x => [x.type, x.value]),
  ) as Record<string, string>;
  const hour = Number(p.hour);
  return {
    date: `${p.year}-${p.month}-${p.day}`,
    weekday: WEEKDAYS[p.weekday],
    hour,
    minutes: hour * 60 + Number(p.minute),
  };
};

/** Is this hour inside [from, to), where the range may wrap past midnight? */
export const hourInWindow = (hour: number, from: number, to: number): boolean =>
  from === to ? true : from < to ? hour >= from && hour < to : hour >= from || hour < to;

export function computeSlots(req: SlotRequest): Slot[] {
  const step = req.stepMin ?? 30;
  const minLead = req.minLeadMin ?? 120;
  const stepMs = step * 60_000;
  const durMs = req.durationMin * 60_000;
  const prospectTz = req.prospectTz ?? ET;
  const winFrom = (req.prospectTz ? 9 : 12) * 60;
  const winTo = 17 * 60;

  const busy = req.busy.map(b => [new Date(b.start).getTime(), new Date(b.end).getTime()] as const);
  const earliest = req.now.getTime() + minLead * 60_000;
  const first = Math.ceil(earliest / stepMs) * stepMs;
  const horizon = req.now.getTime() + (req.businessDays * 2 + 6) * 86_400_000;

  const out: Slot[] = [];
  const days = new Set<string>();

  for (let t = first; t < horizon; t += stepMs) {
    const start = new Date(t);
    const end = new Date(t + durMs);

    const pl = localOf(start, prospectTz);
    if (pl.weekday > 5) continue;
    if (pl.minutes < winFrom || pl.minutes + req.durationMin > winTo) continue;
    // Don't look past the requested number of the prospect's business days.
    if (!days.has(pl.date)) {
      if (days.size >= req.businessDays) break;
      days.add(pl.date);
    }

    // Every minute of the slot must be inside the owner's hours: check both ends.
    const ownerStart = localOf(start, req.ownerTz);
    const ownerLast = localOf(new Date(t + durMs - 60_000), req.ownerTz);
    if (!hourInWindow(ownerStart.hour, req.ownerFrom, req.ownerTo)) continue;
    if (!hourInWindow(ownerLast.hour, req.ownerFrom, req.ownerTo)) continue;

    if (busy.some(([bs, be]) => t < be && t + durMs > bs)) continue;

    out.push({ start: start.toISOString(), end: end.toISOString() });
  }
  return out;
}

export interface DayGroup {
  /** YYYY-MM-DD in the prospect's zone. */
  key: string;
  slots: Slot[];
}

/** Group slots by the prospect's calendar day, for the picker. */
export function groupByDay(slots: Slot[], prospectTz: string | null): DayGroup[] {
  const tz = prospectTz ?? ET;
  const groups: DayGroup[] = [];
  for (const s of slots) {
    const key = localOf(new Date(s.start), tz).date;
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.slots.push(s);
    else groups.push({ key, slots: [s] });
  }
  return groups;
}
