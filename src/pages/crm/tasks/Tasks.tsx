import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';
import {
  PRIORITIES,
  PRIORITY_LABEL,
  PRIORITY_TONE,
  formatDuration,
  priorityOf,
  sortStatuses,
  toneOf,
} from '../../../lib/tasks';
import { spawnNextRecurrence } from '../../../lib/recurrence';
import { taskFields } from '../../../lib/view-fields';
import { applyView, applyFilters, applySearch, applySort } from '../../../lib/views';
import { parseDateOnly, toDateInput, today } from '../../../lib/date';
import type { Project, Task, TaskStatusRow, TeamMember } from '../../../types/database';
import {
  Avatar,
  Badge,
  Button,
  Dot,
  ErrorState,
  PageHeader,
  SegmentedControl,
  SkeletonTiles,
  Stat,
  TableShell,
  Td,
  Th,
  Tr,
  useToast,
  type Tone,
} from '../../../components/crm/ui';
import ViewBar from '../../../components/crm/ViewBar';
import { useView } from '../../../components/crm/useView';
import { useRealtimeRows } from '../../../components/crm/useRealtimeRows';
import TasksBoard from './TasksBoard';
import TasksCalendar from './TasksCalendar';
import TaskPanel from './TaskPanel';
import { cn } from '../../../lib/utils';

const VIEWS = [
  { value: 'board' as const, label: 'Board' },
  { value: 'list' as const, label: 'List' },
  { value: 'calendar' as const, label: 'Calendar' },
];
type Layout = (typeof VIEWS)[number]['value'];

/* A board needs columns. When no grouping is chosen, status is the one
   that answers "what's in flight" — so the board falls back to it
   rather than rendering a single undifferentiated column. */
const BOARD_DEFAULT_GROUP = 'status_id';

/* Which fields a drag can write back. Grouping by anything else still
   works, it just isn't draggable — dropping a card can't change a
   derived value like "is a subtask". */
const DRAGGABLE_GROUPS = new Set(['status_id', 'assigned_to', 'priority', 'project_id', 'due_bucket']);

const PlusIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
    <path d="M12 5v14M5 12h14" />
  </svg>
);

