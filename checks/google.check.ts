/* eslint-disable @typescript-eslint/no-explicit-any -- fixtures read loosely-typed JSON from a fake server */
/* Google Calendar flow, end to end, against a fake Google and a fake
   Supabase. Nothing here touches the network, so it can't send a real
   invite — which is also why it can try the failure cases (revoked
   token, double-booked slot, CRM refusing a booking) that you would
   never want to provoke on a real calendar. */

import { handleCallback, handleGoogle } from '../api/_lib/google-handlers';
import { authUrl, signState, verifyState, type Env } from '../api/_lib/google';

let failures = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    failures++;
    console.error(`FAIL ${name}\n  got  ${JSON.stringify(got)}\n  want ${JSON.stringify(want)}`);
  }
};

const ENV: Env = { supabaseUrl: 'https://db.test', anonKey: 'ANON', serviceKey: 'SERVICE', clientId: 'CID', clientSecret: 'CSECRET' };
const ADMIN = { id: '00000000-0000-0000-0000-0000000000a1', token: 'tok-admin' };
const REP = { id: '00000000-0000-0000-0000-0000000000c1', token: 'tok-rep' };
const LEAD = '11111111-1111-1111-1111-111111111111';
const NOW = new Date('2026-10-13T04:00:00Z'); // Tue 09:00 PKT — slots exist from 18:00 PKT

interface World {
  profiles: Record<string, { role: string; active: boolean; email: string; full_name: string }>;
  connection: Record<string, unknown> | null;
  meetings: Record<string, unknown>[];
  busy: { start: string; end: string }[];
  events: Map<string, Record<string, unknown>>;
  googleRefreshOk: boolean;
  googleRevoked: boolean;
  eventCreateFails: boolean;
  logCallOk: boolean;
  calls: { url: string; method: string; auth: string | null; body: unknown }[];
}

const fresh = (): World => ({
  profiles: {
    [ADMIN.id]: { role: 'admin', active: true, email: 'airaf@xtenzium.com', full_name: 'Airaf Adil' },
    [REP.id]: { role: 'caller', active: true, email: 'rep@xtenzium.com', full_name: 'Rep One' },
  },
  connection: { google_email: 'owner@gmail.com', refresh_token: 'REFRESH', calendar_id: 'primary', status: 'ok' },
  meetings: [],
  busy: [],
  events: new Map(),
  googleRefreshOk: true,
  googleRevoked: false,
  eventCreateFails: false,
  logCallOk: true,
  calls: [],
});

