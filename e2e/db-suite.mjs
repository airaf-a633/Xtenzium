// Database test suite for the dialer: REAL Postgres (PGlite, in memory) running every real migration,
// then exercising the queue, permissions (row-level security as each role) and the rules in SQL.
// Run:  npm run test:db
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
import path from 'node:path';

const MIG = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'supabase', 'migrations');
const ADMIN = '00000000-0000-0000-0000-0000000000a1';
const CALLER = '00000000-0000-0000-0000-0000000000c1';
const db = new PGlite();
await db.exec(`
  CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS;
  CREATE SCHEMA auth; CREATE SCHEMA storage;
  CREATE TABLE auth.users (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text, raw_user_meta_data jsonb DEFAULT '{}');
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  CREATE TABLE storage.buckets (id text PRIMARY KEY, name text, public boolean);
  CREATE TABLE storage.objects (id uuid DEFAULT gen_random_uuid(), bucket_id text, name text);
  ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
  GRANT USAGE ON SCHEMA public, auth TO anon, authenticated, service_role;
  INSERT INTO auth.users (id, email) VALUES ('${ADMIN}', 'owner@xtenzium.com');
`);
for (const f of fs.readdirSync(MIG).filter(f => f.endsWith('.sql')).sort()) {
  try { await db.exec(fs.readFileSync(path.join(MIG, f), 'utf8')); } catch (e) { console.log('FAIL', f, e.message.split('\n')[0]); process.exit(1); }
}
await db.exec(`GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
  INSERT INTO auth.users (id, email) VALUES ('${CALLER}', 'rep@xtenzium.com');
  UPDATE public.profiles SET full_name='Rep' WHERE id='${CALLER}';`);
console.log('all migrations applied');
await db.exec('SET dialer.dedupe_seconds = 0');

let bad = 0;
const st = v => JSON.stringify(v, (k, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort()) : x));
const expect = (n, g, w) => { const ok = st(g) === st(w); if (!ok) bad++; console.log(ok ? 'PASS' : 'FAIL', n, '→', st(g), ok ? '' : `(wanted ${st(w)})`); };
const as = async (uid, role, fn) => {
  await db.exec(`SET ROLE ${role}; SELECT set_config('request.jwt.claim.sub','${uid ?? ''}',false);`);
  try { return await fn(); } finally { await db.exec(`RESET ROLE; SELECT set_config('request.jwt.claim.sub','',false);`); }
};
const q = async (s, p) => (await db.query(s, p)).rows;
const fails = async (s, p) => { try { await db.query(s, p); return false; } catch { return true; } };

const zones = (await q(`SELECT name FROM pg_timezone_names WHERE name ~ '^(Asia|Europe|America|Africa|Pacific|Australia|Atlantic|Indian)/' ORDER BY name`)).map(r => r.name);
let OPEN = null;
for (const z of zones) { if ((await q(`SELECT public.dialer_in_window($1) w`, [z]))[0].w) { OPEN = z; break; } }

const listId = (await q(`INSERT INTO public.call_lists (name) VALUES ('L') RETURNING id`))[0].id;
let n = 0;
const mk = async (name, o = {}) => (await q(
  `INSERT INTO public.call_leads (list_id, company_name, phone_e164, phone_is_us, domain, timezone, tier, status, attempt_count, email, next_call_at, outreach_touches, phone_raw)
   VALUES ($1,$2,$3,$4,$5,$6,'B',$7,$8,$9,$10,$11,$3) RETURNING id`,
  [listId, name, o.phone === undefined ? `+1212555${6000 + ++n}` : o.phone, o.us ?? true, `${name.toLowerCase().replace(/\W/g, '')}.com`, OPEN, o.status ?? 'retry', o.attempts ?? 0, o.email ?? null, o.due ?? null, o.touches ?? 0]))[0].id;
const next = (uid, role = 'authenticated', skip = '{}') => as(uid, role, async () => (await q(`SELECT id, company_name FROM public.dialer_next_lead($1::uuid[], true)`, [skip]))[0]?.company_name ?? null);
const skipIt = (uid, id) => as(uid, 'authenticated', async () => (await q(`SELECT public.dialer_skip_lead($1) t`, [id]))[0].t);
const log27 = (uid, id, outcome, at) => as(uid, 'authenticated', async () => (await q(`SELECT public.log_call($1,$2,'{}'::text[],NULL,false,$3::timestamptz) r`, [id, outcome, at ?? null]))[0].r);
const statusOf = async id => (await q(`SELECT status FROM public.call_leads WHERE id = $1`, [id]))[0].status;
const actCount = async id => (await q(`SELECT count(*)::int n FROM public.call_activities WHERE lead_id = $1`, [id]))[0].n;

