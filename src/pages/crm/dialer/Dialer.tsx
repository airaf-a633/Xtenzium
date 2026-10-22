import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';
import type { CallLeadStatus, CallList } from '../../../types/database';
import RetierTool from './RetierTool';
import {
  Button, ButtonLink, Card, CardHeader, EmptyState, ErrorState, Input, PageHeader,
  Stat, TableShell, Td, Th, Tr, useToast,
} from '../../../components/crm/ui';

/* The call screen itself arrives in the next phase. For now this page
   is home base: how much is loaded, the lists that got it there, and
   the way in for a new CSV. */

const ChangePassword = () => {
  const { toast } = useToast();
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (password.length < 10) {
      toast('Use at least 10 characters.', 'danger');
      return;
    }
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (error) {
      toast(error.message, 'danger');
      return;
    }
    setPassword('');
    toast('Password changed', 'success');
  };

  return (
    <Card>
      <CardHeader title="Change password" />
      <div className="flex flex-wrap items-end gap-2 p-4">
        <Input
          className="w-[260px]"
          label="New password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && save()}
        />
        <Button variant="primary" loading={saving} disabled={!password} onClick={save}>
          Save
        </Button>
      </div>
    </Card>
  );
};

interface Totals {
  all: number;
  ready: number;
  noPhone: number;
}

const Dialer = () => {
  const { profile, role } = useAuth();
  const { toast } = useToast();

  const [lists, setLists] = useState<CallList[]>([]);
  const [totals, setTotals] = useState<Totals>({ all: 0, ready: 0, noPhone: 0 });
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const count = (status?: CallLeadStatus) => {
      const q = supabase.from('call_leads').select('id', { count: 'exact', head: true });
      if (!status) return q;
      // Parked (tier D) leads are kept but never dialled, so they aren't "ready".
      return status === 'new' ? q.eq('status', status).or('tier.is.null,tier.neq.D') : q.eq('status', status);
    };
    Promise.all([
      supabase.from('call_lists').select('*').order('created_at', { ascending: false }),
      count(),
      count('new'),
      count('no_phone'),
    ]).then(([l, all, ready, noPhone]) => {
      if (cancelled) return;
      if (l.error) setFailed(l.error.message);
      else setLists((l.data ?? []) as CallList[]);
      setTotals({ all: all.count ?? 0, ready: ready.count ?? 0, noPhone: noPhone.count ?? 0 });
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const removeList = async (list: CallList) => {
    if (!confirm(`Delete “${list.name}” and its ${list.row_count.toLocaleString()} leads, including their call history?`)) return;
    const { error } = await supabase.from('call_lists').delete().eq('id', list.id);
    if (error) {
      toast('Couldn’t delete that list.', 'danger');
      return;
    }
    setLists(prev => prev.filter(x => x.id !== list.id));
    setTotals(t => ({ ...t, all: Math.max(0, t.all - list.row_count) }));
    toast('List deleted', 'info');
  };

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Dialer"
        subtitle={`Daily target: ${profile?.daily_dial_target ?? 80} dials`}
        actions={
          <>
            <ButtonLink to="/crm/dialer/import">Import leads</ButtonLink>
            <ButtonLink to="/crm/dialer/call" variant="primary">Start calling</ButtonLink>
          </>
        }
      />

      {failed && <ErrorState title="The dialer couldn’t load" body={failed} />}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat label="Total leads" value={totals.all.toLocaleString()} />
        <Stat label="Ready to call" value={totals.ready.toLocaleString()} tone="success" />
        <Stat label="No phone" value={totals.noPhone.toLocaleString()} sub="worked by email → Email outreach" />
      </div>

      <div className="flex flex-wrap gap-2">
        <ButtonLink to="/crm/dialer/board">Board</ButtonLink>
        <ButtonLink to="/crm/dialer/outreach">Email outreach</ButtonLink>
        {role === 'admin' && (
          <>
            <ButtonLink to="/crm/inbox">Inbox</ButtonLink>
            <ButtonLink to="/crm/calls/feed">Live feed</ButtonLink>
            <ButtonLink to="/crm/calls/summary">Daily summary</ButtonLink>
            <ButtonLink to="/crm/calls/reports">Reports</ButtonLink>
            <ButtonLink to="/crm/calls/settings">Settings</ButtonLink>
          </>
        )}
      </div>

      <Card>
        <CardHeader title="Lists" />
        <div className="p-4">
          {loading ? null : lists.length === 0 ? (
            <EmptyState
              className="border-0"
              title="No leads yet"
              body="Import a CSV to load your first call list."
              action={<ButtonLink to="/crm/dialer/import" variant="primary">Import leads</ButtonLink>}
            />
          ) : (
            <TableShell>
              <thead>
                <tr>
                  <Th>List</Th>
                  <Th align="right">Imported</Th>
                  <Th align="right">Skipped</Th>
                  <Th>Uploaded</Th>
                  {role === 'admin' && <Th />}
                </tr>
              </thead>
              <tbody>
                {lists.map(l => (
                  <Tr key={l.id}>
                    <Td className="font-medium text-crm-ink">{l.name}</Td>
                    <Td align="right">{l.row_count.toLocaleString()}</Td>
                    <Td align="right">{l.skipped_count.toLocaleString()}</Td>
                    <Td>{new Date(l.created_at).toLocaleDateString()}</Td>
                    {role === 'admin' && (
                      <Td align="right">
                        <Button size="sm" onClick={() => removeList(l)}>Delete</Button>
                      </Td>
                    )}
                  </Tr>
                ))}
              </tbody>
            </TableShell>
          )}
        </div>
      </Card>

      {role === 'admin' && <RetierTool lists={lists} />}

      <ChangePassword />
    </div>
  );
};

export default Dialer;
