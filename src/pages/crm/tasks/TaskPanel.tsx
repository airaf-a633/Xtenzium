import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import {
  PRIORITIES,
  PRIORITY_LABEL,
  PRIORITY_TONE,
  extractMentions,
  formatDuration,
  parseDuration,
  priorityOf,
  toneOf,
} from '../../../lib/tasks';
import { parseDateOnly, toDateInput } from '../../../lib/date';
import type {
  Project,
  Task,
  TaskAttachment,
  TaskChecklistItem,
  TaskComment,
  TaskPriority,
  TaskStatusRow,
  TaskTimeEntry,
  TeamMember,
} from '../../../types/database';
import {
  Avatar,
  Badge,
  Button,
  Drawer,
  IconButton,
  Input,
  Label,
  Select,
  Textarea,
  useToast,
} from '../../../components/crm/ui';
import { cn } from '../../../lib/utils';

const BUCKET = 'task-attachments';
/* Supabase's default upload ceiling is 50 MB. Refusing at the edge with
   a clear number beats a network error three seconds in. */
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

const XIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
);

const relative = (iso: string) => {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const formatBytes = (bytes: number | null) => {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

/* A small labelled block. Used for every section so the panel reads as
   one rhythm rather than a stack of unrelated widgets. */
const Section = ({
  title,
  count,
  action,
  children,
}: {
  title: string;
  count?: number;
  action?: React.ReactNode;
  children: React.ReactNode;
}) => (
  <section className="border-t border-crm-line pt-4">
    <div className="mb-2.5 flex items-center justify-between gap-2">
      <Label>
        {title}
        {count !== undefined && count > 0 && (
          <span className="crm-num ml-1.5 text-crm-faint">{count}</span>
        )}
      </Label>
      {action}
    </div>
    {children}
  </section>
);

interface TaskPanelProps {
  task: Task | null;
  allTasks: Task[];
  statuses: TaskStatusRow[];
  members: TeamMember[];
  projects: Project[];
  /* Whoever is signed in, resolved to a team member. Null when their
     auth account has not been linked to a row yet — comments and time
     entries still work, they just aren't attributed. */
  me: TeamMember | null;
  onClose: () => void;
  onSaved: (task: Task) => void;
  onCreatedSubtask: (task: Task) => void;
  onDeleted: (taskId: string) => void;
}

const TaskPanel = ({
  task,
  allTasks,
  statuses,
  members,
  projects,
  me,
  onClose,
  onSaved,
  onCreatedSubtask,
  onDeleted,
}: TaskPanelProps) => {
  const { toast } = useToast();
  const [draft, setDraft] = useState<Task | null>(task);
  const [saving, setSaving] = useState(false);

  const [checklist, setChecklist] = useState<TaskChecklistItem[]>([]);
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [attachments, setAttachments] = useState<TaskAttachment[]>([]);
  const [timeEntries, setTimeEntries] = useState<TaskTimeEntry[]>([]);
  const [blockers, setBlockers] = useState<string[]>([]);

  const [newChecklistItem, setNewChecklistItem] = useState('');
  const [newComment, setNewComment] = useState('');
  const [newSubtask, setNewSubtask] = useState('');
  const [timeInput, setTimeInput] = useState('');
  const [timeError, setTimeError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const membersById = useMemo(
    () => Object.fromEntries(members.map(m => [m.id, m])),
    [members],
  );
  const statusById = useMemo(
    () => Object.fromEntries(statuses.map(s => [s.id, s])),
    [statuses],
  );

  const subtasks = useMemo(
    () => (task ? allTasks.filter(t => t.parent_task_id === task.id) : []),
    [allTasks, task],
  );

  /* Pure I/O: fetches, returns, writes nothing. */
  const fetchRelated = (taskId: string) =>
    Promise.all([
      supabase.from('task_checklist_items').select('*').eq('task_id', taskId).order('position'),
      supabase.from('task_comments').select('*').eq('task_id', taskId).order('created_at', { ascending: false }),
      supabase.from('task_attachments').select('*').eq('task_id', taskId).order('created_at', { ascending: false }),
      supabase.from('task_time_entries').select('*').eq('task_id', taskId).order('spent_on', { ascending: false }),
      supabase.from('task_dependencies').select('blocker_id').eq('blocked_id', taskId),
    ]);

  /* The panel is keyed on the task id by its parent, so switching
     tasks remounts it and every piece of draft state starts fresh.
     That leaves this effect doing only what an effect should:
     subscribing to an external system and writing back what it says. */
  const taskId = task?.id;
  useEffect(() => {
    if (!taskId) return undefined;
    let cancelled = false;
    fetchRelated(taskId).then(([c, cm, at, te, dep]) => {
      if (cancelled) return;
      setChecklist((c.data ?? []) as TaskChecklistItem[]);
      setComments((cm.data ?? []) as TaskComment[]);
      setAttachments((at.data ?? []) as TaskAttachment[]);
      setTimeEntries((te.data ?? []) as TaskTimeEntry[]);
      setBlockers(((dep.data ?? []) as Array<{ blocker_id: string }>).map(d => d.blocker_id));
    });
    return () => {
      cancelled = true;
    };
  }, [taskId]);

  if (!task || !draft) return null;

  const set = <K extends keyof Task>(key: K, value: Task[K]) =>
    setDraft(d => (d ? { ...d, [key]: value } : d));

  const logged = timeEntries.reduce((sum, e) => sum + e.minutes, 0);
  const estimate = draft.estimate_minutes ?? 0;
  const overBy = estimate > 0 && logged > estimate ? logged - estimate : 0;
  const pct = estimate > 0 ? Math.min(100, (logged / estimate) * 100) : 0;

  const doneChecklist = checklist.filter(i => i.done).length;

  /* A task is startable only when nothing it depends on is still open.
     Shown rather than enforced — sometimes you start anyway, and a
     tool that refuses is a tool people route around. */
  const openBlockers = blockers
    .map(id => allTasks.find(t => t.id === id))
    .filter((t): t is Task => Boolean(t) && t!.status !== 'done');

  const save = async () => {
    setSaving(true);
    const { data, error } = await supabase
      .from('tasks')
      .update({
        title: draft.title,
        description: draft.description,
        due_date: draft.due_date || null,
        assigned_to: draft.assigned_to || null,
        project_id: draft.project_id || null,
        priority: draft.priority,
        status_id: draft.status_id,
        estimate_minutes: draft.estimate_minutes,
        recurrence_days: draft.recurrence_days,
      })
      .eq('id', draft.id)
      .select()
      .single();
    setSaving(false);
    if (error || !data) {
      toast('That didn’t save — check the connection and try again.', 'danger');
      return;
    }
    onSaved(data as Task);
    toast('Task saved', 'success');
  };

  const addChecklistItem = async () => {
    const label = newChecklistItem.trim();
    if (!label) return;
    const { data, error } = await supabase
      .from('task_checklist_items')
      .insert({ task_id: draft.id, label, position: checklist.length })
      .select()
      .single();
    if (error || !data) {
      toast('Couldn’t add that item.', 'danger');
      return;
    }
    setChecklist(list => [...list, data as TaskChecklistItem]);
    setNewChecklistItem('');
  };

  const toggleChecklistItem = async (item: TaskChecklistItem) => {
    setChecklist(list => list.map(i => (i.id === item.id ? { ...i, done: !i.done } : i)));
    const { error } = await supabase
      .from('task_checklist_items')
      .update({ done: !item.done })
      .eq('id', item.id);
    if (error) {
      setChecklist(list => list.map(i => (i.id === item.id ? item : i)));
      toast('That didn’t stick.', 'danger');
    }
  };

  const removeChecklistItem = async (id: string) => {
    const previous = checklist;
    setChecklist(list => list.filter(i => i.id !== id));
    const { error } = await supabase.from('task_checklist_items').delete().eq('id', id);
    if (error) {
      setChecklist(previous);
      toast('Couldn’t remove that item.', 'danger');
    }
  };

  const addComment = async () => {
    const body = newComment.trim();
    if (!body) return;
    const { data, error } = await supabase
      .from('task_comments')
      .insert({
        task_id: draft.id,
        body,
        author_id: me?.id ?? null,
        mentions: extractMentions(body, members),
      })
      .select()
      .single();
    if (error || !data) {
      toast('The comment didn’t post.', 'danger');
      return;
    }
    setComments(list => [data as TaskComment, ...list]);
    setNewComment('');
  };

  const addSubtask = async () => {
    const title = newSubtask.trim();
    if (!title) return;
    const { data, error } = await supabase
      .from('tasks')
      .insert({
        title,
        project_id: draft.project_id,
        parent_task_id: draft.id,
        assigned_to: draft.assigned_to,
        due_date: draft.due_date,
        status: 'pending',
        priority: draft.priority,
      })
      .select()
      .single();
    if (error || !data) {
      toast(error?.message ?? 'Couldn’t add that subtask.', 'danger');
      return;
    }
    onCreatedSubtask(data as Task);
    setNewSubtask('');
  };

  const logTime = async () => {
    const minutes = parseDuration(timeInput);
    if (minutes === null) {
      setTimeError('Try 90, 1.5h, or 1h 30m.');
      return;
    }
    setTimeError(null);
    const { data, error } = await supabase
      .from('task_time_entries')
      .insert({ task_id: draft.id, minutes, member_id: me?.id ?? null })
      .select()
      .single();
    if (error || !data) {
      toast('That time didn’t log.', 'danger');
      return;
    }
    setTimeEntries(list => [data as TaskTimeEntry, ...list]);
    setTimeInput('');
  };

  const removeTimeEntry = async (id: string) => {
    const previous = timeEntries;
    setTimeEntries(list => list.filter(e => e.id !== id));
    const { error } = await supabase.from('task_time_entries').delete().eq('id', id);
    if (error) {
      setTimeEntries(previous);
      toast('Couldn’t remove that entry.', 'danger');
    }
  };

  const upload = async (file: File) => {
    if (file.size > MAX_UPLOAD_BYTES) {
      toast(`${file.name} is ${formatBytes(file.size)} — the limit is 25 MB.`, 'danger');
      return;
    }
    setUploading(true);
    const path = `${draft.id}/${crypto.randomUUID()}-${file.name}`;
    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file);
    if (uploadError) {
      setUploading(false);
      toast('The upload failed. Nothing was attached.', 'danger');
      return;
    }
    const { data, error } = await supabase
      .from('task_attachments')
      .insert({
        task_id: draft.id,
        storage_path: path,
        file_name: file.name,
        mime_type: file.type || null,
        size_bytes: file.size,
        uploaded_by: me?.id ?? null,
      })
      .select()
      .single();
    setUploading(false);
    if (error || !data) {
      /* Don't leave an orphan in the bucket that nothing references. */
      await supabase.storage.from(BUCKET).remove([path]);
      toast('The file uploaded but couldn’t be attached, so it was removed.', 'danger');
      return;
    }
    setAttachments(list => [data as TaskAttachment, ...list]);
  };

  const openAttachment = async (a: TaskAttachment) => {
    /* Private bucket, so a link needs signing. Short expiry — the URL
       is a capability, and it shouldn't outlive the click. */
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(a.storage_path, 60);
    if (error || !data) {
      toast('Couldn’t open that file.', 'danger');
      return;
    }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  };

  const removeAttachment = async (a: TaskAttachment) => {
    const previous = attachments;
    setAttachments(list => list.filter(x => x.id !== a.id));
    const { error } = await supabase.from('task_attachments').delete().eq('id', a.id);
    if (error) {
      setAttachments(previous);
      toast('Couldn’t remove that file.', 'danger');
      return;
    }
    await supabase.storage.from(BUCKET).remove([a.storage_path]);
  };

  const addBlocker = async (blockerId: string) => {
    if (!blockerId) return;
    const { error } = await supabase
      .from('task_dependencies')
      .insert({ blocker_id: blockerId, blocked_id: draft.id });
    if (error) {
      toast(error.message.includes('block each other')
        ? 'Those two tasks would block each other.'
        : 'Couldn’t add that dependency.', 'danger');
      return;
    }
    setBlockers(list => [...list, blockerId]);
  };

  const removeBlocker = async (blockerId: string) => {
    const previous = blockers;
    setBlockers(list => list.filter(id => id !== blockerId));
    const { error } = await supabase
      .from('task_dependencies')
      .delete()
      .eq('blocker_id', blockerId)
      .eq('blocked_id', draft.id);
    if (error) {
      setBlockers(previous);
      toast('Couldn’t remove that dependency.', 'danger');
    }
  };

  const deleteTask = async () => {
    const { error } = await supabase.from('tasks').delete().eq('id', draft.id);
    if (error) {
      toast('Couldn’t delete that task.', 'danger');
      return;
    }
    onDeleted(draft.id);
    toast('Task deleted', 'info');
    onClose();
  };

  const status = draft.status_id ? statusById[draft.status_id] : null;
  const project = draft.project_id ? projects.find(p => p.id === draft.project_id) : null;

  /* Candidates for "blocked by": anything that isn't this task, isn't
     already a blocker, and isn't one of this task's own subtasks. */
  const blockerCandidates = allTasks.filter(
    t => t.id !== draft.id && !blockers.includes(t.id) && t.parent_task_id !== draft.id,
  );

  return (
    <Drawer
      open
      onClose={onClose}
      eyebrow={
        <div className="flex flex-wrap items-center gap-1.5">
          {status && (
            <Badge tone={toneOf(status.tone)} dot>
              {status.label}
            </Badge>
          )}
          <Badge tone={PRIORITY_TONE[draft.priority]} dot={draft.priority <= 2}>
            {PRIORITY_LABEL[draft.priority]}
          </Badge>
          {draft.parent_task_id && <Badge tone="info">Subtask</Badge>}
          {draft.recurrence_days && <Badge>Repeats every {draft.recurrence_days}d</Badge>}
        </div>
      }
      title={draft.title}
      footer={
        <>
          <Button variant="ghost" onClick={deleteTask}>
            Delete
          </Button>
          <Button variant="primary" loading={saving} onClick={save}>
            Save
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {openBlockers.length > 0 && (
          <div className="rounded-crm-md border border-crm-warning/30 bg-crm-warning-quiet px-3.5 py-3">
            <p className="m-0 text-[12.5px] font-medium text-crm-warning">
              Waiting on {openBlockers.length} unfinished {openBlockers.length === 1 ? 'task' : 'tasks'}
            </p>
            <p className="m-0 mt-1 text-[12.5px] text-crm-ink-2">
              {openBlockers.map(t => t.title).join(', ')}
            </p>
          </div>
        )}

        {/* ── The fields ─────────────────────────────────────── */}
        <Input
          label="Title"
          required
          value={draft.title}
          onChange={e => set('title', e.target.value)}
        />

        <Textarea
          label="Description"
          rows={3}
          value={draft.description ?? ''}
          onChange={e => set('description', e.target.value)}
          placeholder="What done looks like."
        />

        <div className="grid grid-cols-2 gap-3">
          <Select
            label="Status"
            value={draft.status_id ?? ''}
            onChange={e => set('status_id', e.target.value || null)}
            options={statuses.map(s => ({ value: s.id, label: s.label }))}
          />
          <Select
            label="Priority"
            value={String(draft.priority)}
            onChange={e => set('priority', priorityOf(Number(e.target.value)) as TaskPriority)}
            options={PRIORITIES.map(p => ({ value: String(p.value), label: p.label }))}
          />
          <Select
            label="Assignee"
            value={draft.assigned_to ?? ''}
            onChange={e => set('assigned_to', e.target.value || null)}
            placeholder="Unassigned"
            options={members.map(m => ({ value: m.id, label: m.name }))}
          />
          <Input
            label="Due"
            type="date"
            value={draft.due_date ?? ''}
            onChange={e => set('due_date', e.target.value)}
          />
          <Select
            className="col-span-2"
            label="Project"
            value={draft.project_id ?? ''}
            onChange={e => set('project_id', e.target.value || null)}
            placeholder="No project — internal work"
            options={projects.map(p => ({ value: p.id, label: p.name }))}
          />
        </div>

        {project && (
          <Link
            to={`/crm/projects/${project.id}`}
            className="text-[12.5px] text-crm-copper no-underline"
          >
            Open {project.name} →
          </Link>
        )}

        {/* ── Time ───────────────────────────────────────────── */}
        <Section title="Time" action={
          <span className="crm-num font-crm-mono text-[11.5px] text-crm-ink-3">
            {formatDuration(logged)}{estimate > 0 ? ` / ${formatDuration(estimate)}` : ''}
          </span>
        }>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Estimate"
              value={draft.estimate_minutes ? formatDuration(draft.estimate_minutes) : ''}
              onChange={e => {
                const parsed = parseDuration(e.target.value);
                set('estimate_minutes', e.target.value.trim() === '' ? null : parsed);
              }}
              placeholder="4h"
              hint="Saved with the task"
            />
            <Input
              label="Log time"
              value={timeInput}
              onChange={e => {
                setTimeInput(e.target.value);
                setTimeError(null);
              }}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  logTime();
                }
              }}
              placeholder="1h 30m"
              error={timeError ?? undefined}
              hint={timeError ? undefined : 'Enter to log'}
            />
          </div>

          {estimate > 0 && (
            <div className="mt-3">
              <div className="h-1.5 overflow-hidden rounded-full bg-crm-raised">
                <div
                  className={cn(
                    'h-full rounded-full transition-[width] duration-300 ease-crm',
                    overBy > 0 ? 'bg-crm-danger' : 'bg-crm-copper',
                  )}
                  style={{ width: `${overBy > 0 ? 100 : pct}%` }}
                />
              </div>
              <p className={cn(
                'crm-num m-0 mt-1.5 font-crm-mono text-[11px]',
                overBy > 0 ? 'text-crm-danger' : 'text-crm-faint',
              )}>
                {overBy > 0
                  ? `${formatDuration(overBy)} over estimate`
                  : `${Math.round(pct)}% of estimate used`}
              </p>
            </div>
          )}

          {timeEntries.length > 0 && (
            <ul className="m-0 mt-3 list-none p-0">
              {timeEntries.slice(0, 6).map(e => (
                <li key={e.id} className="flex items-center gap-2 py-1">
                  <span className="crm-num w-[52px] shrink-0 font-crm-mono text-[11.5px] text-crm-ink-2">
                    {formatDuration(e.minutes)}
                  </span>
                  {e.member_id && membersById[e.member_id] && (
                    <Avatar name={membersById[e.member_id].name} size="xs" />
                  )}
                  <span className="crm-num flex-1 font-crm-mono text-[10.5px] text-crm-faint">
                    {parseDateOnly(e.spent_on).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                  <IconButton label="Remove entry" size="sm" icon={<XIcon />} onClick={() => removeTimeEntry(e.id)} />
                </li>
              ))}
            </ul>
          )}
        </Section>

        {/* ── Subtasks ───────────────────────────────────────── */}
        {!draft.parent_task_id && (
          <Section
            title="Subtasks"
            count={subtasks.length}
            action={
              subtasks.length > 0 ? (
                <span className="crm-num font-crm-mono text-[11px] text-crm-faint">
                  {subtasks.filter(t => t.status === 'done').length}/{subtasks.length} done
                </span>
              ) : undefined
            }
          >
            <ul className="m-0 mb-2 list-none p-0">
              {subtasks.map(t => (
                <li key={t.id} className="flex items-center gap-2 border-b border-crm-line py-1.5 last:border-b-0">
                  <span className={cn(
                    'h-1.5 w-1.5 shrink-0 rounded-full',
                    t.status === 'done' ? 'bg-crm-success' : 'bg-crm-ink-3',
                  )} />
                  <span className={cn(
                    'flex-1 truncate text-[12.5px]',
                    t.status === 'done' ? 'text-crm-faint line-through' : 'text-crm-ink-2',
                  )}>
                    {t.title}
                  </span>
                  {t.assigned_to && membersById[t.assigned_to] && (
                    <Avatar name={membersById[t.assigned_to].name} size="xs" />
                  )}
                </li>
              ))}
            </ul>
            <div className="flex gap-2">
              <input
                value={newSubtask}
                onChange={e => setNewSubtask(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addSubtask();
                  }
                }}
                placeholder="Add a subtask"
                aria-label="Add a subtask"
                className="h-8 flex-1 rounded-crm-sm border border-crm-line bg-crm-ground px-2.5 text-[12.5px] text-crm-ink placeholder:text-crm-faint hover:border-crm-line-hi"
              />
              <Button size="sm" onClick={addSubtask} disabled={!newSubtask.trim()}>
                Add
              </Button>
            </div>
          </Section>
        )}

        {/* ── Checklist ──────────────────────────────────────── */}
        <Section
          title="Checklist"
          count={checklist.length}
          action={
            checklist.length > 0 ? (
              <span className="crm-num font-crm-mono text-[11px] text-crm-faint">
                {doneChecklist}/{checklist.length}
              </span>
            ) : undefined
          }
        >
          <ul className="m-0 mb-2 list-none p-0">
            {checklist.map(item => (
              <li key={item.id} className="group flex items-center gap-2 py-1">
                <input
                  type="checkbox"
                  checked={item.done}
                  onChange={() => toggleChecklistItem(item)}
                  aria-label={item.label}
                  className="h-3.5 w-3.5 shrink-0 accent-crm-copper"
                />
                <span className={cn(
                  'flex-1 text-[12.5px]',
                  item.done ? 'text-crm-faint line-through' : 'text-crm-ink-2',
                )}>
                  {item.label}
                </span>
                <IconButton label="Remove item" size="sm" icon={<XIcon />} onClick={() => removeChecklistItem(item.id)} />
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <input
              value={newChecklistItem}
              onChange={e => setNewChecklistItem(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addChecklistItem();
                }
              }}
              placeholder="Add an item"
              aria-label="Add a checklist item"
              className="h-8 flex-1 rounded-crm-sm border border-crm-line bg-crm-ground px-2.5 text-[12.5px] text-crm-ink placeholder:text-crm-faint hover:border-crm-line-hi"
            />
            <Button size="sm" onClick={addChecklistItem} disabled={!newChecklistItem.trim()}>
              Add
            </Button>
          </div>
        </Section>

        {/* ── Dependencies ───────────────────────────────────── */}
        <Section title="Blocked by" count={blockers.length}>
          <ul className="m-0 mb-2 list-none p-0">
            {blockers.map(id => {
              const t = allTasks.find(x => x.id === id);
              return (
                <li key={id} className="flex items-center gap-2 py-1">
                  <span className={cn(
                    'h-1.5 w-1.5 shrink-0 rounded-full',
                    t?.status === 'done' ? 'bg-crm-success' : 'bg-crm-warning',
                  )} />
                  <span className="flex-1 truncate text-[12.5px] text-crm-ink-2">
                    {t?.title ?? 'A task you can’t see'}
                  </span>
                  <IconButton label="Remove dependency" size="sm" icon={<XIcon />} onClick={() => removeBlocker(id)} />
                </li>
              );
            })}
          </ul>
          <select
            value=""
            onChange={e => addBlocker(e.target.value)}
            aria-label="Add a blocking task"
            className="h-8 w-full rounded-crm-sm border border-crm-line bg-crm-ground px-2.5 text-[12.5px] text-crm-ink hover:border-crm-line-hi"
          >
            <option value="">Add a task that blocks this one…</option>
            {blockerCandidates.map(t => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>
        </Section>

        {/* ── Attachments ────────────────────────────────────── */}
        <Section
          title="Files"
          count={attachments.length}
          action={
            <Button size="sm" loading={uploading} onClick={() => fileRef.current?.click()}>
              Attach
            </Button>
          }
        >
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            onChange={e => {
              const file = e.target.files?.[0];
              if (file) upload(file);
              e.target.value = '';
            }}
          />
          {attachments.length === 0 ? (
            <p className="m-0 text-[12px] text-crm-faint">Nothing attached.</p>
          ) : (
            <ul className="m-0 list-none p-0">
              {attachments.map(a => (
                <li key={a.id} className="flex items-center gap-2 py-1">
                  <button
                    type="button"
                    onClick={() => openAttachment(a)}
                    className="flex-1 truncate text-left text-[12.5px] text-crm-copper hover:underline"
                  >
                    {a.file_name}
                  </button>
                  <span className="crm-num shrink-0 font-crm-mono text-[10.5px] text-crm-faint">
                    {formatBytes(a.size_bytes)}
                  </span>
                  <IconButton label={`Remove ${a.file_name}`} size="sm" icon={<XIcon />} onClick={() => removeAttachment(a)} />
                </li>
              ))}
            </ul>
          )}
        </Section>

        {/* ── Comments ───────────────────────────────────────── */}
        <Section title="Comments" count={comments.length}>
          <Textarea
            label="Add a comment"
            rows={2}
            value={newComment}
            onChange={e => setNewComment(e.target.value)}
            placeholder="Type @ and a first name to mention someone."
          />
          <div className="mt-2 flex justify-end">
            <Button size="sm" onClick={addComment} disabled={!newComment.trim()}>
              Comment
            </Button>
          </div>

          <ul className="m-0 mt-3 list-none p-0">
            {comments.map(c => (
              <li key={c.id} className="border-l border-crm-line py-2 pl-3">
                <div className="flex items-center gap-2">
                  {c.author_id && membersById[c.author_id] ? (
                    <>
                      <Avatar name={membersById[c.author_id].name} size="xs" />
                      <span className="text-[12px] font-medium text-crm-ink">
                        {membersById[c.author_id].name}
                      </span>
                    </>
                  ) : (
                    <span className="text-[12px] text-crm-ink-3">Someone</span>
                  )}
                  <span className="crm-num ml-auto font-crm-mono text-[10.5px] text-crm-faint">
                    {relative(c.created_at)}
                  </span>
                </div>
                <p className="m-0 mt-1 whitespace-pre-wrap text-[12.5px] text-crm-ink-2">{c.body}</p>
                {c.mentions.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {c.mentions.map(id => (
                      <Badge key={id} tone="info">
                        @{membersById[id]?.name.split(' ')[0] ?? 'someone'}
                      </Badge>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </Section>

        <p className="m-0 font-crm-mono text-[10px] uppercase tracking-[0.1em] text-crm-faint">
          Created {relative(draft.created_at)}
          {draft.completed_at && ` · Completed ${relative(draft.completed_at)}`}
          {draft.due_date && ` · Due ${toDateInput(parseDateOnly(draft.due_date))}`}
        </p>
      </div>
    </Drawer>
  );
};

export default TaskPanel;
