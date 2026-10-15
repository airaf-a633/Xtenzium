import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';
import type { Profile, UserRole } from '../../../types/database';
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardHeader,
  ErrorState,
  Input,
  Select,
  SkeletonRows,
  useToast,
} from '../../../components/crm/ui';

const ROLE_OPTIONS = [
  { value: 'caller', label: 'Caller (sales rep)' },
  { value: 'admin', label: 'Admin (full access)' },
];

/* Creating and resetting logins needs the service-role key, so it goes
   through api/manage-user — which re-checks that we're an admin. */
async function callApi(body: Record<string, unknown>): Promise<{ error: string | null }> {
  const { data } = await supabase.auth.getSession();
  try {
    const res = await fetch('/api/manage-user', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${data.session?.access_token ?? ''}`,
      },
      body: JSON.stringify(body),
    });
    const out = (await res.json().catch(() => ({}))) as { error?: string };
    return { error: res.ok ? null : (out.error ?? `Request failed (${res.status})`) };
  } catch {
    return { error: 'Couldn’t reach the server.' };
  }
}

const Logins = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<UserRole>('caller');
  const [password, setPassword] = useState('');
  const [creating, setCreating] = useState(false);

  const fetchProfiles = () => supabase.from('profiles').select('*').order('role').order('email');

  const apply = useCallback(({ data, error }: Awaited<ReturnType<typeof fetchProfiles>>) => {
    if (error) setFailed(error.message);
    else setProfiles((data ?? []) as Profile[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchProfiles().then(res => {
      if (!cancelled) apply(res);
    });
    return () => {
      cancelled = true;
    };
  }, [apply]);

  const create = async () => {
    setCreating(true);
    const { error } = await callApi({ action: 'create', email, password, full_name: fullName, role });
    setCreating(false);
    if (error) {
      toast(error, 'danger');
      return;
    }
    toast(`Login created for ${email}`, 'success');
    setEmail('');
    setFullName('');
    setPassword('');
    setRole('caller');
    fetchProfiles().then(apply);
  };

  const patch = async (p: Profile, change: Partial<Pick<Profile, 'role' | 'daily_dial_target'>>) => {
    setBusy(p.id);
    const { error } = await supabase.from('profiles').update(change).eq('id', p.id);
    setBusy(null);
    if (error) {
      toast(error.message.includes('last admin') ? 'You can’t demote the last admin.' : 'That didn’t save.', 'danger');
      return;
    }
    setProfiles(list => list.map(x => (x.id === p.id ? { ...x, ...change } : x)));
  };

  const resetPassword = async (p: Profile) => {
    const next = prompt(`New password for ${p.email} (10+ characters):`);
    if (!next) return;
    setBusy(p.id);
    const { error } = await callApi({ action: 'reset_password', user_id: p.id, password: next });
    setBusy(null);
    toast(error ?? 'Password reset', error ? 'danger' : 'success');
  };

  const setDisabled = async (p: Profile, disabled: boolean) => {
    if (disabled && !confirm(`Disable ${p.email}? They’ll be locked out immediately.`)) return;
    setBusy(p.id);
    const { error } = await callApi({ action: 'set_disabled', user_id: p.id, disabled });
    setBusy(null);
    if (error) {
      toast(error, 'danger');
      return;
    }
    setProfiles(list => list.map(x => (x.id === p.id ? { ...x, active: !disabled } : x)));
  };

  return (
    <Card>
      <CardHeader title="Logins & access" />
      <div className="p-4">
        <p className="m-0 mb-4 text-[12.5px] text-crm-ink-3">
          Admins see the whole CRM. Callers only see the dialer — enforced in the database, not just
          hidden in the menu.
        </p>

        <div className="mb-5 flex flex-wrap items-end gap-2">
          <Input className="min-w-[160px] flex-1" label="Name" value={fullName} onChange={e => setFullName(e.target.value)} />
          <Input className="min-w-[200px] flex-1" label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} />
          <Input
            className="min-w-[160px] flex-1"
            label="Temporary password"
            type="password"
            autoComplete="new-password"
            hint="10+ characters. They can change it after signing in."
            value={password}
            onChange={e => setPassword(e.target.value)}
          />
          <Select
            className="w-[190px]"
            label="Role"
            options={ROLE_OPTIONS}
            value={role}
            onChange={e => setRole(e.target.value as UserRole)}
          />
          <Button
            variant="primary"
            loading={creating}
            disabled={!email.trim() || password.length < 10}
            onClick={create}
          >
            Create login
          </Button>
        </div>

        {failed && <ErrorState title="Logins couldn’t load" body={failed} />}
        {loading ? (
          <SkeletonRows rows={3} />
        ) : (
          <ul className="m-0 list-none p-0">
            {profiles.map(p => {
              const isMe = p.id === user?.id;
              return (
                <li key={p.id} className="flex flex-wrap items-center gap-3 border-b border-crm-line py-2.5 last:border-b-0">
                  <Avatar name={p.full_name ?? p.email ?? '?'} size="md" />
                  <div className="min-w-0 flex-1">
                    <p className="m-0 truncate text-[13.5px] text-crm-ink">{p.full_name ?? p.email}</p>
                    <p className="m-0 mt-0.5 truncate text-[12px] text-crm-ink-3">{p.email}</p>
                  </div>
                  {isMe && <Badge tone="copper" dot>You</Badge>}
                  {!p.active && <Badge tone="danger" dot>Disabled</Badge>}
                  <Select
                    className="w-[170px]"
                    label="Role"
                    options={ROLE_OPTIONS}
                    value={p.role}
                    disabled={busy === p.id || isMe}
                    onChange={e => patch(p, { role: e.target.value as UserRole })}
                  />
                  {p.role === 'caller' && (
                    <Input
                      className="w-[110px]"
                      label="Daily dials"
                      type="number"
                      min={1}
                      max={1000}
                      defaultValue={p.daily_dial_target}
                      onBlur={e => {
                        const n = Math.round(Number(e.target.value));
                        if (n >= 1 && n <= 1000 && n !== p.daily_dial_target) void patch(p, { daily_dial_target: n });
                      }}
                    />
                  )}
                  {!isMe && (
                    <>
                      <Button size="sm" disabled={busy === p.id} onClick={() => resetPassword(p)}>
                        Reset password
                      </Button>
                      <Button size="sm" disabled={busy === p.id} onClick={() => setDisabled(p, p.active)}>
                        {p.active ? 'Disable' : 'Enable'}
                      </Button>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Card>
  );
};

export default Logins;
