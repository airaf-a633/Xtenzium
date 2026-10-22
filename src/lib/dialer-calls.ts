/* Call-screen helpers that don't need a browser: the outcome list, phone
   display, and the timezone arithmetic the screen leans on.

   The rules for what each outcome DOES (retry dates, deals, DNC) live
   in the database (migration 018, log_call). This file only describes
   the buttons and how to present a call. */

import type { CallLeadStatus } from '../types/database';

export type OutcomeKey =
  | 'no_answer' | 'voicemail' | 'gatekeeper_name' | 'gatekeeper_blocked'
  | 'callback' | 'interested_info' | 'interested_proposal' | 'interested_call' | 'meeting_booked'
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
  { key: 'interested_info', label: 'Interested — send info', shortcut: '6', group: 'interested', needs: 'contact', effect: 'Email task for the team + deal', chips: ['Company profile', 'Case studies', 'Portfolio', 'Pricing', ...GENERAL_CHIPS] },
  { key: 'interested_proposal', label: 'Wants proposal / pricing', shortcut: '7', group: 'interested', needs: 'contact', effect: 'Hot — email task for the team + deal', chips: GENERAL_CHIPS },
  { key: 'interested_call', label: 'Wants a call with us', shortcut: 'c', group: 'interested', needs: 'contact', effect: 'Call task for the team + deal', chips: ['Intro call', 'Technical call', 'Decision maker joining', ...GENERAL_CHIPS] },
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
/** The deal's stage, as the team names it. */
export const DEAL_STAGE_LABEL: Record<string, string> = {
  new: 'New',
  contacted: 'Contacted',
  qualified: 'Qualified',
  proposal_sent: 'Proposal sent',
  negotiation: 'Negotiation',
  won: 'Won',
  lost: 'Lost',
};

export const dealStageLabel = (stage: string | null | undefined): string | null =>
  stage ? (DEAL_STAGE_LABEL[stage] ?? stage.replace(/_/g, ' ')) : null;

/** Where a lead stands, in a sentence the rep can read at a glance when someone rings back. */
export function leadStatusLine(
  l: { status: string; attempt_count: number; next_call_at: string | null; nudge_count?: number | null; outreach_touches?: number | null },
  tasks: { type: string; status: string; created_at: string }[],
  tz: string,
): string {
  const when = (iso: string) => formatInZone(new Date(iso), tz).split(',').slice(0, 2).join(',');
  switch (l.status) {
    case 'new':
      return 'New lead — nobody has spoken to them yet.';
    case 'retry':
      return `We have called ${l.attempt_count} time${l.attempt_count === 1 ? '' : 's'} without reaching them.`;
    case 'callback':
      return `They asked for a callback${l.next_call_at ? ` for ${when(l.next_call_at)}` : ''}.`;
    case 'followup': {
      const sent = tasks.find(t => t.status === 'sent');
      const waiting = tasks.find(t => t.status === 'queued');
      if (waiting) return 'Interested — an email to them is waiting to be sent by the team.';
      if (sent) return `Interested — we emailed them on ${when(sent.created_at)} and are waiting for a reply.`;
      return 'Interested — the team is following up.';
    }
    case 'meeting':
      return `A meeting is booked${l.next_call_at ? ` for ${when(l.next_call_at)}` : ''}.`;
    case 'nurture':
      return 'Said not now — we agreed to check back later.';
    case 'lost':
      return 'Said no (they handle it in-house).';
    case 'disqualified':
      return 'Not a fit for us.';
    case 'bad_data':
      return 'The number we had was wrong.';
    case 'exhausted':
      return 'We stopped calling after several attempts with no answer.';
    case 'dnc':
      return 'On the do-not-call list.';
    case 'no_phone':
      return 'We only had an email for them until now.';
    default:
      return l.status;
  }
}

/** Saturday or Sunday on the wall clock of `tz`. */
export function isWeekendIn(when: Date, tz: string): boolean {
  const day = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short' }).format(when);
  return day === 'Sat' || day === 'Sun';
}

/** A failure that means "couldn't reach the server", as opposed to the server saying no. */
export const isConnectionError = (message: string | null | undefined): boolean =>
  /failed to fetch|networkerror|network request|load failed|timed? ?out|\b50[234]\b|unavailable|outage/i.test(message ?? '');

/** The login ran out (the app renews it automatically; the request that hit it must be repeated). */
export const isSessionError = (message: string | null | undefined): boolean =>
  /jwt expired|invalid jwt|jwt.{0,20}expired|not authenticated/i.test(message ?? '');

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

