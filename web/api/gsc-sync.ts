export const config = { runtime: 'edge' };

/**
 * Copies Google Search Console query data into Supabase, daily.
 *
 * Run by Vercel Cron (see vercel.json). Safe to call by hand as often as
 * you like: it re-fetches a trailing window and upserts, so running it
 * twice changes nothing.
 *
 * ── Why a trailing window rather than yesterday ────────────────────
 *
 * Search Console restates recent days for about three days as its own
 * data settles. Fetching only yesterday would freeze each day at its
 * first, lowest reading and quietly under-report the site forever. So
 * the last WINDOW days are re-fetched every run and upserted on
 * (day, query, page).
 *
 * ── Why a service account rather than OAuth ────────────────────────
 *
 * There is nobody to click "allow" at 3am. A service account signs its
 * own assertion, which means this needs no refresh token and no consent
 * screen — at the cost of one manual step: the service account's email
 * has to be added as a user on the Search Console property, because
 * creating it in Google Cloud grants it nothing by itself.
 *
 * ── Setup ──────────────────────────────────────────────────────────
 *
 *   1. Google Cloud → create a service account → create a JSON key.
 *   2. Enable the "Google Search Console API" on that project.
 *   3. Search Console → Settings → Users and permissions → add the
 *      service account's email as a Full user.
 *   4. Vercel env vars:
 *        GSC_CLIENT_EMAIL   the service account email
 *        GSC_PRIVATE_KEY    the private_key from the JSON, newlines and all
 *        GSC_SITE_URL       https://www.xtenzium.com/   (must match the
 *                           property exactly, trailing slash included)
 *        SUPABASE_SERVICE_ROLE_KEY
 *        CRON_SECRET        any long random string
 *
 * Step 3 is the one that gets missed, and its symptom is a 403 with a
 * message about insufficient permission rather than anything about
 * users — hence the explicit note in the response below.
 */

declare const process: { env: Record<string, string | undefined> };

const {
  GSC_CLIENT_EMAIL: CLIENT_EMAIL,
  GSC_PRIVATE_KEY: PRIVATE_KEY,
  GSC_SITE_URL: SITE_URL,
  SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY,
  CRON_SECRET,
} = process.env;

const SUPABASE_URL = process.env.PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;

const SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly';
/** Google's own reporting lag, plus a margin. */
const WINDOW = 5;
/** The API's per-request ceiling. */
const ROW_LIMIT = 25000;

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { 'content-type': 'application/json' },
  });

const iso = (daysAgo: number) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d.toISOString().slice(0, 10);
};

/** PEM (PKCS#8) to the ArrayBuffer WebCrypto wants. */
function pemToBytes(pem: string): Uint8Array {
  const b64 = pem
    // Vercel's env UI stores the newlines as the two characters \n.
    .replace(/\\n/g, '\n')
    .replace(/-----[A-Z ]+-----/g, '')
    .replace(/\s+/g, '');
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** base64url, which JWT requires and btoa does not produce. */
const b64url = (input: string | Uint8Array) => {
  const bin =
    typeof input === 'string'
      ? String.fromCharCode(...new TextEncoder().encode(input))
      : String.fromCharCode(...input);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

/**
 * Sign a JWT assertion and trade it for an access token.
 *
 * This is the whole of Google's server-to-server flow, and it is short
 * enough that pulling in googleapis to do it would cost more than it
 * saves — that library is built for Node and this runs at the edge.
 */
async function accessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const claims = {
    iss: CLIENT_EMAIL,
    scope: SCOPE,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };

  const unsigned = `${b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${b64url(
    JSON.stringify(claims),
  )}`;

  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToBytes(PRIVATE_KEY as string) as unknown as ArrayBuffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = new Uint8Array(
    await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned)),
  );

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${unsigned}.${b64url(sig)}`,
    }),
  });

  const body = (await res.json()) as { access_token?: string; error_description?: string };
  if (!res.ok || !body.access_token) {
    throw new Error(`token exchange failed: ${body.error_description ?? res.status}`);
  }
  return body.access_token;
}

type GscRow = { keys: string[]; clicks: number; impressions: number; position: number };

export default async function handler(req: Request): Promise<Response> {
  // Vercel Cron sends the secret as a bearer token. Without this the
  // endpoint is a public button that burns the API quota.
  if (CRON_SECRET) {
    const auth = req.headers.get('authorization');
    if (auth !== `Bearer ${CRON_SECRET}`) return json(401, { error: 'unauthorized' });
  }

  const missing = Object.entries({
    GSC_CLIENT_EMAIL: CLIENT_EMAIL,
    GSC_PRIVATE_KEY: PRIVATE_KEY,
    GSC_SITE_URL: SITE_URL,
    SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY,
    SUPABASE_URL,
  })
    .filter(([, v]) => !v)
    .map(([k]) => k);
  if (missing.length) return json(500, { error: 'not configured', missing });

  let token: string;
  try {
    token = await accessToken();
  } catch (err) {
    return json(500, { error: String(err) });
  }

  const start = iso(WINDOW);
  const end = iso(1);

  const res = await fetch(
    `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(
      SITE_URL as string,
    )}/searchAnalytics/query`,
    {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        startDate: start,
        endDate: end,
        // Date first so each row carries its own day; without it the API
        // returns one aggregate for the whole window and the history
        // this table exists to build would be flat.
        dimensions: ['date', 'query', 'page'],
        rowLimit: ROW_LIMIT,
        // Excludes Discover and News, which are not what "search" means
        // on a B2B agency site.
        type: 'web',
      }),
    },
  );

  if (!res.ok) {
    const detail = await res.text();
    return json(res.status, {
      error: 'search console rejected the request',
      detail: detail.slice(0, 500),
      // The overwhelmingly likely cause, and the one whose error message
      // does not say so.
      hint:
        res.status === 403
          ? 'Add the service account email as a user on the Search Console property. Creating it in Google Cloud grants it nothing by itself.'
          : res.status === 404
            ? 'GSC_SITE_URL must match the property exactly, trailing slash included.'
            : undefined,
    });
  }

  const rows = ((await res.json()) as { rows?: GscRow[] }).rows ?? [];
  if (!rows.length) return json(200, { ok: true, window: [start, end], rows: 0 });

  const records = rows.map(r => ({
    day: r.keys[0],
    query: r.keys[1],
    page: r.keys[2],
    clicks: Math.round(r.clicks),
    impressions: Math.round(r.impressions),
    position: Number(r.position.toFixed(2)),
  }));

  // Upsert, because the trailing window overlaps every previous run.
  const write = await fetch(
    `${SUPABASE_URL}/rest/v1/search_queries?on_conflict=day,query,page`,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        apikey: SERVICE_KEY as string,
        authorization: `Bearer ${SERVICE_KEY}`,
        prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify(records),
    },
  );

  if (!write.ok) {
    return json(500, { error: 'supabase write failed', detail: (await write.text()).slice(0, 500) });
  }

  return json(200, { ok: true, window: [start, end], rows: records.length });
}
