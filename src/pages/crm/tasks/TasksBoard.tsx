import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { useMemo, useState } from 'react';
import type { Project, Task, TeamMember } from '../../../types/database';
import type { Group } from '../../../lib/views';
import { PRIORITY_LABEL, daysUntilDue, formatDuration } from '../../../lib/tasks';
import { parseDateOnly } from '../../../lib/date';
import { Avatar, Badge, Dot, EmptyState, type Tone } from '../../../components/crm/ui';
import { cn } from '../../../lib/utils';

interface TasksBoardProps {
  /* Columns come from the views engine, already filtered, searched,
     sorted and grouped. The board's only job is to draw them and to
     report a drop — it no longer decides what the columns are. */
  groups: Group<Task>[];
  /* Which field the columns represent, so a drop can be turned back
     into a field change. Null means the grouping isn't draggable. */
  groupField: string | null;
  toneFor: (groupKey: string) => Tone;
  /* Columns that describe a consequence rather than a state — you
     can't move something *into* Overdue. */
  readOnlyGroups?: string[];
  membersById: Record<string, TeamMember>;
  projectsById: Record<string, Project>;
  loggedByTask: Record<string, number>;
  subtaskSummaries: Record<string, { done: number; total: number }>;
  onMove: (task: Task, groupKey: string) => void;
  onOpen: (task: Task) => void;
}

