import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import Banner from '../../../components/crm/Banner';
import type { Client, Project, ProjectStatus } from '../../../types/database';

const STATUS_CONFIG: Record<ProjectStatus, { label: string; color: string }> = {
  proposal: { label: 'Proposal', color: '#3b82f6' },
  active: { label: 'Active', color: '#10b981' },
  on_hold: { label: 'On Hold', color: '#f59e0b' },
  completed: { label: 'Completed', color: '#6b7280' },
  cancelled: { label: 'Cancelled', color: '#ef4444' },
};

const FILTERS: Array<{ value: ProjectStatus | 'all'; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'proposal', label: 'Proposal' },
  { value: 'active', label: 'Active' },
  { value: 'on_hold', label: 'On Hold' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

const formatMoney = (n: number, currency = 'PKR') => `${currency} ${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

const Projects = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [clientsById, setClientsById] = useState<Record<string, Client>>({});
  const [filter, setFilter] = useState<ProjectStatus | 'all'>('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProjects = async () => {
      setLoading(true);
      setError(null);
      const [projectsResult, clientsResult] = await Promise.all([
        supabase.from('projects').select('*').order('created_at', { ascending: false }),
        supabase.from('clients').select('*'),
      ]);
      if (projectsResult.error) setError(projectsResult.error.message);
      setProjects((projectsResult.data ?? []) as Project[]);
      const map: Record<string, Client> = {};
      ((clientsResult.data ?? []) as Client[]).forEach(c => { map[c.id] = c; });
      setClientsById(map);
      setLoading(false);
    };
    fetchProjects();
  }, []);

  const filtered = projects.filter(p => {
    const matchesFilter = filter === 'all' || p.status === filter;
    const q = search.toLowerCase();
    const clientName = clientsById[p.client_id]?.name ?? '';
    const matchesSearch = !q || [p.name, clientName].some(v => v.toLowerCase().includes(q));
    return matchesFilter && matchesSearch;
  });

  const formatDate = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ color: '#ffffff', fontSize: 24, fontWeight: 700, margin: 0, letterSpacing: -0.5 }}>Projects</h1>
          <p style={{ color: '#555', fontSize: 14, marginTop: 6 }}>{projects.length} total</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Link
            to="/crm/projects/import"
            style={{ padding: '10px 18px', background: 'transparent', border: '1px solid #2a2a2a', color: '#ddd', borderRadius: 8, fontSize: 14, fontWeight: 600, textDecoration: 'none' }}
          >
            Import CSV
          </Link>
          <Link
            to="/crm/projects/new"
            style={{ padding: '10px 18px', background: '#ffffff', color: '#0a0a0a', borderRadius: 8, fontSize: 14, fontWeight: 600, textDecoration: 'none' }}
          >
            + New Project
          </Link>
        </div>
      </div>

      {error && <Banner type="error" message={error} />}

      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '1', minWidth: 200 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2"
            style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}>
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Search by project or client…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: '100%', padding: '10px 14px 10px 36px', background: '#141414', border: '1px solid #1e1e1e',
              borderRadius: 8, color: '#ffffff', fontSize: 14, outline: 'none', boxSizing: 'border-box',
            }}
          />
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              style={{
                padding: '8px 14px', borderRadius: 8, border: '1px solid',
                borderColor: filter === f.value ? '#444' : '#1e1e1e',
                background: filter === f.value ? '#1e1e1e' : 'transparent',
                color: filter === f.value ? '#ffffff' : '#666', fontSize: 13,
                fontWeight: filter === f.value ? 600 : 400, cursor: 'pointer',
              }}
            >
              {f.label}
              {f.value !== 'all' && (
                <span style={{ marginLeft: 6, color: '#444' }}>{projects.filter(p => p.status === f.value).length}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ color: '#555', fontSize: 14, padding: '32px 0' }}>Loading projects…</div>
      ) : filtered.length === 0 ? (
        <div style={{ background: '#141414', border: '1px solid #1e1e1e', borderRadius: 12, padding: '48px 32px', textAlign: 'center', color: '#444', fontSize: 14 }}>
          {search || filter !== 'all' ? 'No projects match your filters.' : 'No projects yet.'}
        </div>
      ) : (
        <div style={{ background: '#141414', border: '1px solid #1e1e1e', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{
            display: 'grid', gridTemplateColumns: '2fr 1.5fr 1fr 1.2fr 100px', padding: '10px 20px',
            borderBottom: '1px solid #1a1a1a', color: '#444', fontSize: 12, fontWeight: 600,
            textTransform: 'uppercase', letterSpacing: 0.5,
          }}>
            <span>Project / Client</span><span>Status</span><span>Date</span><span>Paid / Total</span><span />
          </div>

          {filtered.map((p, i) => {
            const cfg = STATUS_CONFIG[p.status];
            const remaining = Number(p.total_value) - Number(p.amount_paid);
            return (
              <Link
                key={p.id}
                to={`/crm/projects/${p.id}`}
                style={{
                  display: 'grid', gridTemplateColumns: '2fr 1.5fr 1fr 1.2fr 100px', padding: '14px 20px',
                  borderBottom: i < filtered.length - 1 ? '1px solid #1a1a1a' : 'none', alignItems: 'center',
                  textDecoration: 'none',
                }}
              >
                <div>
                  <div style={{ color: '#ddd', fontSize: 14 }}>{p.name}</div>
                  <div style={{ color: '#555', fontSize: 12, marginTop: 2 }}>{clientsById[p.client_id]?.name ?? 'Unknown'}</div>
                </div>
                <span style={{
                  display: 'inline-block', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                  background: `${cfg.color}22`, color: cfg.color, width: 'fit-content',
                }}>
                  {cfg.label}
                </span>
                <span style={{ color: '#444', fontSize: 13 }}>{formatDate(p.created_at)}</span>
                <div>
                  <div style={{ color: '#aaa', fontSize: 13.5 }}>{formatMoney(Number(p.amount_paid), p.currency)} / {formatMoney(Number(p.total_value), p.currency)}</div>
                  {remaining > 0 && <div style={{ color: '#f59e0b', fontSize: 11.5, marginTop: 2 }}>{formatMoney(remaining, p.currency)} due</div>}
                </div>
                <span style={{ color: '#888', fontSize: 13, justifySelf: 'end' }}>View →</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Projects;
