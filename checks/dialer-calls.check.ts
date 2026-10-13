/* Call-screen helper checks: outcome table integrity, phone display,
   and the timezone maths (the part most likely to be quietly wrong). */

import {
  OUTCOMES, clockFor, dayStartInZone, dayStats, formatInZone, formatPhone,
  isConversation, outcomeByShortcut, voiceLink, zonedToUtc,
} from '../src/lib/dialer-calls';

let failures = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    failures++;
    console.error(`FAIL ${name}\n  got  ${JSON.stringify(got)}\n  want ${JSON.stringify(want)}`);
  }
};

/* The outcome keys must match the database's CASE list (018_dialer_calls.sql). */
const DB_OUTCOMES = [
  'no_answer', 'voicemail', 'gatekeeper_name', 'gatekeeper_blocked', 'callback',
  'interested_info', 'interested_proposal', 'meeting_booked', 'not_interested_inhouse',
  'not_interested_outsources', 'not_interested_timing', 'not_fit', 'wrong_number', 'dnc',
];
eq('outcome keys match the database', OUTCOMES.map(o => o.key), DB_OUTCOMES);
eq('shortcuts are unique', new Set(OUTCOMES.map(o => o.shortcut)).size, OUTCOMES.length);
eq('skip key is not an outcome key', outcomeByShortcut('s'), undefined);
eq('shortcut lookup', outcomeByShortcut('5')?.key, 'callback');
eq('shortcut lookup is case-insensitive', outcomeByShortcut('X')?.key, 'dnc');

eq('voicemail is not a conversation', isConversation('voicemail'), false);
eq('wrong number is not a conversation', isConversation('wrong_number'), false);
eq('callback is a conversation', isConversation('callback'), true);
eq('day stats', dayStats(['no_answer', 'voicemail', 'callback', 'meeting_booked', 'not_fit']),
  { dials: 5, conversations: 3, meetings: 1 });

eq('phone display', formatPhone('+12123801761'), '(212) 380-1761');
eq('international left alone', formatPhone('+442071004189'), '+442071004189');
eq('phone fallback', formatPhone(null, '555'), '555');
eq('voice link encodes the plus', voiceLink('+12123801761'), 'https://voice.google.com/u/0/calls?a=nc,%2B12123801761');

/* Wall-clock → instant, across a DST boundary (US clocks went back 2026-11-01). */
eq('EDT (UTC-4) before the change', zonedToUtc('2026-10-14T10:00', 'America/New_York').toISOString(), '2026-10-14T14:00:00.000Z');
eq('EST (UTC-5) after the change', zonedToUtc('2026-11-03T10:00', 'America/New_York').toISOString(), '2026-11-03T15:00:00.000Z');
eq('Pacific', zonedToUtc('2026-10-14T09:30', 'America/Los_Angeles').toISOString(), '2026-10-14T16:30:00.000Z');
eq('Karachi (UTC+5, no DST)', zonedToUtc('2026-10-14T19:00', 'Asia/Karachi').toISOString(), '2026-10-14T14:00:00.000Z');
eq('Arizona has no DST', zonedToUtc('2026-07-01T10:00', 'America/Phoenix').toISOString(), '2026-07-01T17:00:00.000Z');

/* "Today" for the rep is a Karachi day, not a UTC day. */
eq('Karachi day start', dayStartInZone(new Date('2026-10-14T20:30:00Z'), 'Asia/Karachi').toISOString(), '2026-10-14T19:00:00.000Z');
eq('Karachi day start (just after local midnight)', dayStartInZone(new Date('2026-10-14T19:05:00Z'), 'Asia/Karachi').toISOString(), '2026-10-14T19:00:00.000Z');

/* The clock mirrors the database rule. */
const tue = (h: number, min = 0) => new Date(Date.UTC(2026, 9, 13, h, min)); // Tue 13 Oct, UTC
eq('NY 10:00 is open', clockFor('America/New_York', tue(14)).open, true);
eq('NY 08:00 is closed', clockFor('America/New_York', tue(12)).open, false);
eq('NY 17:00 is closed', clockFor('America/New_York', tue(21)).open, false);
eq('Saturday is closed', clockFor('America/New_York', new Date(Date.UTC(2026, 9, 17, 15))).open, false);
eq('unknown zone 11:00 ET closed', clockFor(null, tue(15)).open, false);
eq('unknown zone 13:00 ET open', clockFor(null, tue(17)).open, true);
eq('unknown zone is flagged', clockFor(null, tue(17)).known, false);
eq('clock text', clockFor('America/New_York', tue(14, 42)).time, '10:42 AM');
eq('format in zone', formatInZone(zonedToUtc('2026-10-14T10:00', 'America/New_York'), 'America/New_York'), 'Wed, Oct 14, 10:00 AM EDT');

if (failures) {
  console.error(`${failures} dialer-calls check(s) failed`);
  process.exit(1);
}
console.log('dialer-calls: all checks passed');
