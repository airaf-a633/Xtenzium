/* Dialer import checks.

   Phone cleaning, timezone-from-HQ, header mapping and dedupe verdicts.
   Run against the real call list too by pointing CALL_LIST_CSV at it —
   that prints the same summary the import preview will show. */

import { readFileSync } from 'node:fs';
import { parseCsv } from '../src/lib/csv';
import {
  autoMap, distinctValues, domainOf, guessTier, normalizePhone, prepareRows, stateFromHq, summarize, tierFor,
  type KnownKeys,
} from '../src/lib/dialer-import';

let failures = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    failures++;
    console.error(`FAIL ${name}\n  got  ${JSON.stringify(got)}\n  want ${JSON.stringify(want)}`);
  }
};

/* Phones — every shape that is actually in the file. */
eq('us formatted', normalizePhone('(212) 380-1761', true), { e164: '+12123801761', isUs: true });
eq('us toll free', normalizePhone('(888) 982-8269', true), { e164: '+18889828269', isUs: true });
eq('us 11 digit', normalizePhone('1-305-777-0471'), { e164: '+13057770471', isUs: true });
eq('us bad area code', normalizePhone('(112) 380-1761', true), { e164: null, isUs: false });
eq('us too short', normalizePhone('380-1761', true), { e164: null, isUs: false });
eq('double 00 prefix', normalizePhone('+0017178849789'), { e164: '+17178849789', isUs: true });
eq('uk plus', normalizePhone('+442071004189'), { e164: '+442071004189', isUs: false });
eq('de punctuation', normalizePhone('+49 (9 11) 81 52 3-0'), { e164: '+4991181523 0'.replace(' ', ''), isUs: false });
eq('au bare country code', normalizePhone('61 2 8973 1908'), { e164: '+61289731908', isUs: false });
eq('00 intl', normalizePhone('00409320165'), { e164: '+409320165', isUs: false });
eq('blank', normalizePhone(''), { e164: null, isUs: false });
eq('letters', normalizePhone('call us'), { e164: null, isUs: false });
eq('too long', normalizePhone('+1234567890123456'), { e164: null, isUs: false });

/* Geography */
eq('city, state', stateFromHq('Coral Gables, Florida'), { state: 'FL', timezone: 'America/New_York' });
eq('multi-word state', stateFromHq('Las Vegas, Nevada'), { state: 'NV', timezone: 'America/Los_Angeles' });
eq('abbreviation', stateFromHq('Austin, TX'), { state: 'TX', timezone: 'America/Chicago' });
eq('country only', stateFromHq('United States'), { state: null, timezone: null });
eq('empty hq', stateFromHq(''), { state: null, timezone: null });

/* Domains */
eq('strips www', domainOf('https://www.1digitalagency.com/'), '1digitalagency.com');
eq('path ignored', domainOf('https://dd.nyc/services/web-design/'), 'dd.nyc');
eq('bare host', domainOf('Acme.IO'), 'acme.io');
eq('empty', domainOf(''), null);

/* Mapping — the real header row, including both rate columns. */
const HEADERS = ['tier','score','name','phone','phone_is_us','role_email','hq','team','hourly_rate','rate_usd','website','contact_url','services','works_count','why','source','profile_url'];
const map = autoMap(HEADERS);
const fieldOf = (h: string) => map[HEADERS.indexOf(h)];
eq('name → company', fieldOf('name'), 'company_name');
eq('role_email → email', fieldOf('role_email'), 'email');
eq('rate_usd beats hourly_rate', fieldOf('rate_usd'), 'hourly_rate_usd');
eq('hourly_rate falls to extra', fieldOf('hourly_rate'), '');
eq('phone_is_us is not the phone', fieldOf('phone_is_us'), '');
eq('hq', fieldOf('hq'), 'hq');
eq('messy headers', autoMap(['Phone Number', 'COMPANY-NAME']), { 0: 'phone', 1: 'company_name' });

/* Rows — verdicts */
const none: KnownKeys = { phones: [], domains: [], dnc_phones: [], dnc_domains: [] };
const H = ['name', 'phone', 'phone_is_us', 'role_email', 'website', 'tier', 'score', 'hq', 'rate_usd', 'notes'];
const m = autoMap(H);
const run = (rows: string[][], known = none) => prepareRows(H, rows, m, known, 2);
const row = (o: Partial<Record<string, string>>) => H.map(h => o[h] ?? '');

const out = run([
  row({ name: 'Alpha', phone: '(212) 380-1761', phone_is_us: 'yes', website: 'https://alpha.com', tier: 'A - call first', score: '110', hq: 'New York City, New York', rate_usd: '$150', notes: 'hi' }),
  row({ name: 'Alpha again', phone: '212-380-1761', phone_is_us: 'yes', website: 'https://other.com' }),
  row({ name: 'Alpha site', phone: '(305) 777-0471', phone_is_us: 'yes', website: 'https://www.alpha.com/x' }),
  row({ name: 'Mail only', role_email: 'Hello@Mail.com', website: 'https://mail.com' }),
  row({ name: 'Broken', phone: '12345', phone_is_us: 'yes', website: 'https://broken.com' }),
  row({ name: '', phone: '(702) 330-4931' }),
  row({ name: 'Known', phone: '(949) 620-1643', phone_is_us: 'yes' }),
  row({ name: 'Blocked', phone: '(415) 555-2671', phone_is_us: 'yes' }),
  row({ name: 'Foreign', phone: '+442071004189' }),
], { ...none, phones: ['+19496201643'], dnc_phones: ['+14155552671'] });