console.log('— 026 skip is remembered —');
const SA = await mk('SkipA', { status: 'new' });
const SB = await mk('SkipB', { status: 'new' });
await db.exec(`UPDATE public.call_leads SET score = 90 WHERE id = '${SA}'; UPDATE public.call_leads SET score = 10 WHERE id = '${SB}'`);
expect('highest score first', await next(CALLER), 'SkipA');
await skipIt(CALLER, SA);
expect('skipped lead not served again', await next(CALLER), 'SkipB');
await as(CALLER, 'authenticated', async () => q(`SELECT public.dialer_unskip_lead($1)`, [SA]));
expect('un-skip puts it back', await next(CALLER), 'SkipA');
await skipIt(CALLER, SA);
await log27(CALLER, SA, 'no_answer');
expect('logging a call clears the snooze', (await q(`SELECT snoozed_until FROM public.call_leads WHERE id = $1`, [SA]))[0].snoozed_until, null);

console.log('— 027 nurture, DNC, duplicates, guards —');
await db.exec(`UPDATE public.call_leads SET status = 'lost' WHERE status IN ('new','retry')`);
const N1 = await mk('Nurture1', { status: 'nurture', due: new Date(Date.now() - 3600e3).toISOString() });
expect('a due nurture lead is served', await next(CALLER), 'Nurture1');
await db.exec(`UPDATE public.call_leads SET next_call_at = now() + interval '30 days' WHERE id = '${N1}'`);
expect('not yet due: no', await next(CALLER), null);

await db.exec('SET dialer.dedupe_seconds = 20');
const D1 = await mk('Dup1', { status: 'new' });
const r1 = await log27(CALLER, D1, 'no_answer');
const r2 = await log27(CALLER, D1, 'no_answer');
expect('identical log within 20s is returned, not repeated', [r2.duplicate, r2.activity_id, await actCount(D1)], [true, r1.activity_id, 1]);
await db.exec('SET dialer.dedupe_seconds = 0');

const DN = await mk('Dnc1', { status: 'new' });
await log27(CALLER, DN, 'dnc');
expect('logging on a DNC lead is refused', await as(CALLER, 'authenticated', () => fails(`SELECT public.log_call('${DN}','no_answer')`)), true);
const dncPhone = (await q(`SELECT phone_e164 p FROM public.call_leads WHERE id = $1`, [DN]))[0].p;
const rows = JSON.stringify([{ company_name: 'Back again', phone_e164: dncPhone, phone_is_us: true, domain: 'backagain.com', status: 'new' }, { company_name: 'Fresh one', phone_e164: '+12125559999', phone_is_us: true, domain: 'fresh1.com', status: 'new' }]);
expect('an import skips DNC numbers', await as(CALLER, 'authenticated', async () => (await q(`SELECT public.import_call_leads($1, $2::jsonb) n`, [listId, rows]))[0].n), 1);

const P = await mk('Direct1', { status: 'new' });
const patch = (uid, set) => as(uid, 'authenticated', () => fails(`UPDATE public.call_leads SET ${set} WHERE id = '${P}'`));
expect('a rep cannot change status or phone directly', [await patch(CALLER, `status = 'lost'`), await patch(CALLER, `phone_e164 = '+12125550000'`)], [true, true]);
expect('but can change tier', await patch(CALLER, `tier = 'A'`), false);
expect('an admin can edit', await patch(ADMIN, `status = 'lost'`), false);

const F = await mk('Fix1', { status: 'new' });
expect('fix phone', await as(CALLER, 'authenticated', async () => (await q(`SELECT public.dialer_fix_phone($1,'(212) 555-7777','+12125557777',true) s`, [F]))[0].s), 'new');
const log = (uid, id, outcome) => as(uid, 'authenticated', async () => (await q(`SELECT public.log_call($1,$2,'{}'::text[],NULL,false,NULL) r`, [id, outcome]))[0].r);
const tier = (id, t) => db.exec(`UPDATE public.call_leads SET tier = ${t ? `'${t}'` : 'NULL'}, score = ${t === 'D' ? 1 : 50} WHERE id = '${id}'`);
const withTiers = (tiers) => as(CALLER, 'authenticated', async () => (await q(`SELECT company_name FROM public.dialer_next_lead('{}', true, NULL, $1::text[])`, [tiers]))[0]?.company_name ?? null);

