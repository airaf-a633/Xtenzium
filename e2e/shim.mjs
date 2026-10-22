// A stand-in for Supabase for end-to-end testing: REAL Postgres (PGlite) running the REAL migrations,
// behind a small PostgREST subset + login endpoints. Test-only hooks live under /__.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';

const MIG = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'supabase', 'migrations');
const PORT = 54321;
const ADMIN = '00000000-0000-0000-0000-0000000000a1';
const CALLER = '00000000-0000-0000-0000-0000000000c1';
const USERS = { 'owner@xtenzium.com': ADMIN, 'rep@xtenzium.com': CALLER };
const EMAIL_OF = Object.fromEntries(Object.entries(USERS).map(([e, i]) => [i, e]));

const db = new PGlite();
await db.exec(`
  CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS;
  CREATE SCHEMA auth; CREATE SCHEMA storage;
  CREATE TABLE auth.users (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text, raw_user_meta_data jsonb DEFAULT '{}');
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  CREATE TABLE storage.buckets (id text PRIMARY KEY, name text, public boolean);
  CREATE TABLE storage.objects (id uuid DEFAULT gen_random_uuid(), bucket_id text, name text);
  ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
  GRANT USAGE ON SCHEMA public, auth TO anon, authenticated, service_role;
  INSERT INTO auth.users (id, email) VALUES ('${ADMIN}', 'owner@xtenzium.com');
`);
for (const f of fs.readdirSync(MIG).filter(f => f.endsWith('.sql')).sort()) {
  try { await db.exec(fs.readFileSync(path.join(MIG, f), 'utf8')); } catch (e) { console.log('MIGRATION FAIL', f, e.message.split('\n')[0]); process.exit(1); }
}
await db.exec(`GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
  GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
  INSERT INTO auth.users (id, email) VALUES ('${CALLER}', 'rep@xtenzium.com');
  UPDATE public.profiles SET full_name = 'Owner', timezone = 'America/New_York' WHERE id = '${ADMIN}';
  UPDATE public.profiles SET full_name = 'Ryan Rep', timezone = 'Asia/Karachi' WHERE id = '${CALLER}';
  INSERT INTO public.team_members (name) VALUES ('Airaf Adil'), ('Sharab Khan'), ('Umar Siddiqui');`);
console.log('migrations applied; roles:', JSON.stringify((await db.query(`SELECT u.email, p.role, p.active FROM public.profiles p JOIN auth.users u ON u.id = p.id`)).rows));

