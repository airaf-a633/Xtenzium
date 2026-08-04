import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { DEFAULT_USD_TO_PKR } from '../../../lib/settings';
import Banner from '../../../components/crm/Banner';
import type { TeamMember } from '../../../types/database';

const inputStyle: React.CSSProperties = {
  padding: '10px 12px', background: '#0f0f0f', border: '1px solid #222', borderRadius: 8,
  color: '#ddd', fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
};
const labelStyle: React.CSSProperties = { display: 'block', color: '#666', fontSize: 12, marginBottom: 6, fontWeight: 500 };
const cardStyle: React.CSSProperties = { background: '#141414', border: '1px solid #1e1e1e', borderRadius: 12, padding: 24 };

const Team = () => {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [designation, setDesignation] = useState('');
  const [adding, setAdding] = useState(false);

  const [rateInput, setRateInput] = useState(String(DEFAULT_USD_TO_PKR));
  const [rateSaving, setRateSaving] = useState(false);
  const [rateSaved, setRateSaved] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [membersResult, settingResult] = await Promise.all([
        supabase.from('team_members').select('*').order('name', { ascending: true }),
        supabase.from('app_settings').select('value').eq('key', 'usd_to_pkr').maybeSingle(),
      ]);
      if (membersResult.error) setError(membersResult.error.message);
      setMembers((membersResult.data ?? []) as TeamMember[]);
      if (settingResult.data) setRateInput(settingResult.data.value);
      setLoading(false);
    };
    load();
  }, []);

  const handleAddMember = async () => {
    if (!name.trim()) return;
    setAdding(true);
    setError(null);
    const { data, error: insertError } = await supabase
      .from('team_members')
      .insert({ name: name.trim(), designation: designation.trim() || null })
      .select()
      .single();
    setAdding(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setMembers(prev => [...prev, data as TeamMember].sort((a, b) => a.name.localeCompare(b.name)));
    setName('');
    setDesignation('');
  };

  const handleRemoveMember = async (member: TeamMember) => {
    if (!confirm(`Remove ${member.name} from the team? Tasks assigned to them will become unassigned.`)) return;
    setError(null);
    const { error: deleteError } = await supabase.from('team_members').delete().eq('id', member.id);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    setMembers(prev => prev.filter(m => m.id !== member.id));
  };

  const handleSaveRate = async () => {
    const value = Number(rateInput);
    if (!Number.isFinite(value) || value <= 0) {
      setError('Exchange rate must be a positive number.');
      return;
    }
    setRateSaving(true);
    setError(null);
    const { error: upsertError } = await supabase
      .from('app_settings')
      .upsert({ key: 'usd_to_pkr', value: String(value) });
    setRateSaving(false);
    if (upsertError) {
      setError(upsertError.message);
      return;
    }
    setRateSaved(true);
    setTimeout(() => setRateSaved(false), 2000);
  };

  return (
    <div style={{ maxWidth: 720 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ color: '#ffffff', fontSize: 24, fontWeight: 700, margin: 0, letterSpacing: -0.5 }}>Team & Settings</h1>
        <p style={{ color: '#555', fontSize: 14, marginTop: 6 }}>Manage who tasks can be assigned to, and the exchange rate used for USD totals.</p>
      </div>

      {error && <Banner type="error" message={error} />}

      {/* Exchange rate */}
      <div style={{ ...cardStyle, marginBottom: 20 }}>
        <h2 style={{ color: '#888', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, margin: '0 0 16px' }}>
          Exchange Rate
        </h2>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10 }}>
          <div>
            <label style={labelStyle}>1 USD equals (PKR)</label>
            <input
              style={{ ...inputStyle, width: 140 }}
              type="number"
              min="1"
              value={rateInput}
              onChange={e => setRateInput(e.target.value)}
            />
          </div>
          <button
            onClick={handleSaveRate}
            disabled={rateSaving}
            style={{
              padding: '10px 18px', background: rateSaved ? '#10b981' : '#1e1e1e', color: rateSaved ? '#fff' : '#ddd',
              border: 'none', borderRadius: 8, fontSize: 13.5, fontWeight: 600, cursor: rateSaving ? 'not-allowed' : 'pointer',
            }}
          >
            {rateSaving ? 'Saving…' : rateSaved ? '✓ Saved' : 'Save rate'}
          </button>
        </div>
        <p style={{ color: '#444', fontSize: 12, marginTop: 10 }}>
          Used to combine PKR and USD project totals into a single figure on the dashboard and client pages.
        </p>
      </div>

      {/* Team members */}
      <div style={cardStyle}>
        <h2 style={{ color: '#888', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, margin: '0 0 16px' }}>
          Team Members
        </h2>

        <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
          <input
            style={{ ...inputStyle, flex: '1 1 160px' }}
            placeholder="Name"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAddMember()}
          />
          <input
            style={{ ...inputStyle, flex: '1 1 160px' }}
            placeholder="Designation (e.g. Developer)"
            value={designation}
            onChange={e => setDesignation(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAddMember()}
          />
          <button
            onClick={handleAddMember}
            disabled={adding || !name.trim()}
            style={{
              padding: '10px 18px', background: '#ffffff', color: '#0a0a0a', border: 'none', borderRadius: 8,
              fontSize: 13.5, fontWeight: 600, cursor: (adding || !name.trim()) ? 'not-allowed' : 'pointer',
            }}
          >
            + Add member
          </button>
        </div>

        {loading ? (
          <div style={{ color: '#555', fontSize: 14 }}>Loading…</div>
        ) : members.length === 0 ? (
          <div style={{ color: '#444', fontSize: 13.5, textAlign: 'center', padding: '24px 0' }}>
            No team members yet. Add your first one above.
          </div>
        ) : (
          <div>
            {members.map((m, i) => (
              <div key={m.id} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0',
                borderBottom: i < members.length - 1 ? '1px solid #1a1a1a' : 'none',
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%', background: '#1e1e1e',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#aaa', fontSize: 13, fontWeight: 600, flexShrink: 0,
                }}>
                  {m.name.charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ color: '#ddd', fontSize: 14 }}>{m.name}</div>
                  {m.designation && <div style={{ color: '#555', fontSize: 12, marginTop: 2 }}>{m.designation}</div>}
                </div>
                <button
                  onClick={() => handleRemoveMember(m)}
                  style={{ background: 'none', border: 'none', color: '#444', cursor: 'pointer', padding: 4 }}
                  title="Remove member"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Team;