console.log('\n— tier D is parked —');
await db.exec(`UPDATE public.call_leads SET status = 'lost' WHERE status IN ('new','retry','nurture','callback')`);
const A = await mk('TierA', { status: 'new' }); await tier(A, 'A');
const D = await mk('TierD', { status: 'new' }); await tier(D, 'D');
expect('D is a valid tier', (await q(`SELECT tier FROM public.call_leads WHERE id = $1`, [D]))[0].tier, 'D');
expect('E is not', await fails(`UPDATE public.call_leads SET tier = 'E' WHERE id = '${D}'`), true);
expect('the default queue serves A', await next(CALLER), 'TierA');
await db.exec(`UPDATE public.call_leads SET status = 'lost' WHERE id = '${A}'`);
expect('with only D left, the default queue is empty', await next(CALLER), null);
expect('asking for D by name serves it', await withTiers(['D']), 'TierD');
const tc = await as(CALLER, 'authenticated', async () => (await q(`SELECT public.dialer_tier_counts() c`))[0].c);
expect('tier counts carry D', tc.D, 1);
const ls = await as(CALLER, 'authenticated', async () => (await q(`SELECT public.dialer_list_summary() s`))[0].s);
const row = ls.find(x => x.id === listId);
const expectInPlay = (await q(`SELECT count(*)::int n FROM public.call_leads WHERE list_id = $1 AND status IN ('new','retry','callback') AND phone_is_us AND phone_e164 IS NOT NULL AND tier IS DISTINCT FROM 'D'`, [listId]))[0].n;
expect('parked leads are out of the queued count but counted as parked', [row.parked >= 1, row.in_play], [true, expectInPlay]);
expect('re-tier accepts D', await as(ADMIN, 'authenticated', async () => (await q(`SELECT public.retier_leads($1,'D','C') n`, [listId]))[0].n), 1);

console.log('\n— never the same lead twice in a day —');
await db.exec(`UPDATE public.call_leads SET status = 'lost' WHERE status IN ('new','retry','nurture','callback')`);
const R = await mk('RetryToday', { status: 'retry', due: new Date(Date.now() - 3600e3).toISOString() });
expect('a due retry is served', await next(CALLER), 'RetryToday');
await db.exec(`UPDATE public.call_leads SET last_called_at = now() WHERE id = '${R}'`);
expect('but not if it was already called today', await next(CALLER), null);
await db.exec(`UPDATE public.call_leads SET last_called_at = now() - interval '2 days' WHERE id = '${R}'`);
expect('and it is back when its last call was before today', await next(CALLER), 'RetryToday');
await db.exec(`UPDATE public.call_leads SET status = 'callback', last_called_at = now() WHERE id = '${R}'`);
expect('a promised callback is exempt', await next(CALLER), 'RetryToday');

console.log('\n— segments —');
const imp = rows => as(CALLER, 'authenticated', async () => (await q(`SELECT public.import_call_leads($1, $2::jsonb) n`, [listId, JSON.stringify(rows)]))[0].n);
expect('import carries segment and tier D', await imp([{ company_name: 'Seg1', phone_raw: '+12125550101', phone_e164: '+12125550101', phone_is_us: true, domain: 'seg1.com', segment: 'dev_shop', tier: 'D', status: 'new' }]), 1);
const seg = (await q(`SELECT segment, tier FROM public.call_leads WHERE company_name = 'Seg1'`))[0];
expect('stored', seg, { segment: 'dev_shop', tier: 'D' });
expect('a bad segment is rejected', await as(CALLER, 'authenticated', () => fails(`SELECT public.import_call_leads('${listId}', '[{"company_name":"Seg2","phone_e164":"+12125550102","phone_is_us":true,"segment":"nope","status":"new"}]'::jsonb)`)), true);
await log(CALLER, (await q(`SELECT id FROM public.call_leads WHERE company_name='Seg1'`))[0].id, 'no_answer');
const rep = await as(ADMIN, 'authenticated', async () => (await q(`SELECT public.dialer_report_segments(now() - interval '1 day', now() + interval '1 day') r`))[0].r);
expect('the report splits by segment', rep.find(x => x.segment === 'dev_shop')?.dials, 1);
expect('a rep cannot read the report', await as(CALLER, 'authenticated', () => fails(`SELECT public.dialer_report_segments(now(), now())`)), true);

