/* One deploy, two apps.
 *
 * `xtenzium.com` is the Astro marketing site in web/. The CRM is the
 * React SPA in src/, and it has to live somewhere reachable — after the
 * Astro site took over the domain, it was reachable nowhere.
 *
 * This builds both into a single output tree:
 *
 *     dist/            ← Astro, serving the public site
 *     dist/crm/        ← the React SPA, serving /crm
 *
 * The SPA is built with `--base=/crm/` so its assets resolve under that
 * prefix. Its router is deliberately left at the default basename: it
 * decides between the public, admin and CRM shells by reading
 * `location.pathname.startsWith('/crm')`, so it needs to keep seeing the
 * full path. Changing the basename would strip the prefix and break
 * every one of those checks along with every `/crm/...` link.
 */

import { execSync } from 'node:child_process';
import { cpSync, existsSync, rmSync, mkdirSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const webDist = path.join(root, 'web', 'dist');

const run = (cmd, cwd = root) => {
  console.log(`\n> ${cmd}`);
  execSync(cmd, { cwd, stdio: 'inherit' });
};

/* Start clean. Two builds writing into one tree makes a stale file from
   a previous run indistinguishable from a current one. */
rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

/* ── 0. One Supabase project, two naming conventions ─────────────────
 *
 * The CRM is Vite and reads VITE_SUPABASE_*. The marketing site is Astro
 * and reads PUBLIC_SUPABASE_* — Astro only inlines PUBLIC_-prefixed vars
 * into the browser bundle. Same project, same anon key, two names.
 *
 * Vercel had the VITE_ pair and not the PUBLIC_ pair. The result was a
 * marketing site whose forms told every visitor "this form is not
 * connected yet", and an analytics table with zero rows — and nothing
 * failed, because every step on that path swallows errors by design so
 * a broken tracker can never break a lead form.
 *
 * So: derive one from the other, and refuse to build a site whose forms
 * cannot send. A loud build failure is the correct outcome for a
 * misconfigured deploy; two silent weeks of lost leads is not.
 */
const derive = (publicName, viteName) => {
  if (process.env[publicName]) return;
  if (process.env[viteName]) {
    process.env[publicName] = process.env[viteName];
    console.log(`  ${publicName} derived from ${viteName}`);
  }
};
derive('PUBLIC_SUPABASE_URL', 'VITE_SUPABASE_URL');
derive('PUBLIC_SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY');

if (!process.env.PUBLIC_SUPABASE_URL || !process.env.PUBLIC_SUPABASE_ANON_KEY) {
  throw new Error(
    'Refusing to build: PUBLIC_SUPABASE_URL / PUBLIC_SUPABASE_ANON_KEY are not set ' +
      '(nor VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY to derive them from). ' +
      'Without them the contact form and estimator tell every visitor the form is ' +
      'not connected, and analytics records nothing. Set them in Vercel → Settings → ' +
      'Environment Variables and redeploy.',
  );
}

/* ── 1. The marketing site ───────────────────────────────────────── */
if (!existsSync(path.join(root, 'web', 'node_modules'))) {
  run('npm ci --prefix web --no-audit --no-fund');
}
run('npm --prefix web run build');

if (!existsSync(webDist)) {
  throw new Error('The Astro build produced no web/dist — refusing to deploy a site with no home page.');
}
cpSync(webDist, dist, { recursive: true });

/* ── 2. The CRM ──────────────────────────────────────────────────── */
run('npx tsc -b');
run('npx vite build --base=/crm/ --outDir dist/crm --emptyOutDir');

/* ── 3. Prove both actually landed ───────────────────────────────── */
const failures = [];
if (!existsSync(path.join(dist, 'index.html'))) failures.push('dist/index.html (marketing site)');
if (!existsSync(path.join(dist, 'crm', 'index.html'))) failures.push('dist/crm/index.html (CRM)');
if (failures.length > 0) {
  throw new Error(`Build finished but these are missing: ${failures.join(', ')}`);
}

const top = readdirSync(dist).filter(f => !f.startsWith('.')).sort();
console.log(`\n✓ dist/ contains: ${top.join(', ')}`);
console.log('✓ marketing site at /, CRM at /crm');
