/* eslint-disable @typescript-eslint/no-explicit-any -- fixtures read loosely-typed JSON from a fake server */
/* The daily-summary endpoint, against a fake Supabase and a fake Resend.
   Nothing is emailed; the point is to prove who may trigger it, what it
   sends, and that it fails visibly rather than silently. */

import { handleSummary, summaryMissingEnv, type SummaryEnv } from '../api/_lib/summary-handler';

let failures = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    failures++;
    console.error(`FAIL ${name}\n  got  ${JSON.stringify(got)}\n  want ${JSON.stringify(want)}`);
  }
};

const BASE: SummaryEnv = {
  supabaseUrl: 'https://db.test', anonKey: 'ANON', serviceKey: 'SERVICE',
  cronSecret: 'CRON-SECRET', resendKey: 'RESEND-KEY', from: 'Xtenzium <summary@xtenzium.com>', to: null,
};
const NOW = new Date('2026-10-14T03:00:00Z');
const ADMIN_ID = '00000000-0000-0000-0000-0000000000a1';
const REP_ID = '00000000-0000-0000-0000-0000000000c1';

const DATA = {
  from: '2026-10-13T03:00:00Z', to: '2026-10-14T03:00:00Z',
  calls: { dials: 10, conversations: 3, interested: 1, meetings: 1 }, by_outcome: [{ outcome: 'no_answer', n: 7 }],
  outreach: { sent: 2, replies: 0, opted_out: 0 }, hot: [],
  needs_you: { followups: [], flagged: [], meetings: [], callbacks_due: 0, retries_due: 0, outreach_due: 0 },
};

interface World { calls: { url: string; method: string; auth: string | null; body: any }[]; rpcOk: boolean; resendOk: boolean; admins: { email: string | null }[] }
const fresh = (): World => ({ calls: [], rpcOk: true, resendOk: true, admins: [{ email: 'airaf@xtenzium.com' }, { email: 'sharab@xtenzium.com' }, { email: null }] });

const makeFetch = (w: World): typeof fetch => (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input);
  const headers = (init?.headers ?? {}) as Record<string, string>;
  const raw = typeof init?.body === 'string' ? init.body : null;
  w.calls.push({ url, method: init?.method ?? 'GET', auth: headers.authorization ?? null, body: raw ? JSON.parse(raw) : null });
  const ok = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { 'content-type': 'application/json' } });

  if (url === 'https://db.test/auth/v1/user') {
    if (headers.authorization === 'Bearer tok-admin') return ok({ id: ADMIN_ID });
    if (headers.authorization === 'Bearer tok-rep') return ok({ id: REP_ID });
    return ok({ msg: 'bad' }, 401);
  }
  if (url.includes('/rest/v1/profiles?id=eq.')) {
    if (url.includes(ADMIN_ID)) return ok([{ role: 'admin', active: true }]);
    if (url.includes(REP_ID)) return ok([{ role: 'caller', active: true }]);
    return ok([]);
  }
  if (url.includes('/rest/v1/profiles?role=eq.admin')) return ok(w.admins);
  if (url === 'https://db.test/rest/v1/rpc/dialer_summary_data') return w.rpcOk ? ok(DATA) : ok({ message: 'function does not exist' }, 404);
  if (url === 'https://api.resend.com/emails') return w.resendOk ? ok({ id: 'email-123' }) : ok({ name: 'validation_error', message: 'The from address is not verified' }, 422);
  return ok({ error: `unhandled ${url}` }, 500);
}) as typeof fetch;

