import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';
import { getUsdToPkrRate, DEFAULT_USD_TO_PKR, toPkr } from '../../../lib/settings';
import { formatMoney } from '../../../lib/money';
import { spawnNextRecurrence } from '../../../lib/recurrence';
import { parseDateOnly } from '../../../lib/date';
import { PRIORITY_LABEL, PRIORITY_TONE } from '../../../lib/tasks';
import TaskForm, { type TaskFormValues } from '../../../components/crm/TaskForm';
import type {
  Activity,
  ActivityType,
  Client,
  Project,
  ProjectStatus,
  Task,
  TeamMember,
} from '../../../types/database';
import {
  Avatar,
  Badge,
  Button,
  ButtonLink,
  Card,
  CardHeader,
  Dialog,
  Dot,
  EmptyState,
  ErrorState,
  Input,
  Label,
  PageHeader,
  PROJECT_STATUS_LABEL,
  PROJECT_STATUS_TONE,
  Select,
  SkeletonRows,
  Stat,
  Textarea,
  useToast,
} from '../../../components/crm/ui';
import { cn } from '../../../lib/utils';

const CURRENCIES = [
  { value: 'PKR', label: 'PKR' },
  { value: 'USD', label: 'USD' },
];

const STATUSES: ProjectStatus[] = ['proposal', 'active', 'on_hold', 'completed', 'cancelled'];

const ACTIVITY_TYPES = [
  { value: 'note', label: 'Note' },
  { value: 'call', label: 'Call' },
  { value: 'meeting', label: 'Meeting' },
  { value: 'email', label: 'Email' },
];

interface FormState {
  client_id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  total_value: string;
  amount_paid: string;
  currency: string;
  start_date: string;
  end_date: string;
}

const INITIAL: FormState = {
  client_id: '',
  name: '',
  description: '',
  status: 'proposal',
  total_value: '0',
  amount_paid: '0',
  currency: 'PKR',
  start_date: '',
  end_date: '',
};

