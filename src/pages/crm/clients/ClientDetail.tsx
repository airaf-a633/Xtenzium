import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import { getUsdToPkrRate, DEFAULT_USD_TO_PKR, toPkr } from '../../../lib/settings';
import { formatMoney, formatCurrencySplit } from '../../../lib/money';
import type { Client, Project } from '../../../types/database';
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  Input,
  PageHeader,
  PROJECT_STATUS_LABEL,
  PROJECT_STATUS_TONE,
  SkeletonRows,
  Stat,
  Textarea,
  useToast,
} from '../../../components/crm/ui';

interface FormState {
  name: string;
  company: string;
  email: string;
  phone: string;
  notes: string;
}

const INITIAL: FormState = { name: '', company: '', email: '', phone: '', notes: '' };

const ClientDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const isNew = !id || id === 'new';

  const [form, setForm] = useState<FormState>(INITIAL);
  const [client, setClient] = useState<Client | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [rate, setRate] = useState(DEFAULT_USD_TO_PKR);

  useEffect(() => {
    let cancelled = false;
    getUsdToPkrRate().then(r => {
      if (!cancelled) setRate(r);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (isNew) return undefined;
    let cancelled = false;

    const fetchAll = () =>
      Promise.all([
        supabase.from('clients').select('*').eq('id', id).single(),
        supabase
          .from('projects')
          .select('*')
          .eq('client_id', id)
          .order('created_at', { ascending: false }),
      ]);

    fetchAll().then(([c, p]) => {
      if (cancelled) return;
      if (c.error) {
        setFailed(c.error.message);
      } else if (c.data) {
        const row = c.data as Client;
        setClient(row);
        setForm({
          name: row.name,
          company: row.company ?? '',
          email: row.email ?? '',
          phone: row.phone ?? '',
          notes: row.notes ?? '',
        });
      }
      setProjects((p.data ?? []) as Project[]);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [id, isNew]);

  const money = useMemo(() => {
    const byCurrency: Record<string, number> = {};
    let total = 0;
    let paid = 0;
    projects.forEach(p => {
      byCurrency[p.currency] = (byCurrency[p.currency] ?? 0) + Number(p.total_value);
      total += toPkr(Number(p.total_value), p.currency, rate);
      paid += toPkr(Number(p.amount_paid), p.currency, rate);
    });
    return { byCurrency, total, paid, outstanding: Math.max(0, total - paid) };
  }, [projects, rate]);

  const save = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      company: form.company.trim() || null,
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      notes: form.notes.trim() || null,
    };

    if (isNew) {
      const { data, error } = await supabase.from('clients').insert(payload).select().single();
      setSaving(false);
      if (error || !data) {
        toast('That client didn’t save.', 'danger');
        return;
      }
      toast('Client created', 'success');
      navigate(`/crm/clients/${(data as Client).id}`, { replace: true });
      return;
    }

    const { error } = await supabase.from('clients').update(payload).eq('id', id as string);
    setSaving(false);
    if (error) {
      toast('That didn’t save.', 'danger');
      return;
    }
    setClient(prev => (prev ? { ...prev, ...payload } : prev));
    toast('Client saved', 'success');
  };

  const remove = async () => {
    if (
      !confirm(
        'Delete this client, and every project, task and note attached to them? This cannot be undone.',
      )
    )
      return;
    setDeleting(true);
    const { error } = await supabase.from('clients').delete().eq('id', id as string);
    if (error) {
      setDeleting(false);
      toast('Couldn’t delete that client.', 'danger');
      return;
    }
    toast('Client deleted', 'info');
    navigate('/crm/clients');
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  if (loading) {
    return (
      <div className="max-w-[820px]">
        <PageHeader title="Client" back={{ to: '/crm/clients', label: 'Back to clients' }} />
        <SkeletonRows rows={6} />
      </div>
    );
  }

  if (!isNew && !client) {
    return (
      <div className="max-w-[820px]">
        <PageHeader title="Client" back={{ to: '/crm/clients', label: 'Back to clients' }} />
        <EmptyState
          title="That client doesn’t exist"
          body="It may have been deleted, or the link is wrong."
          action={
            <ButtonLink to="/crm/clients" size="sm">
              Back to clients
            </ButtonLink>
          }
        />
      </div>
    );
  }

  return (
    <div className="max-w-[820px]">
      <PageHeader
        title={isNew ? 'New client' : (client as Client).name}
        back={{ to: '/crm/clients', label: 'Back to clients' }}
        subtitle={
          isNew
            ? undefined
            : `${projects.length} ${projects.length === 1 ? 'project' : 'projects'}`
        }
        actions={
          <Button variant="primary" loading={saving} disabled={!form.name.trim()} onClick={save}>
            {isNew ? 'Create client' : 'Save changes'}
          </Button>
        }
      />

      {failed && <ErrorState title="That client couldn’t load" body={failed} />}

      <div className="flex flex-col gap-5">
        {!isNew && projects.length > 0 && (
          <section aria-label="Money" className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(180px,1fr))]">
            <Stat
              label="Lifetime value"
              value={formatMoney(money.total)}
              sub={formatCurrencySplit(money.byCurrency)}
              tone="copper"
            />
            <Stat label="Collected" value={formatMoney(money.paid)} tone="success" />
            <Stat
              label="Outstanding"
              value={formatMoney(money.outstanding)}
              sub={money.outstanding > 0 ? 'Delivered and unpaid' : 'Everything settled'}
              tone={money.outstanding > 0 ? 'warning' : 'success'}
            />
          </section>
        )}

        <Card>
          <CardHeader title="Details" />
          <div className="grid gap-4 p-4 sm:grid-cols-2">
            <Input
              label="Full name"
              required
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              placeholder="Jane Doe"
            />
            <Input
              label="Company"
              value={form.company}
              onChange={e => setForm({ ...form, company: e.target.value })}
              placeholder="Acme Inc."
            />
            <Input
              label="Email"
              type="email"
              value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
              placeholder="jane@acme.com"
            />
            <Input
              label="Phone"
              value={form.phone}
              onChange={e => setForm({ ...form, phone: e.target.value })}
              placeholder="+92 300 1234567"
            />
            <Textarea
              className="sm:col-span-2"
              label="Notes"
              rows={4}
              value={form.notes}
              onChange={e => setForm({ ...form, notes: e.target.value })}
              placeholder="Context, preferences, how they found you…"
            />
            {client?.lead_id && (
              <p className="m-0 text-[12.5px] text-crm-ink-3 sm:col-span-2">
                Came in as a lead —{' '}
                <Link to={`/admin/leads/${client.lead_id}`} className="text-crm-copper no-underline hover:underline">
                  view the original enquiry
                </Link>
              </p>
            )}
          </div>
        </Card>

        {!isNew && (
          <Card className="overflow-hidden">
            <CardHeader
              title="Projects"
              action={
                <ButtonLink to={`/crm/projects/new?client_id=${id}`} size="sm">
                  New project
                </ButtonLink>
              }
            />
            {projects.length === 0 ? (
              <EmptyState
                className="m-4 border-0"
                title="No projects yet"
                body="Add one directly, or win a deal for this client on the pipeline."
              />
            ) : (
              <ul className="m-0 list-none p-0">
                {projects.map(p => {
                  const due = Number(p.total_value) - Number(p.amount_paid);
                  return (
                    <li key={p.id} className="border-b border-crm-line last:border-b-0">
                      <Link
                        to={`/crm/projects/${p.id}`}
                        className="flex flex-wrap items-center gap-3 px-4 py-3 no-underline transition-colors duration-150 ease-crm hover:bg-crm-raised"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13.5px] font-medium text-crm-ink">
                            {p.name}
                          </span>
                          <span className="crm-num block text-[12px] text-crm-ink-3">
                            {formatDate(p.created_at)}
                          </span>
                        </span>
                        <Badge tone={PROJECT_STATUS_TONE[p.status] ?? 'neutral'} dot>
                          {PROJECT_STATUS_LABEL[p.status] ?? p.status}
                        </Badge>
                        <span className="crm-num shrink-0 text-right font-crm-mono text-[12.5px] text-crm-ink-2">
                          {formatMoney(Number(p.amount_paid), p.currency)}
                          <span className="text-crm-faint"> / {formatMoney(Number(p.total_value), p.currency)}</span>
                          {due > 0 && p.status !== 'cancelled' && (
                            <span className="mt-0.5 block text-[11px] text-crm-warning">
                              {formatMoney(due, p.currency)} owed
                            </span>
                          )}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        )}

        {!isNew && (
          <div className="border-t border-crm-line pt-4">
            <Button variant="danger" loading={deleting} onClick={remove}>
              Delete client
            </Button>
            <p className="m-0 mt-2 text-[12px] text-crm-ink-3">
              Removes their projects, tasks and notes too. There is no undo.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ClientDetail;