const makeFetch = (w: World): typeof fetch => (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input);
  const method = init?.method ?? 'GET';
  const headers = (init?.headers ?? {}) as Record<string, string>;
  const auth = headers.authorization ?? null;
  const raw = typeof init?.body === 'string' ? init.body : null;
  const asJson = (): Record<string, unknown> => (raw ? JSON.parse(raw) : {});
  w.calls.push({ url, method, auth, body: raw && raw.startsWith('{') ? JSON.parse(raw) : raw });
  const ok = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { 'content-type': 'application/json' } });

  // ── Supabase ──
  if (url === 'https://db.test/auth/v1/user') {
    const u = [ADMIN, REP].find(x => auth === `Bearer ${x.token}`);
    return u ? ok({ id: u.id }) : ok({ msg: 'bad token' }, 401);
  }
  if (url.startsWith('https://db.test/rest/v1/profiles')) {
    const id = /id=eq\.([^&]+)/.exec(url)?.[1] ?? '';
    return ok(w.profiles[id] ? [w.profiles[id]] : []);
  }
  if (url.startsWith('https://db.test/rest/v1/google_connection')) {
    if (method === 'PATCH') { Object.assign(w.connection ?? {}, asJson()); return ok([]); }
    if (method === 'POST') { w.connection = asJson(); return ok([]); }
    return ok(w.connection ? [w.connection] : []);
  }
  if (url.startsWith('https://db.test/rest/v1/dialer_settings')) {
    return ok([{ meeting_owner_tz: 'Asia/Karachi', meeting_hours_from: 18, meeting_hours_to: 2, meeting_default_minutes: 30 }]);
  }
  if (url.startsWith('https://db.test/rest/v1/call_leads')) {
    return ok(url.includes(LEAD) ? [{ id: LEAD, company_name: 'Acme Agency', timezone: 'America/New_York', phone_raw: '(212) 555-0100', website: 'https://acme.io', contact_name: 'Dana Roe', contact_title: 'Founder' }] : []);
  }
  if (url.startsWith('https://db.test/rest/v1/meetings')) {
    if (method === 'POST') { const row = { id: 'MEET-1', ...asJson() }; w.meetings.push(row); return ok([row]); }
    if (method === 'PATCH') {
      const id = /id=eq\.([^&]+)/.exec(url)?.[1];
      w.meetings.filter(m => m.id === id).forEach(m => Object.assign(m, asJson()));
      return ok([]);
    }
    if (url.includes('status=eq.scheduled')) return ok(w.meetings.filter(m => m.status === undefined || m.status === 'scheduled').map(m => ({ id: m.id, google_event_id: m.google_event_id })));
    const id = /id=eq\.([^&]+)/.exec(url)?.[1];
    return ok(w.meetings.filter(m => m.id === id).map(m => ({ id: m.id, google_event_id: m.google_event_id })));
  }
  if (url === 'https://db.test/rest/v1/rpc/log_call') {
    return w.logCallOk ? ok({ status: 'meeting', deal_id: 'DEAL-1', attempts: 1 }) : ok({ message: 'Lead not found' }, 400);
  }
  if (url === 'https://db.test/rest/v1/rpc/meeting_set_status') return new Response(null, { status: 204 });

  // ── Google ──
  if (url === 'https://oauth2.googleapis.com/token') {
    const p = new URLSearchParams(raw ?? '');
    if (p.get('grant_type') === 'authorization_code') {
      return p.get('code') === 'GOOD' ? ok({ access_token: 'ACCESS', refresh_token: 'NEW-REFRESH' }) : p.get('code') === 'NOREFRESH' ? ok({ access_token: 'ACCESS' }) : ok({ error: 'invalid_grant' }, 400);
    }
    if (w.googleRevoked) return ok({ error: 'invalid_grant', error_description: 'Token has been expired or revoked.' }, 400);
    return w.googleRefreshOk ? ok({ access_token: 'GACCESS' }) : ok({ error: 'temporarily_unavailable' }, 503);
  }
  if (url === 'https://openidconnect.googleapis.com/v1/userinfo') return ok({ email: 'owner@gmail.com' });
  if (url === 'https://www.googleapis.com/calendar/v3/freeBusy') return ok({ calendars: { primary: { busy: w.busy } } });
  if (url.startsWith('https://www.googleapis.com/calendar/v3/calendars/primary/events') && method === 'POST') {
    if (w.eventCreateFails) return ok({ error: { message: 'Quota exceeded' } }, 403);
    const id = `evt-${w.events.size + 1}`;
    w.events.set(id, asJson());
    return ok({ id, hangoutLink: 'https://meet.google.com/abc-defg-hij', htmlLink: `https://calendar.google.com/event?eid=${id}` });
  }
  if (url.startsWith('https://www.googleapis.com/calendar/v3/calendars/primary/events/') && method === 'DELETE') {
    const id = decodeURIComponent(url.split('/events/')[1].split('?')[0]);
    const had = w.events.delete(id);
    return new Response(null, { status: had ? 204 : 410 });
  }
  return ok({ error: `unhandled ${method} ${url}` }, 500);
}) as typeof fetch;

const post = (token: string | null, body: Record<string, unknown>, origin = 'https://www.xtenzium.com') =>
  new Request(`${origin}/api/google`, { method: 'POST', headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), 'content-type': 'application/json' }, body: JSON.stringify(body) });
const call = async (w: World, token: string | null, body: Record<string, unknown>) => {
  const res = await handleGoogle(post(token, body), ENV, makeFetch(w), NOW);
  return { status: res.status, body: (await res.json()) as Record<string, any> };
};

