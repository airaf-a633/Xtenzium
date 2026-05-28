import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import type { Lead, LeadStatus } from '../../../types/database';

const STATUS_OPTIONS: Array<{ value: LeadStatus; label: string; color: string }> = [
  { value: 'new', label: 'New', color: '#3b82f6' },
  { value: 'contacted', label: 'Contacted', color: '#f59e0b' },
  { value: 'qualified', label: 'Qualified', color: '#10b981' },
  { value: 'closed', label: 'Closed', color: '#6b7280' },
];

const LeadDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<LeadStatus>('new');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!id) return;
    const fetchLead = async () => {
      const { data } = await supabase.from('leads').select('*').eq('id', id).single();
      if (data) {
        setLead(data);
        setStatus(data.status);
        setNotes(data.notes ?? '');
      }
      setLoading(false);
    };
    fetchLead();
  }, [id]);

  const handleSave = async () => {
    if (!id) return;
    setSaving(true);
    await supabase.from('leads').update({ status, notes }).eq('id', id);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
    // Update local state
    setLead(prev => prev ? { ...prev, status, notes } : null);
  };

  const formatDate = (iso: string) => new Date(iso).toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  const currentStatus = STATUS_OPTIONS.find(s => s.value === status)!;

  if (loading) {
    return <div style={{ color: '#555', fontSize: 14 }}>Loading…</div>;
  }

  if (!lead) {
    return (
      <div style={{ textAlign: 'center', padding: '64px 0' }}>
        <div style={{ color: '#555', fontSize: 16, marginBottom: 16 }}>Lead not found.</div>
        <Link to="/admin/leads" style={{ color: '#888', fontSize: 14 }}>← Back to leads</Link>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 720 }}>
      {/* Back */}
      <Link
        to="/admin/leads"
        style={{ color: '#555', fontSize: 14, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 24 }}
        onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = '#aaa')}
        onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = '#555')}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        Back to leads
      </Link>

      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        marginBottom: 32,
        flexWrap: 'wrap',
        gap: 16,
      }}>
        <div>
          <h1 style={{ color: '#ffffff', fontSize: 24, fontWeight: 700, margin: '0 0 6px', letterSpacing: -0.5 }}>
            {lead.name}
          </h1>
          <p style={{ color: '#555', fontSize: 14, margin: 0 }}>{formatDate(lead.created_at)}</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            padding: '10px 20px',
            background: saved ? '#10b981' : '#ffffff',
            color: saved ? '#ffffff' : '#0a0a0a',
            border: 'none',
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 600,
            cursor: saving ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s',
          }}
        >
          {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save changes'}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        {/* Contact info */}
        <div style={{ background: '#141414', border: '1px solid #1e1e1e', borderRadius: 12, padding: 24 }}>
          <h2 style={{ color: '#888', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, margin: '0 0 16px' }}>
            Contact Info
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <div style={{ color: '#444', fontSize: 11, marginBottom: 4 }}>Email</div>
              <a href={`mailto:${lead.email}`} style={{ color: '#aaa', fontSize: 14, textDecoration: 'none' }}>
                {lead.email}
              </a>
            </div>
            {lead.company && (
              <div>
                <div style={{ color: '#444', fontSize: 11, marginBottom: 4 }}>Company</div>
                <div style={{ color: '#aaa', fontSize: 14 }}>{lead.company}</div>
              </div>
            )}
          </div>
        </div>

        {/* Status */}
        <div style={{ background: '#141414', border: '1px solid #1e1e1e', borderRadius: 12, padding: 24 }}>
          <h2 style={{ color: '#888', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, margin: '0 0 16px' }}>
            Status
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {STATUS_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setStatus(opt.value)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 14px',
                  borderRadius: 8,
                  border: `1px solid ${status === opt.value ? opt.color + '66' : '#1e1e1e'}`,
                  background: status === opt.value ? `${opt.color}11` : 'transparent',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  textAlign: 'left',
                }}
              >
                <span style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: opt.color, flexShrink: 0,
                }} />
                <span style={{
                  color: status === opt.value ? opt.color : '#666',
                  fontSize: 14,
                  fontWeight: status === opt.value ? 600 : 400,
                }}>
                  {opt.label}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Message */}
      <div style={{ background: '#141414', border: '1px solid #1e1e1e', borderRadius: 12, padding: 24, marginBottom: 16 }}>
        <h2 style={{ color: '#888', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, margin: '0 0 16px' }}>
          Message
        </h2>
        <p style={{ color: '#aaa', fontSize: 14, lineHeight: 1.7, margin: 0, whiteSpace: 'pre-wrap' }}>
          {lead.message}
        </p>
      </div>

      {/* Notes */}
      <div style={{ background: '#141414', border: '1px solid #1e1e1e', borderRadius: 12, padding: 24 }}>
        <h2 style={{ color: '#888', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, margin: '0 0 12px' }}>
          Internal Notes
        </h2>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Add notes, action items, next steps…"
          rows={6}
          style={{
            width: '100%',
            padding: '12px',
            background: '#0f0f0f',
            border: '1px solid #222',
            borderRadius: 8,
            color: '#ddd',
            fontSize: 14,
            lineHeight: 1.6,
            resize: 'vertical',
            outline: 'none',
            fontFamily: 'inherit',
            boxSizing: 'border-box',
            transition: 'border-color 0.2s',
          }}
          onFocus={e => (e.target.style.borderColor = '#444')}
          onBlur={e => (e.target.style.borderColor = '#222')}
        />
      </div>

      {/* Delete */}
      <div style={{ marginTop: 24, paddingTop: 24, borderTop: '1px solid #1a1a1a' }}>
        <button
          onClick={async () => {
            if (!confirm('Delete this lead permanently?')) return;
            await supabase.from('leads').delete().eq('id', id!);
            navigate('/admin/leads');
          }}
          style={{
            padding: '8px 16px',
            background: 'transparent',
            border: '1px solid #2a1a1a',
            borderRadius: 8,
            color: '#9b4545',
            fontSize: 13,
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.borderColor = '#7f1d1d';
            (e.currentTarget as HTMLElement).style.color = '#ef4444';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.borderColor = '#2a1a1a';
            (e.currentTarget as HTMLElement).style.color = '#9b4545';
          }}
        >
          Delete lead
        </button>
      </div>
    </div>
  );
};

export default LeadDetail;
