import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';
import { createSessionGuard } from './auth-guard';
import { markSessionLost } from './session-notice';

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

const guardedFetch: typeof fetch = async (input, init) => {
  const res = await fetch(input, init);
  if (res.status === 401) {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (url.startsWith(`${supabaseUrl}/rest/v1`)) guard().catch(() => undefined);
  }
  return res;
};

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, { global: { fetch: guardedFetch } });
