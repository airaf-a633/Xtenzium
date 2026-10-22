/* A deploy renames the app's files (DialerSettings-B2nHie_G.js → DialerSettings-2zfLjUDy.js).
   A tab that was opened BEFORE the deploy still asks for the old names; the server answers with
   a web page instead of a script, and the screen fails with "Failed to fetch dynamically imported
   module". Nothing is wrong with the data — the tab is just out of date. The fix is to reload,
   once, and carry on with the new version. */

const KEY = 'crm:reloaded-for-update';
const COOLDOWN_MS = 30_000;

/** True for the errors a stale tab produces when it can't load a page of the app. */
export const isStaleChunkError = (message: string | null | undefined): boolean =>
  /dynamically imported module|importing a module script failed|module script.*mime type|unexpected token '<'|loading chunk .* failed|preload/i.test(
    message ?? '',
  );

/** Reload to pick up the new version — at most once every 30 s, so a real outage can't cause a reload loop. */
export function reloadForUpdate(now: () => number = Date.now): boolean {
  try {
    const last = Number(sessionStorage.getItem(KEY) ?? 0);
    if (now() - last < COOLDOWN_MS) return false;
    sessionStorage.setItem(KEY, String(now()));
  } catch {
    /* storage blocked: reload anyway, once per page load is all we can promise */
  }
  window.location.reload();
  return true;
}