const formatDate = (iso: string | null) =>
  iso ? parseDateOnly(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—';

const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

const ProjectDetail = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const isNew = !id || id === 'new';

  const [form, setForm] = useState<FormState>({
    ...INITIAL,
    client_id: searchParams.get('client_id') ?? '',
  });
  const [project, setProject] = useState<Project | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [rate, setRate] = useState(DEFAULT_USD_TO_PKR);

  const [noteText, setNoteText] = useState('');
  const [noteType, setNoteType] = useState<ActivityType>('note');

  const [payingOpen, setPayingOpen] = useState(false);
  const [payment, setPayment] = useState('');
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      supabase.from('clients').select('*').order('name'),
      supabase.from('team_members').select('*').order('name'),
      getUsdToPkrRate(),
    ]).then(([c, m, usdRate]) => {
      if (cancelled) return;
      setClients((c.data ?? []) as Client[]);
      setMembers((m.data ?? []) as TeamMember[]);
      setRate(usdRate);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (isNew) return undefined;
    let cancelled = false;

    Promise.all([
      supabase.from('projects').select('*').eq('id', id).single(),
      supabase
        .from('activities')
        .select('*')
        .eq('project_id', id)
        .order('created_at', { ascending: false }),
      supabase.from('tasks').select('*').eq('project_id', id).order('due_date'),
    ]).then(([p, a, t]) => {
      if (cancelled) return;
      if (p.error) {
        setFailed(p.error.message);
      } else if (p.data) {
        const row = p.data as Project;
        setProject(row);
        setForm({
          client_id: row.client_id,
          name: row.name,
          description: row.description ?? '',
          status: row.status,
          total_value: String(row.total_value),
          amount_paid: String(row.amount_paid),
          currency: row.currency,
          start_date: row.start_date ?? '',
          end_date: row.end_date ?? '',
        });
      }
      setActivities((a.data ?? []) as Activity[]);
      setTasks((t.data ?? []) as Task[]);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [id, isNew]);

  const refreshActivities = async (projectId: string) => {
    const { data } = await supabase
      .from('activities')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });
    setActivities((data ?? []) as Activity[]);
  };

  const payload = () => ({
    client_id: form.client_id,
    name: form.name.trim(),
    description: form.description.trim() || null,
    status: form.status,
    total_value: Number(form.total_value) || 0,
    amount_paid: Math.min(Number(form.amount_paid) || 0, Number(form.total_value) || 0),
    currency: form.currency.trim() || 'PKR',
    start_date: form.start_date || null,
    end_date: form.end_date || null,
  });

  const save = async () => {
    if (!form.name.trim() || !form.client_id) return;
    setSaving(true);
    const body = payload();

    if (isNew) {
      const { data, error } = await supabase.from('projects').insert(body).select().single();
      setSaving(false);
      if (error || !data) {
        toast('That project didn’t save.', 'danger');
        return;
      }
      toast('Project created', 'success');
      navigate(`/crm/projects/${(data as Project).id}`, { replace: true });
      return;
    }

    const { error } = await supabase.from('projects').update(body).eq('id', id as string);
    setSaving(false);
    if (error) {
      toast('That didn’t save.', 'danger');
      return;
    }
    setProject(prev => (prev ? { ...prev, ...body } : prev));
    toast('Project saved', 'success');
  };

  /* A dialog rather than window.prompt — the native one can't validate,
     can't say what's left, and looks like a browser bug in an app. */
  const logPayment = async () => {
    if (!project) return;
    const amount = Number(payment);
    const remaining = Number(project.total_value) - Number(project.amount_paid);

    if (!Number.isFinite(amount) || amount <= 0) {
      setPaymentError('Enter an amount greater than zero.');
      return;
    }
    if (amount > remaining) {
      setPaymentError(`That's more than the ${formatMoney(remaining, project.currency)} still owed.`);
      return;
    }

    setPaying(true);
    const newPaid = Math.min(Number(project.amount_paid) + amount, Number(project.total_value));
    const { error } = await supabase
      .from('projects')
      .update({ amount_paid: newPaid })
      .eq('id', project.id);
    setPaying(false);

    if (error) {
      setPaymentError('That payment didn’t save.');
      return;
    }

    setProject(prev => (prev ? { ...prev, amount_paid: newPaid } : prev));
    setForm(prev => ({ ...prev, amount_paid: String(newPaid) }));
    await supabase.from('activities').insert({
      project_id: project.id,
      type: 'note',
      content: `Payment logged: ${formatMoney(amount, project.currency)}`,
      created_by: user?.email ?? null,
    });
    await refreshActivities(project.id);
    setPayingOpen(false);
    setPayment('');
    setPaymentError(null);
    toast('Payment logged', 'success');
  };

  const changeStatus = async (status: ProjectStatus) => {
    const previous = form.status;
    setForm(prev => ({ ...prev, status }));
    if (isNew || !project) return;

    const { error } = await supabase.from('projects').update({ status }).eq('id', project.id);
    if (error) {
      setForm(prev => ({ ...prev, status: previous }));
      toast('That status didn’t stick.', 'danger');
      return;
    }
    setProject(prev => (prev ? { ...prev, status } : prev));
    await supabase.from('activities').insert({
      project_id: project.id,
      type: 'status_change',
      content: `Status changed to "${PROJECT_STATUS_LABEL[status] ?? status}"`,
      created_by: user?.email ?? null,
    });
    await refreshActivities(project.id);
  };

  const addNote = async () => {
    if (!noteText.trim() || !project) return;
    const { data, error } = await supabase
      .from('activities')
      .insert({
        project_id: project.id,
        type: noteType,
        content: noteText.trim(),
        created_by: user?.email ?? null,
      })
      .select()
      .single();
    if (error || !data) {
      toast('That note didn’t post.', 'danger');
      return;
    }
    setActivities(prev => [data as Activity, ...prev]);
    setNoteText('');
  };

  const byDue = (a: Task, b: Task) => (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999');

  const addTask = async (values: TaskFormValues) => {
    if (!project) return;
    const { data, error } = await supabase
      .from('tasks')
      .insert({
        project_id: project.id,
        title: values.title,
        due_date: values.due_date,
        status: 'pending',
        assigned_to: values.assigned_to,
        recurrence_days: values.recurrence_days,
        priority: values.priority,
      })
      .select()
      .single();
    if (error || !data) {
      toast('That task didn’t save.', 'danger');
      return;
    }
    setTasks(prev => [...prev, data as Task].sort(byDue));
  };

  const toggleTask = async (task: Task) => {
    const next = task.status === 'done' ? 'pending' : 'done';
    setTasks(prev => prev.map(t => (t.id === task.id ? { ...t, status: next } : t)));
    const { error } = await supabase.from('tasks').update({ status: next }).eq('id', task.id);
    if (error) {
      setTasks(prev => prev.map(t => (t.id === task.id ? { ...t, status: task.status } : t)));
      toast('That didn’t stick.', 'danger');
      return;
    }
    if (next === 'done') {
      const spawned = await spawnNextRecurrence(task);
      if (spawned) setTasks(prev => [...prev, spawned].sort(byDue));
    }
  };

  const remove = async () => {
    if (!confirm('Delete this project and every task and note on it? This cannot be undone.')) return;
    setDeleting(true);
    const { error } = await supabase.from('projects').delete().eq('id', id as string);
    if (error) {
      setDeleting(false);
      toast('Couldn’t delete that project.', 'danger');
      return;
    }
    toast('Project deleted', 'info');
    navigate(form.client_id ? `/crm/clients/${form.client_id}` : '/crm/projects');
  };

  const totalValue = Number(form.total_value) || 0;
  const amountPaid = Number(form.amount_paid) || 0;
  const remaining = Math.max(totalValue - amountPaid, 0);
  const pct = totalValue > 0 ? Math.min((amountPaid / totalValue) * 100, 100) : 0;
  const openTasks = tasks.filter(t => t.status !== 'done').length;

  const membersById = useMemo(
    () => Object.fromEntries(members.map(m => [m.id, m])),
    [members],
  );

  if (loading) {
    return (
      <div className="max-w-[880px]">
        <PageHeader title="Project" back={{ to: '/crm/projects', label: 'Back to projects' }} />
        <SkeletonRows rows={7} />
      </div>
    );
  }

  if (!isNew && !project) {
    return (
      <div className="max-w-[880px]">
        <PageHeader title="Project" back={{ to: '/crm/projects', label: 'Back to projects' }} />
        <EmptyState
          title="That project doesn’t exist"
          body="It may have been deleted, or the link is wrong."
          action={
            <ButtonLink to="/crm/projects" size="sm">
              Back to projects
            </ButtonLink>
          }
        />
      </div>
    );
  }

  return (
    <div className="max-w-[880px]">
      <PageHeader
        title={isNew ? 'New project' : (project as Project).name}
        back={{ to: '/crm/projects', label: 'Back to projects' }}
        subtitle={
          isNew
            ? undefined
            : `${clients.find(c => c.id === form.client_id)?.name ?? 'Unknown client'}${openTasks > 0 ? ` · ${openTasks} open ${openTasks === 1 ? 'task' : 'tasks'}` : ''}`
        }
        actions={
          <Button
            variant="primary"
            loading={saving}
            disabled={!form.name.trim() || !form.client_id}
            onClick={save}
          >
            {isNew ? 'Create project' : 'Save changes'}
          </Button>
        }
      />

      {failed && <ErrorState title="That project couldn’t load" body={failed} />}

      <div className="flex flex-col gap-5">
        {!isNew && (
          <section aria-label="Money" className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(180px,1fr))]">
            <Stat
              label="Value"
              value={formatMoney(toPkr(totalValue, form.currency, rate))}
              sub={form.currency !== 'PKR' ? `${form.currency} ${totalValue.toLocaleString('en-US')}` : undefined}
              tone="copper"
            />
            <Stat
              label="Collected"
              value={formatMoney(toPkr(amountPaid, form.currency, rate))}
              sub={`${Math.round(pct)}% of the total`}
              tone="success"
            />
            <Stat
              label="Outstanding"
              value={formatMoney(toPkr(remaining, form.currency, rate))}
              sub={remaining > 0 ? 'Still owed' : 'Settled'}
              tone={remaining > 0 ? 'warning' : 'success'}
            />
          </section>
        )}

        <Card>
          <CardHeader title="Details" />
          <div className="grid gap-4 p-4 sm:grid-cols-2">
            <Select
              label="Client"
              required
              value={form.client_id}
              onChange={e => setForm({ ...form, client_id: e.target.value })}
              disabled={!isNew}
              placeholder="Select a client…"
              options={clients.map(c => ({
                value: c.id,
                label: c.company ? `${c.name} · ${c.company}` : c.name,
              }))}
              hint={!isNew ? 'A project can’t change hands after it’s created.' : undefined}
            />
            <Input
              label="Project name"
              required
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              placeholder="Website redesign"
            />
            <Input
              label="Start date"
              type="date"
              value={form.start_date}
              onChange={e => setForm({ ...form, start_date: e.target.value })}
            />
            <Input
              label="End date"
              type="date"
              value={form.end_date}
              onChange={e => setForm({ ...form, end_date: e.target.value })}
              hint="Receivables age from this date"
            />
            <Textarea
              className="sm:col-span-2"
              label="Description"
              rows={3}
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              placeholder="Scope, deliverables, anything worth remembering."
            />
            {clients.length === 0 && (
              <p className="m-0 text-[12.5px] text-crm-warning sm:col-span-2">
                No clients yet —{' '}
                <Link to="/crm/clients/new" className="text-crm-warning underline">
                  add one first
                </Link>
                .
              </p>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Money"
            action={
              !isNew ? (
                <Button size="sm" onClick={() => setPayingOpen(true)}>
                  Log payment
                </Button>
              ) : undefined
            }
          />
          <div className="p-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <Input
                label="Total value"
                type="number"
                min={0}
                value={form.total_value}
                onChange={e => setForm({ ...form, total_value: e.target.value })}
              />
              <Input
                label="Amount paid"
                type="number"
                min={0}
                value={form.amount_paid}
                onChange={e => setForm({ ...form, amount_paid: e.target.value })}
              />
              <Select
                label="Currency"
                value={form.currency}
                onChange={e => setForm({ ...form, currency: e.target.value })}
                options={CURRENCIES}
              />
            </div>

            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-crm-raised">
              <div
                className={cn(
                  'h-full rounded-full transition-[width] duration-500 ease-crm',
                  pct >= 100 ? 'bg-crm-success' : 'bg-crm-copper',
                )}
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="crm-num mt-2 flex justify-between font-crm-mono text-[11.5px]">
              <span className="text-crm-ink-2">
                {formatMoney(toPkr(amountPaid, form.currency, rate))} paid
              </span>
              <span className={remaining > 0 ? 'text-crm-warning' : 'text-crm-faint'}>
                {formatMoney(toPkr(remaining, form.currency, rate))} remaining
              </span>
            </div>
            {form.currency !== 'PKR' && (
              <p className="crm-num m-0 mt-1 text-right font-crm-mono text-[10.5px] text-crm-faint">
                originally {form.currency} {remaining.toLocaleString('en-US')} · at USD 1 = PKR {rate}
              </p>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Status" />
          <div className="flex flex-wrap gap-2 p-4">
            {STATUSES.map(status => {
              const active = form.status === status;
              return (
                <button
                  key={status}
                  type="button"
                  onClick={() => changeStatus(status)}
                  className={cn(
                    'inline-flex cursor-pointer items-center gap-2 rounded-crm-md border px-3 py-2 text-[13px]',
                    'transition-colors duration-150 ease-crm',
                    active
                      ? 'border-crm-copper-line bg-crm-copper-quiet font-medium text-crm-copper'
                      : 'border-crm-line text-crm-ink-2 hover:border-crm-line-hi hover:text-crm-ink',
                  )}
                >
                  <Dot tone={PROJECT_STATUS_TONE[status] ?? 'neutral'} />
                  {PROJECT_STATUS_LABEL[status]}
                </button>
              );
            })}
          </div>
        </Card>

        {!isNew && (
          <>
            <Card>
              <CardHeader
                title="Tasks"
                action={
                  tasks.length > 0 ? (
                    <span className="crm-num font-crm-mono text-[11px] text-crm-faint">
                      {tasks.length - openTasks}/{tasks.length} done
                    </span>
                  ) : undefined
                }
              />
              <div className="p-4">
                {tasks.length > 0 && (
                  <ul className="m-0 mb-4 list-none p-0">
                    {tasks.map(t => {
                      const assignee = t.assigned_to ? membersById[t.assigned_to] : null;
                      const done = t.status === 'done';
                      return (
                        <li
                          key={t.id}
                          className="flex items-center gap-2.5 border-b border-crm-line py-2 last:border-b-0"
                        >
                          <input
                            type="checkbox"
                            checked={done}
                            onChange={() => toggleTask(t)}
                            aria-label={`Mark ${t.title} done`}
                            className="h-3.5 w-3.5 cursor-pointer accent-crm-copper"
                          />
                          <span
                            className={cn(
                              'min-w-0 flex-1 truncate text-[13px]',
                              done ? 'text-crm-faint line-through' : 'text-crm-ink',
                            )}
                          >
                            {t.title}
                            {t.recurrence_days && (
                              <span
                                className="ml-1.5 text-crm-faint"
                                title={`Repeats every ${t.recurrence_days} days`}
                              >
                                ↻
                              </span>
                            )}
                          </span>
                          {!done && t.priority <= 2 && (
                            <Badge tone={PRIORITY_TONE[t.priority]}>
                              {PRIORITY_LABEL[t.priority]}
                            </Badge>
                          )}
                          {assignee && <Avatar name={assignee.name} size="xs" />}
                          <span className="crm-num w-[64px] shrink-0 text-right font-crm-mono text-[11.5px] text-crm-faint">
                            {formatDate(t.due_date)}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
                <TaskForm members={members} onSubmit={addTask} />
              </div>
            </Card>

            <Card>
              <CardHeader title="Activity" />
              <div className="p-4">
                <div className="flex flex-wrap items-end gap-2">
                  <Select
                    className="w-[130px]"
                    label="Type"
                    value={noteType}
                    onChange={e => setNoteType(e.target.value as ActivityType)}
                    options={ACTIVITY_TYPES}
                  />
                  <Input
                    className="min-w-[200px] flex-1"
                    label="What happened"
                    value={noteText}
                    onChange={e => setNoteText(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addNote()}
                    placeholder="Call summary, what was agreed…"
                  />
                  <Button onClick={addNote} disabled={!noteText.trim()}>
                    Add
                  </Button>
                </div>

                {activities.length === 0 ? (
                  <p className="m-0 mt-4 text-[12.5px] text-crm-faint">Nothing recorded yet.</p>
                ) : (
                  <ul className="m-0 mt-4 list-none p-0">
                    {activities.map(a => (
                      <li key={a.id} className="border-l border-crm-line py-2 pl-3.5">
                        <div className="flex flex-wrap items-baseline gap-2">
                          <span className="font-crm-mono text-[10px] uppercase tracking-[0.1em] text-crm-faint">
                            {a.type.replace('_', ' ')}
                          </span>
                          <span className="crm-num font-crm-mono text-[10.5px] text-crm-faint">
                            {formatDateTime(a.created_at)}
                          </span>
                          {a.created_by && (
                            <span className="text-[10.5px] text-crm-faint">· {a.created_by}</span>
                          )}
                        </div>
                        <p className="m-0 mt-1 whitespace-pre-wrap text-[13px] text-crm-ink-2">
                          {a.content}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Card>

            <div className="border-t border-crm-line pt-4">
              <Button variant="danger" loading={deleting} onClick={remove}>
                Delete project
              </Button>
              <p className="m-0 mt-2 text-[12px] text-crm-ink-3">
                Removes its tasks and notes too. There is no undo.
              </p>
            </div>
          </>
        )}
      </div>

      {payingOpen && project && (
        <Dialog
          open
          onClose={() => {
            setPayingOpen(false);
            setPaymentError(null);
          }}
          title="Log a payment"
          description={`${formatMoney(remaining, project.currency)} still owed on this project.`}
          footer={
            <>
              <Button variant="ghost" onClick={() => setPayingOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" loading={paying} onClick={logPayment}>
                Log payment
              </Button>
            </>
          }
        >
          <div className="flex flex-col gap-3">
            <Input
              label={`Amount (${project.currency})`}
              type="number"
              min={0}
              value={payment}
              onChange={e => {
                setPayment(e.target.value);
                setPaymentError(null);
              }}
              onKeyDown={e => e.key === 'Enter' && logPayment()}
              error={paymentError ?? undefined}
              hint={paymentError ? undefined : 'Added to what has already been collected.'}
            />
            <Label>
              This also writes a line to the activity timeline, so the payment history stays readable.
            </Label>
          </div>
        </Dialog>
      )}
    </div>
  );
};

export default ProjectDetail;
