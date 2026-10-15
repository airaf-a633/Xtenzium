/* GET/POST /api/daily-summary — compose the owner's summary and email it.

   Two ways in, both authenticated:
     · Vercel Cron, which sends `Authorization: Bearer $CRON_SECRET`;
     · a signed-in admin (the Summary page's "Send now"), whose token is
       verified with Supabase and whose role is read from profiles.
   Anyone else gets a 401. (Unlike /api/gsc-sync, a missing CRON_SECRET
   does NOT open the endpoint — it just means the cron path is off.)

   Mail goes out through Resend's HTTP API. If it isn't configured the
   endpoint still works as a dry run and returns the composed summary,
   so the Summary page and a first test don't need any setup. */

import { renderSummary, type SummaryData } from '../../src/lib/daily-summary';

export type Fetch = typeof fetch;

export interface SummaryEnv {
  supabaseUrl: string;
  anonKey: string;
  serviceKey: string;
  cronSecret: string | null;
  resendKey: string | null;
  from: string | null;
  /** Comma-separated. Empty = every active admin. */
  to: string | null;
}

export const summaryEnvFrom = (raw: Record<string, string | undefined>): SummaryEnv => ({
  supabaseUrl: (raw.PUBLIC_SUPABASE_URL ?? raw.SUPABASE_URL ?? raw.VITE_SUPABASE_URL) as string,
  anonKey: (raw.PUBLIC_SUPABASE_ANON_KEY ?? raw.SUPABASE_ANON_KEY ?? raw.VITE_SUPABASE_ANON_KEY) as string,
  serviceKey: raw.SUPABASE_SERVICE_ROLE_KEY as string,
  cronSecret: raw.CRON_SECRET || null,
  resendKey: raw.RESEND_API_KEY || null,
  from: raw.SUMMARY_FROM || null,
  to: raw.SUMMARY_TO || null,
});

export const summaryMissingEnv = (raw: Record<string, string | undefined>): string[] =>
  [
    ['SUPABASE_URL', raw.PUBLIC_SUPABASE_URL ?? raw.SUPABASE_URL ?? raw.VITE_SUPABASE_URL],
    ['SUPABASE_ANON_KEY', raw.PUBLIC_SUPABASE_ANON_KEY ?? raw.SUPABASE_ANON_KEY ?? raw.VITE_SUPABASE_ANON_KEY],
    ['SUPABASE_SERVICE_ROLE_KEY', raw.SUPABASE_SERVICE_ROLE_KEY],
  ].filter(([, v]) => !v).map(([k]) => k as string);

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

const service = (env: SummaryEnv, init: RequestInit = {}): RequestInit => ({
  ...init,
  headers: {
    apikey: env.serviceKey,
    authorization: `Bearer ${env.serviceKey}`,
    'content-type': 'application/json',
    ...(init.headers as Record<string, string> | undefined),
  },
});

/** Equal-length compare that doesn't stop at the first difference. */
const sameSecret = (a: string, b: string): boolean => {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
};

async function isAdminToken(env: SummaryEnv, f: Fetch, token: string): Promise<boolean> {
  const who = await f(`${env.supabaseUrl}/auth/v1/user`, { headers: { apikey: env.anonKey, authorization: `Bearer ${token}` } });
  if (!who.ok) return false;
  const id = ((await who.json()) as { id?: string }).id;
  if (!id) return false;
  const res = await f(`${env.supabaseUrl}/rest/v1/profiles?id=eq.${id}&select=role,active`, service(env));
  const [p] = res.ok ? ((await res.json()) as { role: string; active: boolean }[]) : [];
  return !!p && p.active && p.role === 'admin';
}

export async function handleSummary(req: Request, env: SummaryEnv, f: Fetch, now: Date = new Date()): Promise<Response> {
  if (req.method !== 'GET' && req.method !== 'POST') return json(405, { error: 'GET or POST only' });

  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  const viaCron = !!env.cronSecret && !!token && sameSecret(token, env.cronSecret);
  if (!viaCron && !(token && (await isAdminToken(env, f, token)))) return json(401, { error: 'Not authorised' });

  const url = new URL(req.url);
  let body: Record<string, unknown> = {};
  if (req.method === 'POST') {
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      body = {};
    }
  }
  const hours = Math.min(72, Math.max(1, Math.round(Number(body.hours ?? url.searchParams.get('hours') ?? 24)) || 24));
  const dry = body.dry === true || url.searchParams.get('dry') === '1';

  const from = new Date(now.getTime() - hours * 3_600_000);
  const rpc = await f(`${env.supabaseUrl}/rest/v1/rpc/dialer_summary_data`, service(env, {
    method: 'POST',
    body: JSON.stringify({ p_from: from.toISOString(), p_to: now.toISOString() }),
  }));
  if (!rpc.ok) return json(502, { error: 'Couldn’t read the summary from the database. Has migration 025 been run?' });
  const data = (await rpc.json()) as SummaryData;

  const mail = renderSummary(data, { tz: 'Asia/Karachi', crmUrl: `${url.origin}/crm` });

  let to = (env.to ?? '').split(',').map(s => s.trim()).filter(Boolean);
  if (to.length === 0) {
    const admins = await f(`${env.supabaseUrl}/rest/v1/profiles?role=eq.admin&active=eq.true&select=email`, service(env));
    to = admins.ok ? ((await admins.json()) as { email: string | null }[]).map(a => a.email).filter((e): e is string => !!e) : [];
  }

  const reason = dry ? 'dry_run' : !env.resendKey || !env.from ? 'not_configured' : to.length === 0 ? 'no_recipients' : null;
  if (reason) {
    return json(200, { sent: false, reason, to, subject: mail.subject, text: mail.text, data });
  }

  const sent = await f('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${env.resendKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from: env.from, to, subject: mail.subject, html: mail.html, text: mail.text }),
  });
  const out = (await sent.json().catch(() => ({}))) as { id?: string; message?: string; name?: string };
  if (!sent.ok) return json(502, { error: `The email service refused it: ${out.message ?? out.name ?? sent.status}` });
  return json(200, { sent: true, to, subject: mail.subject, id: out.id ?? null });
}
