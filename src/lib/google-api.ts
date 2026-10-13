import { supabase } from './supabase';
import type { Slot } from './meeting-slots';

/* The browser's side of /api/google. The server decides everything that
   matters (who you are, whether the slot is real); this is only the
   plumbing, and it turns every failure into a code the screens can act
   on — "reconnect" and "not_connected" send the rep to manual entry
   instead of leaving them stuck. */

export interface GoogleResult<T> {
  data: T | null;
  error: string | null;
  /** not_connected · reconnect · not_configured · slot_taken · unreachable · … */
  code: string | null;
}

export async function callGoogle<T>(body: Record<string, unknown>): Promise<GoogleResult<T>> {
  const { data: session } = await supabase.auth.getSession();
  try {
    const res = await fetch('/api/google', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${session.session?.access_token ?? ''}` },
      body: JSON.stringify(body),
    });
    const out = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      return {
        data: null,
        error: (out.error as string) ?? `Request failed (${res.status})`,
        code: (out.code as string) ?? (res.status === 404 ? 'unreachable' : null),
      };
    }
    return { data: out as T, error: null, code: null };
  } catch {
    return { data: null, error: 'Couldn’t reach the server.', code: 'unreachable' };
  }
}

export interface SlotsResponse {
  slots: Slot[];
  duration: number;
  owner_tz: string;
  prospect_tz: string | null;
  known_zone: boolean;
}

export interface BookResponse {
  ok: true;
  meet_link: string | null;
  calendar_link: string | null;
}

/** Codes that mean "the calendar can't be used right now" — fall back to typing the time. */
export const CALENDAR_DOWN = new Set(['not_connected', 'reconnect', 'not_configured', 'unreachable']);

/** Start connecting the owner's Google account: ask the server for the consent URL, then go there. */
export async function startGoogleConnect(): Promise<string | null> {
  const r = await callGoogle<{ url: string }>({ action: 'auth_url' });
  if (r.data?.url) {
    window.location.assign(r.data.url);
    return null;
  }
  return r.error ?? 'Couldn’t start the connection.';
}
