import { useState } from 'react';
import { supabase } from '../../../lib/supabase';
import type { CallList } from '../../../types/database';
import { Button, Card, CardHeader, Input, Select, useToast } from '../../../components/crm/ui';

const FROM = [
  { value: '*', label: 'Every lead' },
  { value: 'A', label: 'Tier A' },
  { value: 'B', label: 'Tier B' },
  { value: 'C', label: 'Tier C' },
  { value: '-', label: 'Leads with no tier' },
];
const TO = [
  { value: 'A', label: 'Tier A' },
  { value: 'B', label: 'Tier B' },
  { value: 'C', label: 'Tier C' },
  { value: '-', label: 'No tier' },
];

/* Fixing tiers after the fact — the file used different names, or the
   thresholds turned out wrong. Two ways: move one tier to another, or
   recompute every tier from the score. Admin only (the database says so
   too); applies to one list at a time. */
const RetierTool = ({ lists }: { lists: CallList[] }) => {
  const { toast } = useToast();
  const [listId, setListId] = useState('');
  const [from, setFrom] = useState('*');
  const [to, setTo] = useState('A');
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const [busy, setBusy] = useState(false);

  if (lists.length === 0) return null;
  const chosen = listId || lists[0].id;
  const name = lists.find(l => l.id === chosen)?.name ?? 'this list';

  const move = async () => {
    if (!confirm(`Change tiers in “${name}”?`)) return;
    setBusy(true);
    const { data, error } = await supabase.rpc('retier_leads', { p_list_id: chosen, p_from: from, p_to: to });
    setBusy(false);
    if (error) return toast(error.message, 'danger');
    toast(`${(data ?? 0).toLocaleString()} leads updated`, 'success');
  };

  const byScore = async () => {
    const na = Number(a);
    const nb = Number(b);
    if (!Number.isFinite(na) || !Number.isFinite(nb) || a === '' || b === '') return toast('Enter both score thresholds.', 'danger');
    if (na < nb) return toast('The A threshold must be at least the B threshold.', 'danger');
    if (!confirm(`Set every tier in “${name}” from its score (A ≥ ${na}, B ≥ ${nb}, otherwise C)? Leads with no score are left alone.`)) return;
    setBusy(true);
    const { data, error } = await supabase.rpc('retier_by_score', { p_list_id: chosen, p_a: na, p_b: nb });
    setBusy(false);
    if (error) return toast(error.message, 'danger');
    toast(`${(data ?? 0).toLocaleString()} leads re-tiered`, 'success');
  };

  return (
    <Card>
      <CardHeader title="Change tiers (admin)" />
      <div className="flex flex-col gap-4 p-4">
        <Select
          className="max-w-[420px]"
          label="List"
          value={chosen}
          options={lists.map(l => ({ value: l.id, label: l.name }))}
          onChange={e => setListId(e.target.value)}
        />

        <div>
          <p className="m-0 mb-2 text-[13px] font-medium text-crm-ink">Move one tier to another</p>
          <div className="flex flex-wrap items-end gap-2">
            <Select className="w-[200px]" label="From" value={from} options={FROM} onChange={e => setFrom(e.target.value)} />
            <Select className="w-[160px]" label="To" value={to} options={TO} onChange={e => setTo(e.target.value)} />
            <Button loading={busy} onClick={move}>Apply</Button>
          </div>
        </div>

        <div>
          <p className="m-0 mb-2 text-[13px] font-medium text-crm-ink">Or set every tier from the score</p>
          <div className="flex flex-wrap items-end gap-2">
            <Input className="w-[150px]" label="A at or above" type="number" value={a} onChange={e => setA(e.target.value)} />
            <Input className="w-[150px]" label="B at or above" type="number" value={b} onChange={e => setB(e.target.value)} />
            <Button loading={busy} onClick={byScore}>Apply</Button>
          </div>
          <p className="m-0 mt-1.5 text-[12px] text-crm-ink-3">Below B becomes C. Leads that have no score keep the tier they have.</p>
        </div>
      </div>
    </Card>
  );
};

export default RetierTool;