console.log('\n— an inbound caller —');
const mkIn = (company, e164, o = {}) => as(CALLER, 'authenticated', async () => (await q(`SELECT public.dialer_create_lead($1,$2,$3,true,$4,NULL,$5,$6,$7) r`, [company, e164, e164, o.contact ?? null, o.email ?? null, o.site ?? null, o.domain ?? null]))[0].r);
const n1 = await mkIn('Called Back LLC', '+13105550123', { contact: 'Dana' });
expect('a new caller becomes a lead', [n1.existing, n1.lead.company_name, n1.lead.source, n1.lead.status], [false, 'Called Back LLC', 'inbound', 'new']);
const n2 = await mkIn('Called Back LLC (again)', '+13105550123');
expect('the same number returns the same lead', [n2.existing, n2.lead.id === n1.lead.id], [true, true]);
const n3 = await mkIn('Other name', '+13105550999', { site: 'https://seg1.com', domain: 'seg1.com' });
expect('the same website returns the existing lead', n3.existing, true);
expect('a company is required', await as(CALLER, 'authenticated', () => fails(`SELECT public.dialer_create_lead('  ','+13105550777','+13105550777',true)`)), true);
expect('a phone or email is required', await as(CALLER, 'authenticated', () => fails(`SELECT public.dialer_create_lead('NoContact',NULL,NULL,NULL)`)), true);
expect('junk phone refused', await as(CALLER, 'authenticated', () => fails(`SELECT public.dialer_create_lead('Junk','abc','abc',true)`)), true);
await db.exec(`INSERT INTO public.dnc_list (phone_e164) VALUES ('+13105550888')`);
expect('do-not-call numbers are refused', await as(CALLER, 'authenticated', () => fails(`SELECT public.dialer_create_lead('Dnc Co','+13105550888','+13105550888',true)`)), true);
expect('email-only is allowed (no phone)', (await as(CALLER, 'authenticated', async () => (await q(`SELECT public.dialer_create_lead('Email Only',NULL,NULL,NULL,NULL,NULL,'a@b.co') r`))[0].r)).lead.status, 'no_phone');
expect('anonymous cannot', await as(null, 'anon', () => fails(`SELECT public.dialer_create_lead('X','+13105550666','+13105550666',true)`)), true);
const logged = await log(CALLER, n1.lead.id, 'interested_info');
expect('the inbound lead can be logged like any other', logged.status, 'followup');


console.log('\n— second-sweep fixes —');
await db.exec(`UPDATE public.call_leads SET status = 'lost' WHERE status IN ('new','retry','nurture','callback')`);

// F1: "once a day" follows the LEAD's local date
const X = await mk('LocalDay', { status: 'retry', due: new Date(Date.now() - 3600e3).toISOString() });
await db.exec(`UPDATE public.call_leads SET last_called_at = ((date_trunc('day', now() AT TIME ZONE '${OPEN}') - interval '1 hour') AT TIME ZONE '${OPEN}') WHERE id = '${X}'`);
expect('called late yesterday (its local time) → served today', await next(CALLER), 'LocalDay');
await db.exec(`UPDATE public.call_leads SET last_called_at = ((date_trunc('day', now() AT TIME ZONE '${OPEN}') + interval '1 minute') AT TIME ZONE '${OPEN}') WHERE id = '${X}'`);
const stillToday = (await q(`SELECT (now() AT TIME ZONE '${OPEN}') >= date_trunc('day', now() AT TIME ZONE '${OPEN}') + interval '1 minute' ok`))[0].ok;
expect('called earlier today (its local time) → not served again', stillToday ? await next(CALLER) : null, null);

// F2: a promised callback on a parked lead is served
const PD = await mk('ParkedCb', { status: 'callback', due: new Date(Date.now() - 600e3).toISOString() });
await db.exec(`UPDATE public.call_leads SET tier = 'D' WHERE id = '${PD}'`);
expect('callback on a D lead is served without ticking D', await next(CALLER), 'ParkedCb');
await db.exec(`UPDATE public.call_leads SET status = 'retry' WHERE id = '${PD}'`);
expect('but an ordinary D retry is not', await next(CALLER), null);

// F3: re-tier by score leaves parked leads alone
await db.exec(`UPDATE public.call_leads SET score = 99 WHERE id = '${PD}'`);
await as(ADMIN, 'authenticated', async () => q(`SELECT public.retier_by_score($1, 90, 50)`, [listId]));
expect('retier_by_score does not un-park', (await q(`SELECT tier FROM public.call_leads WHERE id = $1`, [PD]))[0].tier, 'D');

// F4: a nurture lead can be skipped
const NU = await mk('NurtureSkip', { status: 'nurture', due: new Date(Date.now() - 3600e3).toISOString() });
expect('skip works on a due nurture lead', (await skipIt(CALLER, NU)) !== null, true);

// F9: retrying a DNC log whose response was lost returns the first result
await db.exec('SET dialer.dedupe_seconds = 20');
const DL = await mk('DncRetry', { status: 'new' });
const d1 = await as(CALLER, 'authenticated', async () => (await q(`SELECT public.log_call($1,'dnc','{}'::text[],NULL,false,NULL) r`, [DL]))[0].r);
const d2 = await as(CALLER, 'authenticated', async () => (await q(`SELECT public.log_call($1,'dnc','{}'::text[],NULL,false,NULL) r`, [DL]))[0].r);
expect('the retry returns the first DNC log', [d2.duplicate, d2.activity_id], [true, d1.activity_id]);
await db.exec('SET dialer.dedupe_seconds = 0');

// F12: the email worklist leaves parked leads out
const OD = await mk('ParkedEmail', { status: 'no_phone', phone: null, email: 'p@parked.co' });
await db.exec(`UPDATE public.call_leads SET tier = 'D' WHERE id = '${OD}'`);
const ol = tabs => as(CALLER, 'authenticated', async () => (await q(`SELECT company_name FROM public.outreach_list('to_email', 100, 0, $1::text[])`, [tabs])).map(r => r.company_name));
expect('parked lead not on the email list by default', (await ol(null)).includes('ParkedEmail'), false);
expect('…but is when D is asked for', (await ol(['D'])).includes('ParkedEmail'), true);

