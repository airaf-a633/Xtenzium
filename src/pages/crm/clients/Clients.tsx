import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import type { Client, Project } from '../../../types/database';

const Clients = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [projectCounts, setProjectCounts] = useState<Record<string, number>>({});
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchClients = async () => {
      setLoading(true);
      const [clientsResult, projectsResult] = await Promise.all([
        supabase.from('clients').select('*').order('created_at', { ascending: false }),
        supabase.from('projects').select('client_id'),
      ]);
      setClients((clientsResult.data ?? []) as Client[]);

      const counts: Record<string, number> = {};
      ((projectsResult.data ?? []) as Pick<Project, 'client_id'>[]).forEach(p => {
        counts[p.client_id] = (counts[p.client_id] ?? 0) + 1;
      });
      setProjectCounts(counts);
      setLoading(false);
    };
    fetchClients();
  }, []);

  const filtered = clients.filter(c => {
    const q = search.toLowerCase();
    if (!q) return true;
    return [c.name, c.company ?? '', c.email ?? ''].some(v => v.toLowerCase().includes(q));
  });

  const formatDate = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ color: '#ffffff', fontSize: 24, fontWeight: 700, margin: 0, letterSpacing: -0.5 }}>Clients</h1>
          <p style={{ color: '#555', fontSize: 14, marginTop: 6 }}>{clients.length} total</p>
        </div>
        <Link
          to="/crm/clients/new"
          style={{
            padding: '10px 18px', background: '#ffffff', color: '#0a0a0a', borderRadius: 8,
            fontSize: 14, fontWeight: 600, textDecoration: 'none',
          }}
        >
          + New Client
        </Link>
      </div>

      <div style={{ position: 'relative', marginBottom: 20, maxWidth: 360 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2"
          style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}>
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="text"
          placeholder="Search by name, company, email…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            width: '100%', padding: '10px 14px 10px 36px', background: '#141414',
            border: '1px solid #1e1e1e', borderRadius: 8, color: '#ffffff', fontSize: 14,
            outline: 'none', boxSizing: 'border-box',
          }}
        />
      </div>

      {loading ? (
        <div style={{ color: '#555', fontSize: 14, padding: '32px 0' }}>Loading clients…</div>
      ) : filtered.length === 0 ? (
        <div style={{ background: '#141414', border: '1px solid #1e1e1e', borderRadius: 12, padding: '48px 32px', textAlign: 'center', color: '#444', fontSize: 14 }}>
          {search ? 'No clients match your search.' : 'No clients yet. Add one, or convert a qualified lead from /admin/leads.'}
        </div>
      ) : (
        <div style={{ background: '#141414', border: '1px solid #1e1e1e', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{
            display: 'grid', gridTemplateColumns: '2fr 2fr 1fr 1fr 120px', padding: '10px 20px',
            borderBottom: '1px solid #1a1a1a', color: '#444', fontSize: 12, fontWeight: 600,
            textTransform: 'uppercase', letterSpacing: 0.5,
          }}>
            <span>Name</span><span>Email / Company</span><span>Projects</span><span>Added</span><span />
          </div>

          {filtered.map((c, i) => (
            <div key={c.id} style={{
              display: 'grid', gridTemplateColumns: '2fr 2fr 1fr 1fr 120px', padding: '14px 20px',
              borderBottom: i < filtered.length - 1 ? '1px solid #1a1a1a' : 'none', alignItems: 'center',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%', background: '#1e1e1e',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#aaa', fontSize: 13, fontWeight: 600, flexShrink: 0,
                }}>
                  {c.name.charAt(0).toUpperCase()}
                </div>
                <span style={{ color: '#ddd', fontSize: 14 }}>{c.name}</span>
              </div>
              <div>
                <div style={{ color: '#aaa', fontSize: 14 }}>{c.email ?? '—'}</div>
                {c.company && <div style={{ color: '#444', fontSize: 12, marginTop: 2 }}>{c.company}</div>}
              </div>
              <span style={{ color: '#888', fontSize: 14 }}>{projectCounts[c.id] ?? 0}</span>
              <span style={{ color: '#444', fontSize: 13 }}>{formatDate(c.created_at)}</span>
              <Link
                to={`/crm/clients/${c.id}`}
                style={{
                  display: 'inline-block', padding: '6px 14px', border: '1px solid #2a2a2a', borderRadius: 6,
                  color: '#888', fontSize: 13, textDecoration: 'none', width: 'fit-content', justifySelf: 'end',
                }}
              >
                View
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Clients;
