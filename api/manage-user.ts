export const config = { runtime: 'edge' };

/**
 * Create and manage logins. Admin-only.
 *
 * Creating a Supabase auth user needs the service-role key, which must
 * never reach the browser — so the Team page calls this instead. It:
 *
 *   1. verifies the caller's JWT with Supabase (never trusts the body),
 *   2. checks that caller is an admin in public.profiles,
 *   3. only then uses the service-role key.
 *
 * Needs SUPABASE_SERVICE_ROLE_KEY in the Vercel project (gsc-sync
 * already uses the same one).
 *
 * POST { action: 'create', email, password, full_name, role }
 * POST { action: 'reset_password', user_id, password }
 * POST { action: 'set_disabled', user_id, disabled }   (flips profiles.active AND bans/unbans)
 */

declare const process: { env: Record<string, string | undefined> };

const SUPABASE_URL =
  process.env.PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const ANON_KEY =
  process.env.PUBLIC_SUPABASE_ANON_KEY ??
  process.env.SUPABASE_ANON_KEY ??
  process.env.VITE_SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });

const service = (path: string, init: RequestInit = {}) =>
  fetch(`${SUPABASE_URL}${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY as string,
      authorization: `Bearer ${SERVICE_KEY}`,
      'content-type': 'application/json',
      ...(init.headers as Record<string, string> | undefined),
    },
  });

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** The id of the signed-in caller, or null if the token isn't valid. */
async function callerId(token: string): Promise<string | null> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: ANON_KEY as string, authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const user = (await res.json()) as { id?: string };
  return user.id ?? null;
}

async function isAdmin(id: string): Promise<boolean> {
  const res = await service(`/rest/v1/profiles?id=eq.${encodeURIComponent(id)}&select=role`);
  if (!res.ok) return false;
  const rows = (await res.json()) as { role: string }[];
  return rows[0]?.role === 'admin';
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json(405, { error: 'POST only' });
  if (!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY) {
    return json(500, {
      error:
        'Server is missing SUPABASE_SERVICE_ROLE_KEY (or the Supabase URL/anon key). Add it in Vercel → Settings → Environment Variables and redeploy.',
    });
  }

  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  const me = token ? await callerId(token) : null;
  if (!me) return json(401, { error: 'Not signed in' });
  if (!(await isAdmin(me))) return json(403, { error: 'Admins only' });

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return json(400, { error: 'Bad JSON' });
  }

  const action = body.action;
  const password = typeof body.password === 'string' ? body.password : '';

  if (action === 'create') {
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const fullName = typeof body.full_name === 'string' ? body.full_name.trim() : '';
    const role = body.role === 'admin' ? 'admin' : 'caller';
    if (!EMAIL_RE.test(email)) return json(400, { error: 'Enter a valid email' });
    if (password.length < 10) return json(400, { error: 'Password needs at least 10 characters' });

    const created = await service('/auth/v1/admin/users', {
      method: 'POST',
      body: JSON.stringify({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName },
      }),
    });
    const createdBody = (await created.json()) as { id?: string; msg?: string; message?: string };
    if (!created.ok || !createdBody.id) {
      return json(created.status === 422 ? 409 : 400, {
        error: createdBody.msg ?? createdBody.message ?? 'Could not create the user',
      });
    }

    /* The auth.users trigger already made a 'caller' profile. Set the
       real role and name on it. Upsert so a trigger hiccup can't leave
       a user without a row. */
    const profile = await service('/rest/v1/profiles?on_conflict=id', {
      method: 'POST',
      headers: { prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({
        id: createdBody.id,
        email,
        full_name: fullName || email.split('@')[0],
        role,
      }),
    });
    if (!profile.ok) {
      return json(500, {
        error: 'User was created but the profile did not save. Set their role from the Team page.',
        user_id: createdBody.id,
      });
    }
    return json(200, { ok: true, user_id: createdBody.id });
  }

  const userId = typeof body.user_id === 'string' ? body.user_id : '';
  if (!/^[0-9a-f-]{36}$/i.test(userId)) return json(400, { error: 'Bad user_id' });

  if (action === 'reset_password') {
    if (password.length < 10) return json(400, { error: 'Password needs at least 10 characters' });
    const res = await service(`/auth/v1/admin/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify({ password }),
    });
    return res.ok ? json(200, { ok: true }) : json(400, { error: 'Could not reset the password' });
  }

  if (action === 'set_disabled') {
    if (userId === me) return json(400, { error: 'You cannot disable your own login' });
    /* Two layers. profiles.active is the one that matters: the database
       stops honouring the role on the very next request. The auth ban
       additionally stops new sign-ins and token refreshes (GoTrue's
       model of "disabled" is a very long ban, or 'none' to lift it). */
    const off = Boolean(body.disabled);
    const flag = await service(`/rest/v1/profiles?id=eq.${userId}`, {
      method: 'PATCH',
      headers: { prefer: 'return=minimal' },
      body: JSON.stringify({ active: !off }),
    });
    if (!flag.ok) {
      /* The last-admin guard raises here; surface it rather than a vague failure. */
      const detail = (await flag.json().catch(() => ({}))) as { message?: string };
      return json(400, { error: detail.message ?? 'Could not update the login' });
    }
    const ban = await service(`/auth/v1/admin/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify({ ban_duration: off ? '876000h' : 'none' }),
    });
    return ban.ok ? json(200, { ok: true }) : json(400, { error: 'Access was changed but the sign-in ban failed' });
  }

  return json(400, { error: 'Unknown action' });
}
