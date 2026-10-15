/* Google Calendar plumbing for the dialer.

   Everything here takes `fetch` as an argument rather than reaching for
   the global one. That is not ceremony: it is what lets the booking
   flow be exercised end to end against a fake Google in a check, with no
   account, no network and no risk of sending a real invite.

   The underscore in `_lib` keeps Vercel from deploying this folder as
   an endpoint of its own. */

import type { BusyBlock } from '../../src/lib/meeting-slots';

export type Fetch = typeof fetch;

export interface Env {
  supabaseUrl: string;
  anonKey: string;
  serviceKey: string;
  clientId: string;
  clientSecret: string;
}

/* The narrowest scopes that do the job: create/delete events and ask
   when the calendar is busy — not "read everything in the calendar",
   and not Gmail. `openid email` is only to learn which account was
   connected, so Settings can say so. */
export const SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.freebusy',
  'openid',
  'email',
];

/** Names of env vars that are missing, so the error can say exactly what to add. */
export const missingEnv = (raw: Record<string, string | undefined>): string[] =>
  [
    ['SUPABASE_URL', raw.PUBLIC_SUPABASE_URL ?? raw.SUPABASE_URL ?? raw.VITE_SUPABASE_URL],
    ['SUPABASE_ANON_KEY', raw.PUBLIC_SUPABASE_ANON_KEY ?? raw.SUPABASE_ANON_KEY ?? raw.VITE_SUPABASE_ANON_KEY],
    ['SUPABASE_SERVICE_ROLE_KEY', raw.SUPABASE_SERVICE_ROLE_KEY],
    ['GOOGLE_CLIENT_ID', raw.GOOGLE_CLIENT_ID],
    ['GOOGLE_CLIENT_SECRET', raw.GOOGLE_CLIENT_SECRET],
  ].filter(([, v]) => !v).map(([k]) => k as string);

export const envFrom = (raw: Record<string, string | undefined>): Env => ({
  supabaseUrl: (raw.PUBLIC_SUPABASE_URL ?? raw.SUPABASE_URL ?? raw.VITE_SUPABASE_URL) as string,
  anonKey: (raw.PUBLIC_SUPABASE_ANON_KEY ?? raw.SUPABASE_ANON_KEY ?? raw.VITE_SUPABASE_ANON_KEY) as string,
  serviceKey: raw.SUPABASE_SERVICE_ROLE_KEY as string,
  clientId: raw.GOOGLE_CLIENT_ID as string,
  clientSecret: raw.GOOGLE_CLIENT_SECRET as string,
});

/* ─── OAuth state ──────────────────────────────────────────

   The callback is a plain browser redirect, so it carries no login. The
   `state` value stands in for one: it names the admin who started the
   connection, expires in ten minutes, and is signed so it can't be
   forged by someone who just types a URL. The signing key is derived
   from the service-role key, which already has to stay secret. */

const enc = new TextEncoder();

const b64url = (bytes: Uint8Array): string =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const unb64url = (s: string): Uint8Array => {
  const pad = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4);
  return Uint8Array.from(atob(pad), c => c.charCodeAt(0));
};

const hmac = async (secret: string, data: string): Promise<string> => {
  const key = await crypto.subtle.importKey('raw', enc.encode(`gcal-state:${secret}`), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64url(new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(data))));
};

export async function signState(userId: string, secret: string, nowMs = Date.now(), ttlSec = 600): Promise<string> {
  const payload = b64url(enc.encode(JSON.stringify({ u: userId, e: Math.floor(nowMs / 1000) + ttlSec })));
  return `${payload}.${await hmac(secret, payload)}`;
}

