/* Checks for the touch timeline, the calendar file and the summary text. */

import { buildTimeline, nextSteps, touchCounts, type PlanLead } from '../src/lib/touch-plan';
import { buildIcs, fold, icsDate, icsEscape, icsFileName, meetingIcs } from '../src/lib/ics';
import { renderSummary, type SummaryData } from '../src/lib/daily-summary';

let failures = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    failures++;
    console.error(`FAIL ${name}\n  got  ${JSON.stringify(got)}\n  want ${JSON.stringify(want)}`);
  }
};

/* ─── Timeline ─── */
const calls = [
  { id: '1', outcome: 'no_answer', note: null, created_at: '2026-10-12T10:00:00Z' },
  { id: '2', outcome: 'voicemail', note: 'left the pitch', created_at: '2026-10-14T10:00:00Z' },
];
const mails = [
  { id: '1', action: 'emailed', note: null, touch: 1, created_at: '2026-10-13T08:00:00Z' },
  { id: '2', action: 'email_found', note: null, touch: null, created_at: '2026-10-12T12:00:00Z' },
  { id: '3', action: 'form_sent', note: 'via their site', touch: 2, created_at: '2026-10-15T08:00:00Z' },
];
const tl = buildTimeline(calls, mails, o => `call:${o}`, a => `mail:${a}`);
eq('newest first, both channels interleaved', tl.map(e => e.label), ['mail:form_sent (touch 2)', 'call:voicemail', 'mail:emailed (touch 1)', 'mail:email_found', 'call:no_answer']);
eq('channels', tl.map(e => e.channel), ['email', 'call', 'email', 'email', 'call']);
eq('finding an address is not a send', tl.filter(e => e.channel === 'email').map(e => e.isSend), [true, true, false]);
eq('counts: 2 calls, 2 sends', touchCounts(tl), { calls: 2, emails: 2 });
eq('notes travel', tl[0].note, 'via their site');
eq('empty', buildTimeline([], [], String, String), []);

/* ─── Next steps ─── */
const NOW = new Date('2026-10-14T12:00:00Z');
const lead = (o: Partial<PlanLead>): PlanLead => ({
  status: 'new', next_call_at: null, attempt_count: 0, email: null, phone_e164: '+12125550100', phone_is_us: true,
  outreach_touches: 0, outreach_due: null, ...o,
});
const labels = (l: PlanLead, after = 2) => nextSteps(l, after, NOW).map(s => `${s.channel}: ${s.label}`);

eq('fresh phone lead', labels(lead({})), ['call: First call']);
eq('retry, not due yet', nextSteps(lead({ status: 'retry', attempt_count: 1, next_call_at: '2026-10-15T10:00:00Z' }), 2, NOW).map(s => [s.label, s.overdue]), [['Call again (attempt 2)', false]]);
eq('retry, overdue', nextSteps(lead({ status: 'retry', attempt_count: 1, next_call_at: '2026-10-13T10:00:00Z' }), 2, NOW)[0].overdue, true);
eq('2 misses and an email → email too', labels(lead({ status: 'retry', attempt_count: 2, next_call_at: '2026-10-16T10:00:00Z', email: 'a@b.co' })),
  ['call: Call again (attempt 3)', 'email: Email them too — the calls haven’t connected']);