// ── State signing ──
{
  const s = await signState(ADMIN.id, 'SECRET', NOW.getTime());
  eq('state round-trips', await verifyState(s, 'SECRET', NOW.getTime() + 1000), ADMIN.id);
  eq('state expires after 10 minutes', await verifyState(s, 'SECRET', NOW.getTime() + 11 * 60_000), null);
  eq('state with another key is rejected', await verifyState(s, 'OTHER', NOW.getTime()), null);
  const [payload, sig] = s.split('.');
  const forged = btoa(JSON.stringify({ u: REP.id, e: 9999999999 })).replace(/=+$/, '');
  eq('tampered payload is rejected', await verifyState(`${forged}.${sig}`, 'SECRET', NOW.getTime()), null);
  eq('tampered signature is rejected', await verifyState(`${payload}.${sig.slice(0, -2)}xx`, 'SECRET', NOW.getTime()), null);
  eq('garbage is rejected', [await verifyState('abc', 'SECRET'), await verifyState(null, 'SECRET'), await verifyState('', 'SECRET')], [null, null, null]);
}

// ── Authorization URL ──
{
  const u = new URL(authUrl(ENV, 'https://www.xtenzium.com/api/google-callback', 'STATE'));
  eq('auth host', u.origin + u.pathname, 'https://accounts.google.com/o/oauth2/v2/auth');
  eq('offline access + forced consent (so a refresh token is always returned)', [u.searchParams.get('access_type'), u.searchParams.get('prompt')], ['offline', 'consent']);
  eq('redirect uri', u.searchParams.get('redirect_uri'), 'https://www.xtenzium.com/api/google-callback');
  eq('minimal scopes — no Gmail, no full calendar', u.searchParams.get('scope')!.split(' ').sort(), [
    'email', 'https://www.googleapis.com/auth/calendar.events', 'https://www.googleapis.com/auth/calendar.freebusy', 'openid',
  ]);
}

// ── Who may do what ──
{
  const w = fresh();
  eq('no token → 401', (await call(w, null, { action: 'slots', lead_id: LEAD })).status, 401);
  eq('bad token → 401', (await call(w, 'nope', { action: 'slots', lead_id: LEAD })).status, 401);
  eq('GET → 405', (await handleGoogle(new Request('https://x.test/api/google'), ENV, makeFetch(w), NOW)).status, 405);
  eq('rep cannot start a connection', (await call(w, REP.token, { action: 'auth_url' })).status, 403);
  eq('rep cannot cancel meetings', (await call(w, REP.token, { action: 'cancel', meeting_id: LEAD })).status, 403);
  eq('unknown action → 400', (await call(w, ADMIN.token, { action: 'explode' })).status, 400);
  w.profiles[REP.id].active = false;
  eq('a deactivated login is turned away', (await call(w, REP.token, { action: 'slots', lead_id: LEAD })).status, 401);
  const a = await call(w, ADMIN.token, { action: 'auth_url' });
  eq('admin gets a Google URL built for this domain', [a.status, a.body.url.includes('redirect_uri=https%3A%2F%2Fwww.xtenzium.com%2Fapi%2Fgoogle-callback')], [200, true]);
}

// ── Not connected / revoked ──
{
  const w = fresh();
  w.connection = null;
  const r = await call(w, REP.token, { action: 'slots', lead_id: LEAD });
  eq('not connected → 409 not_connected', [r.status, r.body.code], [409, 'not_connected']);

  const w2 = fresh();
  w2.googleRevoked = true;
  const r2 = await call(w2, REP.token, { action: 'slots', lead_id: LEAD });
  eq('revoked token → 409 reconnect', [r2.status, r2.body.code], [409, 'reconnect']);
  eq('…and the connection is marked as errored for every other screen', w2.connection!.status, 'error');
  const r3 = await call(w2, REP.token, { action: 'slots', lead_id: LEAD });
  eq('once errored, no more attempts at Google', [r3.status, r3.body.code, w2.calls.filter(c => c.url.includes('oauth2.googleapis.com')).length], [409, 'reconnect', 1]);

  const w3 = fresh();
  w3.googleRefreshOk = false;
  eq('a Google outage is a 502, not a revoked connection', [(await call(w3, REP.token, { action: 'slots', lead_id: LEAD })).status, w3.connection!.status], [502, 'ok']);
}

