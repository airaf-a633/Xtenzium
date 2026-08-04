import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import { spawnNextRecurrence } from '../../../lib/tasks';
import Banner from '../../../components/crm/Banner';
import TaskForm, { type TaskFormValues } from '../../../components/crm/TaskForm';
import TaskStats from '../../../components/crm/TaskStats';
import TasksBoard, { type BoardColumn } from './TasksBoard';
import TasksCalendar from './TasksCalendar';
import type { Project, Task, TaskStatus, TeamMember } from '../../../types/database';

const FILTERS: Array<{ value: TaskStatus | 'all'; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'done', label: 'Done' },
];

const VIEWS = ['list', 'board', 'calendar'] as const;
type View = typeof VIEWS[number];

const cardStyle: React.CSSProperties = { background: '#141414', border: '1px solid #1e1e1e', borderRadius: 12, padding: 20 };

const Tasks = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projectsById, setProjectsById] = useState<Record<string, Project>>({});
  const [projects, setProjects] = useState<Project[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [membersById, setMembersById] = useState<Record<string, TeamMember>>({});
  const [filter, setFilter] = useState<TaskStatus | 'all'>('pending');
  const [assigneeFilter, setAssigneeFilter] = useState('');
  const [view, setView] = useState<View>('list');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      const [tasksResult, projectsResult, membersResult] = await Promise.all([
        supabase.from('tasks').select('*').order('due_date', { ascending: true }),
        supabase.from('projects').select('*'),
        supabase.from('team_members').select('*').order('name', { ascending: true }),
      ]);
      if (tasksResult.error) setError(tasksResult.error.message);
      setTasks((tasksResult.data ?? []) as Task[]);
      const projectList = (projectsResult.data ?? []) as Project[];
      setProjects(projectList);
      const map: Record<string, Project> = {};
      projectList.forEach(p => { map[p.id] = p; });
      setProjectsById(map);
      const memberList = (membersResult.data ?? []) as TeamMember[];
      setMembers(memberList);
      const memberMap: Record<string, TeamMember> = {};
      memberList.forEach(m => { memberMap[m.id] = m; });
      setMembersById(memberMap);
      setLoading(false);
    };
    load();
  }, []);

  const handleAddTask = async (values: TaskFormValues) => {
    setError(null);
    const { data, error: insertError } = await supabase.from('tasks').insert({
      project_id: values.project_id, title: values.title, due_date: values.due_date,
      status: 'pending', assigned_to: values.assigned_to, recurrence_days: values.recurrence_days,
    }).select().single();
    if (insertError) {
      setError(insertError.message);
      return;
    }
    if (data) setTasks(prev => [...prev, data as Task]);
  };

  const completeTask = async (task: Task) => {
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: 'done' } : t));
    const { error: updateError } = await supabase.from('tasks').update({ status: 'done' }).eq('id', task.id);
    if (updateError) {
      setError(updateError.message);
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: task.status } : t));
      return;
    }
    const nextTask = await spawnNextRecurrence(task);
    if (nextTask) setTasks(prev => [...prev, nextTask]);
  };

  const toggleTask = async (task: Task) => {
    if (task.status === 'pending') {
      await completeTask(task);
      return;
    }
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: 'pending' } : t));
    const { error: updateError } = await supabase.from('tasks').update({ status: 'pending' }).eq('id', task.id);
    if (updateError) {
      setError(updateError.message);
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: task.status } : t));
    }
  };

  const handleBoardMove = async (task: Task, column: BoardColumn) => {
    if (column === 'done') {
      if (task.status !== 'done') await completeTask(task);
      return;
    }
    const today = new Date();
    const dueDate = new Date(today);
    if (column === 'today') { /* today as-is */ }
    else if (column === 'this_week') dueDate.setDate(today.getDate() + 3);
    else dueDate.setDate(today.getDate() + 14);
    const nextDue = dueDate.toISOString().slice(0, 10);

    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: 'pending', due_date: nextDue } : t));
    const { error: updateError } = await supabase.from('tasks').update({ status: 'pending', due_date: nextDue }).eq('id', task.id);
    if (updateError) {
      setError(updateError.message);
      setTasks(prev => prev.map(t => t.id === task.id ? task : t));
    }
  };

  const deleteTask = async (task: Task) => {
    const { error: deleteError } = await supabase.from('tasks').delete().eq('id', task.id);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    setTasks(prev => prev.filter(t => t.id !== task.id));
  };

  const isOverdue = (iso: string | null) => !!iso && new Date(iso) < new Date(new Date().toDateString());
  const formatDate = (iso: string | null) => iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

  const filtered = tasks.filter(t => {
    if (filter !== 'all' && t.status !== filter) return false;
    if (assigneeFilter && t.assigned_to !== assigneeFilter) return false;
    return true;
  });

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ color: '#ffffff', fontSize: 24, fontWeight: 700, margin: 0, letterSpacing: -0.5 }}>Tasks</h1>
          <p style={{ color: '#555', fontSize: 14, marginTop: 6 }}>
            {tasks.filter(t => t.status === 'pending').length} pending across all clients
          </p>
        </div>
        <div style={{ display: 'flex', border: '1px solid #2a2a2a', borderRadius: 8, overflow: 'hidden' }}>
          {VIEWS.map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              style={{
                padding: '10px 16px', background: view === v ? '#1e1e1e' : 'transparent', border: 'none',
                color: view === v ? '#fff' : '#666', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize',
              }}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {error && <Banner type="error" message={error} />}

      <TaskStats tasks={tasks} members={members} />

      <div style={{ ...cardStyle, marginBottom: 20 }}>
        <TaskForm members={members} projects={projects} onSubmit={handleAddTask} />
      </div>

      {loading ? (
        <div style={{ color: '#555', fontSize: 14, padding: '32px 0' }}>Loading tasks…</div>
      ) : view === 'board' ? (
        <TasksBoard tasks={tasks} membersById={membersById} projectsById={projectsById} onMove={handleBoardMove} />
      ) : view === 'calendar' ? (
        <TasksCalendar tasks={tasks} membersById={membersById} projectsById={projectsById} onToggle={toggleTask} />
      ) : (
        <>
          <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 6 }}>
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
            {members.length > 0 && (
              <select
                value={assigneeFilter}
                onChange={e => setAssigneeFilter(e.target.value)}
                style={{
                  padding: '8px 12px', background: '#141414', border: '1px solid #1e1e1e', borderRadius: 8,
                  color: assigneeFilter ? '#ddd' : '#666', fontSize: 13, outline: 'none',
                }}
              >
                <option value="">Everyone</option>
                {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            )}
          </div>

          {filtered.length === 0 ? (
            <div style={{ background: '#141414', border: '1px solid #1e1e1e', borderRadius: 12, padding: '48px 32px', textAlign: 'center', color: '#444', fontSize: 14 }}>
              No {filter !== 'all' ? filter : ''} tasks.
            </div>
          ) : (
            <div style={{ background: '#141414', border: '1px solid #1e1e1e', borderRadius: 12, overflow: 'hidden' }}>
              {filtered.map((t, i) => {
                const project = t.project_id ? projectsById[t.project_id] : null;
                const assignee = t.assigned_to ? membersById[t.assigned_to] : undefined;
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
                        {t.recurrence_days && <span title={`Repeats every ${t.recurrence_days} day(s)`} style={{ marginLeft: 6, color: '#555' }}>🔁</span>}
                      </div>
                      {project && (
                        <Link to={`/crm/projects/${project.id}`} style={{ color: '#555', fontSize: 12, marginTop: 2, textDecoration: 'none' }}>
                          {project.name}
                        </Link>
                      )}
                    </div>
                    {assignee && (
                      <span style={{ color: '#666', fontSize: 12, background: '#1e1e1e', padding: '2px 8px', borderRadius: 20, flexShrink: 0 }}>
                        {assignee.name}
                      </span>
                    )}
                    <span style={{ color: overdue ? '#ef4444' : '#555', fontSize: 12.5, flexShrink: 0, minWidth: 90, textAlign: 'right' }}>
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
        </>
      )}
    </div>
  );
};

export default Tasks;
