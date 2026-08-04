import { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';
import Banner from '../../../components/crm/Banner';
import TaskForm, { type TaskFormValues } from '../../../components/crm/TaskForm';
import { getUsdToPkrRate, toPkr } from '../../../lib/settings';
import { spawnNextRecurrence } from '../../../lib/tasks';
import type { Activity, ActivityType, Client, Project, ProjectStatus, Task, TeamMember } from '../../../types/database';

const CURRENCIES = ['PKR', 'USD'];

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
  client_id: '', name: '', description: '', status: 'proposal',
  total_value: '0', amount_paid: '0', currency: 'PKR', start_date: '', end_date: '',
};

const STATUS_OPTIONS: Array<{ value: ProjectStatus; label: string; color: string }> = [
  { value: 'proposal', label: 'Proposal', color: '#3b82f6' },
  { value: 'active', label: 'Active', color: '#10b981' },
  { value: 'on_hold', label: 'On Hold', color: '#f59e0b' },
  { value: 'completed', label: 'Completed', color: '#6b7280' },
  { value: 'cancelled', label: 'Cancelled', color: '#ef4444' },
];

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', background: '#0f0f0f', border: '1px solid #222',
  borderRadius: 8, color: '#ddd', fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
};
const labelStyle: React.CSSProperties = { display: 'block', color: '#666', fontSize: 12, marginBottom: 6, fontWeight: 500 };
const cardStyle: React.CSSProperties = { background: '#141414', border: '1px solid #1e1e1e', borderRadius: 12, padding: 24 };

