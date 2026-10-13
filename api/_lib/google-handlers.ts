/* The two server endpoints behind Google Calendar:

     POST /api/google            auth_url · slots · book · cancel
     GET  /api/google-callback   where Google sends the browser back

   Who may do what is decided HERE, not trusted from the request: the
   caller's token is verified with Supabase, their role is read from
   profiles with the service key, and only then does anything happen.
   The refresh token lives in a table no browser can read; this is the
   only code that touches it. */

import { computeSlots, type BusyBlock } from '../../src/lib/meeting-slots';
import {
  accessToken, accountEmail, authUrl, buildEvent, createEvent, deleteEvent, exchangeCode, freeBusy,
  signState, verifyState, type Access, type Env, type Fetch,
} from './google';

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DURATIONS = [15, 20, 30, 45, 60];
const BUSINESS_DAYS = 10;

/* ─── Supabase over REST ───────────────────────────────── */

const asService = (env: Env, init: RequestInit = {}): RequestInit => ({
  ...init,
  headers: {
    apikey: env.serviceKey,
    authorization: `Bearer ${env.serviceKey}`,
    'content-type': 'application/json',
    ...(init.headers as Record<string, string> | undefined),
  },
});

const asUser = (env: Env, token: string, init: RequestInit = {}): RequestInit => ({
  ...init,
  headers: {
    apikey: env.anonKey,
    authorization: `Bearer ${token}`,
    'content-type': 'application/json',
    ...(init.headers as Record<string, string> | undefined),
  },
});

async function rows<T>(env: Env, f: Fetch, path: string): Promise<T[]> {
  const res = await f(`${env.supabaseUrl}/rest/v1/${path}`, asService(env));
  return res.ok ? ((await res.json()) as T[]) : [];
}

interface Profile {
  role: string;
  active: boolean;
  email: string | null;
  full_name: string | null;
}

async function identify(env: Env, f: Fetch, token: string): Promise<{ id: string; profile: Profile } | null> {
  const who = await f(`${env.supabaseUrl}/auth/v1/user`, { headers: { apikey: env.anonKey, authorization: `Bearer ${token}` } });
  if (!who.ok) return null;
  const id = ((await who.json()) as { id?: string }).id;
  if (!id) return null;
  const [profile] = await rows<Profile>(env, f, `profiles?id=eq.${id}&select=role,active,email,full_name`);
  if (!profile || !profile.active || !['admin', 'caller'].includes(profile.role)) return null;
  return { id, profile };
}

interface Connection {
  google_email: string;
  refresh_token: string;
  calendar_id: string;
  status: string;
}

interface Settings {
  meeting_owner_tz: string;
  meeting_hours_from: number;
  meeting_hours_to: number;
  meeting_default_minutes: number;
}

interface Lead {
  id: string;
  company_name: string;
  timezone: string | null;
  phone_raw: string | null;
  website: string | null;
  contact_name: string | null;
  contact_title: string | null;
}

/** A usable access token, or the response to send back explaining why not. */
async function calendarAccess(env: Env, f: Fetch): Promise<{ conn: Connection; token: string } | Response> {
  const [conn] = await rows<Connection>(env, f, 'google_connection?select=*&limit=1');
  if (!conn || conn.status !== 'ok') {
    return json(409, { code: conn ? 'reconnect' : 'not_connected', error: 'Google Calendar is not connected.' });
  }
  const access: Access = await accessToken(env, conn.refresh_token, f);
  if (!access.ok) {
    if (access.revoked) {
      // Remember it, so every screen can say "reconnect" without trying again.
      await f(`${env.supabaseUrl}/rest/v1/google_connection?id=eq.true`, asService(env, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'error', last_error: access.error }),
      }));
      return json(409, { code: 'reconnect', error: 'Google access was revoked or expired. Reconnect the calendar in Dialer settings.' });
    }
    return json(502, { error: `Google didn’t respond: ${access.error}` });
  }
  return { conn, token: access.token };
}

