import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';
import { createSessionGuard } from './auth-guard';
import { markSessionLost } from './session-notice';
import {
  adjustStoredSession, createRefreshLimiter, getHealth, reportSkew, reportStorm, skewFromToken,
} from './auth-health';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

/* If the API answers 401 to someone who believes they're signed in, the
   session has ended underneath the tab. Try one quiet refresh; if that
   fails for a real reason (the login was revoked or has expired), sign
   THIS browser out so the app returns to the login page with an
   explanation — instead of every screen retrying and failing.

   A failed refresh caused by a flaky connection is NOT a reason to sign
   anyone out: the session is fine, the network isn't. */
const guard = createSessionGuard({
  hasSession: async () => !!(await supabase.auth.getSession()).data.session,
  refresh: async () => {
    const { error } = await supabase.auth.refreshSession();
    return !error || error.name === 'AuthRetryableFetchError';
  },
  endSession: async () => {
    markSessionLost();
    await supabase.auth.signOut({ scope: 'local' });
  },
});

/* Refreshing a login is limited per IP address by Supabase. A browser
   that refreshes in a loop — a wrong clock does it — would be refused
   (429), signed out, and could lock out everybody on the same connection.
   So this browser gets a handful of refreshes a minute, whatever the cause. */
const refreshLimiter = createRefreshLimiter({ max: 5, windowMs: 60_000 });

/* A response supabase-js will treat as "try again later" rather than
   "this login is invalid": for 502/503/504 it keeps the session. */
const tryAgainLater = (message: string) =>
  new Response(JSON.stringify({ message }), { status: 503, headers: { 'content-type': 'application/json' } });

const urlOf = (input: RequestInfo | URL) => (typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);

const guardedFetch: typeof fetch = async (input, init) => {
  const url = urlOf(input);
  const isToken = url.startsWith(`${supabaseUrl}/auth/v1/token`);
  const isRefresh = isToken && url.includes('grant_type=refresh_token');

  if (isRefresh && !refreshLimiter.allow()) {
    reportStorm();
    console.warn('[auth] Too many login refreshes from this browser — pausing them. Check the computer\'s clock.', { skewMs: getHealth().skewMs });
    return tryAgainLater('Refreshing the login too often; pausing briefly.');
  }

  const res = await fetch(input, init);

  if (isToken) {
    // Being throttled is not the same as being signed out: wait it out.
    if (isRefresh && res.status === 429) return tryAgainLater('Too many login refreshes; will retry shortly.');
    if (res.ok) {
      /* A token that was issued a moment ago tells us the server's time.
         Measured BEFORE returning, so the session is saved with a correct expiry. */
      try {
        const body = (await res.clone().json()) as { access_token?: unknown };
        const skew = typeof body.access_token === 'string' ? skewFromToken(body.access_token, Date.now()) : null;
        if (skew !== null) reportSkew(skew);
      } catch {
        /* not JSON; nothing to learn */
      }
    }
  }

  if (res.status === 401 && url.startsWith(`${supabaseUrl}/rest/v1`)) guard().catch(() => undefined);
  return res;
};

/* The session is saved with its expiry on THIS computer's clock, so a
   clock that is hours out stops meaning "every token is already expired". */
const storage =
  typeof localStorage === 'undefined'
    ? undefined
    : {
        getItem: (key: string) => localStorage.getItem(key),
        setItem: (key: string, value: string) =>
          localStorage.setItem(key, key.endsWith('-auth-token') ? adjustStoredSession(value, getHealth().skewMs) : value),
        removeItem: (key: string) => localStorage.removeItem(key),
      };

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  global: { fetch: guardedFetch },
  ...(storage ? { auth: { storage } } : {}),
});