/* ─── Outcome labels ───────────────────────────────────── */

export const outcomeLabel = (key: string): string =>
  OUTCOMES.find(o => o.key === key)?.label ?? key.replace(/_/g, ' ');

/* ─── Board ────────────────────────────────────────────────

   Columns are groups of lead statuses. Dropping a card on a column
   doesn't just rewrite the status — it logs a call, because that is
   the only thing that moves a lead (retry dates, deals and follow-ups
   all hang off it). So each column lists the outcomes that can land a
   lead there, and the drop asks which one. */

export interface BoardColumn {
  key: string;
  title: string;
  statuses: CallLeadStatus[];
  /** Outcomes that put a lead in this column. Empty = not a drop target. */
  outcomes: OutcomeKey[];
}

export const BOARD_COLUMNS: BoardColumn[] = [
  { key: 'new', title: 'New', statuses: ['new'], outcomes: [] },
  { key: 'retry', title: 'Retry', statuses: ['retry'], outcomes: ['no_answer', 'voicemail', 'gatekeeper_name', 'gatekeeper_blocked'] },
  { key: 'callback', title: 'Callback', statuses: ['callback'], outcomes: ['callback'] },
  { key: 'followup', title: 'Follow-up', statuses: ['followup'], outcomes: ['interested_info', 'interested_proposal', 'interested_call'] },
  { key: 'meeting', title: 'Meeting', statuses: ['meeting'], outcomes: ['meeting_booked'] },
  { key: 'nurture', title: 'Nurture', statuses: ['nurture'], outcomes: ['not_interested_outsources', 'not_interested_timing'] },
  { key: 'closed', title: 'Closed', statuses: ['lost', 'disqualified', 'bad_data', 'dnc', 'exhausted'], outcomes: ['not_interested_inhouse', 'not_fit', 'wrong_number', 'dnc'] },
];

export const columnForStatus = (status: CallLeadStatus | string): BoardColumn | undefined =>
  BOARD_COLUMNS.find(c => (c.statuses as string[]).includes(status));

/* ─── Email templates ──────────────────────────────────── */

/** Fill {{merge_fields}}. Unknown names are left visible so a typo shows up instead of vanishing. */
export function renderTemplate(text: string, vars: Record<string, string | null | undefined>): string {
  return text
    .replace(/\{\{\s*(\w+)\s*\}\}/g, (whole, key: string) => (key in vars ? (vars[key] ?? '') : whole))
    /* An empty {{rep_note}} leaves a hole of blank lines — close it. */
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/* ─── Emails with embedded links ──────────────────────────────
   Templates write a link as [text](https://…). The text box shows exactly that;
   a mail app that can't carry HTML gets "text: https://…", and "Copy for Zoho"
   puts real hyperlinks on the clipboard so they paste in as links. */

const MD_LINK = /\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g;

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Plain text: each link becomes "text: url", so nothing is lost where HTML isn't possible. */
export const emailPlain = (body: string): string => body.replace(MD_LINK, (_, text: string, url: string) => `${text}: ${url}`);

/** HTML with real <a> tags. Everything else is escaped; line breaks are kept. */
export function emailHtml(body: string): string {
  let out = '';
  let last = 0;
  for (const m of body.matchAll(MD_LINK)) {
    out += escapeHtml(body.slice(last, m.index));
    out += `<a href="${escapeHtml(m[2])}">${escapeHtml(m[1])}</a>`;
    last = (m.index ?? 0) + m[0].length;
  }
  out += escapeHtml(body.slice(last));
  return `<div>${out.replace(/\r?\n/g, '<br>')}</div>`;
}

/** True while a {{booking_link}} / {{portfolio_link}} is unfilled, or an "[Add …]" line is still waiting
    for the sender to write it — don't send it like that. */
export const hasUnsetLinks = (body: string): boolean =>
  /\{\{\s*(booking_link|portfolio_link)\s*\}\}|\[Add [^\]\n]*\]/.test(body);

/** "Jodi Smith" → "Jodi"; nobody → "there". */
export const firstName = (name: string | null | undefined): string => (name ?? '').trim().split(/\s+/)[0] || 'there';