/* ── tiny helpers ── */
const lit = v => (v === null || v === undefined ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`);
const ident = c => { if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(c)) throw new Error('bad identifier ' + c); return `"${c}"`; };
const pgArray = a => `{${a.map(x => (x === null ? 'NULL' : `"${String(x).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`)).join(',')}}`;
const valueLit = v => (v === null || v === undefined ? 'NULL' : typeof v === 'object' ? lit(JSON.stringify(v)) : lit(v));
const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = uid => { const now = Math.floor(Date.now() / 1000); return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ iss: 'e2e', sub: uid, aud: 'authenticated', role: 'authenticated', email: EMAIL_OF[uid], iat: now, exp: now + 3600, session_id: 's1' })}.sig`; };
const session = uid => ({ access_token: jwt(uid), token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: `rt:${uid}`, user: userOf(uid) });
const userOf = uid => ({ id: uid, aud: 'authenticated', role: 'authenticated', email: EMAIL_OF[uid], app_metadata: { provider: 'email' }, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' });
const uidFromAuth = h => { try { const t = (h || '').replace(/^Bearer /i, ''); const p = JSON.parse(Buffer.from(t.split('.')[1], 'base64url').toString()); return p.sub || null; } catch { return null; } };

/* ── PostgREST filters ── */
const OPS = { eq: '=', neq: '<>', gt: '>', gte: '>=', lt: '<', lte: '<=', like: 'LIKE', ilike: 'ILIKE' };
function cond(col, op, val) {
  let neg = false;
  if (op === 'not') { neg = true; const i = val.indexOf('.'); op = val.slice(0, i); val = val.slice(i + 1); }
  let sql;
  if (op === 'is') sql = `${ident(col)} IS ${val === 'null' ? 'NULL' : val === 'true' ? 'TRUE' : 'FALSE'}`;
  else if (op === 'in') {
    const items = val.replace(/^\(|\)$/g, '').split(',').map(s => s.replace(/^"|"$/g, ''));
    sql = `${ident(col)} IN (${items.map(lit).join(',')})`;
  } else if (OPS[op]) sql = `${ident(col)} ${OPS[op]} ${lit(val)}`;
  else throw new Error('unsupported operator ' + op);
  return neg ? `NOT (${sql})` : sql;
}
function where(params) {
  const parts = [];
  for (const [k, v] of params) {
    if (['select', 'order', 'limit', 'offset', 'columns', 'on_conflict'].includes(k)) continue;
    if (k === 'or') {
      const inner = v.replace(/^\(|\)$/g, '').split(',').map(c => { const a = c.split('.'); return cond(a[0], a[1], a.slice(2).join('.')); });
      parts.push(`(${inner.join(' OR ')})`);
    } else {
      const i = v.indexOf('.');
      parts.push(cond(k, v.slice(0, i), v.slice(i + 1)));
    }
  }
  return parts.length ? ` WHERE ${parts.join(' AND ')}` : '';
}
function orderBy(params) {
  const o = params.get('order');
  if (!o) return '';
  return ' ORDER BY ' + o.split(',').map(t => { const [c, ...r] = t.split('.'); return `${ident(c)} ${r.includes('desc') ? 'DESC' : 'ASC'}${r.includes('nullsfirst') ? ' NULLS FIRST' : r.includes('nullslast') ? ' NULLS LAST' : ''}`; }).join(', ');
}

/* ── test hooks ── */
let failRest = false;
let fail401 = false;
let revoked = false;
let refreshes = 0;
let latency = 0;
const log = [];

let chain = Promise.resolve();
const serial = fn => { const run = chain.then(fn, fn); chain = run.catch(() => {}); return run; };

async function asUser(uid, fn) {
  return db.transaction(async tx => {
    await tx.query(`SET LOCAL ROLE ${uid ? 'authenticated' : 'anon'}`);
    await tx.query(`SELECT set_config('request.jwt.claim.sub', $1, true)`, [uid || '']);
    await tx.query(`SET LOCAL dialer.dedupe_seconds = '20'`);
    return fn(tx);
  });
}

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'apikey, authorization, content-type, x-client-info, prefer, accept, accept-profile, content-profile, range, x-supabase-api-version',
  'access-control-allow-methods': 'GET,POST,PATCH,PUT,DELETE,HEAD,OPTIONS',
  'access-control-expose-headers': 'content-range',
};
const send = (res, status, body, extra = {}) => {
  const h = { ...CORS, ...extra };
  if (body === undefined) { res.writeHead(status, h); return res.end(); }
  h['content-type'] = 'application/json';
  res.writeHead(status, h);
  res.end(JSON.stringify(body));
};
const sqlStatus = code => (code === '42501' ? 403 : code === '23505' ? 409 : 400);
const pgErr = e => ({ code: e.code || 'P0001', message: e.message, details: e.detail || null, hint: e.hint || null });

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const s = Buffer.concat(chunks).toString();
  return s ? JSON.parse(s) : undefined;
}

