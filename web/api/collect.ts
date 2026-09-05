export const config = { runtime: 'edge' };

/**
 * The analytics collector.
 *
 * The beacon used to POST straight to PostgREST. This sits in front of it
 * for two reasons, one of them a fix:
 *
 *  1. Geography. The site is static, so nothing in the page can learn its
 *     own IP address and no amount of client code will produce a country.
 *     The edge sees the request, so it can — and the address is read from
 *     a header, turned into a country and a city, and dropped inside this
 *     function. It is never sent onward and never stored.
 *
 *  2. The anon key was in a URL. `sendBeacon` cannot set headers, so the
 *     old path put `?apikey=…` in the query string, where it lands in
 *     every proxy and access log between here and Supabase. The key is
 *     public by design, but public is not the same as logged everywhere.
 *     Same-origin now; the key stays server-side on this hop.
 *
 * If this endpoint is down the browser falls back to the direct insert,
 * so a failure here costs geography, not measurement.
 */

/* Declared rather than pulled in from @types/node: this is the only file
   in the project that runs on a server, and one line is a smaller cost
   than node types leaking into a browser-only tsconfig. */
declare const process: { env: Record<string, string | undefined> };

const URL_ = process.env.PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const KEY = process.env.PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;

/** Only the event names the table's check constraint accepts. */
const NAMES = new Set([
  'pageview',
  'scroll_depth',
  'outbound_click',
  'form_start',
  'form_submit',
  'estimate_step',
  'estimate_complete',
  'exit_prompt_shown',
  'exit_prompt_click',
]);

const DEVICES = new Set(['mobile', 'tablet', 'desktop']);

/** Bounded so a hostile client cannot post a novel through the beacon. */
const MAX_BATCH = 50;
const clip = (v: unknown, n: number) =>
  typeof v === 'string' && v.length ? v.slice(0, n) : null;

/**
 * Family only — never a version.
 *
 * A user agent is a fingerprinting surface, and its entropy is almost all
 * in the version numbers and the build tokens. "Safari on iOS" tells you
 * what to test against; "Safari 18.3.1 on iOS 18.3.1" tells you that too,
 * and also helps single somebody out of a small sample.
 */
function client(ua: string): { browser: string | null; os: string | null } {
  if (!ua) return { browser: null, os: null };

  // Order matters throughout: every Chromium browser claims to be Chrome,
  // Chrome claims to be Safari, and Edge claims to be both.
  const browser =
    /\bEdg\//.test(ua) ? 'Edge'
    : /\bOPR\/|\bOpera/.test(ua) ? 'Opera'
    : /\bSamsungBrowser\//.test(ua) ? 'Samsung Internet'
    : /\bFirefox\/|\bFxiOS\//.test(ua) ? 'Firefox'
    : /\bCriOS\/|\bChrome\//.test(ua) ? 'Chrome'
    : /\bSafari\//.test(ua) ? 'Safari'
    : null;

  const os =
    /\biPhone|\biPad|\biPod/.test(ua) ? 'iOS'
    : /\bAndroid\b/.test(ua) ? 'Android'
    : /\bMac OS X\b/.test(ua) ? 'macOS'
    : /\bWindows\b/.test(ua) ? 'Windows'
    : /\bCrOS\b/.test(ua) ? 'ChromeOS'
    : /\bLinux\b/.test(ua) ? 'Linux'
    : null;

  return { browser, os };
}

export default async function handler(req: Request): Promise<Response> {
  // 204 on every path below. The browser has nothing to do with the
  // answer — sendBeacon discards it — and a beacon that can report a
  // failure invites a page to react to one.
  const ok = () => new Response(null, { status: 204 });

  if (req.method !== 'POST') return new Response(null, { status: 405 });
  if (!URL_ || !KEY) return ok();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return ok();
  }
  if (!Array.isArray(body) || !body.length) return ok();

  const h = req.headers;
  const { browser, os } = client(h.get('user-agent') ?? '');
  const country = clip(h.get('x-vercel-ip-country'), 2);
  // Vercel percent-encodes city names with spaces or accents.
  let city = clip(h.get('x-vercel-ip-city'), 80);
  if (city) {
    try {
      city = decodeURIComponent(city);
    } catch {
      /* leave it as sent */
    }
  }

  /* Rebuilt field by field rather than spread. A client that adds a
     column name to its payload should not be able to write it. */
  const rows = body.slice(0, MAX_BATCH).flatMap((e: Record<string, unknown>) => {
    if (!e || typeof e !== 'object') return [];
    const name = clip(e.name, 40);
    const path = clip(e.path, 300);
    const visitor = clip(e.visitor, 64);
    if (!name || !NAMES.has(name) || !path || !visitor) return [];
    const device = clip(e.device, 12);
    return [
      {
        name,
        path,
        visitor,
        referrer: clip(e.referrer, 200),
        device: device && DEVICES.has(device) ? device : null,
        props: e.props && typeof e.props === 'object' ? e.props : {},
        country,
        city,
        browser,
        os,
      },
    ];
  });

  if (!rows.length) return ok();

  try {
    await fetch(`${URL_}/rest/v1/page_events`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        apikey: KEY,
        authorization: `Bearer ${KEY}`,
        prefer: 'return=minimal',
      },
      body: JSON.stringify(rows),
    });
  } catch {
    // Swallowed, as everywhere else on this path. A lost measurement is
    // not worth a visible failure.
  }

  return ok();
}
