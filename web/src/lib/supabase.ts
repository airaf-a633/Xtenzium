import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Browser Supabase client for public form submissions.
 *
 * Safe on a static site because of the RLS policies in migration 001:
 * `anon` may INSERT into `leads`, but SELECT, UPDATE and DELETE are all
 * restricted to `authenticated`. So the anon key — which is public by
 * design and ships in the bundle — can write a lead and cannot read one.
 *
 * Do not add a policy granting anon SELECT on `leads`. That would expose
 * every submission to anyone who opens devtools.
 *
 * Unlike the SPA's client, a missing key does not throw. A marketing page
 * that white-screens because an env var is absent is worse than one whose
 * form reports honestly that it cannot send.
 */

const url = import.meta.env.PUBLIC_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY as string | undefined;

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!url || !anonKey) return null;
  if (!client) {
    client = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}

export const isConfigured = Boolean(url && anonKey);

export type LeadSource = 'contact' | 'estimate';

export interface LeadInput {
  name: string;
  email: string;
  company?: string | null;
  message: string;
  source: LeadSource;
  payload?: Record<string, unknown>;
}

export interface SubmitResult {
  ok: boolean;
  reason?: 'not-configured' | 'rejected' | 'network';
}

export async function submitLead(input: LeadInput): Promise<SubmitResult> {
  const sb = getSupabase();
  if (!sb) return { ok: false, reason: 'not-configured' };

  try {
    const { error } = await sb.from('leads').insert({
      name: input.name,
      email: input.email,
      company: input.company ?? null,
      message: input.message,
      source: input.source,
      payload: input.payload ?? {},
    });
    if (error) {
      console.error('[lead] insert rejected:', error.message);
      return { ok: false, reason: 'rejected' };
    }
    return { ok: true };
  } catch (err) {
    console.error('[lead] network failure:', err);
    return { ok: false, reason: 'network' };
  }
}