async function handleRest(req, res, url, uid) {
  const params = url.searchParams;
  const table = url.pathname.replace('/rest/v1/', '');
  const prefer = String(req.headers.prefer || '');
  const wantObject = String(req.headers.accept || '').includes('vnd.pgrst.object');
  const body = ['POST', 'PATCH', 'PUT'].includes(req.method) ? await readBody(req) : undefined;

  try {
    /* RPC */
    if (table.startsWith('rpc/')) {
      const fn = table.slice(4);
      if (!/^[a-z_][a-z0-9_]*$/.test(fn)) throw new Error('bad function name');
      const out = await asUser(uid, async tx => {
        const meta = (await tx.query(
          `SELECT p.proargnames names, (SELECT array_agg(t::regtype::text) FROM unnest(string_to_array(p.proargtypes::text, ' ')) t) types,
                  p.proretset retset, p.prorettype::regtype::text rettype
           FROM pg_proc p WHERE p.proname = $1 AND p.pronamespace = 'public'::regnamespace LIMIT 1`, [fn])).rows[0];
        if (!meta) { const e = new Error(`Could not find the function public.${fn}`); e.code = 'PGRST202'; throw e; }
        const args = [];
        for (const [k, v] of Object.entries(body || {})) {
          const i = (meta.names || []).indexOf(k);
          const type = i >= 0 ? meta.types[i] : '';
          let l;
          if (v === null || v === undefined) l = 'NULL';
          else if (/^jsonb?$/.test(type)) l = lit(JSON.stringify(v));
          else if (Array.isArray(v)) l = lit(pgArray(v));
          else if (typeof v === 'object') l = lit(JSON.stringify(v));
          else l = lit(v);
          args.push(`${ident(k)} := ${l}`);
        }
        const r = await tx.query(`SELECT * FROM public.${fn}(${args.join(', ')})`);
        if (meta.rettype === 'void') return { void: true };
        if (meta.retset) return { rows: r.rows.map(row => (Object.keys(row).length === 1 && fn in row ? row[fn] : row)) };
        return { value: r.rows[0] ? r.rows[0][fn] ?? r.rows[0] : null };
      });
      if (out.void) return send(res, 204);
      return send(res, 200, out.rows ?? out.value);
    }

    /* tables */
    const t = ident(table);
    const w = where(params);
    const selectCols = (params.get('select') || '*').split(',').map(c => c.trim()).filter(Boolean);
    const cols = selectCols.includes('*') ? '*' : selectCols.map(ident).join(', ');

    const result = await asUser(uid, async tx => {
      if (req.method === 'GET' || req.method === 'HEAD') {
        let total = null;
        if (/count=/.test(prefer)) total = Number((await tx.query(`SELECT count(*)::int n FROM public.${t}${w}`)).rows[0].n);
        if (req.method === 'HEAD') return { status: 200, headers: { 'content-range': `*/${total ?? '*'}` } };
        const lim = params.get('limit') ? ` LIMIT ${Number(params.get('limit'))}` : '';
        const off = params.get('offset') ? ` OFFSET ${Number(params.get('offset'))}` : '';
        const rows = (await tx.query(`SELECT ${cols} FROM public.${t}${w}${orderBy(params)}${lim}${off}`)).rows;
        return { status: 200, rows, headers: total !== null ? { 'content-range': rows.length ? `0-${rows.length - 1}/${total}` : `*/${total}` } : {} };
      }
      if (req.method === 'POST') {
        const list = Array.isArray(body) ? body : [body];
        const keys = [...new Set(list.flatMap(o => Object.keys(o)))];
        const vals = list.map(o => `(${keys.map(k => (k in o ? valueLit(o[k]) : 'DEFAULT')).join(', ')})`).join(', ');
        const conflict = /resolution=merge-duplicates/.test(prefer) && params.get('on_conflict')
          ? ` ON CONFLICT (${params.get('on_conflict').split(',').map(ident).join(',')}) DO UPDATE SET ${keys.map(k => `${ident(k)} = EXCLUDED.${ident(k)}`).join(', ')}`
          : /resolution=ignore-duplicates/.test(prefer) ? ' ON CONFLICT DO NOTHING' : '';
        const rows = (await tx.query(`INSERT INTO public.${t} (${keys.map(ident).join(', ')}) VALUES ${vals}${conflict} RETURNING *`)).rows;
        return { status: 201, rows, minimal: !/return=representation/.test(prefer) };
      }
      if (req.method === 'PATCH') {
        const sets = Object.entries(body).map(([k, v]) => `${ident(k)} = ${valueLit(v)}`).join(', ');
        const rows = (await tx.query(`UPDATE public.${t} SET ${sets}${w} RETURNING *`)).rows;
        return { status: 200, rows, minimal: !/return=representation/.test(prefer) };
      }
      if (req.method === 'DELETE') {
        const rows = (await tx.query(`DELETE FROM public.${t}${w} RETURNING *`)).rows;
        return { status: 200, rows, minimal: !/return=representation/.test(prefer) };
      }
      throw new Error('unsupported method ' + req.method);
    });

    if (result.headers && req.method === 'HEAD') return send(res, 200, undefined, result.headers);
    if (result.minimal) return send(res, result.status === 201 ? 201 : 204);
    let rows = result.rows;
    if (wantObject) {
      if (rows.length !== 1) return send(res, 406, { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned', details: `The result contains ${rows.length} rows`, hint: null });
      return send(res, result.status, rows[0], result.headers);
    }
    return send(res, result.status, rows, result.headers);
  } catch (e) {
    return send(res, e.code === 'PGRST202' ? 404 : sqlStatus(e.code), pgErr(e));
  }
}

const server = http.createServer((req, res) => serial(async () => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  if (req.method === 'OPTIONS') return send(res, 204);
  const t0 = Date.now();
  try {
    /* test hooks */
    if (url.pathname === '/__sql' && req.method === 'POST') {
      const { sql, params } = await readBody(req);
      const r = await db.query(sql, params || []);
      return send(res, 200, r.rows);
    }
    if (url.pathname === '/__401') { fail401 = url.searchParams.get('on') === '1'; return send(res, 200, { fail401 }); }
    if (url.pathname === '/__revoke') { revoked = url.searchParams.get('on') === '1'; return send(res, 200, { revoked }); }
    if (url.pathname === '/__refreshes') return send(res, 200, { refreshes });
    if (url.pathname === '/__fail') { failRest = url.searchParams.get('on') === '1'; return send(res, 200, { failRest }); }
    if (url.pathname === '/__latency') { latency = Number(url.searchParams.get('ms') || 0); return send(res, 200, { latency }); }
    if (url.pathname === '/__log') return send(res, 200, log.slice(-80));
    if (url.pathname === '/__open_zone') {
      const zones = (await db.query(`SELECT name FROM pg_timezone_names WHERE name ~ '^(America|Pacific|Atlantic)/' ORDER BY name`)).rows.map(r => r.name);
      for (const z of zones) if ((await db.query(`SELECT public.dialer_in_window($1) w`, [z])).rows[0].w) return send(res, 200, { zone: z });
      return send(res, 200, { zone: null });
    }

    /* auth */
    if (url.pathname === '/auth/v1/token' && req.method === 'POST') {
      const b = await readBody(req);
      const grant = url.searchParams.get('grant_type');
      if (grant === 'password') {
        const uid = USERS[(b.email || '').toLowerCase()];
        if (!uid) return send(res, 400, { error: 'invalid_grant', error_description: 'Invalid login credentials', code: 'invalid_credentials', message: 'Invalid login credentials' });
        return send(res, 200, session(uid));
      }
      if (grant === 'refresh_token') {
        refreshes++;
        if (revoked) return send(res, 400, { error: 'invalid_grant', error_description: 'Invalid Refresh Token: Refresh Token Not Found', code: 'refresh_token_not_found', message: 'Invalid Refresh Token: Refresh Token Not Found' });
        fail401 = false;   // a refreshed token works again
        const uid = String(b.refresh_token || '').replace('rt:', '');
        return EMAIL_OF[uid] ? send(res, 200, session(uid)) : send(res, 400, { error: 'invalid_grant', message: 'Invalid Refresh Token' });
      }
    }
    if (url.pathname === '/auth/v1/user') { const uid = uidFromAuth(req.headers.authorization); return uid && EMAIL_OF[uid] ? send(res, 200, userOf(uid)) : send(res, 401, { message: 'invalid JWT' }); }
    if (url.pathname === '/auth/v1/logout') return send(res, 204);
    if (url.pathname.startsWith('/auth/v1/')) return send(res, 200, {});

    /* rest */
    if (url.pathname.startsWith('/rest/v1/')) {
      if (latency) await new Promise(r => setTimeout(r, latency));
      if (fail401) return send(res, 401, { code: 'PGRST301', message: 'JWT expired' });
      if (failRest) return send(res, 503, { message: 'e2e: simulated outage' });
      const uid = uidFromAuth(req.headers.authorization);
      log.push(`${req.method} ${url.pathname}${url.search.slice(0, 90)}`);
      return await handleRest(req, res, url, uid);
    }
    return send(res, 404, { message: 'not found' });
  } catch (e) {
    return send(res, 500, { message: String(e.message || e) });
  } finally {
    void t0;
  }
}));
server.listen(PORT, () => console.log(`e2e shim ready on http://localhost:${PORT}`));
