/* A tab left open across a deploy: recognise the error, reload once, never loop. */

import { isStaleChunkError, reloadForUpdate } from '../src/lib/app-update';

let failures = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    failures++;
    console.error(`FAIL ${name}\n  got  ${JSON.stringify(got)}\n  want ${JSON.stringify(want)}`);
  }
};

/* The errors browsers actually produce (the first two are from a real report). */
eq('Chrome: failed to fetch dynamically imported module', isStaleChunkError('Failed to fetch dynamically imported module: https://www.xtenzium.com/crm/assets/DialerSettings-B2nHie_G.js'), true);
eq('Chrome: wrong MIME type from the server', isStaleChunkError('Failed to load module script: Expected a JavaScript-or-Wasm module script but the server responded with a MIME type of "text/html".'), true);
eq('Safari', isStaleChunkError('Importing a module script failed.'), true);
eq('Firefox', isStaleChunkError('error loading dynamically imported module: https://x/a.js'), true);
eq('HTML parsed as script', isStaleChunkError("Unexpected token '<'"), true);
eq('webpack-style', isStaleChunkError('Loading chunk 12 failed.'), true);
eq('Vite preload', isStaleChunkError('Unable to preload CSS for /crm/assets/x.css'), true);

/* …and not the ones that are real bugs. */
eq('a normal crash is not "stale"', [isStaleChunkError('lists.filter is not a function'), isStaleChunkError("Cannot read properties of undefined (reading 'toLocaleString')"), isStaleChunkError(null), isStaleChunkError('')], [false, false, false, false]);

/* Reload once, then not again within 30 s. */
const store = new Map<string, string>();
let reloads = 0;
const g = globalThis as unknown as Record<string, unknown>;
g.sessionStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) };
g.window = { location: { reload: () => void reloads++ } };

let t = 1_000_000;
eq('first failure: reloads', [reloadForUpdate(() => t), reloads], [true, 1]);
t += 5_000;
eq('failing again 5 s later: does NOT reload again (no loop)', [reloadForUpdate(() => t), reloads], [false, 1]);
t += 40_000;
eq('45 s later, a genuinely new deploy: reloads', [reloadForUpdate(() => t), reloads], [true, 2]);

/* Storage blocked (private window): still reloads, never throws. */
g.sessionStorage = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
eq('blocked storage still reloads', [reloadForUpdate(() => t + 100_000), reloads], [true, 3]);

if (failures) {
  console.error(`${failures} app-update check(s) failed`);
  process.exit(1);
}
console.log('app-update: all checks passed');
