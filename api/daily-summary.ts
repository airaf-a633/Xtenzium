export const config = { runtime: 'edge' };

/**
 * The owner's daily summary, emailed every morning (see vercel.json), and
 * available on demand to a signed-in admin.
 *
 * Environment variables (Vercel → Settings → Environment Variables):
 *   CRON_SECRET     any long random string; Vercel Cron sends it as a bearer token
 *   RESEND_API_KEY  from resend.com (free tier is plenty)
 *   SUMMARY_FROM    a sender Resend has verified, e.g. "Xtenzium <summary@xtenzium.com>"
 *   SUMMARY_TO      optional, comma-separated; default is every active admin
 *
 * Without RESEND_API_KEY / SUMMARY_FROM it still works as a dry run and
 * returns the composed summary, which is what the Summary page shows.
 * All the logic is in _lib/summary-handler.ts so it can be tested.
 */

import { handleSummary, summaryEnvFrom, summaryMissingEnv } from './_lib/summary-handler';

declare const process: { env: Record<string, string | undefined> };

export default async function handler(req: Request): Promise<Response> {
  const missing = summaryMissingEnv(process.env);
  if (missing.length > 0) {
    return new Response(JSON.stringify({ error: `Not configured on the server: ${missing.join(', ')}` }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
  return handleSummary(req, summaryEnvFrom(process.env), fetch);
}
