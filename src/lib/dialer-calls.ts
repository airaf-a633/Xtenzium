/* Call-screen helpers that don't need a browser: the outcome list, phone
   display, and the timezone arithmetic the screen leans on.

   The rules for what each outcome DOES (retry dates, deals, DNC) live
   in the database (migration 018, log_call). This file only describes
   the buttons and how to present a call. */

export type OutcomeKey =
  | 'no_answer' | 'voicemail' | 'gatekeeper_name' | 'gatekeeper_blocked'
  | 'callback' | 'interested_info' | 'interested_proposal' | 'meeting_booked'
  | 'not_interested_inhouse' | 'not_interested_outsources' | 'not_interested_timing'
  | 'not_fit' | 'wrong_number' | 'dnc';

export type OutcomeGroup = 'no_contact' | 'interested' | 'not_interested' | 'dead';

export interface OutcomeDef {
  key: OutcomeKey;
  label: string;
  /** Single key that picks this outcome. */
  shortcut: string;
  group: OutcomeGroup;
  /** What extra input the outcome needs before it can be saved. */
  needs?: 'callback_time' | 'meeting_time' | 'contact';
  /** One-line "what happens next", shown under the button label. */
  effect: string;
  chips?: string[];
}

export const GENERAL_CHIPS = [
  'Asked for email',
  'Decision maker is…',
  'Uses offshore already',
  'Price sensitive',
  'Busy — call mornings',
  'Wants case studies',
  'Has WordPress needs',
  'Has app / React needs',
];

export const OUTCOMES: OutcomeDef[] = [
  { key: 'no_answer', label: 'No answer', shortcut: '1', group: 'no_contact', effect: 'Retry tomorrow', chips: ['Rang out', 'Straight to voicemail', 'Line busy'] },
  { key: 'voicemail', label: 'Left voicemail', shortcut: '2', group: 'no_contact', effect: 'Retry in 2 days', chips: ['Left pitch', 'Left callback number'] },
  { key: 'gatekeeper_name', label: 'Gatekeeper — got a name', shortcut: '3', group: 'no_contact', needs: 'contact', effect: 'Retry tomorrow', chips: ['Receptionist', 'Gave direct extension', 'Said best time to call'] },
  { key: 'gatekeeper_blocked', label: 'Gatekeeper — blocked', shortcut: '4', group: 'no_contact', effect: 'Retry in 3 days', chips: ['Receptionist', 'Told to email', 'No solicitation'] },
  { key: 'callback', label: 'Callback requested', shortcut: '5', group: 'interested', needs: 'callback_time', effect: 'Reminder at the time you set', chips: GENERAL_CHIPS },
  { key: 'interested_info', label: 'Interested — send info', shortcut: '6', group: 'interested', needs: 'contact', effect: 'Email task for the owner + deal', chips: GENERAL_CHIPS },
  { key: 'interested_proposal', label: 'Wants proposal / pricing', shortcut: '7', group: 'interested', needs: 'contact', effect: 'Hot — email task + deal', chips: GENERAL_CHIPS },
  { key: 'meeting_booked', label: 'Meeting agreed', shortcut: '8', group: 'interested', needs: 'meeting_time', effect: 'Owner is told + deal', chips: GENERAL_CHIPS },
  { key: 'not_interested_inhouse', label: 'No — has in-house devs', shortcut: '9', group: 'not_interested', effect: 'Closed as lost', chips: ['Has in-house team', 'Just hired'] },
  { key: 'not_interested_outsources', label: 'No — already outsources', shortcut: '0', group: 'not_interested', effect: 'Call again in 90 days', chips: ['Happy with current vendor', 'Contract running'] },
  { key: 'not_interested_timing', label: 'No — bad timing / budget', shortcut: 't', group: 'not_interested', effect: 'Call again in 60 days', chips: ['No budget', 'Busy season', 'Revisit later'] },
  { key: 'not_fit', label: 'Not a fit', shortcut: 'f', group: 'dead', effect: 'Disqualified', chips: ['Not an agency', 'Too small', 'Wrong service'] },
  { key: 'wrong_number', label: 'Wrong / dead number', shortcut: 'w', group: 'dead', effect: 'Marked bad data', chips: ['Disconnected', 'Different business'] },
  { key: 'dnc', label: 'Do not call', shortcut: 'x', group: 'dead', effect: 'Blocked permanently', chips: ['Asked to be removed'] },
];