// F18: a rep cannot re-segment a lead or change its file data
const SG = await mk('SegGuard', { status: 'new' });
expect('segment / extra are guarded', [await as(CALLER, 'authenticated', () => fails(`UPDATE public.call_leads SET segment = 'agency' WHERE id = '${SG}'`)), await as(CALLER, 'authenticated', () => fails(`UPDATE public.call_leads SET extra = '{"a":"b"}' WHERE id = '${SG}'`))], [true, true]);

console.log('\n— caller id —');
expect('the default number is set', (await q(`SELECT caller_id_number c FROM public.dialer_settings`))[0].c, '+14072438456');
expect('a rep can read it', await as(CALLER, 'authenticated', async () => (await q(`SELECT caller_id_number c FROM public.dialer_settings`))[0].c), '+14072438456');
expect('an admin can change it', await as(ADMIN, 'authenticated', () => fails(`UPDATE public.dialer_settings SET caller_id_number = '+13105550100' WHERE id = true`)), false);
expect('a rep cannot', await as(CALLER, 'authenticated', async () => { await db.query(`UPDATE public.dialer_settings SET caller_id_number = '+13105550199' WHERE id = true`); return (await q(`SELECT caller_id_number c FROM public.dialer_settings`))[0].c; }), '+13105550100');
expect('a non-US or malformed number is refused', [await fails(`UPDATE public.dialer_settings SET caller_id_number = '4072438456'`), await fails(`UPDATE public.dialer_settings SET caller_id_number = '+44 20 7946 0958'`), await fails(`UPDATE public.dialer_settings SET caller_id_number = '+10002438456'`)], [true, true, true]);
expect('it can be cleared', await fails(`UPDATE public.dialer_settings SET caller_id_number = NULL`), false);

console.log('\n— e2e fixes (030) —');
await db.exec(`UPDATE public.call_leads SET status = 'lost' WHERE status IN ('new','retry','nurture','callback')`);

// 1 · a rep's import saves its totals
const myList = await as(CALLER, 'authenticated', async () => (await q(`INSERT INTO public.call_lists (name, source_filename) VALUES ('Rep list','r.csv') RETURNING id`))[0].id);
await as(CALLER, 'authenticated', async () => q(`SELECT public.finish_import($1, 120, 7)`, [myList]));
expect('the rep\'s totals are saved', (await q(`SELECT row_count, skipped_count FROM public.call_lists WHERE id = $1`, [myList]))[0], { row_count: 120, skipped_count: 7 });
const adminList = await as(ADMIN, 'authenticated', async () => (await q(`INSERT INTO public.call_lists (name) VALUES ('Admin list') RETURNING id`))[0].id);
await as(CALLER, 'authenticated', async () => q(`SELECT public.finish_import($1, 999, 9)`, [adminList]));
expect('…but not on a list someone else uploaded', (await q(`SELECT row_count FROM public.call_lists WHERE id = $1`, [adminList]))[0].row_count, 0);
await as(ADMIN, 'authenticated', async () => q(`SELECT public.finish_import($1, 50, 1)`, [adminList]));
expect('an admin can finish any list', (await q(`SELECT row_count FROM public.call_lists WHERE id = $1`, [adminList]))[0].row_count, 50);
expect('anonymous cannot', await as(null, 'anon', () => fails(`SELECT public.finish_import('${myList}', 1, 1)`)), true);

// 2 · the workday starts at noon for a Karachi caller
await db.exec(`UPDATE public.profiles SET timezone = 'Asia/Karachi', workday_start_hour = 12 WHERE id = '${CALLER}'`);
const ws = await as(CALLER, 'authenticated', async () => (await q(`SELECT public.dialer_workday_start() s, to_char(public.dialer_workday_start() AT TIME ZONE 'Asia/Karachi', 'HH24:MI') hhmm, (now() - public.dialer_workday_start()) < interval '24 hours' AS within, public.dialer_workday_start() <= now() AS past`))[0]);
expect('the working day began at 12:00 Karachi, within the last 24h', [ws.hhmm, ws.within, ws.past], ['12:00', true, true]);
await db.exec(`UPDATE public.profiles SET workday_start_hour = 0 WHERE id = '${CALLER}'`);
expect('with the default it is midnight', (await as(CALLER, 'authenticated', async () => (await q(`SELECT to_char(public.dialer_workday_start() AT TIME ZONE 'Asia/Karachi', 'HH24:MI') h`))[0].h)), '00:00');
expect('out-of-range hour refused', await fails(`UPDATE public.profiles SET workday_start_hour = 24 WHERE id = '${CALLER}'`), true);
await db.exec(`UPDATE public.profiles SET workday_start_hour = 12 WHERE id = '${CALLER}'`);

