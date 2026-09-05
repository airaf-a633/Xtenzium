import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import type { Deal, DealActivity, DealStage, TeamMember } from '../../../types/database';
import { OPEN_STAGES, SOURCE_LABEL, STAGE_LABEL, STAGE_TONE, isOpen, stageConfig } from '../../../lib/deals';
import { formatMoney } from '../../../lib/money';
import { toPkr } from '../../../lib/settings';
import {
  Badge,
  Button,
  Drawer,
  Input,
  Label,
  Select,
  Textarea,
  useToast,
} from '../../../components/crm/ui';

const CURRENCIES = [
  { value: 'PKR', label: 'PKR' },
  { value: 'USD', label: 'USD' },
];

const SOURCES = Object.entries(SOURCE_LABEL).map(([value, label]) => ({ value, label }));

const relative = (iso: string) => {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

interface DealPanelProps {
  deal: Deal | null;
  members: TeamMember[];
  usdRate: number;
  onClose: () => void;
  onSaved: (deal: Deal) => void;
  onRequestClose: (deal: Deal, outcome: 'won' | 'lost') => void;
}

const DealPanel = ({ deal, members, usdRate, onClose, onSaved, onRequestClose }: DealPanelProps) => {
  const { toast } = useToast();
  const [draft, setDraft] = useState<Deal | null>(deal);
  const [activities, setActivities] = useState<DealActivity[]>([]);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  /* Keyed on the deal id by its parent, so a different deal remounts
     rather than being patched into the previous one's draft. */
  useEffect(() => {
    if (!deal) return;

    let cancelled = false;
    supabase
      .from('deal_activities')
      .select('*')
      .eq('deal_id', deal.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (!cancelled) setActivities((data ?? []) as DealActivity[]);
      });
    return () => {
      cancelled = true;
    };
  }, [deal]);

  if (!deal || !draft) return null;

  const set = <K extends keyof Deal>(key: K, value: Deal[K]) =>
    setDraft(d => (d ? { ...d, [key]: value } : d));

  /* Changing stage from the panel re-seeds probability only while the
     deal still carries the previous stage's default — an explicitly
     tuned number is never silently overwritten. */
  const setStage = (stage: DealStage) => {
    setDraft(d => {
      if (!d) return d;
      const wasDefault = stageConfig(d.stage)?.defaultProbability === d.probability;
      const next = stageConfig(stage)?.defaultProbability;
      return {
        ...d,
        stage,
        probability: wasDefault && next !== undefined ? next : d.probability,
      };
    });
  };

  const save = async () => {
    setSaving(true);
    const { data, error } = await supabase
      .from('deals')
      .update({
        title: draft.title,
        company: draft.company,
        contact_name: draft.contact_name,
        contact_email: draft.contact_email,
        contact_phone: draft.contact_phone,
        stage: draft.stage,
        value: draft.value,
        currency: draft.currency,
        probability: draft.probability,
        expected_close: draft.expected_close || null,
        owner_id: draft.owner_id || null,
        source: draft.source,
        next_action: draft.next_action,
        next_action_date: draft.next_action_date || null,
      })
      .eq('id', draft.id)
      .select()
      .single();
    setSaving(false);

    if (error || !data) {
      toast('That didn’t save — check the connection and try again.', 'danger');
      return;
    }
    onSaved(data as Deal);
    toast('Deal saved', 'success');
  };

  const addNote = async () => {
    const content = note.trim();
    if (!content) return;
    const { data, error } = await supabase
      .from('deal_activities')
      .insert({ deal_id: draft.id, type: 'note', content })
      .select()
      .single();
    if (error || !data) {
      toast('The note didn’t post.', 'danger');
      return;
    }
    setActivities(a => [data as DealActivity, ...a]);
    setNote('');
  };

  const pkr = toPkr(Number(draft.value), draft.currency, usdRate);
  const weighted = pkr * (draft.probability / 100);
  const open = isOpen(draft.stage);

  return (
    <Drawer
      open
      onClose={onClose}
      eyebrow={
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone={STAGE_TONE[draft.stage]} dot>
            {STAGE_LABEL[draft.stage]}
          </Badge>
          <Badge>{SOURCE_LABEL[draft.source]}</Badge>
          {draft.lead_id && (
            <Link to={`/admin/leads/${draft.lead_id}`} className="no-underline">
              <Badge tone="info">Original enquiry →</Badge>
            </Link>
          )}
        </div>
      }
      title={draft.title}
      footer={
        <>
          {open ? (
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => onRequestClose(draft, 'won')}>
                Mark won
              </Button>
              <Button variant="ghost" onClick={() => onRequestClose(draft, 'lost')}>
                Mark lost
              </Button>
            </div>
          ) : draft.project_id ? (
            <Link
              to={`/crm/projects/${draft.project_id}`}
              className="text-[13px] text-crm-copper no-underline"
            >
              Open the project →
            </Link>
          ) : (
            <span className="text-[12.5px] text-crm-ink-3">
              Closed {relative(draft.closed_at ?? draft.updated_at)}
            </span>
          )}
          <Button variant="primary" loading={saving} onClick={save}>
            Save
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        {/* ── Value, spelled out ─────────────────────────────── */}
        <div className="rounded-crm-md border border-crm-line bg-crm-ground p-3.5">
          <div className="flex items-baseline justify-between gap-3">
            <span className="crm-num font-crm-display text-[22px] font-bold leading-none tracking-[-0.02em] text-crm-ink">
              {formatMoney(pkr)}
            </span>
            <span className="crm-num font-crm-mono text-[12px] text-crm-copper">
              {formatMoney(weighted)} weighted
            </span>
          </div>
          {draft.currency !== 'PKR' && (
            <p className="m-0 mt-1.5 font-crm-mono text-[10.5px] text-crm-faint">
              Entered as {draft.currency} {Number(draft.value).toLocaleString('en-US')}
            </p>
          )}
        </div>

        {/* ── The two fields that decide whether this deal moves ── */}
        <fieldset className="m-0 flex flex-col gap-3 border-0 p-0">
          <Label>Next step</Label>
          <Input
            label="What happens next"
            value={draft.next_action ?? ''}
            onChange={e => set('next_action', e.target.value)}
            placeholder="Send the revised scope"
            hint={
              draft.next_action_date
                ? undefined
                : 'A deal with no agreed next step is a deal nobody is working.'
            }
          />
          <Input
            label="By when"
            type="date"
            value={draft.next_action_date ?? ''}
            onChange={e => set('next_action_date', e.target.value)}
          />
        </fieldset>

        {/* ── Deal shape ─────────────────────────────────────── */}
        <fieldset className="m-0 grid grid-cols-2 gap-3 border-0 p-0">
          <Input
            className="col-span-2"
            label="Title"
            value={draft.title}
            onChange={e => set('title', e.target.value)}
            required
          />
          <Select
            label="Stage"
            value={draft.stage}
            onChange={e => setStage(e.target.value as DealStage)}
            options={
              open
                ? OPEN_STAGES.map(s => ({ value: s.value, label: s.label }))
                : [{ value: draft.stage, label: STAGE_LABEL[draft.stage] }, ...OPEN_STAGES.map(s => ({ value: s.value, label: s.label }))]
            }
          />
          <Select
            label="Owner"
            value={draft.owner_id ?? ''}
            onChange={e => set('owner_id', e.target.value || null)}
            placeholder="Unassigned"
            options={members.map(m => ({ value: m.id, label: m.name }))}
          />
          <Input
            label="Value"
            type="number"
            min={0}
            step="any"
            value={String(draft.value)}
            onChange={e => set('value', Number(e.target.value))}
          />
          <Select
            label="Currency"
            value={draft.currency}
            onChange={e => set('currency', e.target.value)}
            options={CURRENCIES}
          />
          <Input
            label="Probability %"
            type="number"
            min={0}
            max={100}
            value={String(draft.probability)}
            onChange={e => set('probability', Math.max(0, Math.min(100, Number(e.target.value))))}
          />
          <Input
            label="Expected close"
            type="date"
            value={draft.expected_close ?? ''}
            onChange={e => set('expected_close', e.target.value)}
          />
        </fieldset>

        {/* ── Who it's with ──────────────────────────────────── */}
        <fieldset className="m-0 grid grid-cols-2 gap-3 border-0 p-0">
          <Input
            className="col-span-2"
            label="Company"
            value={draft.company ?? ''}
            onChange={e => set('company', e.target.value)}
          />
          <Input
            label="Contact"
            value={draft.contact_name ?? ''}
            onChange={e => set('contact_name', e.target.value)}
          />
          <Input
            label="Email"
            type="email"
            value={draft.contact_email ?? ''}
            onChange={e => set('contact_email', e.target.value)}
          />
          <Input
            label="Phone"
            value={draft.contact_phone ?? ''}
            onChange={e => set('contact_phone', e.target.value)}
          />
          <Select
            label="Source"
            value={draft.source}
            onChange={e => set('source', e.target.value as Deal['source'])}
            options={SOURCES}
          />
        </fieldset>

        {draft.lost_reason && (
          <div className="rounded-crm-md border border-crm-danger/30 bg-crm-danger-quiet px-3.5 py-3">
            <Label className="text-crm-danger">Lost because</Label>
            <p className="m-0 mt-1.5 text-[13px] text-crm-ink-2">{draft.lost_reason}</p>
          </div>
        )}

        {/* ── History ────────────────────────────────────────── */}
        <div>
          <Label className="mb-2 block">History</Label>
          <div className="flex gap-2">
            <Textarea
              className="flex-1"
              label="Add a note"
              rows={2}
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Call summary, what they pushed back on, what you promised…"
            />
          </div>
          <div className="mt-2 flex justify-end">
            <Button size="sm" onClick={addNote} disabled={!note.trim()}>
              Post note
            </Button>
          </div>

          <ul className="m-0 mt-4 list-none p-0">
            {activities.length === 0 && (
              <li className="text-[12.5px] text-crm-faint">Nothing recorded yet.</li>
            )}
            {activities.map(a => (
              <li key={a.id} className="border-l border-crm-line py-2 pl-3.5">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-crm-mono text-[10px] uppercase tracking-[0.1em] text-crm-faint">
                    {a.type.replace('_', ' ')}
                  </span>
                  <span className="crm-num font-crm-mono text-[10.5px] text-crm-faint">
                    {relative(a.created_at)}
                  </span>
                </div>
                <p className="m-0 mt-1 whitespace-pre-wrap text-[12.5px] text-crm-ink-2">
                  {a.content}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Drawer>
  );
};

export default DealPanel;
