/* The clock-skew correction, the refresh circuit breaker and the health store. */

import {
  adjustStoredSession, createRefreshLimiter, describeSkew, getHealth, jwtClaims, reportSkew, reportStorm,
  resetHealth, skewFromToken, subscribeHealth, SKEW_TOLERANCE_MS,
} from '../src/lib/auth-health';

let failures = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    failures++;
    console.error(`FAIL ${name}\n  got  ${JSON.stringify(got)}\n  want ${JSON.stringify(want)}`);
  }
};

const b64url = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = (claims: Record<string, unknown>) => `${b64url({ alg: 'HS256' })}.${b64url(claims)}.sig`;

/* ─── Reading a token ─── */
eq('claims', jwtClaims(jwt({ iat: 100, exp: 3700, sub: 'u' })), { iat: 100, exp: 3700, sub: 'u' });
eq('not a jwt', [jwtClaims('nope'), jwtClaims(''), jwtClaims('a.b.c')], [null, null, null]);
eq('unicode in claims survives', jwtClaims(jwt({ name: 'Zoë — ünï', iat: 1 }))?.iat, 1);

/* ─── Skew ─── */
const SERVER_NOW = 1_800_000_000; // seconds
eq('a correct clock reads ~0', skewFromToken(jwt({ iat: SERVER_NOW }), SERVER_NOW * 1000 + 800), 800);
eq('a clock 2h AHEAD reads +2h', skewFromToken(jwt({ iat: SERVER_NOW }), (SERVER_NOW + 7200) * 1000), 7_200_000);
eq('a clock 15 min BEHIND reads negative', skewFromToken(jwt({ iat: SERVER_NOW }), (SERVER_NOW - 900) * 1000), -900_000);
eq('no iat → unknown', skewFromToken(jwt({ exp: 5 }), 1), null);

/* ─── Re-basing a saved session ─── */
const session = (exp: number, extra: Record<string, unknown> = {}) =>
  JSON.stringify({ access_token: jwt({ iat: exp - 3600, exp }), refresh_token: 'r', expires_at: exp, token_type: 'bearer', user: { id: 'u1' }, ...extra });
const EXP = SERVER_NOW + 3600;

eq('no skew → untouched, byte for byte', adjustStoredSession(session(EXP), 0), session(EXP));
eq('within tolerance → untouched', adjustStoredSession(session(EXP), SKEW_TOLERANCE_MS - 1), session(EXP));
const ahead = JSON.parse(adjustStoredSession(session(EXP), 7_200_000));
eq('clock 2h ahead → the expiry moves 2h later, on the computer\'s clock', ahead.expires_at, EXP + 7200);
eq('…so at the computer\'s "now" the token has ~an hour left, as it truly does', ahead.expires_at - (SERVER_NOW + 7200), 3600);
eq('everything else in the session is preserved', [ahead.refresh_token, ahead.user, ahead.token_type], ['r', { id: 'u1' }, 'bearer']);
const behind = JSON.parse(adjustStoredSession(session(EXP), -900_000));
eq('clock 15 min behind → the expiry moves earlier', behind.expires_at, EXP - 900);
eq('IDEMPOTENT: saving the same session again does not shift it twice',
  JSON.parse(adjustStoredSession(adjustStoredSession(session(EXP), 7_200_000), 7_200_000)).expires_at, EXP + 7200);
eq('junk is returned unchanged, never thrown on', [adjustStoredSession('not json', 9e6), adjustStoredSession('{"a":1}', 9e6), adjustStoredSession(JSON.stringify({ access_token: 'x.y.z' }), 9e6)], ['not json', '{"a":1}', JSON.stringify({ access_token: 'x.y.z' })]);

/* ─── Circuit breaker ─── */
{
  let t = 0;
  const lim = createRefreshLimiter({ max: 5, windowMs: 60_000, now: () => t });
  const results: boolean[] = [];
  for (let i = 0; i < 8; i++) results.push(lim.allow());
  eq('five allowed, then refused', results, [true, true, true, true, true, false, false, false]);
  t = 59_999;
  eq('still refused just inside the window', lim.allow(), false);
  t = 60_001;
  eq('allowed again once the window has rolled past', lim.allow(), true);
  eq('…and only as many as have aged out', [lim.allow(), lim.allow(), lim.allow(), lim.allow(), lim.allow()], [true, true, true, true, false]);
  eq('refusals do not count against the window (they must not extend a lock-out)', (() => {
    let tt = 0;
    const l = createRefreshLimiter({ max: 2, windowMs: 1000, now: () => tt });
    l.allow(); l.allow();
    for (let i = 0; i < 100; i++) { tt += 5; l.allow(); }   // hammering while blocked
    tt = 1001;
    return l.allow();
  })(), true);
}

/* ─── Health store ─── */
{
  resetHealth();
  let notified = 0;
  const unsub = subscribeHealth(() => notified++);
  eq('starts healthy', getHealth(), { skewMs: 0, refreshStorm: false });
  reportSkew(5_000);
  eq('small skew is ignored (no notification, no change)', [getHealth().skewMs, notified], [0, 0]);
  reportSkew(7_200_000);
  eq('a real skew is published', [getHealth().skewMs, notified], [7_200_000, 1]);
  reportSkew(7_200_000);
  eq('the same value again does not re-notify', notified, 1);
  const before = getHealth();
  reportSkew(7_200_000);
  eq('the snapshot is referentially stable when nothing changed (needed by useSyncExternalStore)', getHealth() === before, true);
  reportStorm();
  eq('the breaker tripping is published', [getHealth().refreshStorm, notified], [true, 2]);
  reportSkew(1_000);
  eq('fixing the clock clears the skew but not the storm flag', getHealth(), { skewMs: 0, refreshStorm: true });
  unsub();
  reportSkew(9_000_000);
  eq('unsubscribed listeners are not called (skew set, storm set, skew cleared = 3 notifications, no more)', notified, 3);
  resetHealth();
}

/* ─── Wording ─── */
eq('minutes', [describeSkew(14 * 60_000), describeSkew(-60_000)], ['about 14 minutes', 'about 1 minute']);
eq('hours', [describeSkew(7_200_000), describeSkew(5_400_000), describeSkew(-3_600_000)], ['about 2 hours', 'about 1.5 hours', 'about 1 hour']);

if (failures) {
  console.error(`${failures} auth-health check(s) failed`);
  process.exit(1);
}
console.log('auth-health: all checks passed');
