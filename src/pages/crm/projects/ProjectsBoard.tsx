import { DndContext, useDraggable, useDroppable, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { Link } from 'react-router-dom';
import { toPkr } from '../../../lib/settings';
import type { Client, Project, ProjectStatus } from '../../../types/database';

const STATUS_COLUMNS: Array<{ value: ProjectStatus; label: string; color: string }> = [
  { value: 'proposal', label: 'Proposal', color: '#3b82f6' },
  { value: 'active', label: 'Active', color: '#10b981' },
  { value: 'on_hold', label: 'On Hold', color: '#f59e0b' },
  { value: 'completed', label: 'Completed', color: '#6b7280' },
  { value: 'cancelled', label: 'Cancelled', color: '#ef4444' },
];

const formatMoney = (n: number) => `PKR ${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

interface ProjectsBoardProps {
  projects: Project[];
  clientsById: Record<string, Client>;
  usdRate: number | null;
  onStatusChange: (projectId: string, status: ProjectStatus) => void;
}

const Card = ({ project, clientName, usdRate }: { project: Project; clientName: string; usdRate: number | null }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: project.id });
  const pkr = usdRate !== null ? toPkr(Number(project.total_value), project.currency, usdRate) : Number(project.total_value);
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{
        background: '#1a1a1a', border: '1px solid #262626', borderRadius: 10, padding: 12, marginBottom: 8,
        cursor: 'grab', transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
        zIndex: isDragging ? 10 : undefined, boxShadow: isDragging ? '0 8px 24px rgba(0,0,0,0.5)' : undefined,
        position: 'relative',
      }}
    >
      <Link to={`/crm/projects/${project.id}`} onClick={e => { if (isDragging) e.preventDefault(); }} style={{ textDecoration: 'none' }}>
        <div style={{ color: '#ddd', fontSize: 13.5, fontWeight: 500, marginBottom: 4 }}>{project.name}</div>
        <div style={{ color: '#666', fontSize: 12, marginBottom: 8 }}>{clientName}</div>
        <div style={{ color: '#888', fontSize: 12.5 }}>{formatMoney(pkr)}</div>
      </Link>
    </div>
  );
};

const Column = ({ status, label, color, children }: { status: ProjectStatus; label: string; color: string; children: React.ReactNode }) => {
  const { setNodeRef, isOver } = useDroppable({ id: status });
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

const ProjectsBoard = ({ projects, clientsById, usdRate, onStatusChange }: ProjectsBoardProps) => {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const handleDragEnd = (event: DragEndEvent) => {
    if (!event.over) return;
    onStatusChange(String(event.active.id), event.over.id as ProjectStatus);
  };

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${STATUS_COLUMNS.length}, minmax(200px, 1fr))`, gap: 12, overflowX: 'auto' }}>
        {STATUS_COLUMNS.map(col => {
          const columnProjects = projects.filter(p => p.status === col.value);
          return (
            <Column key={col.value} status={col.value} label={`${col.label} (${columnProjects.length})`} color={col.color}>
              {columnProjects.map(p => (
                <Card key={p.id} project={p} clientName={clientsById[p.client_id]?.name ?? 'Unknown'} usdRate={usdRate} />
              ))}
            </Column>
          );
        })}
      </div>
    </DndContext>
  );
};

export default ProjectsBoard;
