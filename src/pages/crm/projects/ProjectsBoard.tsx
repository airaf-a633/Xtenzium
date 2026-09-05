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
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { toPkr } from '../../../lib/settings';
import { formatMoney, formatMoneyCompact } from '../../../lib/money';
import type { Client, Project, ProjectStatus } from '../../../types/database';
import {
  Dot,
  EmptyState,
  PROJECT_STATUS_LABEL,
  PROJECT_STATUS_TONE,
  type Tone,
} from '../../../components/crm/ui';
import { cn } from '../../../lib/utils';

const COLUMNS: ProjectStatus[] = ['proposal', 'active', 'on_hold', 'completed', 'cancelled'];

interface ProjectsBoardProps {
  projects: Project[];
  clientsById: Record<string, Client>;
  usdRate: number;
  onStatusChange: (projectId: string, status: ProjectStatus) => void;
}

const Card = ({
  project,
  clientName,
  usdRate,
  overlay = false,
}: {
  project: Project;
  clientName: string;
  usdRate: number;
  overlay?: boolean;
}) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: project.id,
    disabled: overlay,
  });

  const value = toPkr(Number(project.total_value), project.currency, usdRate);
  const paid = Number(project.total_value) > 0
    ? Math.min(100, (Number(project.amount_paid) / Number(project.total_value)) * 100)
    : 0;

  return (
    <div
      ref={overlay ? undefined : setNodeRef}
      {...(overlay ? {} : listeners)}
      {...(overlay ? {} : attributes)}
      className={cn(
        'w-full cursor-grab rounded-crm-md border bg-crm-surface p-3',
        'transition-colors duration-150 ease-crm',
        overlay
          ? 'cursor-grabbing border-crm-copper shadow-crm-drag'
          : 'border-crm-line hover:border-crm-line-hi hover:bg-crm-raised',
        isDragging && !overlay && 'opacity-35',
      )}
    >
      <Link
        to={`/crm/projects/${project.id}`}
        onClick={e => isDragging && e.preventDefault()}
        className="block no-underline"
      >
        <span className="line-clamp-2 text-[13px] font-medium leading-snug text-crm-ink">
          {project.name}
        </span>
        <span className="mt-1 block truncate text-[11.5px] text-crm-ink-3">{clientName}</span>

        <span className="crm-num mt-2.5 flex items-baseline justify-between gap-2">
          <span className="font-crm-mono text-[12.5px] text-crm-ink-2" title={formatMoney(value)}>
            {formatMoneyCompact(value)}
          </span>
          <span className="font-crm-mono text-[10px] text-crm-faint">{Math.round(paid)}% paid</span>
        </span>

        {/* How much is actually collected — the number that decides
            whether "active" is good news. */}
        <span className="mt-1.5 block h-1 overflow-hidden rounded-full bg-crm-raised">
          <span
            className={cn('block h-full rounded-full', paid >= 100 ? 'bg-crm-success' : 'bg-crm-copper')}
            style={{ width: `${paid}%` }}
          />
        </span>
      </Link>
    </div>
  );
};

const Column = ({
  status,
  count,
  children,
}: {
  status: ProjectStatus;
  count: number;
  children: React.ReactNode;
}) => {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <section
      ref={setNodeRef}
      aria-label={`${PROJECT_STATUS_LABEL[status]}, ${count} projects`}
      className={cn(
        'flex min-h-[200px] w-full flex-col rounded-crm-lg border bg-crm-ground/40 p-2.5',
        'transition-colors duration-150 ease-crm',
        isOver ? 'border-crm-copper bg-crm-raised' : 'border-crm-line',
      )}
    >
      <header className="mb-2.5 flex items-center gap-2 px-1">
        <Dot tone={(PROJECT_STATUS_TONE[status] ?? 'neutral') as Tone} />
        <span className="truncate text-[12.5px] font-medium text-crm-ink">
          {PROJECT_STATUS_LABEL[status]}
        </span>
        <span className="crm-num ml-auto font-crm-mono text-[11px] text-crm-faint">{count}</span>
      </header>
      <div className="flex flex-col gap-2">{children}</div>
    </section>
  );
};

const ProjectsBoard = ({ projects, clientsById, usdRate, onStatusChange }: ProjectsBoardProps) => {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const handleDragEnd = (e: DragEndEvent) => {
    setDraggingId(null);
    if (!e.over) return;
    const project = projects.find(p => p.id === e.active.id);
    const status = e.over.id as ProjectStatus;
    if (!project || project.status === status) return;
    onStatusChange(project.id, status);
  };

  const dragging = draggingId ? projects.find(p => p.id === draggingId) ?? null : null;

  if (projects.length === 0) {
    return (
      <EmptyState
        title="Nothing on the board"
        body="No project matches the current filters. Win a deal on the pipeline and its project lands here automatically."
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
        <div className="grid min-w-[980px] items-start gap-2.5 [grid-template-columns:repeat(5,minmax(190px,1fr))]">
          {COLUMNS.map(status => {
            const inColumn = projects.filter(p => p.status === status);
            return (
              <Column key={status} status={status} count={inColumn.length}>
                {inColumn.map(p => (
                  <Card
                    key={p.id}
                    project={p}
                    clientName={clientsById[p.client_id]?.name ?? 'Unknown client'}
                    usdRate={usdRate}
                  />
                ))}
              </Column>
            );
          })}
        </div>
      </div>

      <DragOverlay dropAnimation={null}>
        {dragging && (
          <div className="w-[210px]">
            <Card
              project={dragging}
              clientName={clientsById[dragging.client_id]?.name ?? 'Unknown client'}
              usdRate={usdRate}
              overlay
            />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
};

export default ProjectsBoard;
