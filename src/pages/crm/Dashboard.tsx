import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import type { Client, Project, ProjectStatus, Task } from '../../types/database';

interface Stats {
  totalClients: number;
  activeProjects: number;
  pipelineValue: number;
  totalPaid: number;
  totalOutstanding: number;
}

const STATUS_COLORS: Record<ProjectStatus, string> = {
  proposal: '#3b82f6',
  active: '#10b981',
  on_hold: '#f59e0b',
  completed: '#6b7280',
  cancelled: '#ef4444',
};

const formatMoney = (n: number, currency = 'PKR') =>
  `${currency} ${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

const StatCard = ({
  label,
  value,
  sub,
  color = '#ffffff',
}: {
  label: string;
  value: number | string;
  sub?: string;
  color?: string;
}) => (
  <div style={{ background: '#141414', border: '1px solid #1e1e1e', borderRadius: 12, padding: '24px' }}>
    <div style={{ color: '#555', fontSize: 13, fontWeight: 500, marginBottom: 12 }}>{label}</div>
    <div style={{ color, fontSize: 28, fontWeight: 700, letterSpacing: -1, lineHeight: 1 }}>{value}</div>
    {sub && <div style={{ color: '#444', fontSize: 12, marginTop: 8 }}>{sub}</div>}
  </div>
);

const Dashboard = () => {
  const [stats, setStats] = useState<Stats>({
    totalClients: 0, activeProjects: 0, pipelineValue: 0, totalPaid: 0, totalOutstanding: 0,
  });
  const [recentProjects, setRecentProjects] = useState<Project[]>([]);
  const [clientsById, setClientsById] = useState<Record<string, Client>>({});
  const [upcomingTasks, setUpcomingTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const [clientsResult, projectsResult, tasksResult] = await Promise.all([
        supabase.from('clients').select('*'),
        supabase.from('projects').select('*').order('created_at', { ascending: false }),
        supabase.from('tasks').select('*').eq('status', 'pending').order('due_date', { ascending: true }).limit(6),
      ]);

      const clients = (clientsResult.data ?? []) as Client[];
      const projects = (projectsResult.data ?? []) as Project[];
      const tasks = (tasksResult.data ?? []) as Task[];

      const clientMap: Record<string, Client> = {};
      clients.forEach(c => { clientMap[c.id] = c; });
      setClientsById(clientMap);

      const active = projects.filter(p => p.status === 'active' || p.status === 'proposal');

      setStats({
        totalClients: clients.length,
        activeProjects: projects.filter(p => p.status === 'active').length,
        pipelineValue: active.reduce((sum, p) => sum + Number(p.total_value), 0),
        totalPaid: projects.reduce((sum, p) => sum + Number(p.amount_paid), 0),
        totalOutstanding: projects.reduce((sum, p) => sum + (Number(p.total_value) - Number(p.amount_paid)), 0),
      });

      setRecentProjects(projects.slice(0, 5));
      setUpcomingTasks(tasks);
      setLoading(false);
    };

    fetchData();
  }, []);

  const formatDate = (iso: string | null) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const isOverdue = (iso: string | null) => !!iso && new Date(iso) < new Date(new Date().toDateString());

  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ color: '#ffffff', fontSize: 24, fontWeight: 700, margin: 0, letterSpacing: -0.5 }}>Dashboard</h1>
        <p style={{ color: '#555', fontSize: 14, marginTop: 6 }}>
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {loading ? (
        <div style={{ color: '#555', fontSize: 14 }}>Loading…</div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 40 }}>
            <StatCard label="Total Clients" value={stats.totalClients} />
            <StatCard label="Active Projects" value={stats.activeProjects} color="#10b981" />
            <StatCard label="Pipeline Value" value={formatMoney(stats.pipelineValue)} color="#3b82f6" sub="Active + proposal" />
            <StatCard label="Total Paid" value={formatMoney(stats.totalPaid)} color="#a78bfa" />
            <StatCard label="Outstanding" value={formatMoney(stats.totalOutstanding)} color="#f59e0b" sub="Across all projects" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 24, alignItems: 'start' }}>
            {/* Recent projects */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <h2 style={{ color: '#ffffff', fontSize: 16, fontWeight: 600, margin: 0 }}>Recent Projects</h2>
                <Link to="/crm/projects" style={{ color: '#666', fontSize: 13, textDecoration: 'none' }}>View all →</Link>
              </div>

              {recentProjects.length === 0 ? (
                <div style={{ background: '#141414', border: '1px solid #1e1e1e', borderRadius: 12, padding: '32px', textAlign: 'center', color: '#444', fontSize: 14 }}>
                  No projects yet. Convert a lead or add a client to get started.
                </div>
              ) : (
                <div style={{ background: '#141414', border: '1px solid #1e1e1e', borderRadius: 12, overflow: 'hidden' }}>
                  {recentProjects.map((p, i) => (
                    <Link
                      key={p.id}
                      to={`/crm/projects/${p.id}`}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 16, padding: '14px 20px',
                        borderBottom: i < recentProjects.length - 1 ? '1px solid #1a1a1a' : 'none',
                        textDecoration: 'none', transition: 'background 0.15s',
                      }}
                      onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)')}
                      onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ color: '#ddd', fontSize: 14, fontWeight: 500 }}>{p.name}</div>
                        <div style={{ color: '#555', fontSize: 12, marginTop: 2 }}>
                          {clientsById[p.client_id]?.name ?? 'Unknown client'}
                        </div>
                      </div>
                      <span style={{
                        display: 'inline-block', padding: '3px 10px', borderRadius: 20, fontSize: 11,
                        fontWeight: 600, background: `${STATUS_COLORS[p.status]}22`, color: STATUS_COLORS[p.status],
                        textTransform: 'capitalize',
                      }}>
                        {p.status.replace('_', ' ')}
                      </span>
                      <span style={{ color: '#888', fontSize: 13, minWidth: 90, textAlign: 'right' }}>
                        {formatMoney(Number(p.total_value), p.currency)}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Upcoming tasks */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <h2 style={{ color: '#ffffff', fontSize: 16, fontWeight: 600, margin: 0 }}>Upcoming Tasks</h2>
                <Link to="/crm/tasks" style={{ color: '#666', fontSize: 13, textDecoration: 'none' }}>View all →</Link>
              </div>

              {upcomingTasks.length === 0 ? (
                <div style={{ background: '#141414', border: '1px solid #1e1e1e', borderRadius: 12, padding: '24px', textAlign: 'center', color: '#444', fontSize: 13 }}>
                  No pending tasks.
                </div>
              ) : (
                <div style={{ background: '#141414', border: '1px solid #1e1e1e', borderRadius: 12, overflow: 'hidden' }}>
                  {upcomingTasks.map((t, i) => (
                    <div
                      key={t.id}
                      style={{
                        padding: '12px 18px',
                        borderBottom: i < upcomingTasks.length - 1 ? '1px solid #1a1a1a' : 'none',
                      }}
                    >
                      <div style={{ color: '#ddd', fontSize: 13.5 }}>{t.title}</div>
                      <div style={{ color: isOverdue(t.due_date) ? '#ef4444' : '#555', fontSize: 12, marginTop: 4 }}>
                        {isOverdue(t.due_date) ? 'Overdue · ' : ''}{formatDate(t.due_date)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Dashboard;