const call = async (w: World, opts: { token?: string | null; method?: string; query?: string; body?: Record<string, unknown>; env?: Partial<SummaryEnv> } = {}) => {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (opts.token !== null) headers.authorization = `Bearer ${opts.token ?? 'CRON-SECRET'}`;
  const req = new Request(`https://www.xtenzium.com/api/daily-summary${opts.query ?? ''}`, {
    method: opts.method ?? 'GET', headers, body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const res = await handleSummary(req, { ...BASE, ...opts.env }, makeFetch(w), NOW);
  return { status: res.status, body: (await res.json()) as Record<string, any> };
};

/* ── who may trigger it ── */
{
  const w = fresh();
  eq('no token → 401', (await call(w, { token: null })).status, 401);
  eq('wrong secret → 401', (await call(w, { token: 'guess' })).status, 401);
  eq('a rep\'s login → 401', (await call(w, { token: 'tok-rep' })).status, 401);
  eq('nothing was read or sent for any of those', w.calls.filter(c => c.url.includes('dialer_summary_data') || c.url.includes('resend')).length, 0);
  eq('with no CRON_SECRET configured the endpoint is NOT open', (await call(w, { token: 'anything', env: { cronSecret: null } })).status, 401);
  eq('…an empty bearer cannot match an unset secret either', (await call(w, { token: '', env: { cronSecret: null } })).status, 401);
  eq('wrong method → 405', (await call(w, { method: 'DELETE' })).status, 405);
  eq('the cron secret works', (await call(w)).status, 200);
  eq('a signed-in admin works', (await call(fresh(), { token: 'tok-admin' })).status, 200);
}

/* ── what it sends ── */
{
  const w = fresh();
  const r = await call(w);
  eq('sent', [r.status, r.body.sent, r.body.id], [200, true, 'email-123']);
  eq('subject carries the headline', r.body.subject, 'Xtenzium dialer — Wed, Oct 14: 10 dials, 3 conversations, 1 meeting');
  const mail = w.calls.find(c => c.url === 'https://api.resend.com/emails')!;
  eq('uses the Resend key', mail.auth, 'Bearer RESEND-KEY');
  eq('from address', mail.body.from, 'Xtenzium <summary@xtenzium.com>');
  eq('defaults to every active admin that has an email', mail.body.to, ['airaf@xtenzium.com', 'sharab@xtenzium.com']);
  eq('plain text and HTML are both sent', [typeof mail.body.text, typeof mail.body.html, mail.body.text.includes('10 dials')], ['string', 'string', true]);
  const rpc = w.calls.find(c => c.url.endsWith('/rpc/dialer_summary_data'))!;
  eq('the data is read with the service key (it is server-only)', rpc.auth, 'Bearer SERVICE');
  eq('default window is the last 24 hours', [rpc.body.p_from, rpc.body.p_to], ['2026-10-13T03:00:00.000Z', '2026-10-14T03:00:00.000Z']);
  eq('the link in the email points at this site', mail.body.text.includes('https://www.xtenzium.com/crm/inbox'), true);
}

/* ── options ── */
{
  const w = fresh();
  await call(w, { env: { to: 'a@x.co, b@x.co ,' } });
  eq('SUMMARY_TO overrides the admin list', w.calls.find(c => c.url === 'https://api.resend.com/emails')!.body.to, ['a@x.co', 'b@x.co']);
  eq('…and the admin lookup is skipped', w.calls.some(c => c.url.includes('role=eq.admin')), false);

  const w2 = fresh();
  await call(w2, { query: '?hours=6' });
  eq('?hours narrows the window', w2.calls.find(c => c.url.endsWith('/rpc/dialer_summary_data'))!.body.p_from, '2026-10-13T21:00:00.000Z');
  const w3 = fresh();
  await call(w3, { method: 'POST', token: 'tok-admin', body: { hours: 9999 } });
  eq('hours is capped at 72', w3.calls.find(c => c.url.endsWith('/rpc/dialer_summary_data'))!.body.p_from, '2026-10-11T03:00:00.000Z');
  const w4 = fresh();
  await call(w4, { query: '?hours=banana' });
  eq('junk falls back to 24', w4.calls.find(c => c.url.endsWith('/rpc/dialer_summary_data'))!.body.p_from, '2026-10-13T03:00:00.000Z');
}

/* ── dry runs and missing setup ── */
{
  const w = fresh();
  const dry = await call(w, { query: '?dry=1' });
  eq('?dry=1 composes without sending', [dry.body.sent, dry.body.reason, typeof dry.body.text, w.calls.some(c => c.url.includes('resend'))], [false, 'dry_run', 'string', false]);

  const w2 = fresh();
  const dry2 = await call(w2, { method: 'POST', token: 'tok-admin', body: { dry: true } });
  eq('an admin\'s dry run (the Summary page) returns the data', [dry2.status, dry2.body.data.calls.dials, dry2.body.reason], [200, 10, 'dry_run']);

  const w3 = fresh();
  const nc = await call(w3, { env: { resendKey: null } });
  eq('no Resend key → not an error, a clear reason, and still the summary', [nc.status, nc.body.sent, nc.body.reason, typeof nc.body.subject], [200, false, 'not_configured', 'string']);
  const nc2 = await call(fresh(), { env: { from: null } });
  eq('no sender address → not configured', nc2.body.reason, 'not_configured');
  const nr = await call(fresh(), { env: { to: null }, token: 'CRON-SECRET' }).then(async () => { const w5 = fresh(); w5.admins = []; return call(w5); });
  eq('nobody to send to → says so', [nr.body.sent, nr.body.reason], [false, 'no_recipients']);
}

/* ── failures are loud ── */
{
  const w = fresh();
  w.rpcOk = false;
  const r = await call(w);
  eq('the database function missing → 502 pointing at migration 025', [r.status, r.body.error.includes('migration 025')], [502, true]);
  const w2 = fresh();
  w2.resendOk = false;
  const r2 = await call(w2);
  eq('Resend refuses → 502 with its reason, not a silent success', [r2.status, r2.body.error.includes('from address is not verified')], [502, true]);
}

/* ── env check ── */
eq('lists exactly what is missing', summaryMissingEnv({ SUPABASE_URL: 'x' }), ['SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY']);
eq('nothing missing when set', summaryMissingEnv({ VITE_SUPABASE_URL: 'x', VITE_SUPABASE_ANON_KEY: 'y', SUPABASE_SERVICE_ROLE_KEY: 'z' }), []);

if (failures) {
  console.error(`${failures} summary-api check(s) failed`);
  process.exit(1);
}
console.log('summary-api: all checks passed');