eq('verdicts', out.map(r => r.verdict),
  ['ok', 'dup_file', 'dup_file', 'no_phone', 'bad_phone', 'no_name', 'dup_existing', 'dnc', 'ok']);
eq('row numbers match the spreadsheet', out.map(r => r.rowNumber).slice(0, 3), [2, 3, 4]);

const a = out[0].record!;
eq('record e164', a.phone_e164, '+12123801761');
eq('record tier', a.tier, 'A');
eq('record score', a.score, 110);
eq('record rate', a.hourly_rate_usd, 150);
eq('record state/tz', [a.state, a.timezone], ['NY', 'America/New_York']);
eq('record domain', a.domain, 'alpha.com');
eq('notes maps to why', a.why, 'hi');
eq('us flag column is not extra', a.extra, {});
{
  const h = ['name', 'phone', 'Weird Col'];
  const r = prepareRows(h, [['X', '(212) 380-1761', 'keep me']], autoMap(h), none);
  eq('truly unmapped column kept', r[0].record!.extra, { 'Weird Col': 'keep me' });
}
eq('email lowercased', out[3].record!.email, 'hello@mail.com');
eq('no-phone status', out[3].record!.status, 'no_phone');
eq('bad phone status', out[4].record!.status, 'bad_data');
eq('foreign flagged non-US', out[8].record!.phone_is_us, false);

const s = summarize(out);
eq('summary', [s.callable, s.noPhone, s.badPhone, s.dupFile, s.dupExisting, s.dnc, s.noName, s.toImport, s.nonUs],
  [2, 1, 1, 2, 1, 1, 1, 4, 1]);

/* Tiers: files write priority in many ways. */
eq('letter', guessTier('A'), 'A');
eq('lower-case letter', guessTier('b'), 'B');
eq('the real file\'s wording', guessTier('A - call first'), 'A');
eq('"B - worth a call"', guessTier('B - worth a call'), 'B');
eq('"C - email only"', guessTier('C - email only'), 'C');
eq('Tier B', guessTier('Tier B'), 'B');
eq('tier: a', guessTier('tier: a'), 'A');
eq('hot / warm / cold', [guessTier('Hot'), guessTier('Warm'), guessTier('COLD')], ['A', 'B', 'C']);
eq('high / medium / low', [guessTier('High'), guessTier('Medium'), guessTier('low priority')], ['A', 'B', 'C']);
eq('1 / 2 / 3', [guessTier('1'), guessTier('2'), guessTier('3')], ['A', 'B', 'C']);
eq('"Tier 1"', guessTier('Tier 1'), 'A');
eq('unreadable is left for the person to decide', [guessTier('maybe'), guessTier('7'), guessTier(''), guessTier(null)], [null, null, null, null]);
eq('a word that merely starts with a letter is not a tier', guessTier('banana'), null);

const rows = [['x', 'Hot'], ['y', 'Hot'], ['z', 'Cold'], ['w', ''], ['v', ' Hot ']];
eq('distinct values, most common first, blanks skipped', distinctValues(rows, 1), [{ value: 'Hot', count: 3 }, { value: 'Cold', count: 1 }]);

eq('mapping beats the guess', tierFor('Hot', 99, { tierMap: { Hot: 'C' } }), 'C');
eq('mapping to "no tier" is respected, and not overridden by a score', tierFor('Hot', 99, { tierMap: { Hot: null }, scoreRule: { a: 90, b: 70 } }), null);
eq('unmapped values fall back to the guess', tierFor('Hot', null, { tierMap: { Cold: 'C' } }), 'A');
eq('score rule: A', tierFor(null, 95, { scoreRule: { a: 90, b: 70 } }), 'A');
eq('score rule: B (at the threshold)', tierFor(null, 70, { scoreRule: { a: 90, b: 70 } }), 'B');
eq('score rule: C', tierFor(null, 12, { scoreRule: { a: 90, b: 70 } }), 'C');
eq('score rule needs a score', tierFor(null, null, { scoreRule: { a: 90, b: 70 } }), null);
eq('a stated tier beats the score rule', tierFor('B', 99, { scoreRule: { a: 90, b: 70 } }), 'B');
eq('no tier and no rule', tierFor(null, 99, {}), null);

{
  const h = ['name', 'phone', 'priority', 'rating'];
  const data = [['Acme', '(212) 380-1761', 'Hot', '5'], ['Beta', '(305) 777-0471', 'maybe', '3'], ['Gamma', '(702) 330-4931', '', '88']];
  const mapped = prepareRows(h, data, autoMap(h), none, null, { tierMap: { Hot: 'A', maybe: 'C' }, scoreRule: { a: 90, b: 70 } });
  eq('priority and rating columns are recognised', [autoMap(h)[2], autoMap(h)[3]], ['tier', 'score']);
  eq('end to end: mapped values, and the score rule only for the blank', mapped.map(r => r.record!.tier), ['A', 'C', 'B']);
  const unmapped = prepareRows(h, data, autoMap(h), none, null, {});
  eq('without choices: guess where it can, else none', unmapped.map(r => r.record!.tier), ['A', null, null]);
}

/* The real file, when pointed at it. */
const file = process.env.CALL_LIST_CSV;
if (file) {
  const raw = readFileSync(file, 'utf8');
  const text = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw;
  const [head, ...body] = parseCsv(text).filter(r => r.some(c => c.trim()));
  const real = summarize(prepareRows(head, body, autoMap(head), none, head.indexOf('phone_is_us')));
  console.log('real file:', JSON.stringify(real, null, 1));
}

if (failures) {
  console.error(`${failures} dialer import check(s) failed`);
  process.exit(1);
}
console.log('dialer-import: all checks passed');
