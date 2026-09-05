import { useState } from 'react';
import type { Project, TeamMember } from '../../types/database';
import { PRIORITIES } from '../../lib/tasks';
import { Button, Input, Select } from './ui';
import type { TaskPriority } from '../../types/database';

export interface TaskFormValues {
  title: string;
  project_id: string | null;
  assigned_to: string | null;
  due_date: string | null;
  recurrence_days: number | null;
  priority: TaskPriority;
}

const REPEAT_OPTIONS = [
  { value: '', label: 'Doesn’t repeat' },
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

const TaskForm = ({ members, projects, defaultProjectId, onSubmit }: TaskFormProps) => {
  const [title, setTitle] = useState('');
  const [projectId, setProjectId] = useState(defaultProjectId ?? '');
  const [assignedTo, setAssignedTo] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [repeat, setRepeat] = useState('');
  const [priority, setPriority] = useState<TaskPriority>(3);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!title.trim() || submitting) return;
    setSubmitting(true);
    await onSubmit({
      title: title.trim(),
      project_id: projectId || null,
      assigned_to: assignedTo || null,
      due_date: dueDate || null,
      recurrence_days: repeat ? Number(repeat) : null,
      priority,
    });
    setSubmitting(false);
    setTitle('');
    setAssignedTo('');
    setDueDate('');
    setRepeat('');
    setPriority(3);
    if (!defaultProjectId) setProjectId('');
  };

  return (
    <div className="flex flex-col gap-3">
      <Input
        label="Task"
        value={title}
        onChange={e => setTitle(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && submit()}
        placeholder="What needs to get done?"
      />

      <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(150px,1fr))]">
        {projects && (
          <Select
            label="Project"
            value={projectId}
            onChange={e => setProjectId(e.target.value)}
            placeholder="No project"
            options={projects.map(p => ({ value: p.id, label: p.name }))}
          />
        )}
        <Select
          label="Assign to"
          value={assignedTo}
          onChange={e => setAssignedTo(e.target.value)}
          placeholder="Unassigned"
          options={members.map(m => ({
            value: m.id,
            label: m.designation ? `${m.name} — ${m.designation}` : m.name,
          }))}
        />
        <Select
          label="Priority"
          value={String(priority)}
          onChange={e => setPriority(Number(e.target.value) as TaskPriority)}
          options={PRIORITIES.map(p => ({ value: String(p.value), label: p.label }))}
        />
        <Input
          label="Due date"
          type="date"
          value={dueDate}
          onChange={e => setDueDate(e.target.value)}
        />
        <Select
          label="Repeat"
          value={repeat}
          onChange={e => setRepeat(e.target.value)}
          options={REPEAT_OPTIONS}
        />
      </div>

      <div>
        <Button variant="primary" loading={submitting} disabled={!title.trim()} onClick={submit}>
          Add task
        </Button>
      </div>
    </div>
  );
};

export default TaskForm;
