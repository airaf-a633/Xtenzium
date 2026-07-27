import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import Banner from '../../../components/crm/Banner';
import type { Client, Project, ProjectStatus } from '../../../types/database';

interface FormState {
  name: string;
  company: string;
  email: string;
  phone: string;
  notes: string;
}

const INITIAL: FormState = { name: '', company: '', email: '', phone: '', notes: '' };

const STATUS_COLORS: Record<ProjectStatus, string> = {
  proposal: '#3b82f6', active: '#10b981', on_hold: '#f59e0b', completed: '#6b7280', cancelled: '#ef4444',
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', background: '#0f0f0f', border: '1px solid #222',
  borderRadius: 8, color: '#ddd', fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
};

const labelStyle: React.CSSProperties = { display: 'block', color: '#666', fontSize: 12, marginBottom: 6, fontWeight: 500 };

const ClientDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = !id || id === 'new';

  const [form, setForm] = useState<FormState>(INITIAL);
  const [client, setClient] = useState<Client | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (isNew) return;
    const fetchClient = async () => {
      setLoading(true);
      const [clientResult, projectsResult] = await Promise.all([
        supabase.from('clients').select('*').eq('id', id).single(),
        supabase.from('projects').select('*').eq('client_id', id).order('created_at', { ascending: false }),
      ]);
      if (clientResult.error) {
        setError(clientResult.error.message);
      } else if (clientResult.data) {
        const c = clientResult.data as Client;
        setClient(c);
        setForm({
          name: c.name, company: c.company ?? '', email: c.email ?? '',
          phone: c.phone ?? '', notes: c.notes ?? '',
        });
      }
      setProjects((projectsResult.data ?? []) as Project[]);
      setLoading(false);
    };
    fetchClient();
  }, [id, isNew]);

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    setError(null);
    const payload = {
      name: form.name.trim(),
      company: form.company.trim() || null,
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      notes: form.notes.trim() || null,
    };

    if (isNew) {
      const { data, error: insertError } = await supabase.from('clients').insert(payload).select().single();
      setSaving(false);
      if (insertError) {
        setError(insertError.message);
      } else if (data) {
        navigate(`/crm/clients/${(data as Client).id}`, { replace: true });
      }
    } else {
      const { error: updateError } = await supabase.from('clients').update(payload).eq('id', id!);
      setSaving(false);
      if (updateError) {
        setError(updateError.message);
        return;
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      setClient(prev => prev ? { ...prev, ...payload } : null);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Delete this client and all their projects, tasks, and notes? This cannot be undone.')) return;
    setDeleting(true);
    setError(null);
    const { error: deleteError } = await supabase.from('clients').delete().eq('id', id!);
    if (deleteError) {
      setError(deleteError.message);
      setDeleting(false);
      return;
    }
    navigate('/crm/clients');
  };

  const formatDate = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const formatMoney = (n: number, currency = 'PKR') => `${currency} ${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

  if (loading) return <div style={{ color: '#555', fontSize: 14 }}>Loading…</div>;

  if (!isNew && !client) {
    return (
      <div style={{ textAlign: 'center', padding: '64px 0' }}>
        <div style={{ color: '#555', fontSize: 16, marginBottom: 16 }}>Client not found.</div>
        <Link to="/crm/clients" style={{ color: '#888', fontSize: 14 }}>← Back to clients</Link>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 760 }}>
      <Link
        to="/crm/clients"
        style={{ color: '#555', fontSize: 14, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 24 }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        Back to clients
      </Link>

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <h1 style={{ color: '#ffffff', fontSize: 24, fontWeight: 700, margin: 0, letterSpacing: -0.5 }}>
          {isNew ? 'New Client' : client!.name}
        </h1>
        <button
          onClick={handleSave}
          disabled={saving || !form.name.trim()}
          style={{
            padding: '10px 20px', background: saved ? '#10b981' : '#ffffff',
            color: saved ? '#ffffff' : '#0a0a0a', border: 'none', borderRadius: 8,
            fontSize: 14, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer',
          }}
        >
          {saving ? 'Saving…' : saved ? '✓ Saved' : isNew ? 'Create client' : 'Save changes'}
        </button>
      </div>

      {error && <Banner type="error" message={error} />}

      <div style={{ background: '#141414', border: '1px solid #1e1e1e', borderRadius: 12, padding: 24, marginBottom: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <label style={labelStyle}>Full name *</label>
            <input style={inputStyle} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Jane Doe" />
          </div>
          <div>
            <label style={labelStyle}>Company</label>
            <input style={inputStyle} value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} placeholder="Acme Inc." />
          </div>
          <div>
            <label style={labelStyle}>Email</label>
            <input style={inputStyle} type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="jane@acme.com" />
          </div>
          <div>
            <label style={labelStyle}>Phone</label>
            <input style={inputStyle} value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="+92 300 1234567" />
          </div>
        </div>
        <div style={{ marginTop: 16 }}>
          <label style={labelStyle}>Notes</label>
          <textarea
            style={{ ...inputStyle, resize: 'vertical' }}
            rows={4}
            value={form.notes}
            onChange={e => setForm({ ...form, notes: e.target.value })}
            placeholder="Context, preferences, how they found us…"
          />
        </div>
        {client?.lead_id && (
          <div style={{ marginTop: 16, fontSize: 12, color: '#555' }}>
            Converted from a lead — <Link to={`/admin/leads/${client.lead_id}`} style={{ color: '#888' }}>view original lead</Link>
          </div>
        )}
      </div>

      {!isNew && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h2 style={{ color: '#ffffff', fontSize: 16, fontWeight: 600, margin: 0 }}>Projects</h2>
            <Link
              to={`/crm/projects/new?client_id=${id}`}
              style={{ padding: '7px 14px', background: '#1e1e1e', color: '#ddd', borderRadius: 7, fontSize: 13, textDecoration: 'none' }}
            >
              + New Project
            </Link>
          </div>

          {projects.length === 0 ? (
            <div style={{ background: '#141414', border: '1px solid #1e1e1e', borderRadius: 12, padding: '32px', textAlign: 'center', color: '#444', fontSize: 14, marginBottom: 24 }}>
              No projects yet for this client.
            </div>
          ) : (
            <div style={{ background: '#141414', border: '1px solid #1e1e1e', borderRadius: 12, overflow: 'hidden', marginBottom: 24 }}>
              {projects.map((p, i) => (
                <Link
                  key={p.id}
                  to={`/crm/projects/${p.id}`}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 16, padding: '14px 20px',
                    borderBottom: i < projects.length - 1 ? '1px solid #1a1a1a' : 'none',
                    textDecoration: 'none',
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ color: '#ddd', fontSize: 14, fontWeight: 500 }}>{p.name}</div>
                    <div style={{ color: '#555', fontSize: 12, marginTop: 2 }}>{formatDate(p.created_at)}</div>
                  </div>
                  <span style={{
                    display: 'inline-block', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                    background: `${STATUS_COLORS[p.status]}22`, color: STATUS_COLORS[p.status], textTransform: 'capitalize',
                  }}>
                    {p.status.replace('_', ' ')}
                  </span>
                  <span style={{ color: '#888', fontSize: 13, minWidth: 100, textAlign: 'right' }}>
                    {formatMoney(Number(p.amount_paid), p.currency)} / {formatMoney(Number(p.total_value), p.currency)}
                  </span>
                </Link>
              ))}
            </div>
          )}

          <div style={{ paddingTop: 8, borderTop: '1px solid #1a1a1a' }}>
            <button
              onClick={handleDelete}
              disabled={deleting}
              style={{
                padding: '8px 16px', background: 'transparent', border: '1px solid #2a1a1a', borderRadius: 8,
                color: '#9b4545', fontSize: 13, cursor: deleting ? 'not-allowed' : 'pointer',
              }}
            >
              {deleting ? 'Deleting…' : 'Delete client'}
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default ClientDetail;