const formatMoney = (n: number, currency = 'PKR') => `${currency} ${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
const formatDate = (iso: string | null) => iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
const formatDateTime = (iso: string) => new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

const ProjectDetail = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isNew = !id || id === 'new';

  const [form, setForm] = useState<FormState>({ ...INITIAL, client_id: searchParams.get('client_id') ?? '' });
  const [project, setProject] = useState<Project | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [usdRate, setUsdRate] = useState<number | null>(null);

  const [noteText, setNoteText] = useState('');
  const [noteType, setNoteType] = useState<ActivityType>('note');

  useEffect(() => {
    supabase.from('clients').select('*').order('name', { ascending: true }).then(({ data }) => {
      setClients((data ?? []) as Client[]);
    });
    supabase.from('team_members').select('*').order('name', { ascending: true }).then(({ data }) => {
      setMembers((data ?? []) as TeamMember[]);
    });
    getUsdToPkrRate().then(setUsdRate);
  }, []);

  useEffect(() => {
    if (isNew) return;
    const fetchAll = async () => {
      setLoading(true);
      const [projectResult, activitiesResult, tasksResult] = await Promise.all([
        supabase.from('projects').select('*').eq('id', id).single(),
        supabase.from('activities').select('*').eq('project_id', id).order('created_at', { ascending: false }),
        supabase.from('tasks').select('*').eq('project_id', id).order('due_date', { ascending: true }),
      ]);
      if (projectResult.error) {
        setError(projectResult.error.message);
      } else if (projectResult.data) {
        const p = projectResult.data as Project;
        setProject(p);
        setForm({
          client_id: p.client_id, name: p.name, description: p.description ?? '', status: p.status,
          total_value: String(p.total_value), amount_paid: String(p.amount_paid), currency: p.currency,
          start_date: p.start_date ?? '', end_date: p.end_date ?? '',
        });
      }
      setActivities((activitiesResult.data ?? []) as Activity[]);
      setTasks((tasksResult.data ?? []) as Task[]);
      setLoading(false);
    };
    fetchAll();
  }, [id, isNew]);

  const buildPayload = () => ({
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

  const handleSave = async () => {
    if (!form.name.trim() || !form.client_id) return;
    setSaving(true);
    setError(null);
    const payload = buildPayload();

    if (isNew) {
      const { data, error: insertError } = await supabase.from('projects').insert(payload).select().single();
      setSaving(false);
      if (insertError) {
        setError(insertError.message);
      } else if (data) {
        navigate(`/crm/projects/${(data as Project).id}`, { replace: true });
      }
    } else {
      const { error: updateError } = await supabase.from('projects').update(payload).eq('id', id!);
      setSaving(false);
      if (updateError) {
        setError(updateError.message);
        return;
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      setProject(prev => prev ? { ...prev, ...payload } : null);
    }
  };

  const handleAddPayment = async () => {
    if (!project) return;
    const remaining = Number(project.total_value) - Number(project.amount_paid);
    const input = prompt(`Log a payment (${project.currency}). Remaining: ${formatMoney(remaining, project.currency)}`);
    if (!input) return;
    const amount = Number(input);
    if (!amount || amount <= 0) return;
    setError(null);
    const newPaid = Math.min(Number(project.amount_paid) + amount, Number(project.total_value));
    const { error: updateError } = await supabase.from('projects').update({ amount_paid: newPaid }).eq('id', project.id);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setProject(prev => prev ? { ...prev, amount_paid: newPaid } : null);
    setForm(prev => ({ ...prev, amount_paid: String(newPaid) }));
    await supabase.from('activities').insert({
      project_id: project.id, type: 'note',
      content: `Payment logged: ${formatMoney(amount, project.currency)}`,
      created_by: user?.email ?? null,
    });
    const { data } = await supabase.from('activities').select('*').eq('project_id', project.id).order('created_at', { ascending: false });
    setActivities((data ?? []) as Activity[]);
  };

  const handleStatusChange = async (status: ProjectStatus) => {
    const previousStatus = form.status;
    setForm(prev => ({ ...prev, status }));
    if (isNew || !project) return;
    setError(null);
    const { error: updateError } = await supabase.from('projects').update({ status }).eq('id', project.id);
    if (updateError) {
      setError(updateError.message);
      setForm(prev => ({ ...prev, status: previousStatus }));
      return;
    }
    setProject(prev => prev ? { ...prev, status } : null);
    await supabase.from('activities').insert({
      project_id: project.id, type: 'status_change',
      content: `Status changed to "${status.replace('_', ' ')}"`,
      created_by: user?.email ?? null,
    });
    const { data } = await supabase.from('activities').select('*').eq('project_id', project.id).order('created_at', { ascending: false });
    setActivities((data ?? []) as Activity[]);
  };

  const handleAddNote = async () => {
    if (!noteText.trim() || !project) return;
    setError(null);
    const { data, error: insertError } = await supabase.from('activities').insert({
      project_id: project.id, type: noteType, content: noteText.trim(), created_by: user?.email ?? null,
    }).select().single();
    if (insertError) {
      setError(insertError.message);
      return;
    }
    if (data) setActivities(prev => [data as Activity, ...prev]);
    setNoteText('');
  };

  const handleAddTask = async (values: TaskFormValues) => {
    if (!project) return;
    setError(null);
    const { data, error: insertError } = await supabase.from('tasks').insert({
      project_id: project.id, title: values.title, due_date: values.due_date,
      status: 'pending', assigned_to: values.assigned_to, recurrence_days: values.recurrence_days,
    }).select().single();
    if (insertError) {
      setError(insertError.message);
      return;
    }
    if (data) setTasks(prev => [...prev, data as Task].sort((a, b) => (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999')));
  };

  const toggleTask = async (task: Task) => {
    const newStatus = task.status === 'done' ? 'pending' : 'done';
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: newStatus } : t));
    const { error: updateError } = await supabase.from('tasks').update({ status: newStatus }).eq('id', task.id);
    if (updateError) {
      setError(updateError.message);
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: task.status } : t));
      return;
    }
    if (newStatus === 'done') {
      const nextTask = await spawnNextRecurrence(task);
      if (nextTask) setTasks(prev => [...prev, nextTask].sort((a, b) => (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999')));
    }
  };

  const handleDelete = async () => {
    if (!confirm('Delete this project and all its tasks/notes? This cannot be undone.')) return;
    setDeleting(true);
    setError(null);
    const { error: deleteError } = await supabase.from('projects').delete().eq('id', id!);
    if (deleteError) {
      setError(deleteError.message);
      setDeleting(false);
      return;
    }
    navigate(`/crm/clients/${form.client_id}`);
  };

  if (loading) return <div style={{ color: '#555', fontSize: 14 }}>Loading…</div>;

  if (!isNew && !project) {
    return (
      <div style={{ textAlign: 'center', padding: '64px 0' }}>
        <div style={{ color: '#555', fontSize: 16, marginBottom: 16 }}>Project not found.</div>
        <Link to="/crm/projects" style={{ color: '#888', fontSize: 14 }}>← Back to projects</Link>
      </div>
    );
  }

  const totalValue = Number(form.total_value) || 0;
  const amountPaid = Number(form.amount_paid) || 0;
  const remaining = Math.max(totalValue - amountPaid, 0);
  const pct = totalValue > 0 ? Math.min((amountPaid / totalValue) * 100, 100) : 0;

  return (
    <div style={{ maxWidth: 860 }}>
      <Link to="/crm/projects" style={{ color: '#555', fontSize: 14, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 24 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
        Back to projects
      </Link>

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <h1 style={{ color: '#ffffff', fontSize: 24, fontWeight: 700, margin: 0, letterSpacing: -0.5 }}>
          {isNew ? 'New Project' : project!.name}
        </h1>
        <button
          onClick={handleSave}
          disabled={saving || !form.name.trim() || !form.client_id}
          style={{
            padding: '10px 20px', background: saved ? '#10b981' : '#ffffff', color: saved ? '#ffffff' : '#0a0a0a',
            border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600,
            cursor: (saving || !form.name.trim() || !form.client_id) ? 'not-allowed' : 'pointer',
          }}
        >
          {saving ? 'Saving…' : saved ? '✓ Saved' : isNew ? 'Create project' : 'Save changes'}
        </button>
      </div>

      {error && <Banner type="error" message={error} />}

      {/* Core fields */}
      <div style={{ ...cardStyle, marginBottom: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <label style={labelStyle}>Client *</label>
            <select
              style={inputStyle}
              value={form.client_id}
              onChange={e => setForm({ ...form, client_id: e.target.value })}
              disabled={!isNew}
            >
              <option value="">Select a client…</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}{c.company ? ` (${c.company})` : ''}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Project name *</label>
            <input style={inputStyle} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Website redesign" />
          </div>
          <div>
            <label style={labelStyle}>Start date</label>
            <input style={inputStyle} type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} />
          </div>
          <div>
            <label style={labelStyle}>End date</label>
            <input style={inputStyle} type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} />
          </div>
        </div>
        <div style={{ marginTop: 16 }}>
          <label style={labelStyle}>Description</label>
          <textarea style={{ ...inputStyle, resize: 'vertical' }} rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Scope, deliverables…" />
        </div>
        {clients.length === 0 && (
          <div style={{ marginTop: 12, color: '#f59e0b', fontSize: 12.5 }}>
            No clients yet — <Link to="/crm/clients/new" style={{ color: '#f59e0b' }}>add one first</Link>.
          </div>
        )}
      </div>

      {/* Financials */}
      <div style={{ ...cardStyle, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 style={{ color: '#888', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, margin: 0 }}>Financials</h2>
          {!isNew && (
            <button onClick={handleAddPayment} style={{ padding: '6px 14px', background: '#1e1e1e', color: '#ddd', border: 'none', borderRadius: 7, fontSize: 12.5, cursor: 'pointer' }}>
              + Log payment
            </button>
          )}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 16 }}>
          <div>
            <label style={labelStyle}>Total value</label>
            <input style={inputStyle} type="number" min="0" value={form.total_value} onChange={e => setForm({ ...form, total_value: e.target.value })} />
          </div>
          <div>
            <label style={labelStyle}>Amount paid</label>
            <input style={inputStyle} type="number" min="0" value={form.amount_paid} onChange={e => setForm({ ...form, amount_paid: e.target.value })} />
          </div>
          <div>
            <label style={labelStyle}>Currency</label>
            <select style={inputStyle} value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })}>
              {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <div style={{ height: 6, background: '#1e1e1e', borderRadius: 4, overflow: 'hidden', marginBottom: 10 }}>
          <div style={{ height: '100%', width: `${pct}%`, background: '#10b981', transition: 'width 0.3s' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
          <span style={{ color: '#aaa' }}>
            {usdRate !== null ? formatMoney(toPkr(amountPaid, form.currency, usdRate), 'PKR') : formatMoney(amountPaid, form.currency)} paid
          </span>
          <span style={{ color: remaining > 0 ? '#f59e0b' : '#555' }}>
            {usdRate !== null ? formatMoney(toPkr(remaining, form.currency, usdRate), 'PKR') : formatMoney(remaining, form.currency)} remaining
          </span>
        </div>
        {form.currency !== 'PKR' && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#555', marginTop: 6 }}>
            <span>originally {formatMoney(amountPaid, form.currency)}</span>
            <span>originally {formatMoney(remaining, form.currency)}</span>
          </div>
        )}
      </div>

      {/* Status */}
      <div style={{ ...cardStyle, marginBottom: 20 }}>
        <h2 style={{ color: '#888', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, margin: '0 0 16px' }}>Status</h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {STATUS_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => handleStatusChange(opt.value)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 8,
                border: `1px solid ${form.status === opt.value ? opt.color + '66' : '#1e1e1e'}`,
                background: form.status === opt.value ? `${opt.color}11` : 'transparent', cursor: 'pointer',
              }}
            >
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: opt.color, flexShrink: 0 }} />
              <span style={{ color: form.status === opt.value ? opt.color : '#666', fontSize: 13.5, fontWeight: form.status === opt.value ? 600 : 400 }}>{opt.label}</span>
            </button>
          ))}
        </div>
      </div>

      {!isNew && (
        <>
          {/* Tasks */}
          <div style={{ ...cardStyle, marginBottom: 20 }}>
            <h2 style={{ color: '#888', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, margin: '0 0 16px' }}>Tasks</h2>
            {tasks.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                {tasks.map(t => {
                  const assignee = members.find(m => m.id === t.assigned_to);
                  return (
                    <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid #1a1a1a' }}>
                      <input type="checkbox" checked={t.status === 'done'} onChange={() => toggleTask(t)} style={{ cursor: 'pointer' }} />
                      <span style={{ flex: 1, color: t.status === 'done' ? '#555' : '#ddd', fontSize: 13.5, textDecoration: t.status === 'done' ? 'line-through' : 'none' }}>
                        {t.title}
                        {t.recurrence_days && <span title={`Repeats every ${t.recurrence_days} day(s)`} style={{ marginLeft: 6, color: '#555' }}>🔁</span>}
                      </span>
                      {assignee && (
                        <span style={{ color: '#666', fontSize: 12, background: '#1e1e1e', padding: '2px 8px', borderRadius: 20 }}>
                          {assignee.name}
                        </span>
                      )}
                      <span style={{ color: '#555', fontSize: 12, minWidth: 80, textAlign: 'right' }}>{formatDate(t.due_date)}</span>
                    </div>
                  );
                })}
              </div>
            )}
            <TaskForm members={members} onSubmit={handleAddTask} />
          </div>

          {/* Activity timeline */}
          <div style={{ ...cardStyle, marginBottom: 20 }}>
            <h2 style={{ color: '#888', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, margin: '0 0 16px' }}>Activity</h2>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <select style={{ ...inputStyle, width: 130 }} value={noteType} onChange={e => setNoteType(e.target.value as ActivityType)}>
                <option value="note">Note</option>
                <option value="call">Call</option>
                <option value="meeting">Meeting</option>
                <option value="email">Email</option>
              </select>
              <input
                style={{ ...inputStyle, flex: 1 }}
                placeholder="Log an update…"
                value={noteText}
                onChange={e => setNoteText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddNote()}
              />
              <button onClick={handleAddNote} style={{ padding: '10px 16px', background: '#1e1e1e', color: '#ddd', border: 'none', borderRadius: 8, fontSize: 13.5, cursor: 'pointer' }}>Add</button>
            </div>

            {activities.length === 0 ? (
              <div style={{ color: '#444', fontSize: 13.5, textAlign: 'center', padding: '16px 0' }}>No activity yet.</div>
            ) : (
              <div>
                {activities.map((a, i) => (
                  <div key={a.id} style={{ padding: '10px 0', borderBottom: i < activities.length - 1 ? '1px solid #1a1a1a' : 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{
                        fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5,
                        color: '#666', background: '#1e1e1e', padding: '2px 7px', borderRadius: 4,
                      }}>
                        {a.type.replace('_', ' ')}
                      </span>
                      <span style={{ color: '#444', fontSize: 11.5 }}>{formatDateTime(a.created_at)}</span>
                      {a.created_by && <span style={{ color: '#444', fontSize: 11.5 }}>· {a.created_by}</span>}
                    </div>
                    <div style={{ color: '#ccc', fontSize: 13.5, lineHeight: 1.5 }}>{a.content}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ paddingTop: 8, borderTop: '1px solid #1a1a1a' }}>
            <button
              onClick={handleDelete}
              disabled={deleting}
              style={{ padding: '8px 16px', background: 'transparent', border: '1px solid #2a1a1a', borderRadius: 8, color: '#9b4545', fontSize: 13, cursor: deleting ? 'not-allowed' : 'pointer' }}
            >
              {deleting ? 'Deleting…' : 'Delete project'}
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default ProjectDetail;
