import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import type { Lead, LeadStatus } from '../../../types/database';

const STATUS_CONFIG: Record<LeadStatus, { label: string; color: string }> = {
  new: { label: 'New', color: '#3b82f6' },
  contacted: { label: 'Contacted', color: '#f59e0b' },
  qualified: { label: 'Qualified', color: '#10b981' },
  closed: { label: 'Closed', color: '#6b7280' },
};

const FILTERS: Array<{ value: LeadStatus | 'all'; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'qualified', label: 'Qualified' },
  { value: 'closed', label: 'Closed' },
];

const Leads = () => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [filter, setFilter] = useState<LeadStatus | 'all'>('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLeads = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false });
      setLeads(data ?? []);
      setLoading(false);
    };
    fetchLeads();
  }, []);

  const filtered = leads.filter(lead => {
    const matchesFilter = filter === 'all' || lead.status === filter;
    const q = search.toLowerCase();
    const matchesSearch = !q || [lead.name, lead.email, lead.company ?? ''].some(v =>
      v.toLowerCase().includes(q)
    );
    return matchesFilter && matchesSearch;
  });

  const formatDate = (iso: string) => new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ color: '#ffffff', fontSize: 24, fontWeight: 700, margin: 0, letterSpacing: -0.5 }}>
          Leads
        </h1>
        <p style={{ color: '#555', fontSize: 14, marginTop: 6 }}>
          {leads.length} total · {leads.filter(l => l.status === 'new').length} new
        </p>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: '1', minWidth: 200 }}>
          <svg
            width="14" height="14"
            viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2"
            style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Search by name, email, company…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 14px 10px 36px',
              background: '#141414',
              border: '1px solid #1e1e1e',
              borderRadius: 8,
              color: '#ffffff',
              fontSize: 14,
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Status filters */}
        <div style={{ display: 'flex', gap: 6 }}>
          {FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              style={{
                padding: '8px 14px',
                borderRadius: 8,
                border: '1px solid',
                borderColor: filter === f.value ? '#444' : '#1e1e1e',
                background: filter === f.value ? '#1e1e1e' : 'transparent',
                color: filter === f.value ? '#ffffff' : '#666',
                fontSize: 13,
                fontWeight: filter === f.value ? 600 : 400,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {f.label}
              {f.value !== 'all' && (
                <span style={{ marginLeft: 6, color: '#444', fontWeight: 400 }}>
                  {leads.filter(l => l.status === f.value).length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ color: '#555', fontSize: 14, padding: '32px 0' }}>Loading leads…</div>
      ) : filtered.length === 0 ? (
        <div style={{
          background: '#141414',
          border: '1px solid #1e1e1e',
          borderRadius: 12,
          padding: '48px 32px',
          textAlign: 'center',
          color: '#444',
          fontSize: 14,
        }}>
          {search || filter !== 'all' ? 'No leads match your filters.' : 'No leads yet.'}
        </div>
      ) : (
        <div style={{
          background: '#141414',
          border: '1px solid #1e1e1e',
          borderRadius: 12,
          overflow: 'hidden',
        }}>
          {/* Table header */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '2fr 2fr 1fr 1fr 120px',
            padding: '10px 20px',
            borderBottom: '1px solid #1a1a1a',
            color: '#444',
            fontSize: 12,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
          }}>
            <span>Name</span>
            <span>Email / Company</span>
            <span>Status</span>
            <span>Date</span>
            <span />
          </div>

          {filtered.map((lead, i) => {
            const cfg = STATUS_CONFIG[lead.status];
            return (
              <div
                key={lead.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '2fr 2fr 1fr 1fr 120px',
                  padding: '14px 20px',
                  borderBottom: i < filtered.length - 1 ? '1px solid #1a1a1a' : 'none',
                  alignItems: 'center',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%',
                    background: '#1e1e1e',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#aaa', fontSize: 13, fontWeight: 600, flexShrink: 0,
                  }}>
                    {lead.name.charAt(0).toUpperCase()}
                  </div>
                  <span style={{ color: '#ddd', fontSize: 14 }}>{lead.name}</span>
                </div>

                <div>
                  <div style={{ color: '#aaa', fontSize: 14 }}>{lead.email}</div>
                  {lead.company && (
                    <div style={{ color: '#444', fontSize: 12, marginTop: 2 }}>{lead.company}</div>
                  )}
                </div>

                <span style={{
                  display: 'inline-block',
                  padding: '3px 10px',
                  borderRadius: 20,
                  fontSize: 11,
                  fontWeight: 600,
                  background: `${cfg.color}22`,
                  color: cfg.color,
                  textTransform: 'capitalize',
                  width: 'fit-content',
                }}>
                  {cfg.label}
                </span>

                <span style={{ color: '#444', fontSize: 13 }}>{formatDate(lead.created_at)}</span>

                <Link
                  to={`/admin/leads/${lead.id}`}
                  style={{
                    display: 'inline-block',
                    padding: '6px 14px',
                    border: '1px solid #2a2a2a',
                    borderRadius: 6,
                    color: '#888',
                    fontSize: 13,
                    textDecoration: 'none',
                    transition: 'all 0.15s',
                    width: 'fit-content',
                    justifySelf: 'end',
                  }}
                  onMouseEnter={e => {
                    const el = e.currentTarget as HTMLElement;
                    el.style.borderColor = '#444';
                    el.style.color = '#fff';
                  }}
                  onMouseLeave={e => {
                    const el = e.currentTarget as HTMLElement;
                    el.style.borderColor = '#2a2a2a';
                    el.style.color = '#888';
                  }}
                >
                  View
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Leads;