/** The admin's user id if the state is genuine and unexpired, else null. */
export async function verifyState(state: string | null, secret: string, nowMs = Date.now()): Promise<string | null> {
  const [payload, sig] = (state ?? '').split('.');
  if (!payload || !sig) return null;
  const expected = await hmac(secret, payload);
  // Constant-time-ish compare: same length, then every char.
  if (expected.length !== sig.length) return null;
  let diff = 0;
  for (let i = 0; i < sig.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  if (diff !== 0) return null;
  try {
    const { u, e } = JSON.parse(new TextDecoder().decode(unb64url(payload))) as { u?: string; e?: number };
    return u && typeof e === 'number' && e * 1000 > nowMs ? u : null;
  } catch {
    return null;
  }
}

/* ─── Google OAuth ─────────────────────────────────────── */

export const authUrl = (env: Env, redirectUri: string, state: string): string => {
  const p = new URLSearchParams({
    client_id: env.clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: SCOPES.join(' '),
    /* offline + consent is what makes Google hand back a refresh token
       every time; without it a reconnect silently returns none. */
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${p}`;
};

const form = (o: Record<string, string>) => new URLSearchParams(o).toString();

export async function exchangeCode(env: Env, code: string, redirectUri: string, f: Fetch) {
  const res = await f('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: form({ code, client_id: env.clientId, client_secret: env.clientSecret, redirect_uri: redirectUri, grant_type: 'authorization_code' }),
  });
  const body = (await res.json().catch(() => ({}))) as { access_token?: string; refresh_token?: string; error?: string; error_description?: string };
  return { ok: res.ok && !!body.access_token, ...body };
}

export async function accountEmail(accessToken: string, f: Fetch): Promise<string | null> {
  const res = await f('https://openidconnect.googleapis.com/v1/userinfo', { headers: { authorization: `Bearer ${accessToken}` } });
  if (!res.ok) return null;
  return ((await res.json()) as { email?: string }).email ?? null;
}

export type Access = { ok: true; token: string } | { ok: false; revoked: boolean; error: string };

/** Trade the stored refresh token for a short-lived access token. `revoked` means it will never work again. */
export async function accessToken(env: Env, refreshToken: string, f: Fetch): Promise<Access> {
  const res = await f('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: form({ client_id: env.clientId, client_secret: env.clientSecret, refresh_token: refreshToken, grant_type: 'refresh_token' }),
  });
  const body = (await res.json().catch(() => ({}))) as { access_token?: string; error?: string; error_description?: string };
  if (res.ok && body.access_token) return { ok: true, token: body.access_token };
  return { ok: false, revoked: body.error === 'invalid_grant', error: body.error_description ?? body.error ?? `HTTP ${res.status}` };
}

/* ─── Calendar ─────────────────────────────────────────── */

const CAL = 'https://www.googleapis.com/calendar/v3';

export async function freeBusy(token: string, calendarId: string, from: Date, to: Date, f: Fetch): Promise<BusyBlock[]> {
  const res = await f(`${CAL}/freeBusy`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ timeMin: from.toISOString(), timeMax: to.toISOString(), items: [{ id: calendarId }] }),
  });
  if (!res.ok) throw new Error(`Calendar free/busy failed (${res.status})`);
  const body = (await res.json()) as { calendars?: Record<string, { busy?: BusyBlock[]; errors?: unknown[] }> };
  const cal = body.calendars?.[calendarId];
  if (!cal || (cal.errors && cal.errors.length > 0)) throw new Error('Calendar free/busy returned an error for this calendar');
  return cal.busy ?? [];
}

export interface EventInput {
  company: string;
  startIso: string;
  endIso: string;
  ownerTz: string;
  attendees: { email: string; name?: string | null }[];
  description: string;
}

export const buildEvent = (e: EventInput, requestId: string) => ({
  summary: `Xtenzium × ${e.company}`,
  description: e.description,
  start: { dateTime: e.startIso, timeZone: e.ownerTz },
  end: { dateTime: e.endIso, timeZone: e.ownerTz },
  attendees: e.attendees.map(a => ({ email: a.email, ...(a.name ? { displayName: a.name } : {}) })),
  conferenceData: { createRequest: { requestId, conferenceSolutionKey: { type: 'hangoutsMeet' } } },
  reminders: { useDefault: true },
});

export interface CreatedEvent {
  id: string;
  meetLink: string | null;
  htmlLink: string | null;
}

export async function createEvent(token: string, calendarId: string, event: ReturnType<typeof buildEvent>, f: Fetch): Promise<CreatedEvent> {
  /* conferenceDataVersion=1 is what makes Google create the Meet link;
     sendUpdates=all is what emails the invite to every attendee. */
  const res = await f(`${CAL}/calendars/${encodeURIComponent(calendarId)}/events?conferenceDataVersion=1&sendUpdates=all`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(event),
  });
  const body = (await res.json().catch(() => ({}))) as {
    id?: string; hangoutLink?: string; htmlLink?: string;
    conferenceData?: { entryPoints?: { entryPointType?: string; uri?: string }[] };
    error?: { message?: string };
  };
  if (!res.ok || !body.id) throw new Error(body.error?.message ?? `Calendar refused the event (${res.status})`);
  const meet = body.hangoutLink ?? body.conferenceData?.entryPoints?.find(p => p.entryPointType === 'video')?.uri ?? null;
  return { id: body.id, meetLink: meet, htmlLink: body.htmlLink ?? null };
}

/** Delete an event and tell the attendees. Already-gone (404/410) counts as success. */
export async function deleteEvent(token: string, calendarId: string, eventId: string, f: Fetch): Promise<boolean> {
  const res = await f(`${CAL}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}?sendUpdates=all`, {
    method: 'DELETE',
    headers: { authorization: `Bearer ${token}` },
  });
  return res.ok || res.status === 404 || res.status === 410;
}