eq('2 misses and NO email → find one', labels(lead({ status: 'retry', attempt_count: 2, next_call_at: '2026-10-16T10:00:00Z' }))[1], 'email: Find an email — the calls haven’t connected');
eq('1 miss is too early for email', labels(lead({ status: 'retry', attempt_count: 1, next_call_at: '2026-10-16T10:00:00Z', email: 'a@b.co' })), ['call: Call again (attempt 2)']);
eq('threshold 0 turns the email nudge off', labels(lead({ status: 'retry', attempt_count: 5, next_call_at: '2026-10-16T10:00:00Z', email: 'a@b.co' }), 0), ['call: Call again (attempt 6)']);
eq('no phone, has email', labels(lead({ status: 'no_phone', phone_e164: null, phone_is_us: null, email: 'a@b.co' })), ['email: Send the first email']);
eq('no phone, no email', labels(lead({ status: 'no_phone', phone_e164: null, phone_is_us: null })), ['email: Find an email address']);
eq('non-US number is emailed, not dialled', labels(lead({ status: 'new', phone_e164: '+442071004189', phone_is_us: false, email: 'a@b.co' })), ['email: Send the first email']);
eq('mid-sequence: next touch and when', nextSteps(lead({ status: 'no_phone', phone_e164: null, phone_is_us: null, email: 'a@b.co', outreach_touches: 1, outreach_due: '2026-10-13T00:00:00Z' }), 2, NOW).map(s => [s.label, s.overdue]), [['Email follow-up (touch 2 of 4)', true]]);
eq('sequence finished: nothing more by email', labels(lead({ status: 'no_phone', phone_e164: null, phone_is_us: null, email: 'a@b.co', outreach_touches: 4, outreach_due: null })), []);
eq('callback', labels(lead({ status: 'callback', next_call_at: '2026-10-14T09:00:00Z' })), ['call: Call back (they asked for it)']);
eq('with the team', labels(lead({ status: 'followup' })), ['team: Waiting on the team to follow up']);
eq('meeting', labels(lead({ status: 'meeting', next_call_at: '2026-10-16T14:00:00Z' })), ['team: Meeting']);
eq('closed leads have no next step', [labels(lead({ status: 'lost' })), labels(lead({ status: 'dnc' })), labels(lead({ status: 'exhausted' }))], [[], [], []]);
eq('nurture: call again later', labels(lead({ status: 'nurture', next_call_at: '2027-01-01T10:00:00Z' })), ['call: Call again (they said not now)']);

/* ─── Calendar file ─── */
eq('UTC date format', icsDate(new Date('2026-10-14T14:05:09Z')), '20261014T140509Z');
eq('escaping', icsEscape('a, b; c\\d\ne'), 'a\\, b\\; c\\\\d\\ne');
eq('folding leaves short lines alone', fold('SUMMARY:short'), 'SUMMARY:short');
const long = 'DESCRIPTION:' + 'x'.repeat(200);
const folded = fold(long).split('\r\n');
eq('long lines fold at 75 octets', folded.every(l => new TextEncoder().encode(l).length <= 75), true);
eq('continuation lines start with a space', folded.slice(1).every(l => l.startsWith(' ')), true);
eq('unfolding restores the original', folded.map((l, i) => (i ? l.slice(1) : l)).join(''), long);
const accents = 'SUMMARY:' + 'é'.repeat(80);
eq('a multi-byte letter is never split across lines', fold(accents).split('\r\n').map((l, i) => (i ? l.slice(1) : l)).join(''), accents);
eq('…and every folded line stays within 75 bytes', fold(accents).split('\r\n').every(l => new TextEncoder().encode(l).length <= 75), true);

