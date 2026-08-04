import type { Task, TeamMember } from '../../types/database';

interface TaskStatsProps {
  tasks: Task[];
  members: TeamMember[];
}

const tileStyle: React.CSSProperties = { background: '#141414', border: '1px solid #1e1e1e', borderRadius: 12, padding: 18 };

const startOfWeek = () => {
  const d = new Date();
  const day = d.getDay();
  const diff = (day + 6) % 7; // days since Monday
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
};

const TaskStats = ({ tasks, members }: TaskStatsProps) => {
  const today = new Date(new Date().toDateString());
  const weekStart = startOfWeek();

  const pending = tasks.filter(t => t.status === 'pending');
  const overdue = pending.filter(t => t.due_date && new Date(t.due_date) < today);
  const completedThisWeek = tasks.filter(t => t.status === 'done' && new Date(t.updated_at) >= weekStart);

  const workload = members
    .map(m => ({ member: m, count: pending.filter(t => t.assigned_to === m.id).length }))
    .filter(w => w.count > 0)
    .sort((a, b) => b.count - a.count);
  const unassignedCount = pending.filter(t => !t.assigned_to).length;
  const maxCount = Math.max(1, ...workload.map(w => w.count), unassignedCount);

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: workload.length > 0 || unassignedCount > 0 ? 12 : 0 }}>
        <div style={tileStyle}>
          <div style={{ color: '#555', fontSize: 12, marginBottom: 6 }}>Completed this week</div>
          <div style={{ color: '#10b981', fontSize: 22, fontWeight: 700 }}>{completedThisWeek.length}</div>
        </div>
        <div style={tileStyle}>
          <div style={{ color: '#555', fontSize: 12, marginBottom: 6 }}>Pending</div>
          <div style={{ color: '#3b82f6', fontSize: 22, fontWeight: 700 }}>{pending.length}</div>
        </div>
        <div style={tileStyle}>
          <div style={{ color: '#555', fontSize: 12, marginBottom: 6 }}>Overdue</div>
          <div style={{ color: overdue.length > 0 ? '#ef4444' : '#555', fontSize: 22, fontWeight: 700 }}>{overdue.length}</div>
        </div>
      </div>

      {(workload.length > 0 || unassignedCount > 0) && (
        <div style={tileStyle}>
          <div style={{ color: '#555', fontSize: 12, marginBottom: 12 }}>Workload (pending tasks)</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {workload.map(w => (
              <div key={w.member.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 100, color: '#888', fontSize: 12.5, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {w.member.name}
                </div>
                <div style={{ flex: 1, height: 8, background: '#1e1e1e', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${(w.count / maxCount) * 100}%`, background: '#3b82f6', borderRadius: 4 }} />
                </div>
                <div style={{ width: 20, color: '#666', fontSize: 12, textAlign: 'right', flexShrink: 0 }}>{w.count}</div>
              </div>
            ))}
            {unassignedCount > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 100, color: '#555', fontSize: 12.5, flexShrink: 0 }}>Unassigned</div>
                <div style={{ flex: 1, height: 8, background: '#1e1e1e', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${(unassignedCount / maxCount) * 100}%`, background: '#3f3f3f', borderRadius: 4 }} />
                </div>
                <div style={{ width: 20, color: '#555', fontSize: 12, textAlign: 'right', flexShrink: 0 }}>{unassignedCount}</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default TaskStats;
