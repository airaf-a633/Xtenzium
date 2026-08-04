import { Link } from 'react-router-dom';
import MonthCalendar from '../../../components/crm/MonthCalendar';
import { isSameDay } from '../../../lib/date';
import type { Client, Project, ProjectStatus } from '../../../types/database';

interface ProjectsCalendarProps {
  projects: Project[];
  clientsById: Record<string, Client>;
}

const STATUS_COLORS: Record<ProjectStatus, string> = {
  proposal: '#3b82f6', active: '#10b981', on_hold: '#f59e0b', completed: '#6b7280', cancelled: '#ef4444',
};

const ProjectsCalendar = ({ projects, clientsById }: ProjectsCalendarProps) => {
  const startingOn = (day: Date) => projects.filter(p => p.start_date && isSameDay(new Date(p.start_date), day));
  const endingOn = (day: Date) => projects.filter(p => p.end_date && isSameDay(new Date(p.end_date), day));

  return (
    <MonthCalendar
      renderDay={day => {
        const starts = startingOn(day);
        const ends = endingOn(day);
        const items = [...starts.map(p => ({ p, kind: 'starts' as const })), ...ends.map(p => ({ p, kind: 'ends' as const }))];
        return (
          <>
            {items.slice(0, 3).map(({ p, kind }) => (
              <Link
                key={`${p.id}-${kind}`}
                to={`/crm/projects/${p.id}`}
                title={`${p.name} (${clientsById[p.client_id]?.name ?? 'Unknown'}) ${kind}`}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, marginBottom: 3, textDecoration: 'none',
                  color: '#aaa',
                }}
              >
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: STATUS_COLORS[p.status], flexShrink: 0 }} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {p.name} {kind === 'ends' ? '(ends)' : ''}
                </span>
              </Link>
            ))}
            {items.length > 3 && (
              <div style={{ color: '#555', fontSize: 10.5 }}>+{items.length - 3} more</div>
            )}
          </>
        );
      }}
    />
  );
};

export default ProjectsCalendar;
