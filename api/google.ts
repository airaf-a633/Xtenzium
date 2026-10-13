export const config = { runtime: 'edge' };

/**
 * Google Calendar for the dialer: connect the owner's account, offer
 * free slots to the rep, book meetings, cancel them.
 *
 *   POST { action: 'auth_url' }                         (admin)
 *   POST { action: 'slots', lead_id, duration? }        (admin or caller)
 *   POST { action: 'book',  lead_id, start, duration, attendee_email, … }
 *   POST { action: 'cancel', meeting_id }               (admin)
 *
 * Needs, in the Vercel project's environment variables:
 *   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET   (Google Cloud → OAuth client)
 *   SUPABASE_SERVICE_ROLE_KEY                (already set for /api/manage-user)
 *
 * All the logic is in _lib/google-handlers.ts so it can be tested
 * against a fake Google; this file only supplies the real environment.
 */

import { envFrom, missingEnv } from './_lib/google';
import { handleGoogle } from './_lib/google-handlers';

declare const process: { env: Record<string, string | undefined> };

export default async function handler(req: Request): Promise<Response> {
  const missing = missingEnv(process.env);
  if (missing.length > 0) {
    return new Response(
      JSON.stringify({
        code: 'not_configured',
        error: `Google Calendar isn’t set up on the server yet. Add ${missing.join(', ')} in Vercel → Settings → Environment Variables, then redeploy.`,
      }),
      { status: 500, headers: { 'content-type': 'application/json' } },
    );
  }
  return handleGoogle(req, envFrom(process.env), fetch);
}
