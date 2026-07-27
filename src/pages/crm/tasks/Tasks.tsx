import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';
import Banner from '../../../components/crm/Banner';
import type { Project, Task, TaskStatus } from '../../../types/database';

const FILTERS: Array<{ value: TaskStatus | 'all'; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'done', label: 'Done' },
];

const inputStyle: React.CSSProperties = {
  padding: '10px 12px', background: '#0f0f0f', border: '1px solid #222', borderRadius: 8,
  color: '#ddd', fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
};

const Tasks = () => {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projectsById, setProjectsById] = useState<Record<string, Project>>({});
  const [filter, setFilter] = useState<TaskStatus | 'all'>('pending');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [due, setDue] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      const [tasksResult, projectsResult] = await Promise.all([
        supabase.from('tasks').select('*').order('due_date', { ascending: true }),
        supabase.from('projects').select('*'),
      ]);
      if (tasksResult.error) setError(tasksResult.error.message);
      setTasks((tasksResult.data ?? []) as Task[]);
      const map: Record<string, Project> = {};
      ((projectsResult.data ?? []) as Project[]).forEach(p => { map[p.id] = p; });
      setProjectsById(map);
      setLoading(false);
    };
    load();
  }, []);

  const handleAddTask = async () => {
    if (!title.trim()) return;
    const { data } = await supabase.from('tasks').insert({
      project_id: null, title: title.trim(), due_date: due || null, status: 'pending', assigned_to: user?.email ?? null,
    }).select().single();
    if (data) setTasks(prev => [...prev, data as Task]);
    setTitle('');
    setDue('');
  };

  const toggleTask = async (task: Task) => {
    const newStatus = task.status === 'done' ? 'pending' : 'done';
    await supabase.from('tasks').update({ status: newStatus }).eq('id', task.id);
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: newStatus } : t));
  };

  const deleteTask = async (task: Task) => {
    await supabase.from('tasks').delete().eq('id', task.id);
    setTasks(prev => prev.filter(t => t.id !== task.id));
  };

  const isOverdue = (iso: string | null) => !!iso && new Date(iso) < new Date(new Date().toDateString());
  const formatDate = (iso: string | null) => iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

  const filtered = tasks.filter(t => filter === 'all' || t.status === filter);

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ color: '#ffffff', fontSize: 24, fontWeight: 700, margin: 0, letterSpacing: -0.5 }}>Tasks</h1>
        <p style={{ color: '#555', fontSize: 14, marginTop: 6 }}>
          {tasks.filter(t => t.status === 'pending').length} pending across all clients
        </p>
      </div>

      {error && <Banner type="error" message={error} />}

      {/* Quick add */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <input
          style={{ ...inputStyle, flex: 1 }}
          placeholder="New task (not tied to a project)…"
          value={title}
          onChange={e => setTitle(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAddTask()}
        />
        <input style={{ ...inputStyle, width: 160 }} type="date" value={due} onChange={e => setDue(e.target.value)} />
        <button onClick={handleAddTask} style={{ padding: '10px 18px', background: '#ffffff', color: '#0a0a0a', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
          Add
        </button>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
        {FILTERS.map(f => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            style={{
              padding: '8px 14px', borderRadius: 8, border: '1px solid',
              borderColor: filter === f.value ? '#444' : '#1e1e1e',
              background: filter === f.value ? '#1e1e1e' : 'transparent',
              color: filter === f.value ? '#ffffff' : '#666', fontSize: 13,
              fontWeight: filter === f.value ? 600 : 400, cursor: 'pointer',
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ color: '#555', fontSize: 14, padding: '32px 0' }}>Loading tasks…</div>
      ) : filtered.length === 0 ? (
        <div style={{ background: '#141414', border: '1px solid #1e1e1e', borderRadius: 12, padding: '48px 32px', textAlign: 'center', color: '#444', fontSize: 14 }}>
          No {filter !== 'all' ? filter : ''} tasks.
        </div>
      ) : (
        <div style={{ background: '#141414', border: '1px solid #1e1e1e', borderRadius: 12, overflow: 'hidden' }}>
          {filtered.map((t, i) => {
            const project = t.project_id ? projectsById[t.project_id] : null;
            const overdue = t.status === 'pending' && isOverdue(t.due_date);
            return (
              <div key={t.id} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px',
                borderBottom: i < filtered.length - 1 ? '1px solid #1a1a1a' : 'none',
              }}>
                <input type="checkbox" checked={t.status === 'done'} onChange={() => toggleTask(t)} style={{ cursor: 'pointer', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: t.status === 'done' ? '#555' : '#ddd', fontSize: 14, textDecoration: t.status === 'done' ? 'line-through' : 'none' }}>
                    {t.title}
                  </div>
                  {project && (
                    <Link to={`/crm/projects/${project.id}`} style={{ color: '#555', fontSize: 12, marginTop: 2, textDecoration: 'none' }}>
                      {project.name}
                    </Link>
                  )}
                </div>
                <span style={{ color: overdue ? '#ef4444' : '#555', fontSize: 12.5, flexShrink: 0 }}>
                  {overdue ? 'Overdue · ' : ''}{formatDate(t.due_date)}
                </span>
                <button
                  onClick={() => deleteTask(t)}
                  style={{ background: 'none', border: 'none', color: '#444', cursor: 'pointer', padding: 4, flexShrink: 0 }}
                  title="Delete task"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Tasks;