/** Opens Gmail's compose window with everything filled in. */
export const gmailCompose = (to: string | null, subject: string, body: string) =>
  `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(to ?? '')}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

/* ─── @mentions in notes ───────────────────────────────────

   The rep types "@Ai…" in a note and picks a teammate; on save the
   database (log_call, migration 021) finds the names, notifies those
   people and gives the first one the follow-up. This file is the
   typing half: spotting the "@" being typed, filtering the list, and a
   mirror of the database's matching rule so the screen can say who
   will be notified BEFORE the call is saved. */

export interface Person {
  id: string;
  name: string;
}

export interface MentionTrigger {
  /** Index of the "@". */
  start: number;
  /** What has been typed after it so far. */
  query: string;
}

const NAME_CHAR = /[A-Za-z0-9._-]/;
const LETTER = /[A-Za-z]/;
const WORD_CHAR = /[A-Za-z0-9_]/;

/** Is the caret just after "@abc"? "a@b.com" is an email, not a mention. */
export function mentionTrigger(text: string, caret: number): MentionTrigger | null {
  let i = caret;
  while (i > 0 && LETTER.test(text[i - 1])) i--;
  if (i === 0 || text[i - 1] !== '@') return null;
  const before = i >= 2 ? text[i - 2] : '';
  if (before && NAME_CHAR.test(before)) return null;
  return { start: i - 1, query: text.slice(i, caret) };
}

/** People whose first or last name starts with what's been typed. */
export const filterPeople = (people: Person[], query: string): Person[] => {
  const q = query.toLowerCase();
  return people.filter(p => p.name.toLowerCase().split(' ').some(w => w.startsWith(q)));
};

/** "Airaf" — or the full name when two people share a first name. */
export function mentionLabel(person: Person, all: Person[]): string {
  const first = person.name.split(' ')[0];
  const clash = all.some(p => p.id !== person.id && p.name.split(' ')[0].toLowerCase() === first.toLowerCase());
  return clash ? person.name : first;
}

export function insertMention(text: string, trigger: MentionTrigger, caret: number, label: string) {
  const inserted = `@${label} `;
  return { text: text.slice(0, trigger.start) + inserted + text.slice(caret), caret: trigger.start + inserted.length };
}

/** Same rule as the database: "@First" (while unique) or "@Full Name", case-insensitive, not inside an email address. */
export function mentionsIn(text: string, people: Person[]): Person[] {
  const lower = text.toLowerCase();
  const found: Person[] = [];
  for (const p of people) {
    const first = p.name.split(' ')[0];
    /* A first name shared with a teammate can't identify anyone on its own. */
    const shared = people.some(o => o.id !== p.id && o.name.split(' ')[0].toLowerCase() === first.toLowerCase());
    const candidates = (shared ? [p.name] : [p.name, first]).map(c => `@${c.toLowerCase()}`);
    const hit = candidates.some(c => {
      let from = 0;
      for (;;) {
        const at = lower.indexOf(c, from);
        if (at === -1) return false;
        const before = at > 0 ? text[at - 1] : '';
        const after = text[at + c.length] ?? '';
        if ((!before || !NAME_CHAR.test(before)) && !WORD_CHAR.test(after)) return true;
        from = at + 1;
      }
    });
    if (hit) found.push(p);
  }
  return found;
}

/* ─── Instant logging ──────────────────────────────────────

   "No answer" and "voicemail" are most of a rep's day, and neither
   needs a note. Shift+1 / Shift+2 log them and move on in one
   keystroke. (Matched on the physical key, so it works on any
   keyboard layout.) */

const INSTANT: Record<string, OutcomeKey> = { Digit1: 'no_answer', Digit2: 'voicemail' };

export const instantOutcome = (code: string, shiftKey: boolean): OutcomeDef | undefined => {
  const key = shiftKey ? INSTANT[code] : undefined;
  return key ? OUTCOMES.find(o => o.key === key) : undefined;
};

export const INSTANT_HINT: Partial<Record<OutcomeKey, string>> = { no_answer: '⇧1', voicemail: '⇧2' };

/* ─── Tier filter ──────────────────────────────────────────── */

export type TierChoice = 'A' | 'B' | 'C' | 'D' | '-';

export const TIER_CHOICES: { value: TierChoice; label: string }[] = [
  { value: 'A', label: 'Tier A' },
  { value: 'B', label: 'Tier B' },
  { value: 'C', label: 'Tier C' },
  { value: '-', label: 'No tier' },
  { value: 'D', label: 'Parked (D)' },
];

/** What to send the database. Nothing picked means "the usual queue" — which leaves parked (D) leads out. */
export const tiersParam = (picked: TierChoice[]): TierChoice[] | null => (picked.length === 0 ? null : picked);

/* ─── Segments ─────────────────────────────────────────────── */

export type Segment = 'agency' | 'dev_shop';

export const SEGMENTS: { value: Segment; label: string }[] = [
  { value: 'agency', label: 'Agency' },
  { value: 'dev_shop', label: 'Dev shop' },
];

export const segmentLabel = (s: string | null | undefined): string | null =>
  SEGMENTS.find(x => x.value === s)?.label ?? null;

/* ─── Extra columns a file carried ─────────────────────────────
   Anything the importer didn't map is kept on the lead. Social links
   become clickable; the rest is shown as plain details. */

const SOCIALS: { key: string; label: string; base: string }[] = [
  { key: 'linkedin', label: 'LinkedIn', base: 'https://www.linkedin.com/' },
  { key: 'instagram', label: 'Instagram', base: 'https://www.instagram.com/' },
  { key: 'facebook', label: 'Facebook', base: 'https://www.facebook.com/' },
  { key: 'twitter', label: 'Twitter / X', base: 'https://x.com/' },
  { key: 'x', label: 'Twitter / X', base: 'https://x.com/' },
];

const letterKey = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

/** A link that is safe to put in an href: http(s) only, and a bare "acme.com" gets its scheme
    (otherwise the browser reads it as a path inside this app). Anything else is no link. */
export const safeHref = (raw: string | null | undefined): string | null => {
  const v = (raw ?? '').trim();
  if (!v || /\s/.test(v)) return null;
  if (/^https?:\/\//i.test(v)) return v;
  if (/^[a-z][a-z0-9+.-]*:/i.test(v)) return null;
  return v.includes('.') ? `https://${v}` : null;
};