// skip hides a lead until the NEXT workday start (>= ~12h away at worst-case, never "35 minutes")
const SK = await mk('SkipWorkday', { status: 'new' });
const till = await skipIt(CALLER, SK);
const gap = (await q(`SELECT extract(epoch FROM ($1::timestamptz - now())) / 3600 h, to_char($1::timestamptz AT TIME ZONE 'Asia/Karachi', 'HH24:MI') hhmm`, [till]))[0];
expect('skip returns at the next 12:00 Karachi', gap.hhmm, '12:00');
expect('…which is always in the future and under 24h away', [gap.h > 0, gap.h <= 24], [true, true]);

// 3 · snoozed leads are not counted as ready
const A1 = await mk('CountA', { status: 'new' }); const A2 = await mk('CountB', { status: 'new' });
const cnt = async () => { const ls = await as(CALLER, 'authenticated', async () => (await q(`SELECT public.dialer_list_summary() s`))[0].s); const r = ls.find(x => x.id === listId); return [r.in_play, r.callable_now]; };
const before = await cnt();
await skipIt(CALLER, A1);
const after = await cnt();
expect('a snoozed lead drops out of in-play and ready-now', [before[0] - after[0], before[1] - after[1]], [1, 1]);

// 4 · stable order for equal scores
await db.exec(`UPDATE public.call_leads SET status = 'lost' WHERE status IN ('new','retry','nurture','callback')`);
await db.exec(`INSERT INTO public.call_leads (list_id, company_name, phone_e164, phone_is_us, timezone, tier, score, status, created_at)
  SELECT '${listId}', 'Tie ' || g, '+1415555' || (3000 + g), true, '${OPEN}', 'A', 77, 'new', '2026-01-01' FROM generate_series(1, 6) g`);
const tieIds = (await q(`SELECT id FROM public.call_leads WHERE company_name LIKE 'Tie %' ORDER BY id`)).map(r => r.id);
const first = await as(CALLER, 'authenticated', async () => (await q(`SELECT id FROM public.dialer_next_lead('{}', true)`))[0].id);
const again = await as(CALLER, 'authenticated', async () => (await q(`SELECT id FROM public.dialer_next_lead('{}', true)`))[0].id);
expect('equal-score, equal-time leads come out in id order, every time', [first === tieIds[0], again === first], [true, true]);

console.log('\n— follow-up email & nudges (031) —');
await db.exec(`UPDATE public.call_leads SET status = 'lost' WHERE status IN ('new','retry','nurture','callback')`);

// templates
const tpl = Object.fromEntries((await q(`SELECT type, subject, body FROM public.email_templates WHERE type IN ('email_info','email_proposal','followup_nudge')`)).map(r => [r.type, r]));
expect('the three templates exist', Object.keys(tpl).sort(), ['email_info', 'email_proposal', 'followup_nudge']);
expect('email_info uses the owners\' wording and merge fields', ['{{contact_first}}', '{{company_name}}', '[Select a time]({{booking_link}})', '[Portfolio]({{portfolio_link}})', 'Sharab K.', 'one person'].map(t => tpl.email_info.body.includes(t)), [true, true, true, true, true, true]);
expect('the nudge asks them to pick a time', tpl.followup_nudge.body.includes('{{booking_link}}'), true);

// the two links
expect('a valid booking link is accepted', await fails(`UPDATE public.dialer_settings SET booking_link = 'https://workplace.zoho.com/bookings/abc', portfolio_link = 'https://xtenzium.com/portfolio'`), false);
expect('javascript:, ftp: and spaces are refused', [await fails(`UPDATE public.dialer_settings SET booking_link = 'javascript:alert(1)'`), await fails(`UPDATE public.dialer_settings SET portfolio_link = 'ftp://x.com/a'`), await fails(`UPDATE public.dialer_settings SET booking_link = 'https://a.com/x y'`)], [true, true, true]);
expect('a rep can read them', (await as(CALLER, 'authenticated', async () => (await q(`SELECT booking_link FROM public.dialer_settings`))[0].booking_link)), 'https://workplace.zoho.com/bookings/abc');

// the nudge schedule
const FL = await mk('NudgeCo', { status: 'followup' });
const fq = (await q(`INSERT INTO public.followup_queue (lead_id, type, note) VALUES ($1, 'email_info', 'x') RETURNING id`, [FL]))[0].id;
const due1 = await as(ADMIN, 'authenticated', async () => (await q(`SELECT public.followup_mark_sent($1) d`, [fq]))[0].d);
const info1 = (await q(`SELECT l.nudge_count, l.nudge_due_at > now() AS future, extract(isodow FROM l.nudge_due_at AT TIME ZONE COALESCE(l.timezone,'America/New_York')) AS dow, to_char(l.nudge_due_at AT TIME ZONE COALESCE(l.timezone,'America/New_York'), 'HH24:MI') AS hhmm, (SELECT status FROM public.followup_queue WHERE id = $2) fstatus FROM public.call_leads l WHERE l.id = $1`, [FL, fq]))[0];
expect('marking sent records it and starts the nudge clock', [info1.fstatus, info1.nudge_count, info1.future, Number(info1.dow) < 6, info1.hhmm], ['sent', 0, true, true, '10:00']);
expect('the function returns the due time', due1 !== null, true);

