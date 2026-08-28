import { Link } from 'react-router-dom';
import MonthCalendar from '../../../components/crm/MonthCalendar';
import { isSameDay, parseDateOnly } from '../../../lib/date';
import type { Client, Project } from '../../../types/database';
import { Dot, PROJECT_STATUS_TONE } from '../../../components/crm/ui';

interface ProjectsCalendarProps {
  projects: Project[];
  clientsById: Record<string, Client>;
}

const ProjectsCalendar = ({ projects, clientsById }: ProjectsCalendarProps) => {
  /* parseDateOnly rather than `new Date(iso)` — start_date and end_date
     are date-only columns, and the default parse treats them as UTC
     midnight, shifting them a square left in western timezones. */
  const on = (day: Date, key: 'start_date' | 'end_date') =>
    projects.filter(p => p[key] && isSameDay(parseDateOnly(p[key] as string), day));

  return (
    <MonthCalendar
      renderDay={day => {
        const items = [
          ...on(day, 'start_date').map(p => ({ p, kind: 'starts' as const })),
          ...on(day, 'end_date').map(p => ({ p, kind: 'ends' as const })),
        ];
        return (
          <>
            {items.slice(0, 3).map(({ p, kind }) => (
              <Link
                key={`${p.id}-${kind}`}
                to={`/crm/projects/${p.id}`}
                title={`${p.name} · ${clientsById[p.client_id]?.name ?? 'Unknown client'} · ${kind}`}
                className="mb-0.5 flex items-center gap-1.5 rounded-crm-sm px-1 py-0.5 no-underline transition-colors duration-100 ease-crm hover:bg-crm-raised"
              >
                <Dot
                  tone={PROJECT_STATUS_TONE[p.status] ?? 'neutral'}
                  className="h-1.5 w-1.5"
                />
                <span className="truncate text-[11px] text-crm-ink-2">
                  {p.name}
                  {kind === 'ends' && <span className="text-crm-faint"> ends</span>}
                </span>
              </Link>
            ))}
            {items.length > 3 && (
              <span className="crm-num block px-1 font-crm-mono text-[10px] text-crm-faint">
                +{items.length - 3} more
              </span>
            )}
          </>
        );
      }}
    />
  );
};

export default ProjectsCalendar;