const Card = ({
  task,
  membersById,
  projectsById,
  logged,
  subtaskSummary,
  onOpen,
  overlay = false,
}: {
  task: Task;
  membersById: Record<string, TeamMember>;
  projectsById: Record<string, Project>;
  logged: number;
  subtaskSummary: { done: number; total: number } | null;
  onOpen?: (task: Task) => void;
  overlay?: boolean;
}) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: task.id,
    disabled: overlay,
  });

  const assignee = task.assigned_to ? membersById[task.assigned_to] : null;
  const project = task.project_id ? projectsById[task.project_id] : null;
  const done = task.status === 'done';
  const overdue = !done && task.due_date != null && daysUntilDue(task.due_date) < 0;
  const marked = task.priority <= 2 && !done;
  const overEstimate = task.estimate_minutes != null && logged > task.estimate_minutes;

  return (
    <div
      ref={overlay ? undefined : setNodeRef}
      {...(overlay ? {} : listeners)}
      {...(overlay ? {} : attributes)}
      role={overlay ? undefined : 'button'}
      tabIndex={overlay ? undefined : 0}
      onClick={() => onOpen?.(task)}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen?.(task);
        }
      }}
      className={cn(
        'relative w-full cursor-grab overflow-hidden rounded-crm-md border bg-crm-surface p-3 text-left',
        'transition-colors duration-150 ease-crm',
        overlay
          ? 'cursor-grabbing border-crm-copper shadow-crm-drag'
          : 'border-crm-line hover:border-crm-line-hi hover:bg-crm-raised',
        isDragging && !overlay && 'opacity-35',
      )}
    >
      {/* Priority reads as a stripe, not another badge. Urgent and High
          only — a stripe on every card is a stripe on none. */}
      {marked && (
        <span
          className={cn(
            'absolute inset-y-0 left-0 w-[3px]',
            task.priority === 1 ? 'bg-crm-danger' : 'bg-crm-warning',
          )}
          aria-hidden="true"
        />
      )}

      <div className={cn('flex items-start justify-between gap-2', marked && 'pl-1.5')}>
        <span
          className={cn(
            'line-clamp-2 text-[13px] leading-snug',
            done ? 'text-crm-faint line-through' : 'text-crm-ink',
          )}
        >
          {task.title}
        </span>
        {assignee && <Avatar name={assignee.name} size="xs" />}
      </div>

      {project && (
        <p className={cn('m-0 mt-1.5 truncate text-[11.5px] text-crm-ink-3', marked && 'pl-1.5')}>
          {project.name}
        </p>
      )}

      {(marked || subtaskSummary || logged > 0 || task.due_date || task.recurrence_days) && (
        <div className={cn('mt-2.5 flex flex-wrap items-center gap-1.5', marked && 'pl-1.5')}>
          {marked && (
            <Badge tone={task.priority === 1 ? 'danger' : 'warning'}>
              {PRIORITY_LABEL[task.priority]}
            </Badge>
          )}
          {subtaskSummary && (
            <span className="crm-num font-crm-mono text-[10.5px] text-crm-faint">
              {subtaskSummary.done}/{subtaskSummary.total} subtasks
            </span>
          )}
          {logged > 0 && (
            <span
              className={cn(
                'crm-num font-crm-mono text-[10.5px]',
                overEstimate ? 'text-crm-danger' : 'text-crm-faint',
              )}
              title={
                task.estimate_minutes
                  ? `${formatDuration(logged)} logged of ${formatDuration(task.estimate_minutes)} estimated`
                  : `${formatDuration(logged)} logged`
              }
            >
              {formatDuration(logged)}
              {task.estimate_minutes ? ` / ${formatDuration(task.estimate_minutes)}` : ''}
            </span>
          )}
          {task.recurrence_days && (
            <span
              className="font-crm-mono text-[10.5px] text-crm-faint"
              title={`Repeats every ${task.recurrence_days} days`}
            >
              ↻
            </span>
          )}
          {task.due_date && (
            <span
              className={cn(
                'crm-num ml-auto font-crm-mono text-[10.5px]',
                overdue ? 'text-crm-danger' : 'text-crm-faint',
              )}
            >
              {parseDateOnly(task.due_date).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
              })}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

/* dnd-kit rejects an empty-string droppable id, and "no value" is a
   real column — unassigned, no project, no date — so it gets a
   sentinel that is translated back on drop. */
const NONE = '__none__';

const Column = ({
  id,
  label,
  tone,
  count,
  disabled,
  children,
}: {
  id: string;
  label: string;
  tone: Tone;
  count: number;
  disabled: boolean;
  children: React.ReactNode;
}) => {
  const { setNodeRef, isOver } = useDroppable({ id: id || NONE, disabled });
  return (
    <section
      ref={setNodeRef}
      aria-label={`${label}, ${count} tasks`}
      className={cn(
        'flex min-h-[200px] w-full flex-col rounded-crm-lg border bg-crm-ground/40 p-2.5',
        'transition-colors duration-150 ease-crm',
        isOver && !disabled ? 'border-crm-copper bg-crm-raised' : 'border-crm-line',
      )}
    >
      <header className="mb-2.5 flex items-center gap-2 px-1">
        <Dot tone={tone} />
        <span className="truncate text-[12.5px] font-medium text-crm-ink">{label}</span>
        <span className="crm-num ml-auto font-crm-mono text-[11px] text-crm-faint">{count}</span>
      </header>
      <div className="flex flex-col gap-2">{children}</div>
    </section>
  );
};

const TasksBoard = ({
  groups,
  groupField,
  toneFor,
  readOnlyGroups = [],
  membersById,
  projectsById,
  loggedByTask,
  subtaskSummaries,
  onMove,
  onOpen,
}: TasksBoardProps) => {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const allTasks = useMemo(() => groups.flatMap(g => g.rows), [groups]);

  const handleDragEnd = (e: DragEndEvent) => {
    setDraggingId(null);
    if (!e.over || !groupField) return;
    const task = allTasks.find(t => t.id === e.active.id);
    if (!task) return;
    const raw = String(e.over.id);
    const groupKey = raw === NONE ? '' : raw;
    const from = groups.find(g => g.rows.some(r => r.id === task.id));
    if (from?.key === groupKey) return;
    onMove(task, groupKey);
  };

  const dragging = draggingId ? allTasks.find(t => t.id === draggingId) ?? null : null;

  if (allTasks.length === 0) {
    return (
      <EmptyState
        title="Nothing matches"
        body="No task fits the current filters. Clear them, or add one above. Subtasks live inside their parent, so they never appear as separate cards."
      />
    );
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={(e: DragStartEvent) => setDraggingId(String(e.active.id))}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setDraggingId(null)}
    >
      <div className="overflow-x-auto pb-1">
        <div
          className="grid items-start gap-2.5"
          style={{
            gridTemplateColumns: `repeat(${groups.length}, minmax(190px, 1fr))`,
            minWidth: `${groups.length * 200}px`,
          }}
        >
          {groups.map(group => (
            <Column
              key={group.key || NONE}
              id={group.key}
              label={group.label}
              tone={toneFor(group.key)}
              count={group.rows.length}
              disabled={!groupField || readOnlyGroups.includes(group.key)}
            >
              {group.rows.map(t => (
                <Card
                  key={t.id}
                  task={t}
                  membersById={membersById}
                  projectsById={projectsById}
                  logged={loggedByTask[t.id] ?? 0}
                  subtaskSummary={subtaskSummaries[t.id] ?? null}
                  onOpen={onOpen}
                />
              ))}
            </Column>
          ))}
        </div>
      </div>

      <DragOverlay dropAnimation={null}>
        {dragging && (
          <div className="w-[210px]">
            <Card
              task={dragging}
              membersById={membersById}
              projectsById={projectsById}
              logged={loggedByTask[dragging.id] ?? 0}
              subtaskSummary={subtaskSummaries[dragging.id] ?? null}
              overlay
            />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
};

export default TasksBoard;