/** Free slots for a lead, given the owner's calendar. Shared by "slots" and the re-check inside "book". */
async function openSlots(env: Env, f: Fetch, token: string, conn: Connection, lead: Lead, durationMin: number, now: Date) {
  const [settings] = await rows<Settings>(env, f, 'dialer_settings?select=*&limit=1');
  const cfg: Settings = settings ?? { meeting_owner_tz: 'Asia/Karachi', meeting_hours_from: 18, meeting_hours_to: 2, meeting_default_minutes: 30 };
  const to = new Date(now.getTime() + (BUSINESS_DAYS * 2 + 6) * 86_400_000);
  const busy: BusyBlock[] = await freeBusy(token, conn.calendar_id, now, to, f);
  const slots = computeSlots({
    now, businessDays: BUSINESS_DAYS, durationMin, prospectTz: lead.timezone,
    ownerTz: cfg.meeting_owner_tz, ownerFrom: cfg.meeting_hours_from, ownerTo: cfg.meeting_hours_to, busy,
  });
  return { slots, cfg };
}

/* ─── POST /api/google ─────────────────────────────────── */

export async function handleGoogle(req: Request, env: Env, f: Fetch, now: Date = new Date()): Promise<Response> {
  if (req.method !== 'POST') return json(405, { error: 'POST only' });

  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  const me = token ? await identify(env, f, token) : null;
  if (!me) return json(401, { error: 'Not signed in' });
  const isAdmin = me.profile.role === 'admin';

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return json(400, { error: 'Bad JSON' });
  }
  const origin = new URL(req.url).origin;

  switch (body.action) {
    /* Start connecting the owner's Google account. */
    case 'auth_url': {
      if (!isAdmin) return json(403, { error: 'Admins only' });
      const state = await signState(me.id, env.serviceKey, now.getTime());
      return json(200, { url: authUrl(env, `${origin}/api/google-callback`, state) });
    }

    /* The times the rep may offer. */
    case 'slots': {
      const leadId = String(body.lead_id ?? '');
      if (!UUID_RE.test(leadId)) return json(400, { error: 'Bad lead' });
      const [lead] = await rows<Lead>(env, f, `call_leads?id=eq.${leadId}&select=id,company_name,timezone,phone_raw,website,contact_name,contact_title`);
      if (!lead) return json(404, { error: 'Lead not found' });

      const access = await calendarAccess(env, f);
      if (access instanceof Response) return access;

      const [settings] = await rows<Settings>(env, f, 'dialer_settings?select=*&limit=1');
      const asked = Number(body.duration);
      const duration = DURATIONS.includes(asked) ? asked : (settings?.meeting_default_minutes ?? 30);
      try {
        const { slots, cfg } = await openSlots(env, f, access.token, access.conn, lead, duration, now);
        return json(200, {
          slots, duration, owner_tz: cfg.meeting_owner_tz, prospect_tz: lead.timezone, known_zone: lead.timezone !== null,
        });
      } catch (e) {
        return json(502, { error: (e as Error).message });
      }
    }

    /* Book: event first, then the CRM, and undo the event if the CRM refuses. */
    case 'book': {
      const leadId = String(body.lead_id ?? '');
      const start = new Date(String(body.start ?? ''));
      const duration = Number(body.duration);
      const email = String(body.attendee_email ?? '').trim().toLowerCase();
      const name = String(body.attendee_name ?? '').trim() || null;
      if (!UUID_RE.test(leadId)) return json(400, { error: 'Bad lead' });
      if (Number.isNaN(start.getTime()) || start.getTime() < now.getTime()) return json(400, { error: 'Pick a time in the future' });
      if (!DURATIONS.includes(duration)) return json(400, { error: 'Bad duration' });
      if (!EMAIL_RE.test(email)) return json(400, { error: 'Enter the prospect’s email so they get the invite' });

      const [lead] = await rows<Lead>(env, f, `call_leads?id=eq.${leadId}&select=id,company_name,timezone,phone_raw,website,contact_name,contact_title`);
      if (!lead) return json(404, { error: 'Lead not found' });

      const access = await calendarAccess(env, f);
      if (access instanceof Response) return access;
      const { conn, token: gtoken } = access;

      // The slot must still be on offer — free on the calendar AND inside the allowed hours.
      let cfg: Settings;
      try {
        const open = await openSlots(env, f, gtoken, conn, lead, duration, now);
        cfg = open.cfg;
        if (!open.slots.some(s => new Date(s.start).getTime() === start.getTime())) {
          return json(409, { code: 'slot_taken', error: 'That time is no longer available. Pick another.' });
        }
      } catch (e) {
        return json(502, { error: (e as Error).message });
      }

      const end = new Date(start.getTime() + duration * 60_000);
      const note = String(body.note ?? '').trim();
      const owner = conn.google_email.toLowerCase();
      const attendees = [{ email, name }, ...(me.profile.email ? [{ email: me.profile.email.toLowerCase(), name: me.profile.full_name }] : [])]
        .filter((a, i, all) => a.email !== owner && all.findIndex(b => b.email === a.email) === i);

      const description = [
        `Intro call arranged by ${me.profile.full_name ?? 'the Xtenzium team'}.`,
        '',
        `Company: ${lead.company_name}`,
        lead.website ? `Website: ${lead.website}` : null,
        lead.phone_raw ? `Phone: ${lead.phone_raw}` : null,
        name || lead.contact_name ? `Contact: ${[name ?? lead.contact_name, lead.contact_title].filter(Boolean).join(', ')}` : null,
        note ? `\nFrom the call: ${note}` : null,
        `\nCRM: ${origin}/crm/inbox`,
      ].filter((l): l is string => l !== null).join('\n');

      let created;
      try {
        created = await createEvent(gtoken, conn.calendar_id, buildEvent({
          company: lead.company_name, startIso: start.toISOString(), endIso: end.toISOString(),
          ownerTz: cfg.meeting_owner_tz, attendees, description,
        }, crypto.randomUUID()), f);
      } catch (e) {
        return json(502, { error: `Couldn’t create the calendar event: ${(e as Error).message}` });
      }

      // Log the call as the REP (their token), so every CRM rule runs under their own permissions.
      const logged = await f(`${env.supabaseUrl}/rest/v1/rpc/log_call`, asUser(env, token, {
        method: 'POST',
        body: JSON.stringify({
          p_lead_id: leadId, p_outcome: 'meeting_booked',
          p_tags: Array.isArray(body.tags) ? body.tags.map(String) : [],
          p_note: note || null, p_flagged: Boolean(body.flagged), p_at: start.toISOString(),
          p_contact_name: String(body.contact_name ?? name ?? '').trim() || null,
          p_contact_title: String(body.contact_title ?? '').trim() || null,
          p_contact_email: email,
        }),
      }));
      if (!logged.ok) {
        // The CRM said no — take the invite back so the prospect isn't left with a meeting that doesn't exist.
        await deleteEvent(gtoken, conn.calendar_id, created.id, f);
        const why = (await logged.json().catch(() => ({}))) as { message?: string };
        return json(500, { error: why.message ?? 'The CRM couldn’t record the meeting, so the invite was cancelled.' });
      }
      const result = (await logged.json()) as { deal_id?: string | null };

      // Rebooking replaces: any earlier scheduled meeting for this lead is cancelled in Google and in the CRM.
      const earlier = await rows<{ id: string; google_event_id: string | null }>(env, f, `meetings?lead_id=eq.${leadId}&status=eq.scheduled&select=id,google_event_id`);
      for (const m of earlier) {
        if (m.google_event_id) await deleteEvent(gtoken, conn.calendar_id, m.google_event_id, f);
        await f(`${env.supabaseUrl}/rest/v1/meetings?id=eq.${m.id}`, asService(env, { method: 'PATCH', body: JSON.stringify({ status: 'cancelled' }) }));
      }

      const saved = await f(`${env.supabaseUrl}/rest/v1/meetings`, asService(env, {
        method: 'POST',
        headers: { prefer: 'return=representation' },
        body: JSON.stringify({
          lead_id: leadId, deal_id: result.deal_id ?? null, google_event_id: created.id, meet_link: created.meetLink,
          calendar_link: created.htmlLink, starts_at: start.toISOString(), ends_at: end.toISOString(),
          attendee_name: name, attendee_email: email, rep_id: me.id, rep_email: me.profile.email,
        }),
      }));
      if (!saved.ok) {
        return json(500, { error: 'The meeting is on the calendar and the invites went out, but it wasn’t saved in the CRM. Check your calendar.', meet_link: created.meetLink });
      }
      const [meeting] = (await saved.json()) as Record<string, unknown>[];
      return json(200, { ok: true, meeting, meet_link: created.meetLink, calendar_link: created.htmlLink });
    }

    /* Cancel a booked meeting (admin): remove it from Google, then update the CRM. */
    case 'cancel': {
      if (!isAdmin) return json(403, { error: 'Admins only' });
      const id = String(body.meeting_id ?? '');
      if (!UUID_RE.test(id)) return json(400, { error: 'Bad meeting' });
      const [m] = await rows<{ id: string; google_event_id: string | null }>(env, f, `meetings?id=eq.${id}&select=id,google_event_id`);
      if (!m) return json(404, { error: 'Meeting not found' });

      if (m.google_event_id) {
        const access = await calendarAccess(env, f);
        if (access instanceof Response) return access;
        const gone = await deleteEvent(access.token, access.conn.calendar_id, m.google_event_id, f);
        if (!gone) return json(502, { error: 'Google wouldn’t remove the event. Delete it from your calendar, then try again.' });
      }
      const res = await f(`${env.supabaseUrl}/rest/v1/rpc/meeting_set_status`, asUser(env, token, {
        method: 'POST', body: JSON.stringify({ p_meeting_id: id, p_status: 'cancelled' }),
      }));
      return res.ok ? json(200, { ok: true }) : json(500, { error: 'Removed from Google, but the CRM update failed.' });
    }

    default:
      return json(400, { error: 'Unknown action' });
  }
}