export const SKIP_SHORTCUT = 's';

export const outcomeByShortcut = (key: string): OutcomeDef | undefined =>
  OUTCOMES.find(o => o.shortcut === key.toLowerCase());

/** Outcomes where nobody substantive picked up. Everything else counts as a conversation. */
const NO_CONVERSATION = new Set<string>(['no_answer', 'voicemail', 'gatekeeper_name', 'gatekeeper_blocked', 'wrong_number']);
export const isConversation = (outcome: string) => !NO_CONVERSATION.has(outcome);

export interface DayStats {
  dials: number;
  conversations: number;
  meetings: number;
}

export const dayStats = (outcomes: string[]): DayStats => ({
  dials: outcomes.length,
  conversations: outcomes.filter(isConversation).length,
  meetings: outcomes.filter(o => o === 'meeting_booked').length,
});

/* ─── Phones ───────────────────────────────────────────── */

/** "+12123801761" → "(212) 380-1761". Anything else is shown as stored. */
export function formatPhone(e164: string | null | undefined, fallback?: string | null): string {
  const m = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(e164 ?? '');
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : (e164 ?? fallback ?? '');
}

/** Google Voice's "new call" deep link. Copy stays the fallback if it ever changes. */
export const voiceLink = (e164: string) =>
  `https://voice.google.com/u/0/calls?a=nc,${encodeURIComponent(e164)}`;

/* ─── Timezones ────────────────────────────────────────── */

const ET = 'America/New_York';

const partsIn = (date: Date, tz: string) => {
  const p = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hourCycle: 'h23', weekday: 'short',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(date);
  return Object.fromEntries(p.map(x => [x.type, x.value])) as Record<string, string>;
};

/** How far `tz` is ahead of UTC at this instant, in ms. */
const offsetMs = (date: Date, tz: string) => {
  const v = partsIn(date, tz);
  return Date.UTC(+v.year, +v.month - 1, +v.day, +v.hour, +v.minute, +v.second) - Math.floor(date.getTime() / 1000) * 1000;
};

/** "2026-10-14T10:00" typed as wall-clock time in `tz` → the real instant. Two passes so DST edges settle. */
export function zonedToUtc(local: string, tz: string): Date {
  const [d, t] = local.split('T');
  const [y, m, day] = d.split('-').map(Number);
  const [h, min] = t.split(':').map(Number);
  const guess = Date.UTC(y, m - 1, day, h, min);
  const first = guess - offsetMs(new Date(guess), tz);
  return new Date(guess - offsetMs(new Date(first), tz));
}

/** Midnight at the start of `now`'s calendar day in `tz`, as an instant. */
export function dayStartInZone(now: Date, tz: string): Date {
  const v = partsIn(now, tz);
  return zonedToUtc(`${v.year}-${v.month}-${v.day}T00:00`, tz);
}

export interface Clock {
  /** "10:42 AM" in the prospect's zone. */
  time: string;
  open: boolean;
  /** False when the lead has no timezone and Eastern is a stand-in. */
  known: boolean;
  zoneLabel: string;
}

/** Mirrors dialer_in_window() in the database: 9–17 Mon–Fri, or 12–17 ET if unknown. */
export function clockFor(tz: string | null, now: Date = new Date()): Clock {
  const zone = tz ?? ET;
  const v = partsIn(now, zone);
  const hour = Number(v.hour);
  const weekday = !['Sat', 'Sun'].includes(v.weekday);
  const from = tz ? 9 : 12;
  const short = new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'short' })
    .formatToParts(now).find(p => p.type === 'timeZoneName')?.value ?? zone;
  return {
    time: new Intl.DateTimeFormat('en-US', { timeZone: zone, hour: 'numeric', minute: '2-digit' }).format(now),
    open: weekday && hour >= from && hour < 17,
    known: tz !== null,
    zoneLabel: short,
  };
}

/** "Tue, Oct 14, 10:00 AM EDT" */
export const formatInZone = (date: Date, tz: string) =>
  new Intl.DateTimeFormat('en-US', {
    timeZone: tz, weekday: 'short', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
  }).format(date);
