export const config = { runtime: 'edge' };

/**
 * Where Google sends the browser after the owner approves access.
 *
 * Register this exact URL as an "Authorized redirect URI" on the OAuth
 * client in Google Cloud, once per domain the CRM is served from:
 *
 *   https://www.xtenzium.com/api/google-callback
 *
 * It exchanges the one-time code for a refresh token, stores it where
 * only the server can read it, and sends the browser back to Dialer
 * settings with ?google=connected (or ?google=error&reason=…).
 */

import { envFrom, missingEnv } from './_lib/google';
import { handleCallback } from './_lib/google-handlers';

declare const process: { env: Record<string, string | undefined> };

export default async function handler(req: Request): Promise<Response> {
  const missing = missingEnv(process.env);
  if (missing.length > 0) {
    return new Response(null, {
      status: 302,
      headers: { location: `${new URL(req.url).origin}/crm/calls/settings?google=error&reason=not_configured` },
    });
  }
  return handleCallback(req, envFrom(process.env), fetch);
}