const Tasks = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [statuses, setStatuses] = useState<TaskStatusRow[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loggedByTask, setLoggedByTask] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState<string | null>(null);

  const [layout, setLayout] = useState<Layout>('board');
  const [showDone, setShowDone] = useState(false);
  const [selected, setSelected] = useState<Task | null>(null);
  const [quickTitle, setQuickTitle] = useState('');
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const [tasksResult, statusResult, projectsResult, membersResult, timeResult] =
        await Promise.all([
          supabase.from('tasks').select('*').order('due_date', { ascending: true }),
          supabase.from('task_statuses').select('*').order('position'),
          supabase.from('projects').select('*'),
          supabase.from('team_members').select('*').order('name'),
          supabase.from('task_time_totals').select('*'),
        ]);
      if (cancelled) return;

      if (tasksResult.error) {
        setFailed(tasksResult.error.message);
        setLoading(false);
        return;
      }

      setTasks((tasksResult.data ?? []) as Task[]);
      setStatuses(sortStatuses((statusResult.data ?? []) as TaskStatusRow[]));
      setProjects((projectsResult.data ?? []) as Project[]);
      setMembers((membersResult.data ?? []) as TeamMember[]);
      setLoggedByTask(
        Object.fromEntries(
          ((timeResult.data ?? []) as Array<{ task_id: string; logged_minutes: number }>).map(r => [
            r.task_id,
            r.logged_minutes,
          ]),
        ),
      );
      setLoading(false);
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  /* Someone else's drag lands here without a refresh. applyChange
     ignores an echo older than what's on screen, so an optimistic move
     is never undone by its own round trip. */
  useRealtimeRows<Task>('tasks', setTasks);

  const membersById = useMemo(() => Object.fromEntries(members.map(m => [m.id, m])), [members]);
  const projectsById = useMemo(() => Object.fromEntries(projects.map(p => [p.id, p])), [projects]);
  const statusById = useMemo(() => Object.fromEntries(statuses.map(s => [s.id, s])), [statuses]);

  /* Identity, now that team_members can carry a user_id. */
  const me = useMemo(
    () => members.find(m => m.user_id && m.user_id === user?.id) ?? null,
    [members, user],
  );

  const view = useView('tasks', me);
  const fields = useMemo(
    () => taskFields(statuses, members, projects),
    [statuses, members, projects],
  );

  const doneStatusId = useMemo(() => statuses.find(s => s.kind === 'done')?.id ?? null, [statuses]);
  const todoStatusId = useMemo(() => statuses.find(s => s.kind === 'open')?.id ?? null, [statuses]);

  const replace = (task: Task) => {
    setTasks(list => list.map(t => (t.id === task.id ? task : t)));
    setSelected(s => (s && s.id === task.id ? task : s));
  };

  /* Subtasks are shown inside their parent, never as their own card or
     row, so they're excluded before the view is applied — otherwise
     they'd distort every count and column. */
  const visible = useMemo(
    () => tasks.filter(t => !t.parent_task_id && (showDone || t.status !== 'done')),
    [tasks, showDone],
  );

  const subtaskSummaries = useMemo(() => {
    const map: Record<string, { done: number; total: number }> = {};
    tasks.forEach(t => {
      if (!t.parent_task_id) return;
      const entry = map[t.parent_task_id] ?? { done: 0, total: 0 };
      entry.total += 1;
      if (t.status === 'done') entry.done += 1;
      map[t.parent_task_id] = entry;
    });
    return map;
  }, [tasks]);

  const boardGroupField = view.view.groupBy ?? BOARD_DEFAULT_GROUP;

  const groups = useMemo(
    () => applyView(visible, { ...view.view, groupBy: boardGroupField }, fields),
    [visible, view.view, boardGroupField, fields],
  );

  /* List and calendar want a flat, ordered set — the same filters and
     sort, without the grouping. One engine, two shapes. */
  const flat = useMemo(
    () => applySort(applySearch(applyFilters(visible, view.view.filters, fields), view.view.search, fields), view.view.sort, fields),
    [visible, view.view, fields],
  );

  const toneFor = (groupKey: string): Tone => {
    if (boardGroupField === 'status_id') return toneOf(statusById[groupKey]?.tone ?? 'neutral');
    if (boardGroupField === 'priority') {
      return PRIORITY_TONE[priorityOf(Number(groupKey))];
    }
    if (boardGroupField === 'due_bucket') {
      if (groupKey === 'overdue') return 'danger';
      if (groupKey === 'today') return 'copper';
      if (groupKey === 'this_week') return 'info';
      return 'neutral';
    }
    if (boardGroupField === 'assigned_to') return groupKey ? 'info' : 'neutral';
    return 'neutral';
  };

  /* One write path for every task mutation, so the optimistic update,
     the rollback and the recurrence spawn are defined once. */
  const patchTask = async (
    task: Task,
    patch: Partial<Pick<Task, 'status_id' | 'assigned_to' | 'priority' | 'due_date' | 'project_id'>>,
  ) => {
    const previous = task;
    replace({ ...task, ...patch });

    const { data, error } = await supabase
      .from('tasks')
      .update(patch)
      .eq('id', task.id)
      .select()
      .single();

    if (error || !data) {
      replace(previous);
      toast('That didn’t stick — the board has been put back.', 'danger');
      return;
    }

    const updated = data as Task;
    replace(updated);

    /* Completing a repeating task spawns the next one, exactly as it
       did before this phase. */
    if (previous.status !== 'done' && updated.status === 'done' && updated.recurrence_days) {
      const next = await spawnNextRecurrence(updated);
      if (next) setTasks(list => [...list, next]);
    }
  };

  /* A drop reports which column it landed in; what that means depends
     on which field the columns represent. */
  const handleMove = (task: Task, groupKey: string) => {
    switch (boardGroupField) {
      case 'status_id':
        return groupKey ? patchTask(task, { status_id: groupKey }) : undefined;
      case 'assigned_to':
        return patchTask(task, { assigned_to: groupKey || null });
      case 'project_id':
        return patchTask(task, { project_id: groupKey || null });
      case 'priority':
        return patchTask(task, { priority: priorityOf(Number(groupKey)) });
      case 'due_bucket': {
        if (groupKey === 'no_date') return patchTask(task, { due_date: null });
        const d = today();
        if (groupKey === 'this_week') d.setDate(d.getDate() + 3);
        else if (groupKey === 'later') d.setDate(d.getDate() + 14);
        return patchTask(task, { due_date: toDateInput(d) });
      }
      default:
        return undefined;
    }
  };

  /* Deliberately not routed through handleMove: that reads the current
     grouping, so a checkbox in list view would mean something
     different depending on how the board happened to be grouped. */
  const toggleDone = (task: Task) => {
    const statusId = task.status === 'done' ? todoStatusId : doneStatusId;
    if (!statusId) return;
    return patchTask(task, { status_id: statusId });
  };

  const quickAdd = async () => {
    const title = quickTitle.trim();
    if (!title) return;
    setAdding(true);
    const { data, error } = await supabase
      .from('tasks')
      .insert({ title, status: 'pending' })
      .select()
      .single();
    setAdding(false);
    if (error || !data) {
      toast('That task didn’t save.', 'danger');
      return;
    }
    setTasks(list => [...list, data as Task]);
    setQuickTitle('');
  };

  const openCount = tasks.filter(t => t.status !== 'done' && !t.parent_task_id).length;
  const overdueCount = tasks.filter(
    t => t.status !== 'done' && t.due_date != null && parseDateOnly(t.due_date) < today(),
  ).length;
  const urgentCount = tasks.filter(t => t.status !== 'done' && t.priority === 1).length;
  const loggedTotal = useMemo(
    () => Object.values(loggedByTask).reduce((a, b) => a + b, 0),
    [loggedByTask],
  );

  return (
    <div>
      <PageHeader
        title="Tasks"
        subtitle={
          loading
            ? undefined
            : `${openCount} open${overdueCount > 0 ? ` · ${overdueCount} overdue` : ''}`
        }
      />

      {failed && (
        <ErrorState
          title="Tasks couldn’t load"
          body={
            failed.includes('task_statuses') || failed.includes('status_id')
              ? 'This page needs migration 007. Run it in the Supabase SQL editor and reload.'
              : failed
          }
        />
      )}

      {!failed && (
        <>
          <section className="mb-5" aria-label="Summary">
            {loading ? (
              <SkeletonTiles count={4} />
            ) : (
              <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(180px,1fr))]">
                <Stat label="Open" value={openCount} />
                <Stat
                  label="Overdue"
                  value={overdueCount}
                  tone={overdueCount > 0 ? 'danger' : 'success'}
                  sub={overdueCount === 0 ? 'Nothing has slipped' : 'Past the due date'}
                />
                <Stat label="Urgent" value={urgentCount} tone={urgentCount > 0 ? 'warning' : 'ink'} />
                <Stat
                  label="Time logged"
                  value={formatDuration(loggedTotal)}
                  sub="Across every task"
                  tone="copper"
                />
              </div>
            )}
          </section>

          <ViewBar
            fields={fields}
            view={view.view}
            onChange={view.setView}
            onReset={view.resetView}
            savedViews={view.savedViews}
            activeViewId={view.activeViewId}
            onApplySaved={view.applySavedView}
            onSave={view.saveView}
            onUpdateActive={view.updateActiveView}
            onDelete={view.deleteView}
            shareUrl={view.shareUrl}
            viewsUnavailable={view.viewsUnavailable}
            searchPlaceholder="Search tasks…"
          >
            <label className="flex cursor-pointer items-center gap-2 text-[12.5px] text-crm-ink-2">
              <input
                type="checkbox"
                checked={showDone}
                onChange={e => setShowDone(e.target.checked)}
                className="h-3.5 w-3.5 accent-crm-copper"
              />
              Show done
            </label>
            <SegmentedControl label="Task layout" value={layout} onChange={setLayout} options={VIEWS} />
          </ViewBar>

          <div className="mb-4 flex gap-2">
            <input
              value={quickTitle}
              onChange={e => setQuickTitle(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  quickAdd();
                }
              }}
              placeholder="Add a task and press Enter…"
              aria-label="Add a task"
              className="h-9 flex-1 rounded-crm-md border border-crm-line bg-crm-ground px-3 text-[13.5px] text-crm-ink placeholder:text-crm-faint transition-colors duration-150 ease-crm hover:border-crm-line-hi focus:border-crm-copper"
            />
            <Button
              variant="primary"
              icon={<PlusIcon />}
              loading={adding}
              onClick={quickAdd}
              disabled={!quickTitle.trim()}
            >
              Add
            </Button>
          </div>

          {loading ? (
            <SkeletonTiles count={5} />
          ) : layout === 'board' ? (
            <TasksBoard
              groups={groups}
              groupField={DRAGGABLE_GROUPS.has(boardGroupField) ? boardGroupField : null}
              toneFor={toneFor}
              readOnlyGroups={boardGroupField === 'due_bucket' ? ['overdue'] : []}
              membersById={membersById}
              projectsById={projectsById}
              loggedByTask={loggedByTask}
              subtaskSummaries={subtaskSummaries}
              onMove={handleMove}
              onOpen={setSelected}
            />
          ) : layout === 'calendar' ? (
            <TasksCalendar
              tasks={flat}
              membersById={membersById}
              projectsById={projectsById}
              onToggle={toggleDone}
            />
          ) : (
            <TableShell>
              <thead>
                <tr>
                  <Th />
                  <Th>Task</Th>
                  <Th>Status</Th>
                  <Th>Priority</Th>
                  <Th>Assignee</Th>
                  <Th align="right">Time</Th>
                  <Th align="right">Due</Th>
                </tr>
              </thead>
              <tbody>
                {flat.length === 0 && (
                  <Tr>
                    <Td /><Td className="text-crm-ink-3">Nothing matches the current filters.</Td>
                    <Td /><Td /><Td /><Td /><Td />
                  </Tr>
                )}
                {flat.map(t => {
                  const status = t.status_id ? statusById[t.status_id] : null;
                  const assignee = t.assigned_to ? membersById[t.assigned_to] : null;
                  const project = t.project_id ? projectsById[t.project_id] : null;
                  const logged = loggedByTask[t.id] ?? 0;
                  const overdue =
                    t.status !== 'done' && t.due_date != null && parseDateOnly(t.due_date) < today();
                  return (
                    <Tr key={t.id} onClick={() => setSelected(t)}>
                      <Td className="w-8 pr-0">
                        <input
                          type="checkbox"
                          checked={t.status === 'done'}
                          onChange={() => toggleDone(t)}
                          onClick={e => e.stopPropagation()}
                          aria-label={`Mark ${t.title} done`}
                          className="h-3.5 w-3.5 accent-crm-copper"
                        />
                      </Td>
                      <Td>
                        <span
                          className={cn(
                            'block',
                            t.status === 'done' ? 'text-crm-faint line-through' : 'text-crm-ink',
                          )}
                        >
                          {t.title}
                        </span>
                        {project && (
                          <Link
                            to={`/crm/projects/${project.id}`}
                            onClick={e => e.stopPropagation()}
                            className="mt-0.5 block text-[12px] text-crm-ink-3 no-underline hover:text-crm-copper"
                          >
                            {project.name}
                          </Link>
                        )}
                      </Td>
                      <Td>
                        {status && (
                          <span className="inline-flex items-center gap-1.5">
                            <Dot tone={toneOf(status.tone)} />
                            <span className="text-[12.5px]">{status.label}</span>
                          </span>
                        )}
                      </Td>
                      <Td>
                        {t.priority <= 2 ? (
                          <Badge tone={PRIORITY_TONE[t.priority]}>{PRIORITY_LABEL[t.priority]}</Badge>
                        ) : (
                          <span className="text-[12.5px] text-crm-faint">
                            {PRIORITY_LABEL[t.priority]}
                          </span>
                        )}
                      </Td>
                      <Td>
                        {assignee ? (
                          <span className="inline-flex items-center gap-1.5">
                            <Avatar name={assignee.name} size="xs" />
                            <span className="text-[12.5px]">{assignee.name}</span>
                          </span>
                        ) : (
                          <span className="text-[12.5px] text-crm-faint">—</span>
                        )}
                      </Td>
                      <Td align="right" className="font-crm-mono text-[12px]">
                        {logged > 0 ? formatDuration(logged) : '—'}
                        {t.estimate_minutes ? (
                          <span className="text-crm-faint"> / {formatDuration(t.estimate_minutes)}</span>
                        ) : null}
                      </Td>
                      <Td
                        align="right"
                        className={cn('font-crm-mono text-[12px]', overdue && 'text-crm-danger')}
                      >
                        {t.due_date
                          ? parseDateOnly(t.due_date).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                            })
                          : '—'}
                      </Td>
                    </Tr>
                  );
                })}
              </tbody>
            </TableShell>
          )}

          {!loading && (
            <p className="m-0 mt-4 font-crm-mono text-[10.5px] uppercase tracking-[0.1em] text-crm-faint">
              {PRIORITIES.map(
                p =>
                  `${p.label} ${tasks.filter(t => t.status !== 'done' && t.priority === p.value).length}`,
              ).join('  ·  ')}
            </p>
          )}
        </>
      )}

      <TaskPanel
        key={selected?.id ?? 'none'}
        task={selected}
        allTasks={tasks}
        statuses={statuses}
        members={members}
        projects={projects}
        me={me}
        onClose={() => setSelected(null)}
        onSaved={replace}
        onCreatedSubtask={t => setTasks(list => [...list, t])}
        onDeleted={id => setTasks(list => list.filter(t => t.id !== id && t.parent_task_id !== id))}
      />
    </div>
  );
};

export default Tasks;
