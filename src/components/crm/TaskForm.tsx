import { useState } from 'react';
import type { Project, TeamMember } from '../../types/database';

export interface TaskFormValues {
  title: string;
  project_id: string | null;
  assigned_to: string | null;
  due_date: string | null;
  recurrence_days: number | null;
}

const REPEAT_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '', label: "Doesn't repeat" },
  { value: '1', label: 'Daily' },
  { value: '7', label: 'Weekly' },
  { value: '14', label: 'Every 2 weeks' },
  { value: '30', label: 'Monthly' },
];

interface TaskFormProps {
  members: TeamMember[];
  projects?: Project[];
  defaultProjectId?: string;
  onSubmit: (values: TaskFormValues) => Promise<void> | void;
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', background: '#0f0f0f', border: '1px solid #222', borderRadius: 8,
  color: '#ddd', fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
};
const labelStyle: React.CSSProperties = { display: 'block', color: '#666', fontSize: 11.5, marginBottom: 6, fontWeight: 500 };

const TaskForm = ({ members, projects, defaultProjectId, onSubmit }: TaskFormProps) => {
  const [title, setTitle] = useState('');
  const [projectId, setProjectId] = useState(defaultProjectId ?? '');
  const [assignedTo, setAssignedTo] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [repeat, setRepeat] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!title.trim() || submitting) return;
    setSubmitting(true);
    await onSubmit({
      title: title.trim(),
      project_id: projectId || null,
      assigned_to: assignedTo || null,
      due_date: dueDate || null,
      recurrence_days: repeat ? Number(repeat) : null,
    });
    setSubmitting(false);
    setTitle('');
    setAssignedTo('');
    setDueDate('');
    setRepeat('');
    if (!defaultProjectId) setProjectId('');
  };

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <label style={labelStyle}>Task</label>
        <input
          style={inputStyle}
          placeholder="What needs to get done?"
          value={title}
          onChange={e => setTitle(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
        />
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: projects ? 'repeat(4, 1fr)' : 'repeat(3, 1fr)',
        gap: 10,
        marginBottom: 14,
      }}>
        {projects && (
          <div>
            <label style={labelStyle}>Project</label>
            <select style={inputStyle} value={projectId} onChange={e => setProjectId(e.target.value)}>
              <option value="">No project</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        )}
        <div>
          <label style={labelStyle}>Assign to</label>
          <select style={inputStyle} value={assignedTo} onChange={e => setAssignedTo(e.target.value)}>
            <option value="">Unassigned</option>
            {members.map(m => <option key={m.id} value={m.id}>{m.name}{m.designation ? ` — ${m.designation}` : ''}</option>)}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Due date</label>
          <input style={inputStyle} type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
        </div>
        <div>
          <label style={labelStyle}>Repeat</label>
          <select style={inputStyle} value={repeat} onChange={e => setRepeat(e.target.value)}>
            {REPEAT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>

      <button
        onClick={handleSubmit}
        disabled={!title.trim() || submitting}
        style={{
          padding: '10px 20px', background: '#ffffff', color: '#0a0a0a', border: 'none', borderRadius: 8,
          fontSize: 13.5, fontWeight: 600, cursor: (!title.trim() || submitting) ? 'not-allowed' : 'pointer',
        }}
      >
        {submitting ? 'Adding…' : '+ Add task'}
      </button>
    </div>
  );
};

export default TaskForm;