const ics = meetingIcs(
  { id: 'abc-123', company_name: 'Acme, Inc.', contact_name: 'Dana Roe', email: 'dana@acme.io', phone_raw: '(212) 555-0100', website: 'https://acme.io' },
  new Date('2026-10-15T15:00:00Z'), 30, 'Wants the team model; budget this quarter', 'https://www.xtenzium.com/crm/inbox', new Date('2026-10-14T00:00:00Z'),
);
eq('CRLF line ends throughout', ics.split('\r\n').length > 10 && !ics.replace(/\r\n/g, '').includes('\n'), true);
eq('calendar wrapper', [ics.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0'), ics.trimEnd().endsWith('END:VCALENDAR')], [true, true]);
eq('start and end (30 min)', [ics.includes('DTSTART:20261015T150000Z'), ics.includes('DTEND:20261015T153000Z')], [true, true]);
eq('title is escaped', ics.includes('SUMMARY:Xtenzium × Acme\\, Inc.'), true);
eq('stable id, so re-importing updates instead of duplicating', ics.includes('UID:meeting-abc-123@xtenzium.com'), true);
eq('stamp is the injected time', ics.includes('DTSTAMP:20261014T000000Z'), true);
eq('the prospect is an attendee', ics.includes('ATTENDEE;ROLE=REQ-PARTICIPANT;CN="Dana Roe":mailto:dana@acme.io'), true);
eq('call notes are in the description', ics.replace(/\r\n /g, '').includes('From the call: Wants the team model\\; budget this quarter'), true);
eq('no attendee when there is no email', meetingIcs({ id: 'x', company_name: 'No Email Co', contact_name: null, email: null, phone_raw: null, website: null }, new Date('2026-10-15T15:00:00Z'), 30, null, 'https://x', new Date()).includes('ATTENDEE'), false);
eq('the same input gives the same file', buildIcs({ uid: 'u', title: 't', start: new Date(0), end: new Date(60000), now: new Date(0) }), buildIcs({ uid: 'u', title: 't', start: new Date(0), end: new Date(60000), now: new Date(0) }));
eq('file names are safe', [icsFileName('Acme, Inc. / West'), icsFileName('***'), icsFileName('')], ['Acme-Inc-West-meeting.ics', 'meeting-meeting.ics', 'meeting-meeting.ics']);
eq('DTEND is after DTSTART by exactly the duration', (() => { const m = ics.match(/DTSTART:(\d+T\d+Z)[\s\S]*DTEND:(\d+T\d+Z)/)!; return [m[1] < m[2]]; })(), [true]);

/* ─── Summary text ─── */
const data: SummaryData = {
  from: '2026-10-13T03:00:00Z', to: '2026-10-14T03:00:00Z',
  calls: { dials: 62, conversations: 14, interested: 5, meetings: 2 },
  by_outcome: [{ outcome: 'no_answer', n: 31 }, { outcome: 'voicemail', n: 17 }, { outcome: 'meeting_booked', n: 2 }],
  outreach: { sent: 9, replies: 1, opted_out: 0 },
  hot: [{ company: 'Acme <Agency>', outcome: 'interested_proposal', note: 'wants pricing for a 3-person team' }],
  needs_you: {
    followups: [{ company: 'Acme <Agency>', type: 'email_proposal', assignee: 'Sharab Khan', note: 'wants pricing', age_hours: 7 }, { company: 'Beta', type: 'admin_call', assignee: null, note: null, age_hours: 50 }],
    flagged: [{ company: 'Gamma', outcome: 'meeting_booked', note: null }],
    meetings: [{ company: 'Gamma', at: '2026-10-15T14:00:00Z', contact: 'Lee', email: null }],
    callbacks_due: 2, retries_due: 11, outreach_due: 4,
  },
};
const r = renderSummary(data, { tz: 'Asia/Karachi', crmUrl: 'https://www.xtenzium.com/crm' });
eq('subject has the headline numbers and what is waiting', r.subject, 'Xtenzium dialer — Wed, Oct 14: 62 dials, 14 conversations, 2 meetings · 4 waiting on you');
eq('text: the day in numbers', r.text.includes('62 dials · 14 conversations · 5 interested · 2 meetings agreed'), true);
eq('text: outcomes', r.text.includes('Outcomes: No answer 31, Voicemail 17, Meeting agreed 2'), true);
eq('text: email line', r.text.includes('9 emails sent · 1 reply'), true);
eq('text: the rep\'s words', r.text.includes('Acme <Agency> — Wants a proposal — “wants pricing for a 3-person team”'), true);
eq('text: who has each follow-up', [r.text.includes('(Sharab Khan), waiting 7h'), r.text.includes('(unassigned), waiting 2d')], [true, true]);
eq('text: a meeting with no email says so', r.text.includes('Meeting: Gamma') && r.text.includes('no email yet'), true);
eq('text: queue', r.text.includes('2 callbacks · 11 due to retry · 4 email follow-ups'), true);
eq('text: link', r.text.includes('https://www.xtenzium.com/crm/inbox'), true);
eq('html escapes company names', [r.html.includes('Acme &lt;Agency&gt;'), r.html.includes('<Agency>')], [true, false]);
const quiet = renderSummary({ ...data, calls: { dials: 0, conversations: 0, interested: 0, meetings: 0 }, by_outcome: [], outreach: { sent: 0, replies: 0, opted_out: 0 }, hot: [], needs_you: { followups: [], flagged: [], meetings: [], callbacks_due: 0, retries_due: 0, outreach_due: 0 } });
eq('a quiet day says so', [quiet.text.includes('No calls or emails were logged.'), quiet.text.includes('Nothing is waiting on you.'), quiet.subject.includes('waiting on you')], [true, true, false]);
eq('singular grammar', renderSummary({ ...data, calls: { dials: 1, conversations: 1, interested: 0, meetings: 0 } }).subject.includes('1 dial, 1 conversation'), true);
const longNote = renderSummary({ ...data, hot: [{ company: 'X', outcome: 'callback', note: 'n'.repeat(400) }] });
eq('very long notes are cut short', longNote.text.includes('…') && !longNote.text.includes('n'.repeat(200)), true);

if (failures) {
  console.error(`${failures} touch/ics/summary check(s) failed`);
  process.exit(1);
}
console.log('touch-ics-summary: all checks passed');
