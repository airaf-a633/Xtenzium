export const config = { runtime: 'edge' };

/**
 * Lead intake for the digital business cards (/c/<name>).
 *
 * Same-origin, so a conference Wi-Fi that blocks or throttles
 * *.supabase.co still gets the lead through, and retried here rather than
 * in a phone that may lose signal between attempts. Writes to `leads`,
 * whose AFTER INSERT trigger opens the deal in the CRM pipeline.
 *
 * `source` stays 'contact' (the column is check-constrained); card leads
 * are told apart by payload.via = 'card'.
 */

declare const process: { env: Record<string, string | undefined> };

const URL_ = process.env.PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const KEY = process.env.PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;

const OWNERS = new Set(['airaf', 'sharab', 'umar']);
const clip = (v: unknown, n: number) =>
  typeof v === 'string' && v.trim() ? v.trim().slice(0, n) : null;
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json(405, { ok: false });
  if (!URL_ || !KEY) return json(503, { ok: false, reason: 'not-configured' });

  let b: Record<string, unknown>;
  try {
    b = await req.json();
  } catch {
    return json(400, { ok: false, reason: 'bad-json' });
  }

  const name = clip(b.name, 120);
  const email = clip(b.email, 200);
  const owner = clip(b.owner, 20);
  if (!name || !email || !/^\S+@\S+\.\S+$/.test(email) || !owner || !OWNERS.has(owner)) {
    return json(400, { ok: false, reason: 'invalid' });
  }

  const ownerName = clip(b.ownerName, 80) ?? owner;
  const row = {
    name,
    email,
    company: clip(b.company, 160),
    message: `[Card: met ${ownerName}] ${clip(b.message, 2000) ?? 'Swapped details via digital card.'}`,
    source: 'contact',
    payload: {
      via: 'card',
      owner,
      tap: clip(b.tap, 10),
      phone: clip(b.phone, 40),
      id: clip(b.id, 64),
      country: req.headers.get('x-vercel-ip-country'),
    },
  };

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(`${URL_}/rest/v1/leads`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          apikey: KEY,
          authorization: `Bearer ${KEY}`,
          prefer: 'return=minimal',
        },
        body: JSON.stringify(row),
      });
      if (res.ok) return json(200, { ok: true });
      // A 4xx will not improve on retry.
      if (res.status < 500) return json(422, { ok: false, reason: 'rejected' });
    } catch {
      /* network — retry */
    }
    await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
  }
  return json(502, { ok: false, reason: 'upstream' });
}
