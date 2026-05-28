import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Link } from 'react-router-dom';

interface Stats {
  totalLeads: number;
  newLeads: number;
  qualifiedLeads: number;
  publishedBlogs: number;
  draftBlogs: number;
}

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
  <div style={{
    background: '#141414',
    border: '1px solid #1e1e1e',
    borderRadius: 12,
    padding: '24px',
  }}>
    <div style={{ color: '#555', fontSize: 13, fontWeight: 500, marginBottom: 12 }}>{label}</div>
    <div style={{ color, fontSize: 32, fontWeight: 700, letterSpacing: -1, lineHeight: 1 }}>
      {value}
    </div>
    {sub && <div style={{ color: '#444', fontSize: 12, marginTop: 8 }}>{sub}</div>}
  </div>
);

const Dashboard = () => {
  const [stats, setStats] = useState<Stats>({
    totalLeads: 0,
    newLeads: 0,
    qualifiedLeads: 0,
    publishedBlogs: 0,
    draftBlogs: 0,
  });
  const [loading, setLoading] = useState(true);
  const [recentLeads, setRecentLeads] = useState<Array<{
    id: string;
    name: string;
    email: string;
    company: string | null;
    status: string;
    created_at: string;
  }>>([]);

  useEffect(() => {
    const fetchStats = async () => {
      const [leadsResult, blogsResult, recentResult] = await Promise.all([
        supabase.from('leads').select('status'),
        supabase.from('blogs').select('status'),
        supabase.from('leads').select('id, name, email, company, status, created_at').order('created_at', { ascending: false }).limit(5),
      ]);

      const leads = leadsResult.data ?? [];
      const blogs = blogsResult.data ?? [];

      setStats({
        totalLeads: leads.length,
        newLeads: leads.filter(l => l.status === 'new').length,
        qualifiedLeads: leads.filter(l => l.status === 'qualified').length,
        publishedBlogs: blogs.filter(b => b.status === 'published').length,
        draftBlogs: blogs.filter(b => b.status === 'draft').length,
      });

      setRecentLeads(recentResult.data ?? []);
      setLoading(false);
    };

    fetchStats();
  }, []);

  const STATUS_COLORS: Record<string, string> = {
    new: '#3b82f6',
    contacted: '#f59e0b',
    qualified: '#10b981',
    closed: '#6b7280',
  };

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ color: '#ffffff', fontSize: 24, fontWeight: 700, margin: 0, letterSpacing: -0.5 }}>
          Dashboard
        </h1>
        <p style={{ color: '#555', fontSize: 14, marginTop: 6 }}>
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {loading ? (
        <div style={{ color: '#555', fontSize: 14 }}>Loading…</div>
      ) : (
        <>
          {/* Stats grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: 16,
            marginBottom: 40,
          }}>
            <StatCard label="Total Leads" value={stats.totalLeads} />
            <StatCard label="New Leads" value={stats.newLeads} color="#3b82f6" sub="Awaiting action" />
            <StatCard label="Qualified" value={stats.qualifiedLeads} color="#10b981" sub="Ready to close" />
            <StatCard label="Published Posts" value={stats.publishedBlogs} color="#a78bfa" />
            <StatCard label="Drafts" value={stats.draftBlogs} color="#555" sub="In progress" />
          </div>

          {/* Recent leads */}
          <div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 16,
            }}>
              <h2 style={{ color: '#ffffff', fontSize: 16, fontWeight: 600, margin: 0 }}>Recent Leads</h2>
              <Link
                to="/admin/leads"
                style={{ color: '#666', fontSize: 13, textDecoration: 'none' }}
                onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = '#aaa')}
                onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = '#666')}
              >
                View all →
              </Link>
            </div>

            {recentLeads.length === 0 ? (
              <div style={{
                background: '#141414',
                border: '1px solid #1e1e1e',
                borderRadius: 12,
                padding: '32px',
                textAlign: 'center',
                color: '#444',
                fontSize: 14,
              }}>
                No leads yet. Add the contact form to your homepage to start capturing.
              </div>
            ) : (
              <div style={{
                background: '#141414',
                border: '1px solid #1e1e1e',
                borderRadius: 12,
                overflow: 'hidden',
              }}>
                {recentLeads.map((lead, i) => (
                  <Link
                    key={lead.id}
                    to={`/admin/leads/${lead.id}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 16,
                      padding: '14px 20px',
                      borderBottom: i < recentLeads.length - 1 ? '1px solid #1a1a1a' : 'none',
                      textDecoration: 'none',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)')}
                    onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
                  >
                    <div style={{
                      width: 36,
                      height: 36,
                      borderRadius: '50%',
                      background: '#1e1e1e',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#aaa',
                      fontSize: 14,
                      fontWeight: 600,
                      flexShrink: 0,
                    }}>
                      {lead.name.charAt(0).toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ color: '#ddd', fontSize: 14, fontWeight: 500 }}>{lead.name}</div>
                      <div style={{ color: '#555', fontSize: 12, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {lead.company || lead.email}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '3px 10px',
                        borderRadius: 20,
                        fontSize: 11,
                        fontWeight: 600,
                        background: `${STATUS_COLORS[lead.status]}22`,
                        color: STATUS_COLORS[lead.status],
                        textTransform: 'capitalize',
                      }}>
                        {lead.status}
                      </span>
                      <span style={{ color: '#444', fontSize: 12, flexShrink: 0 }}>
                        {formatDate(lead.created_at)}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default Dashboard;