// ── Slots ──
let firstSlot = '';
{
  const w = fresh();
  const r = await call(w, REP.token, { action: 'slots', lead_id: LEAD, duration: 30 });
  eq('slots ok', r.status, 200);
  eq('prospect and owner zones come back for display', [r.body.prospect_tz, r.body.owner_tz, r.body.known_zone], ['America/New_York', 'Asia/Karachi', true]);
  eq('first slot is 09:00 New York', r.body.slots[0].start, '2026-10-13T13:00:00.000Z');
  eq('a full ten business days of 16 slots', r.body.slots.length, 160);
  firstSlot = r.body.slots[0].start;
  eq('free/busy was asked about the owner calendar only', (w.calls.find(c => c.url.endsWith('/freeBusy'))!.body as any).items, [{ id: 'primary' }]);
  eq('asked with the Google access token, not the service key', w.calls.find(c => c.url.endsWith('/freeBusy'))!.auth, 'Bearer GACCESS');

  w.busy = [{ start: '2026-10-13T13:00:00Z', end: '2026-10-13T14:00:00Z' }];
  const r2 = await call(w, REP.token, { action: 'slots', lead_id: LEAD });
  eq('a busy hour removes the slots inside it', r2.body.slots[0].start, '2026-10-13T14:00:00.000Z');

  eq('bad lead id → 400', (await call(w, REP.token, { action: 'slots', lead_id: 'x' })).status, 400);
  eq('unknown lead → 404', (await call(w, REP.token, { action: 'slots', lead_id: '22222222-2222-2222-2222-222222222222' })).status, 404);
}

// ── Booking: the happy path ──
{
  const w = fresh();
  const r = await call(w, REP.token, {
    action: 'book', lead_id: LEAD, start: firstSlot, duration: 30,
    attendee_email: ' Dana@Acme.io ', attendee_name: 'Dana Roe', note: 'Wants to hear about the team model', tags: ['Price sensitive'], flagged: false,
  });
  eq('booked', [r.status, r.body.ok, r.body.meet_link], [200, true, 'https://meet.google.com/abc-defg-hij']);

  const evCall = w.calls.find(c => c.url.includes('/events?') && c.method === 'POST')!;
  const ev = evCall.body as any;
  eq('invites are emailed and a Meet link is requested', [evCall.url.includes('sendUpdates=all'), evCall.url.includes('conferenceDataVersion=1')], [true, true]);
  eq('event title', ev.summary, 'Xtenzium × Acme Agency');
  eq('prospect (lower-cased, trimmed) AND the rep are invited', ev.attendees.map((a: any) => a.email), ['dana@acme.io', 'rep@xtenzium.com']);
  eq('event runs 30 min on the owner’s calendar zone', [ev.start.dateTime, ev.end.dateTime, ev.start.timeZone], ['2026-10-13T13:00:00.000Z', '2026-10-13T13:30:00.000Z', 'Asia/Karachi']);
  eq('Meet is requested as a conference', ev.conferenceData.createRequest.conferenceSolutionKey.type, 'hangoutsMeet');
  eq('description carries the call context', [ev.description.includes('Acme Agency'), ev.description.includes('Wants to hear about the team model'), ev.description.includes('https://www.xtenzium.com/crm/inbox')], [true, true, true]);

  const logCall = w.calls.find(c => c.url.endsWith('/rpc/log_call'))!;
  eq('the call is logged AS THE REP (their token, not the service key)', logCall.auth, `Bearer ${REP.token}`);
  eq('logged as a meeting at the booked time, with the email', [(logCall.body as any).p_outcome, (logCall.body as any).p_at, (logCall.body as any).p_contact_email], ['meeting_booked', '2026-10-13T13:00:00.000Z', 'dana@acme.io']);

  eq('meeting saved with the event and the deal', [w.meetings.length, w.meetings[0].google_event_id, w.meetings[0].deal_id, w.meetings[0].meet_link], [1, 'evt-1', 'DEAL-1', 'https://meet.google.com/abc-defg-hij']);
  eq('meeting records who booked it', [w.meetings[0].rep_id, w.meetings[0].rep_email], [REP.id, 'rep@xtenzium.com']);
  eq('order: event first, then the CRM, then the record', [
    w.calls.findIndex(c => c.url.includes('/events?')) < w.calls.findIndex(c => c.url.endsWith('/rpc/log_call')),
    w.calls.findIndex(c => c.url.endsWith('/rpc/log_call')) < w.calls.findIndex(c => c.url.endsWith('/rest/v1/meetings') && c.method === 'POST'),
  ], [true, true]);

  // Rebooking the same lead replaces the earlier meeting.
  const again = await call(w, REP.token, { action: 'book', lead_id: LEAD, start: '2026-10-13T14:00:00.000Z', duration: 30, attendee_email: 'dana@acme.io' });
  eq('rebooked', again.status, 200);
  eq('the earlier event was deleted from Google', [w.events.has('evt-1'), w.events.has('evt-2')], [false, true]);
  eq('the earlier meeting row is cancelled', w.meetings.find(m => m.id === 'MEET-1' && m.google_event_id === 'evt-1')?.status, 'cancelled');
}