/* ─── GET /api/google-callback ─────────────────────────── */

export async function handleCallback(req: Request, env: Env, f: Fetch, now: Date = new Date()): Promise<Response> {
  const url = new URL(req.url);
  const back = (q: string) =>
    new Response(null, { status: 302, headers: { location: `${url.origin}/crm/calls/settings?${q}`, 'cache-control': 'no-store' } });

  if (url.searchParams.get('error')) return back('google=error&reason=denied');

  const userId = await verifyState(url.searchParams.get('state'), env.serviceKey, now.getTime());
  if (!userId) return back('google=error&reason=state');

  // The person who started this must still be an admin.
  const [profile] = await rows<Profile>(env, f, `profiles?id=eq.${userId}&select=role,active,email,full_name`);
  if (!profile || !profile.active || profile.role !== 'admin') return back('google=error&reason=state');

  const code = url.searchParams.get('code');
  if (!code) return back('google=error&reason=exchange');

  const tokens = await exchangeCode(env, code, `${url.origin}/api/google-callback`, f);
  if (!tokens.ok) return back('google=error&reason=exchange');
  if (!tokens.refresh_token) return back('google=error&reason=no_refresh');

  const email = (await accountEmail(tokens.access_token as string, f)) ?? 'unknown';
  const saved = await f(`${env.supabaseUrl}/rest/v1/google_connection?on_conflict=id`, asService(env, {
    method: 'POST',
    headers: { prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({
      id: true, google_email: email, refresh_token: tokens.refresh_token, calendar_id: 'primary',
      status: 'ok', last_error: null, connected_by: userId, connected_at: now.toISOString(),
    }),
  }));
  return saved.ok ? back('google=connected') : back('google=error&reason=save');
}
