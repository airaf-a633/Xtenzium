/* The session-loss rules: one quiet refresh, then a clean local sign-out,
   never a loop. And the "you were signed out" note. */

import { createSessionGuard } from '../src/lib/auth-guard';
import { consumeSessionLost, markSessionLost } from '../src/lib/session-notice';

let failures = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    failures++;
    console.error(`FAIL ${name}\n  got  ${JSON.stringify(got)}\n  want ${JSON.stringify(want)}`);
  }
};

const world = (o: { session?: boolean; refreshOk?: boolean } = {}) => {
  const log = { has: 0, refresh: 0, ended: 0 };
  let t = 1_000_000;
  const guard = createSessionGuard({
    hasSession: async () => { log.has++; return o.session ?? true; },
    refresh: async () => { log.refresh++; await Promise.resolve(); return o.refreshOk ?? true; },
    endSession: async () => { log.ended++; },
    now: () => t,
    cooldownMs: 5000,
  });
  return { guard, log, advance: (ms: number) => { t += ms; } };
};

/* A refresh that works means nobody notices. */
{
  const w = world({ refreshOk: true });
  await w.guard();
  eq('refresh succeeds → stay signed in', [w.log.refresh, w.log.ended], [1, 0]);
}

/* A refresh that fails ends THIS session, once. */
{
  const w = world({ refreshOk: false });
  await w.guard();
  eq('refresh fails → signed out locally', [w.log.refresh, w.log.ended], [1, 1]);
}

/* Already signed out: nothing to recover, nothing to do. */
{
  const w = world({ session: false });
  await w.guard();
  eq('no session → no refresh, no sign-out', [w.log.refresh, w.log.ended], [0, 0]);
}

/* A burst of failing requests (the old storm) causes ONE attempt. */
{
  const w = world({ refreshOk: false });
  await Promise.all(Array.from({ length: 34 }, () => w.guard()));
  eq('34 simultaneous 401s → one refresh, one sign-out', [w.log.refresh, w.log.ended], [1, 1]);
  await w.guard();
  eq('…and 401s straight afterwards are ignored too', [w.log.refresh, w.log.ended], [1, 1]);
  w.advance(4999);
  await w.guard();
  eq('…still quiet just inside the cooldown', w.log.refresh, 1);
  w.advance(2);
  await w.guard();
  eq('…and allowed again once it has passed', w.log.refresh, 2);
}

/* A guard that throws must not wedge itself shut. */
{
  let calls = 0;
  const guard = createSessionGuard({
    hasSession: async () => { calls++; throw new Error('network down'); },
    refresh: async () => true,
    endSession: async () => {},
    now: () => 1,
    cooldownMs: 0,
  });
  let threw = false;
  try { await guard(); } catch { threw = true; }
  eq('an error surfaces to the caller', threw, true);
  try { await guard(); } catch { /* expected */ }
  eq('…and the guard is not stuck: the next call tries again', calls, 2);
}

/* The note shown on the login page. */
{
  const mem = new Map<string, string>();
  const store = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k) };
  eq('nothing to show at first', consumeSessionLost(store), false);
  markSessionLost(store);
  eq('shown once after a lost session', consumeSessionLost(store), true);
  eq('…and not again on a refresh of the login page', consumeSessionLost(store), false);
  eq('blocked storage never throws', [consumeSessionLost(null), (() => { markSessionLost(null); return true; })()], [false, true]);
  const broken = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); }, removeItem: () => { throw new Error('denied'); } };
  eq('a throwing store never throws', [consumeSessionLost(broken), (() => { markSessionLost(broken); return true; })()], [false, true]);
}

if (failures) {
  console.error(`${failures} auth-guard check(s) failed`);
  process.exit(1);
}
console.log('auth-guard: all checks passed');