// ── Booking: owner is also a rep → no duplicate invite ──
{
  const w = fresh();
  w.profiles[REP.id].email = 'OWNER@gmail.com';
  await call(w, REP.token, { action: 'book', lead_id: LEAD, start: firstSlot, duration: 30, attendee_email: 'dana@acme.io' });
  eq('the organiser is not invited to their own event', ((w.calls.find(c => c.url.includes('/events?'))!.body as any).attendees as any[]).map(a => a.email), ['dana@acme.io']);
}

// ── Booking: refusals ──
{
  const w = fresh();
  const base = { action: 'book', lead_id: LEAD, start: firstSlot, duration: 30, attendee_email: 'dana@acme.io' };
  eq('no email → 400 (the prospect must get an invite)', (await call(w, REP.token, { ...base, attendee_email: '' })).status, 400);
  eq('bad email → 400', (await call(w, REP.token, { ...base, attendee_email: 'dana@' })).status, 400);
  eq('a time in the past → 400', (await call(w, REP.token, { ...base, start: '2026-10-12T13:00:00Z' })).status, 400);
  eq('odd duration → 400', (await call(w, REP.token, { ...base, duration: 37 })).status, 400);
  eq('nothing was created by any refusal', [w.events.size, w.meetings.length], [0, 0]);

  // A time the rep invented: free on the calendar, but outside the owner's hours (13:00 PKT).
  const out = await call(w, REP.token, { ...base, start: '2026-10-14T08:00:00.000Z' });
  eq('a time outside the offered slots is refused', [out.status, out.body.code], [409, 'slot_taken']);

  // Someone grabbed the slot between "show slots" and "confirm".
  w.busy = [{ start: firstSlot, end: '2026-10-13T13:30:00.000Z' }];
  const taken = await call(w, REP.token, base);
  eq('a slot that just got busy → 409 slot_taken', [taken.status, taken.body.code], [409, 'slot_taken']);
  eq('…and nothing was booked', [w.events.size, w.meetings.length], [0, 0]);
}

// ── Booking: failures after the event exists ──
{
  const w = fresh();
  w.logCallOk = false;
  const r = await call(w, REP.token, { action: 'book', lead_id: LEAD, start: firstSlot, duration: 30, attendee_email: 'dana@acme.io' });
  eq('CRM refuses → 500 with its reason', [r.status, r.body.error], [500, 'Lead not found']);
  eq('…the calendar invite is taken back', w.events.size, 0);
  eq('…and no meeting record is left behind', w.meetings.length, 0);

  const w2 = fresh();
  w2.eventCreateFails = true;
  const r2 = await call(w2, REP.token, { action: 'book', lead_id: LEAD, start: firstSlot, duration: 30, attendee_email: 'dana@acme.io' });
  eq('Google refuses the event → 502, and the CRM is never told', [r2.status, w2.calls.some(c => c.url.endsWith('/rpc/log_call'))], [502, false]);
}