const due2 = await as(ADMIN, 'authenticated', async () => (await q(`SELECT public.followup_nudge_sent($1) d`, [FL]))[0].d);
expect('after nudge 1 another is scheduled', [due2 !== null, (await q(`SELECT nudge_count FROM public.call_leads WHERE id = $1`, [FL]))[0].nudge_count], [true, 1]);
const due3 = await as(ADMIN, 'authenticated', async () => (await q(`SELECT public.followup_nudge_sent($1) d`, [FL]))[0].d);
expect('after nudge 2 it stops', [due3, (await q(`SELECT nudge_count, nudge_due_at FROM public.call_leads WHERE id = $1`, [FL]))[0]], [null, { nudge_count: 2, nudge_due_at: null }]);

// a booked meeting stops the nudges
const FL2 = await mk('NudgeBooked', { status: 'followup' });
const fq2 = (await q(`INSERT INTO public.followup_queue (lead_id, type) VALUES ($1, 'email_proposal') RETURNING id`, [FL2]))[0].id;
await as(ADMIN, 'authenticated', async () => q(`SELECT public.followup_mark_sent($1)`, [fq2]));
expect('a nudge is pending', (await q(`SELECT nudge_due_at IS NOT NULL p FROM public.call_leads WHERE id = $1`, [FL2]))[0].p, true);
await as(ADMIN, 'authenticated', async () => q(`SELECT public.log_call($1, 'meeting_booked', '{}'::text[], 'Booked through the Zoho link', false, now() + interval '2 days')`, [FL2]));
expect('booking the meeting cancels it', (await q(`SELECT status, nudge_due_at FROM public.call_leads WHERE id = $1`, [FL2]))[0], { status: 'meeting', nudge_due_at: null });

// only an email follow-up starts the clock
const FL3 = await mk('NudgeCall', { status: 'followup' });
const fq3 = (await q(`INSERT INTO public.followup_queue (lead_id, type) VALUES ($1, 'admin_call') RETURNING id`, [FL3]))[0].id;
await as(ADMIN, 'authenticated', async () => q(`SELECT public.followup_mark_sent($1)`, [fq3]));
expect('a "call them" task does not start a nudge', (await q(`SELECT nudge_due_at FROM public.call_leads WHERE id = $1`, [FL3]))[0].nudge_due_at, null);

// permissions
expect('anonymous cannot', await as(null, 'anon', () => fails(`SELECT public.followup_mark_sent('${fq}')`)), true);
expect('a rep cannot schedule nudges by hand', await as(CALLER, 'authenticated', () => fails(`UPDATE public.call_leads SET nudge_due_at = now() WHERE id = '${FL3}'`)), true);

console.log('\n— after the meeting (032) —');
await db.exec(`UPDATE public.call_leads SET status = 'lost' WHERE status IN ('new','retry','nurture','callback')`);

const mkMeeting = async (name, stage = 'qualified') => {
  const id = await mk(name, { status: 'meeting', due: new Date(Date.now() - 3600e3).toISOString() });
  const deal = (await q(`INSERT INTO public.deals (title, company, stage, source) VALUES ($1, $1, $2, 'outbound') RETURNING id`, [name, stage]))[0].id;
  await db.exec(`UPDATE public.call_leads SET deal_id = '${deal}' WHERE id = '${id}'`);
  return { id, deal };
};
const outcome = (uid, id, o) => as(uid, 'authenticated', async () => (await q(`SELECT public.meeting_outcome($1, $2) r`, [id, o]))[0].r);
const lead = async id => (await q(`SELECT status, next_call_at, nudge_due_at FROM public.call_leads WHERE id = $1`, [id]))[0];
const tasks = async id => (await q(`SELECT type, status, note FROM public.followup_queue WHERE lead_id = $1 ORDER BY created_at`, [id]));

