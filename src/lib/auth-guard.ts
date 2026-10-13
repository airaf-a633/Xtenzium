/* What to do when the server says "401" to someone who thinks they're
   signed in.

   It happens when a session ends underneath an open tab — a sign-out
   somewhere else, a revoked login, a refresh that couldn't complete. The
   old behaviour was to keep asking and failing; this tries ONE quiet
   refresh, and if that doesn't work, signs this browser out (locally)
   so the app returns to the login page with an explanation instead of
   looping.

   Dependencies are passed in so the rules can be checked without a
   browser or a server. */

export interface GuardDeps {
  /** Is there a session in this browser right now? */
  hasSession: () => Promise<boolean>;
  /** Try to get a fresh token. true = it worked. */
  refresh: () => Promise<boolean>;
  /** Sign THIS browser out (not every device) and remember why. */
  endSession: () => Promise<void>;
  now?: () => number;
  /** After one recovery attempt, ignore further 401s for this long. */
  cooldownMs?: number;
}

export function createSessionGuard(deps: GuardDeps) {
  const now = deps.now ?? Date.now;
  const cooldown = deps.cooldownMs ?? 5000;
  let inFlight: Promise<void> | null = null;
  let quietUntil = 0;

  /** Call on every 401 from the API. Safe to call a hundred times at once. */
  return function onUnauthorized(): Promise<void> {
    if (inFlight) return inFlight;
    if (now() < quietUntil) return Promise.resolve();

    inFlight = (async () => {
      try {
        // Nothing to recover: already signed out, and the router is handling it.
        if (!(await deps.hasSession())) return;
        if (await deps.refresh()) return;
        await deps.endSession();
      } finally {
        quietUntil = now() + cooldown;
        inFlight = null;
      }
    })();
    return inFlight;
  };
}