// ── Cancel ──
{
  const w = fresh();
  await call(w, REP.token, { action: 'book', lead_id: LEAD, start: firstSlot, duration: 30, attendee_email: 'dana@acme.io' });
  const r = await call(w, ADMIN.token, { action: 'cancel', meeting_id: '33333333-3333-3333-3333-333333333333' });
  eq('unknown meeting → 404', r.status, 404);
  // The fake numbers meetings "MEET-1", which isn't uuid-shaped; give it a real-looking id.
  w.meetings[0].id = '44444444-4444-4444-4444-444444444444';
  const ok = await call(w, ADMIN.token, { action: 'cancel', meeting_id: '44444444-4444-4444-4444-444444444444' });
  eq('admin cancels', ok.status, 200);
  eq('the event is removed from Google', w.events.size, 0);
  const rpc = w.calls.find(c => c.url.endsWith('/rpc/meeting_set_status'))!;
  eq('the CRM is updated as the admin', [rpc.auth, (rpc.body as any).p_status], [`Bearer ${ADMIN.token}`, 'cancelled']);
}

// ── Callback ──
{
  const cb = async (w: World, query: string) => handleCallback(new Request(`https://www.xtenzium.com/api/google-callback?${query}`), ENV, makeFetch(w), NOW);
  const state = await signState(ADMIN.id, ENV.serviceKey, NOW.getTime());

  const w = fresh();
  w.connection = null;
  const ok = await cb(w, `code=GOOD&state=${state}`);
  eq('success redirects to settings', [ok.status, ok.headers.get('location')], [302, 'https://www.xtenzium.com/crm/calls/settings?google=connected']);
  eq('refresh token stored with the connected account', [w.connection!.refresh_token, w.connection!.google_email, w.connection!.status, w.connection!.connected_by], ['NEW-REFRESH', 'owner@gmail.com', 'ok', ADMIN.id]);
  eq('the token went to the server-side table with the service key', w.calls.find(c => c.url.includes('google_connection') && c.method === 'POST')!.auth, 'Bearer SERVICE');
  eq('the code was exchanged for the same redirect uri Google was sent', (w.calls.find(c => c.url.includes('oauth2.googleapis.com'))!.body as string).includes('redirect_uri=https%3A%2F%2Fwww.xtenzium.com%2Fapi%2Fgoogle-callback'), true);

  const w2 = fresh();
  w2.connection = null;
  eq('forged state → rejected, nothing stored', [(await cb(w2, 'code=GOOD&state=forged.value')).headers.get('location')!.endsWith('reason=state'), w2.connection], [true, null]);
  eq('denied at Google → rejected', (await cb(w2, 'error=access_denied')).headers.get('location')!.endsWith('reason=denied'), true);
  eq('bad code → exchange failure', (await cb(w2, `code=BAD&state=${state}`)).headers.get('location')!.endsWith('reason=exchange'), true);
  eq('Google returns no refresh token → says so, stores nothing', [(await cb(w2, `code=NOREFRESH&state=${state}`)).headers.get('location')!.endsWith('reason=no_refresh'), w2.connection], [true, null]);
  const repState = await signState(REP.id, ENV.serviceKey, NOW.getTime());
  eq('state from a non-admin is rejected', (await cb(w2, `code=GOOD&state=${repState}`)).headers.get('location')!.endsWith('reason=state'), true);
  eq('an expired state is rejected', (await handleCallback(new Request(`https://www.xtenzium.com/api/google-callback?code=GOOD&state=${state}`), ENV, makeFetch(w2), new Date(NOW.getTime() + 20 * 60_000))).headers.get('location')!.endsWith('reason=state'), true);

  // Reconnecting overwrites an errored connection.
  const w3 = fresh();
  w3.connection = { google_email: 'owner@gmail.com', refresh_token: 'DEAD', calendar_id: 'primary', status: 'error' };
  await cb(w3, `code=GOOD&state=${state}`);
  eq('reconnect replaces a dead token and clears the error', [w3.connection!.refresh_token, w3.connection!.status, w3.connection!.last_error], ['NEW-REFRESH', 'ok', null]);
}

if (failures) {
  console.error(`${failures} google check(s) failed`);
  process.exit(1);
}
console.log('google: all checks passed');