// held
const H = await mkMeeting('HeldCo');
const rh = await outcome(ADMIN, H.id, 'held');
expect('held → follow-up, meeting time cleared', [rh.status, (await lead(H.id)).status, (await lead(H.id)).next_call_at], ['followup', 'followup', null]);
const th = await tasks(H.id);
expect('a thank-you & next-steps email is queued', [th.length, th[0].type, th[0].status, /Meeting held/.test(th[0].note)], [1, 'email_after_meeting', 'queued', true]);
const da = await q(`SELECT type, content FROM public.deal_activities WHERE deal_id = $1`, [H.deal]);
expect('the deal records the meeting', da.some(a => a.type === 'meeting' && /Meeting held/.test(a.content)), true);
expect('the deal has a next action', (await q(`SELECT next_action FROM public.deals WHERE id = $1`, [H.deal]))[0].next_action, 'Send the thank-you and next steps');
expect('it can only be done once', await as(ADMIN, 'authenticated', () => fails(`SELECT public.meeting_outcome('${H.id}', 'held')`)), true);

// no-show stays with the owners, not the rep's cold queue
const N = await mkMeeting('NoShowCo');
await outcome(ADMIN, N.id, 'no_show');
const tn = await tasks(N.id);
expect('no-show → a reschedule email is queued', [tn[0].type, (await lead(N.id)).status], ['email_noshow', 'followup']);
expect('…and the lead is NOT thrown back at the rep', await next(CALLER), null);

// cancelled
const C = await mkMeeting('CancelCo');
await outcome(ADMIN, C.id, 'cancelled');
expect('cancelled → reschedule email', (await tasks(C.id))[0].type, 'email_noshow');

// guards
const notMeeting = await mk('JustFollowup', { status: 'followup' });
expect('a lead with no meeting is refused', await as(ADMIN, 'authenticated', () => fails(`SELECT public.meeting_outcome('${notMeeting}', 'held')`)), true);
const guardMeeting = (await mkMeeting('GuardCo')).id;
expect('an unknown outcome is refused', await as(ADMIN, 'authenticated', () => fails(`SELECT public.meeting_outcome('${guardMeeting}', 'maybe')`)), true);
const repMeeting = (await mkMeeting('RepTry')).id;
expect('a rep cannot', await as(CALLER, 'authenticated', () => fails(`SELECT public.meeting_outcome('${repMeeting}', 'held')`)), true);
expect('anonymous cannot', await as(null, 'anon', () => fails(`SELECT public.meeting_outcome('${H.id}', 'held')`)), true);

// sending the thank-you
const tId = th[0].id ?? (await q(`SELECT id FROM public.followup_queue WHERE lead_id = $1`, [H.id]))[0].id;
await as(ADMIN, 'authenticated', async () => q(`SELECT public.followup_mark_sent($1, true)`, [tId]));
const dealAfter = (await q(`SELECT stage, probability, next_action FROM public.deals WHERE id = $1`, [H.deal]))[0];
expect('"sent — proposal attached" moves the deal to Proposal sent', [dealAfter.stage, dealAfter.probability >= 40, dealAfter.next_action], ['proposal_sent', true, 'Follow up on the proposal']);
expect('…and starts the nudge clock', (await lead(H.id)).nudge_due_at !== null, true);
expect('the stage change is on the deal', (await q(`SELECT 1 FROM public.deal_activities WHERE deal_id = $1 AND type = 'stage_change'`, [H.deal])).length, 1);

// the plain "mark sent" does not move the deal; a later stage is never pulled back
const N2 = await mkMeeting('NoProposal');
await outcome(ADMIN, N2.id, 'held');
const t2 = (await q(`SELECT id FROM public.followup_queue WHERE lead_id = $1`, [N2.id]))[0].id;
await as(ADMIN, 'authenticated', async () => q(`SELECT public.followup_mark_sent($1)`, [t2]));
expect('plain "sent" leaves the deal alone', (await q(`SELECT stage FROM public.deals WHERE id = $1`, [N2.deal]))[0].stage, 'qualified');
const NG = await mkMeeting('Negotiating', 'negotiation');
await outcome(ADMIN, NG.id, 'held');
const t3 = (await q(`SELECT id FROM public.followup_queue WHERE lead_id = $1`, [NG.id]))[0].id;
await as(ADMIN, 'authenticated', async () => q(`SELECT public.followup_mark_sent($1, true)`, [t3]));
expect('a deal already further along is never moved back', (await q(`SELECT stage FROM public.deals WHERE id = $1`, [NG.deal]))[0].stage, 'negotiation');

// templates
const tpl32 = Object.fromEntries((await q(`SELECT type, body FROM public.email_templates WHERE type IN ('email_after_meeting','email_noshow')`)).map(r => [r.type, r.body]));
expect('both templates exist with the booking link', [Object.keys(tpl32).sort(), tpl32.email_after_meeting.includes('{{booking_link}}'), tpl32.email_noshow.includes('{{booking_link}}')], [['email_after_meeting', 'email_noshow'], true, true]);
expect('the thank-you asks the sender to add the next steps', tpl32.email_after_meeting.includes('[Add the next steps'), true);

console.log(bad ? `\n${bad} FAILED` : "\nALL PASSED"); process.exit(bad ? 1 : 0);