/** "LinkedIn", "linkedin_url" and "Instagram handle" all count; the one-letter "x" must match exactly. */
const socialFor = (header: string) => {
  const k = letterKey(header);
  return SOCIALS.find(s => k === s.key || (s.key.length > 1 && k.includes(s.key)));
};

const clip = (v: string, n = 200) => (v.length > n ? `${v.slice(0, n)}…` : v);

/** Only ever http(s): a cell in a CSV is not to be trusted with a javascript: link. */
const asUrl = (value: string, base: string): string | null => {
  const v = value.trim();
  if (!v || /\s/.test(v)) return null;
  if (/^https?:\/\//i.test(v)) return v;
  if (/^[a-z][a-z0-9+.-]*:/i.test(v)) return null;
  const host = new URL(base).hostname.replace(/^www\./, '');
  // A path or the platform's own domain is a link; anything else ("john.smith") is a handle.
  if (v.includes('/') || /^www\./i.test(v) || v.toLowerCase().includes(host)) return `https://${v}`;
  return `${base}${v.replace(/^@/, '')}`;
};

export function extraLinks(extra: Record<string, unknown> | null | undefined): { label: string; url: string }[] {
  const out: { label: string; url: string }[] = [];
  for (const [header, raw] of Object.entries(extra ?? {})) {
    const social = socialFor(header);
    if (!social || typeof raw !== 'string') continue;
    const url = asUrl(raw, social.base);
    if (url && !out.some(o => o.url === url)) out.push({ label: social.label, url });
  }
  return out;
}

export function extraDetails(extra: Record<string, unknown> | null | undefined): { label: string; value: string }[] {
  return Object.entries(extra ?? {})
    .filter(([header, v]) => typeof v === 'string' && v.trim() && !socialFor(header))
    .map(([header, v]) => ({ label: header.replace(/[_-]+/g, ' '), value: clip(String(v).trim()) }));
}

export const parseTiers = (raw: string | null): TierChoice[] =>
  (raw ?? '').split(',').filter((t): t is TierChoice => TIER_CHOICES.some(c => c.value === t));

/* ─── Script placeholders ──────────────────────────────────── */

export function scriptVars(
  lead: { company_name: string; contact_name: string | null } | null,
  repName: string | null,
  callerId?: string | null,
): Record<string, string> {
  const company = lead?.company_name ?? 'the company';
  const contact = lead?.contact_name?.trim();
  return {
    company,
    who: contact ? `${contact} at ${company}` : `a representative at ${company}`,
    rep: (repName ?? '').trim().split(' ')[0] || 'me',
    caller_id: callerId ? formatPhone(callerId) : 'this number',
  };
}
