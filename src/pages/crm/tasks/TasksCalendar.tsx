import MonthCalendar from '../../../components/crm/MonthCalendar';
import { isSameDay } from '../../../lib/date';
import type { Project, Task, TeamMember } from '../../../types/database';

interface TasksCalendarProps {
  tasks: Task[];
  membersById: Record<string, TeamMember>;
  projectsById: Record<string, Project>;
  onToggle: (task: Task) => void;
}

const TasksCalendar = ({ tasks, membersById, projectsById, onToggle }: TasksCalendarProps) => {
  const tasksByDay = (day: Date) => tasks.filter(t => t.due_date && isSameDay(new Date(t.due_date), day));

  return (
    <MonthCalendar
      renderDay={day => {
        const dayTasks = tasksByDay(day);
        return (
          <>
            {dayTasks.slice(0, 3).map(t => {
              const project = t.project_id ? projectsById[t.project_id] : null;
              const assignee = t.assigned_to ? membersById[t.assigned_to] : null;
              const titleParts = [t.title, project?.name, assignee?.name].filter(Boolean);
              return (
                <div
                  key={t.id}
                  onClick={() => onToggle(t)}
                  title={titleParts.join(' — ')}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, marginBottom: 3, cursor: 'pointer',
                    color: t.status === 'done' ? '#4a4a4a' : '#aaa', textDecoration: t.status === 'done' ? 'line-through' : 'none',
                  }}
                >
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: t.status === 'done' ? '#4a4a4a' : '#3b82f6', flexShrink: 0 }} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</span>
                </div>
              );
            })}
            {dayTasks.length > 3 && (
              <div style={{ color: '#555', fontSize: 10.5 }}>+{dayTasks.length - 3} more</div>
            )}
          </>
        );
      }}
    />
  );
};

export default TasksCalendar;
