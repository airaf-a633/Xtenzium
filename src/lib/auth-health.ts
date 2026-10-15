/* Keeping a login alive on a computer whose clock is wrong, and keeping
   one misbehaving browser from locking everyone else out.

   THE PROBLEM. A login is a short-lived token (an hour) that the browser
   renews with a "refresh" request. The browser decides a token has
   expired by comparing the token's expiry — a time on the SERVER's clock —
   with its OWN clock. If the computer's clock (or time zone) is an hour
   or more ahead, every freshly-issued token already looks expired, so the
   browser asks for another one on every request, and every one of those
   looks expired too. Supabase limits refreshes per IP address, so the
   storm hits "429 Too Many Requests", the refresh is refused, and the
   person is signed out. The limit is per IP, so it can lock out
   everybody on the same connection, not just that one browser.

   THE FIX, in three parts:
     1. Measure the clock error from the token itself (its `iat` is the
        server's time of issue) and store the expiry on the browser's own
        clock, so a wrong clock stops mattering.
     2. A circuit breaker: this browser may refresh only a handful of times
        a minute, whatever the cause.
     3. Tell the person when their clock is wrong, and how to fix it.

   Pure functions plus a tiny external store, so every rule is checked
   without a browser. */

/* ─── Reading a token ──────────────────────────────────── */

export interface Claims {
  iat?: number;
  exp?: number;
}

const decode = (b64url: string): string => {
  const pad = b64url.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (b64url.length % 4)) % 4);
  const bin = atob(pad);
  return decodeURIComponent(Array.from(bin, c => `%${c.charCodeAt(0).toString(16).padStart(2, '0')}`).join(''));
};

/** The claims in a JWT, or null if it isn't one. Never throws. */
export function jwtClaims(token: string): Claims | null {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    const c = JSON.parse(decode(part)) as Claims;
    return typeof c === 'object' && c !== null ? c : null;
  } catch {
    return null;
  }
}

/** How far this computer's clock is AHEAD of the server's (negative = behind), from a token issued just now. */
export function skewFromToken(token: string, nowMs: number): number | null {
  const iat = jwtClaims(token)?.iat;
  return typeof iat === 'number' ? nowMs - iat * 1000 : null;
}

/** Errors smaller than this are network latency and clock jitter, not a wrong clock. */
export const SKEW_TOLERANCE_MS = 30_000;
/** Past this, tell the person. */
export const SKEW_WARN_MS = 120_000;

/**
 * Rewrite a saved session so its expiry is on THIS computer's clock.
 * Derived from the token's own `exp` every time, so saving the same
 * session twice never shifts it twice. Anything it can't read is left alone.
 */
export function adjustStoredSession(raw: string, skewMs: number): string {
  if (Math.abs(skewMs) < SKEW_TOLERANCE_MS) return raw;
  try {
    const session = JSON.parse(raw) as { access_token?: unknown; expires_at?: unknown };
    if (typeof session.access_token !== 'string') return raw;
    const exp = jwtClaims(session.access_token)?.exp;
    if (typeof exp !== 'number') return raw;
    return JSON.stringify({ ...session, expires_at: exp + Math.round(skewMs / 1000) });
  } catch {
    return raw;
  }
}

/* ─── The circuit breaker ──────────────────────────────── */

/** Allows at most `max` calls in any rolling `windowMs`. */
export function createRefreshLimiter(opts: { max: number; windowMs: number; now?: () => number }) {
  const now = opts.now ?? Date.now;
  const hits: number[] = [];
  return {
    allow(): boolean {
      const t = now();
      while (hits.length && hits[0] <= t - opts.windowMs) hits.shift();
      if (hits.length >= opts.max) return false;
      hits.push(t);
      return true;
    },
  };
}

/* ─── What the app can show ────────────────────────────── */

export interface Health {
  /** Computer clock minus server clock, in ms. 0 when within tolerance or unknown. */
  skewMs: number;
  /** The breaker has tripped at least once this page load. */
  refreshStorm: boolean;
}

let state: Health = { skewMs: 0, refreshStorm: false };
const listeners = new Set<() => void>();

const publish = (next: Health) => {
  if (next.skewMs === state.skewMs && next.refreshStorm === state.refreshStorm) return;
  state = next;
  listeners.forEach(l => l());
};

/** For useSyncExternalStore: the same object until something changes. */
export const getHealth = (): Health => state;
export const subscribeHealth = (listener: () => void) => {
  listeners.add(listener);
  return () => void listeners.delete(listener);
};
export const reportSkew = (ms: number) => publish({ ...state, skewMs: Math.abs(ms) < SKEW_TOLERANCE_MS ? 0 : ms });
export const reportStorm = () => publish({ ...state, refreshStorm: true });
/** For checks. */
export const resetHealth = () => publish({ skewMs: 0, refreshStorm: false });

/** "about 2 hours", "about 14 minutes" */
export function describeSkew(ms: number): string {
  const min = Math.round(Math.abs(ms) / 60_000);
  if (min < 60) return `about ${min} minute${min === 1 ? '' : 's'}`;
  const h = Math.round((min / 60) * 10) / 10;
  return `about ${h} hour${h === 1 ? '' : 's'}`;
}
