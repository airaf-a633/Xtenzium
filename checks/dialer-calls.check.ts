/* Call-screen helper checks: outcome table integrity, phone display,
   and the timezone maths (the part most likely to be quietly wrong). */

import {
  OUTCOMES, clockFor, dayStartInZone, dayStats, formatInZone, formatPhone,
  isConversation, outcomeByShortcut, voiceLink, zonedToUtc,
  BOARD_COLUMNS, columnForStatus, filterPeople, gmailCompose, insertMention, mentionLabel,
  extraDetails, extraLinks, instantOutcome, safeHref, mentionsIn, mentionTrigger, outcomeLabel, parseTiers, renderTemplate, scriptVars, segmentLabel, tiersParam,
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
  'interested_info', 'interested_proposal', 'interested_call', 'meeting_booked', 'not_interested_inhouse',
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

/* Board: every outcome a column accepts must be a real one, and no outcome lands in two columns. */
const known = new Set<string>(OUTCOMES.map(o => o.key));
eq('board outcomes are real', BOARD_COLUMNS.flatMap(c => c.outcomes).every(k => known.has(k)), true);
const placed = BOARD_COLUMNS.flatMap(c => c.outcomes);
eq('no outcome in two columns', new Set(placed).size, placed.length);
eq('every outcome has a column', OUTCOMES.every(o => placed.includes(o.key)), true);
eq('every lead status has a column', ['new','retry','callback','followup','meeting','nurture','lost','disqualified','bad_data','dnc','exhausted'].every(s => columnForStatus(s)), true);
eq('no_phone leads are not on the board', columnForStatus('no_phone'), undefined);
eq('exhausted shows under Closed', columnForStatus('exhausted')?.key, 'closed');
eq('outcome label', outcomeLabel('meeting_booked'), 'Meeting agreed');
eq('unknown outcome label', outcomeLabel('some_new_thing'), 'some new thing');

/* Templates */
eq('merge fields', renderTemplate('Hi {{contact_name}}, re {{company_name}}', { contact_name: 'Dana', company_name: 'Acme' }), 'Hi Dana, re Acme');
eq('spaces inside braces', renderTemplate('{{ company_name }}', { company_name: 'Acme' }), 'Acme');
eq('unknown field stays visible', renderTemplate('Hi {{nme}}', { contact_name: 'x' }), 'Hi {{nme}}');
eq('null field becomes empty', renderTemplate('A{{rep_note}}B', { rep_note: null }), 'AB');
eq('empty note closes the gap', renderTemplate('Line\n\n{{rep_note}}\n\nNext', { rep_note: '' }), 'Line\n\nNext');
eq('script placeholders with spaces are untouched', renderTemplate('{{contact or the owner}}', {}), '{{contact or the owner}}');
eq('gmail link', gmailCompose('a@b.co', 'Hi & bye', 'x\ny'), 'https://mail.google.com/mail/?view=cm&fs=1&to=a%40b.co&su=Hi%20%26%20bye&body=x%0Ay');
eq('gmail link with no address', gmailCompose(null, 's', 'b').includes('&to=&'), true);

/* @mentions */
const team = [{ id: '1', name: 'Airaf Adil' }, { id: '2', name: 'Sharab Khan' }, { id: '3', name: 'Umar Siddiqui' }, { id: '4', name: 'Umar Farooq' }];
eq('typing @ai', mentionTrigger('call @ai', 8), { start: 5, query: 'ai' });
eq('bare @', mentionTrigger('hi @', 4), { start: 3, query: '' });
eq('start of note', mentionTrigger('@sh', 3), { start: 0, query: 'sh' });
eq('email address is not a mention', mentionTrigger('mail x@ai', 9), null);
eq('no @ nearby', mentionTrigger('hello', 5), null);
eq('a finished word after a space is not a trigger', mentionTrigger('@airaf hello', 12), null);
eq('filter by first name', filterPeople(team, 'sh').map(p => p.name), ['Sharab Khan']);
eq('filter by last name', filterPeople(team, 'kh').map(p => p.name), ['Sharab Khan']);
eq('empty query lists everyone', filterPeople(team, '').length, 4);
eq('label is the first name', mentionLabel(team[0], team), 'Airaf');
eq('shared first name uses the full name', mentionLabel(team[2], team), 'Umar Siddiqui');
const ins = insertMention('call @ai now', { start: 5, query: 'ai' }, 8, 'Airaf');
eq('insert replaces the typed fragment', ins.text, 'call @Airaf  now');
eq('caret lands after the inserted name', ins.caret, 12);
eq('first name', mentionsIn('@Airaf please call', team).map(p => p.id), ['1']);
eq('case-insensitive', mentionsIn('cc @SHARAB', team).map(p => p.id), ['2']);
eq('full name picks one of two Umars', mentionsIn('@Umar Siddiqui to call', team).map(p => p.id), ['3']);
eq('a bare shared first name tags nobody', mentionsIn('@Umar to call', team), []);
eq('the other Umar by full name', mentionsIn('@Umar Farooq', team).map(p => p.id), ['4']);
eq('boundary: @Airafx is nobody', mentionsIn('@Airafx', team), []);
eq('punctuation ends a mention', mentionsIn('thanks @Airaf, @Sharab.', team).map(p => p.id), ['1', '2']);
eq('email address is not a mention', mentionsIn('reach me at ai@airaf.com', team), []);
eq('mentioned once even if named twice', mentionsIn('@Airaf and @Airaf Adil', team).length, 1);

/* Instant-log keys */
eq('Shift+1 is no answer', instantOutcome('Digit1', true)?.key, 'no_answer');
eq('Shift+2 is voicemail', instantOutcome('Digit2', true)?.key, 'voicemail');
eq('plain 1 is NOT instant (it opens the note step)', instantOutcome('Digit1', false), undefined);
eq('other digits are not instant', [instantOutcome('Digit3', true), instantOutcome('KeyA', true)], [undefined, undefined]);

/* Tier filter */
eq('nothing picked = no filter', tiersParam([]), null);
eq('A, B, C and none picked stays an explicit list, so parked D stays out', tiersParam(['A', 'B', 'C', '-']), ['A', 'B', 'C', '-']);
eq('D is only served when picked', tiersParam(['D']), ['D']);
eq('some picked', tiersParam(['A', 'B']), ['A', 'B']);
eq('parse saved tiers', parseTiers('A,-,C'), ['A', '-', 'C']);
eq('parse drops junk', parseTiers('A,Z,,x'), ['A']);
eq('parse knows D', parseTiers('A,D'), ['A', 'D']);

/* Segments and the extra columns a file carried */
eq('segment labels', [segmentLabel('agency'), segmentLabel('dev_shop'), segmentLabel(null), segmentLabel('nope')], ['Agency', 'Dev shop', null, null]);
eq('social links: full urls, handles and bare domains',
  extraLinks({ linkedin: 'https://linkedin.com/company/acme', Instagram: '@acme', facebook: 'facebook.com/acme', Twitter: 'acme_co' }),
  [
    { label: 'LinkedIn', url: 'https://linkedin.com/company/acme' },
    { label: 'Instagram', url: 'https://www.instagram.com/acme' },
    { label: 'Facebook', url: 'https://facebook.com/acme' },
    { label: 'Twitter / X', url: 'https://x.com/acme_co' },
  ]);
eq('a javascript: link in a cell is never made clickable', extraLinks({ linkedin: 'javascript:alert(1)' }), []);
eq('text with spaces is not a link', extraLinks({ linkedin: 'not on linkedin' }), []);
eq('the same link twice shows once', extraLinks({ linkedin: 'https://x.com/a', twitter: 'https://x.com/a' }).length, 1);
eq('other extras become details, socials do not', extraDetails({ size_confidence: 'high', linkedin: 'https://l.com/x', status: 'verified', blank: '  ' }),
  [{ label: 'size confidence', value: 'high' }, { label: 'status', value: 'verified' }]);
eq('no extras at all', [extraLinks(null), extraDetails(undefined)], [[], []]);
eq('usual header names still find the link', extraLinks({ 'LinkedIn URL': 'https://linkedin.com/in/a', 'Instagram Handle': '@acme' }).map(l => l.label), ['LinkedIn', 'Instagram']);
eq('a dotted handle is a handle, not a domain', extraLinks({ instagram: 'john.smith' }), [{ label: 'Instagram', url: 'https://www.instagram.com/john.smith' }]);
eq('"x" must be the whole header', [extraLinks({ x: 'acme' }).length, extraLinks({ 'next steps': 'acme' }).length], [1, 0]);
eq('long extra values are clipped', extraDetails({ notes: 'a'.repeat(500) })[0].value.length, 201);

/* Links from a CSV cell */
eq('a bare domain gets https', safeHref('acme.com'), 'https://acme.com');
eq('www. too', safeHref('www.acme.com/about'), 'https://www.acme.com/about');
eq('http(s) is kept', [safeHref('https://a.co'), safeHref('http://a.co')], ['https://a.co', 'http://a.co']);
eq('other schemes are no link', [safeHref('javascript:alert(1)'), safeHref('mailto:a@b.co'), safeHref('tel:+1212'), safeHref('data:text/html,x')], [null, null, null, null]);
eq('junk and empty', [safeHref(''), safeHref(null), safeHref('not a url'), safeHref('plainword')], [null, null, null, null]);
eq('parse empty / null', [parseTiers(''), parseTiers(null)], [[], []]);

/* Script placeholders */
eq('who, contact known', scriptVars({ company_name: 'Acme', contact_name: 'Dana' }, 'Ryan Lee').who, 'Dana at Acme');
eq('who, contact unknown', scriptVars({ company_name: 'Acme', contact_name: null }, 'Ryan Lee').who, 'a representative at Acme');
eq('who, blank contact', scriptVars({ company_name: 'Acme', contact_name: '   ' }, null).who, 'a representative at Acme');
eq('rep is the first name', scriptVars(null, 'Ryan Lee').rep, 'Ryan');
eq('rep fallback', scriptVars(null, null).rep, 'me');
eq('opener reads naturally', renderTemplate('Am I speaking with {{who}}? I’m {{rep}}.', scriptVars({ company_name: 'Acme', contact_name: null }, 'Ryan')), 'Am I speaking with a representative at Acme? I’m Ryan.');

if (failures) {
  console.error(`${failures} dialer-calls check(s) failed`);
  process.exit(1);
}
console.log('dialer-calls: all checks passed');
