import MonthCalendar from '../../../components/crm/MonthCalendar';
import { isSameDay, parseDateOnly } from '../../../lib/date';
import { PRIORITY_TONE } from '../../../lib/tasks';
import type { Project, Task, TeamMember } from '../../../types/database';
import { Dot } from '../../../components/crm/ui';
import { cn } from '../../../lib/utils';

interface TasksCalendarProps {
  tasks: Task[];
  membersById: Record<string, TeamMember>;
  projectsById: Record<string, Project>;
  onToggle: (task: Task) => void;
}

const TasksCalendar = ({ tasks, membersById, projectsById, onToggle }: TasksCalendarProps) => {
  /* parseDateOnly, not `new Date(due)` — the latter reads a date-only
     column as UTC midnight, which lands a task on the previous square
     for anyone west of UTC. */
  const tasksOn = (day: Date) =>
    tasks.filter(t => t.due_date && isSameDay(parseDateOnly(t.due_date), day));

  return (
    <MonthCalendar
      renderDay={day => {
        const dayTasks = tasksOn(day);
        return (
          <>
            {dayTasks.slice(0, 3).map(t => {
              const project = t.project_id ? projectsById[t.project_id] : null;
              const assignee = t.assigned_to ? membersById[t.assigned_to] : null;
              const done = t.status === 'done';
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onToggle(t)}
                  title={[t.title, project?.name, assignee?.name].filter(Boolean).join(' — ')}
                  className="mb-0.5 flex w-full cursor-pointer items-center gap-1.5 rounded-crm-sm px-1 py-0.5 text-left transition-colors duration-100 ease-crm hover:bg-crm-raised"
                >
                  <Dot tone={done ? 'neutral' : PRIORITY_TONE[t.priority]} className="h-1.5 w-1.5" />
                  <span
                    className={cn(
                      'truncate text-[11px]',
                      done ? 'text-crm-faint line-through' : 'text-crm-ink-2',
                    )}
                  >
                    {t.title}
                  </span>
                </button>
              );
            })}
            {dayTasks.length > 3 && (
              <span className="crm-num block px-1 font-crm-mono text-[10px] text-crm-faint">
                +{dayTasks.length - 3} more
              </span>
            )}
          </>
        );
      }}
    />
  );
};

export default TasksCalendar;
