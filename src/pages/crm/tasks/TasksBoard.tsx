import { DndContext, useDraggable, useDroppable, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { Link } from 'react-router-dom';
import type { Project, Task, TeamMember } from '../../../types/database';

export type BoardColumn = 'today' | 'this_week' | 'later' | 'done';

const COLUMNS: Array<{ value: BoardColumn; label: string; color: string }> = [
  { value: 'today', label: 'Today', color: '#3b82f6' },
  { value: 'this_week', label: 'This Week', color: '#a78bfa' },
  { value: 'later', label: 'Later', color: '#6b7280' },
  { value: 'done', label: 'Done', color: '#10b981' },
];

const OVERDUE_COLOR = '#ef4444';

const dateOnly = (d: Date) => new Date(d.toDateString());

const bucketFor = (task: Task): 'overdue' | BoardColumn => {
  if (task.status === 'done') return 'done';
  if (!task.due_date) return 'later';
  const today = dateOnly(new Date());
  const due = dateOnly(new Date(task.due_date));
  const endOfWeek = new Date(today);
  endOfWeek.setDate(endOfWeek.getDate() + 6);
  if (due < today) return 'overdue';
  if (due.getTime() === today.getTime()) return 'today';
  if (due <= endOfWeek) return 'this_week';
  return 'later';
};

interface TasksBoardProps {
  tasks: Task[];
  membersById: Record<string, TeamMember>;
  projectsById: Record<string, Project>;
  onMove: (task: Task, column: BoardColumn) => void;
}

const formatDate = (iso: string | null) => iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—';

const Card = ({ task, membersById, projectsById }: { task: Task; membersById: Record<string, TeamMember>; projectsById: Record<string, Project> }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id });
  const assignee = task.assigned_to ? membersById[task.assigned_to] : null;
  const project = task.project_id ? projectsById[task.project_id] : null;
  const overdue = bucketFor(task) === 'overdue';

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{
        background: '#1a1a1a', border: `1px solid ${overdue ? OVERDUE_COLOR + '44' : '#262626'}`, borderRadius: 10, padding: 12, marginBottom: 8,
        cursor: 'grab', transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
        zIndex: isDragging ? 10 : undefined, boxShadow: isDragging ? '0 8px 24px rgba(0,0,0,0.5)' : undefined,
      }}
    >
      <div style={{ color: task.status === 'done' ? '#666' : '#ddd', fontSize: 13.5, marginBottom: 6, textDecoration: task.status === 'done' ? 'line-through' : 'none' }}>
        {task.title} {task.recurrence_days && <span title={`Repeats every ${task.recurrence_days}d`}>🔁</span>}
      </div>
      {project && (
        <Link to={`/crm/projects/${project.id}`} onClick={e => e.stopPropagation()} style={{ color: '#555', fontSize: 11.5, textDecoration: 'none', display: 'block', marginBottom: 6 }}>
          {project.name}
        </Link>
      )}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {assignee ? (
          <span style={{ color: '#666', fontSize: 11, background: '#1e1e1e', padding: '2px 7px', borderRadius: 20 }}>{assignee.name}</span>
        ) : <span />}
        <span style={{ color: overdue ? OVERDUE_COLOR : '#555', fontSize: 11.5 }}>{formatDate(task.due_date)}</span>
      </div>
    </div>
  );
};

const Column = ({
  value, label, color, disabled, children,
}: { value: string; label: string; color: string; disabled?: boolean; children: React.ReactNode }) => {
  const { setNodeRef, isOver } = useDroppable({ id: value, disabled });
  return (
    <div
      ref={setNodeRef}
      style={{
        background: isOver ? 'rgba(255,255,255,0.03)' : '#141414', border: `1px solid ${isOver ? color + '66' : '#1e1e1e'}`,
        borderRadius: 12, padding: 12, minHeight: 200, transition: 'background 0.15s, border-color 0.15s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, padding: '0 4px' }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
        <span style={{ color: '#888', fontSize: 12.5, fontWeight: 600 }}>{label}</span>
      </div>
      {children}
    </div>
  );
};

const TasksBoard = ({ tasks, membersById, projectsById, onMove }: TasksBoardProps) => {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const buckets: Record<'overdue' | BoardColumn, Task[]> = { overdue: [], today: [], this_week: [], later: [], done: [] };
  tasks.forEach(t => buckets[bucketFor(t)].push(t));

  const handleDragEnd = (event: DragEndEvent) => {
    if (!event.over) return;
    const task = tasks.find(t => t.id === event.active.id);
    if (!task) return;
    onMove(task, event.over.id as BoardColumn);
  };

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div style={{ display: 'grid', gridTemplateColumns: `minmax(200px, 1fr) repeat(${COLUMNS.length}, minmax(200px, 1fr))`, gap: 12, overflowX: 'auto' }}>
        <Column value="overdue" label={`Overdue (${buckets.overdue.length})`} color={OVERDUE_COLOR} disabled>
          {buckets.overdue.map(t => <Card key={t.id} task={t} membersById={membersById} projectsById={projectsById} />)}
        </Column>
        {COLUMNS.map(col => (
          <Column key={col.value} value={col.value} label={`${col.label} (${buckets[col.value].length})`} color={col.color}>
            {buckets[col.value].map(t => <Card key={t.id} task={t} membersById={membersById} projectsById={projectsById} />)}
          </Column>
        ))}
      </div>
    </DndContext>
  );
};

export default TasksBoard;
