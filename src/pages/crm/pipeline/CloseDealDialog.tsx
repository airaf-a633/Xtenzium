import { useMemo, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import type { Client, Deal } from '../../../types/database';
import { Button, Dialog, Input, Select, Textarea, useToast } from '../../../components/crm/ui';

/* Common reasons, so lost-deal analysis in phase 06 groups on
   something consistent instead of six spellings of "too expensive".
   "Something else" keeps the free-text escape hatch. */
const LOST_REASONS = [
  { value: 'price', label: 'Price — we were too expensive' },
  { value: 'timeline', label: 'Timeline — we couldn’t start soon enough' },
  { value: 'competitor', label: 'Went with a competitor' },
  { value: 'scope', label: 'Scope wasn’t a fit' },
  { value: 'budget_pulled', label: 'Their budget disappeared' },
  { value: 'no_response', label: 'Went quiet' },
  { value: 'other', label: 'Something else' },
];

const LOST_LABEL = Object.fromEntries(LOST_REASONS.map(r => [r.value, r.label]));

const today = () => new Date().toISOString().slice(0, 10);

interface CloseDealDialogProps {
  deal: Deal;
  outcome: 'won' | 'lost';
  clients: Client[];
  onCancel: () => void;
  onDone: (deal: Deal) => void;
}

const CloseDealDialog = ({ deal, outcome, clients, onCancel, onDone }: CloseDealDialogProps) => {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* ── Won ── */
  const suggestedClient = useMemo(() => {
    if (deal.client_id) return deal.client_id;
    const needle = (deal.company || deal.contact_name || '').trim().toLowerCase();
    if (!needle) return '';
    /* Suggest, never auto-pick. A wrong silent match merges two real
       clients, which is far more expensive than one extra click. */
    const hit = clients.find(
      c =>
        c.name.trim().toLowerCase() === needle ||
        (c.company ?? '').trim().toLowerCase() === needle,
    );
    return hit?.id ?? '';
  }, [deal, clients]);

  const [clientId, setClientId] = useState(suggestedClient);
  const [newClientName, setNewClientName] = useState(deal.company || deal.contact_name || '');
  const [projectName, setProjectName] = useState(deal.title.replace(/\s+enquiry$/i, ''));
  const [startDate, setStartDate] = useState(today());
  const [endDate, setEndDate] = useState('');
  const [value, setValue] = useState(String(deal.value));

  /* ── Lost ── */
  const [reason, setReason] = useState('');
  const [reasonNote, setReasonNote] = useState('');

  const confirmWon = async () => {
    setError(null);

    let resolvedClientId = clientId;

    if (!resolvedClientId) {
      if (!newClientName.trim()) {
        setError('Give the client a name, or pick an existing one.');
        return;
      }
      setBusy(true);
      const { data, error: clientError } = await supabase
        .from('clients')
        .insert({
          name: newClientName.trim(),
          company: deal.company,
          email: deal.contact_email,
          phone: deal.contact_phone,
          notes: null,
          lead_id: deal.lead_id,
        })
        .select()
        .single();
      if (clientError || !data) {
        setBusy(false);
        setError('Creating the client failed. Nothing was changed.');
        return;
      }
      resolvedClientId = (data as Client).id;
    }

    if (!projectName.trim()) {
      setBusy(false);
      setError('The project needs a name.');
      return;
    }

    setBusy(true);
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .insert({
        client_id: resolvedClientId,
        name: projectName.trim(),
        description: deal.next_action,
        status: 'active',
        total_value: Number(value),
        amount_paid: 0,
        currency: deal.currency,
        start_date: startDate || null,
        end_date: endDate || null,
      })
      .select()
      .single();

    if (projectError || !project) {
      setBusy(false);
      /* The client may have just been created. Saying so beats a
         generic failure that leaves someone hunting for a duplicate. */
      setError('The project couldn’t be created. If a new client was added, it’s still there — try again from Clients.');
      return;
    }

    const { data: updated, error: dealError } = await supabase
      .from('deals')
      .update({
        stage: 'won',
        client_id: resolvedClientId,
        project_id: (project as { id: string }).id,
        probability: 100,
        value: Number(value),
      })
      .eq('id', deal.id)
      .select()
      .single();

    setBusy(false);

    if (dealError || !updated) {
      setError('The project was created, but the deal didn’t update. Reload and check the pipeline.');
      return;
    }

    await supabase.from('deal_activities').insert({
      deal_id: deal.id,
      type: 'note',
      content: `Won. Project "${projectName.trim()}" created.`,
    });

    toast('Won — project created', 'success');
    onDone(updated as Deal);
  };

  const confirmLost = async () => {
    setError(null);
    if (!reason) {
      setError('Pick a reason — it’s what makes the lost column worth reading later.');
      return;
    }
    const text = reasonNote.trim()
      ? `${LOST_LABEL[reason]} — ${reasonNote.trim()}`
      : LOST_LABEL[reason];

    setBusy(true);
    const { data, error: dealError } = await supabase
      .from('deals')
      .update({ stage: 'lost', lost_reason: text, probability: 0 })
      .eq('id', deal.id)
      .select()
      .single();
    setBusy(false);

    if (dealError || !data) {
      setError('That didn’t save. Nothing was changed.');
      return;
    }
    toast('Marked lost', 'info');
    onDone(data as Deal);
  };

  if (outcome === 'lost') {
    return (
      <Dialog
        open
        onClose={onCancel}
        title="Mark this deal lost"
        description={deal.title}
        footer={
          <>
            <Button variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
            <Button variant="danger" loading={busy} onClick={confirmLost}>
              Mark lost
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Select
            label="Why"
            required
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="Pick one"
            options={LOST_REASONS}
            error={error && !reason ? error : undefined}
          />
          <Textarea
            label="Anything worth remembering"
            rows={3}
            value={reasonNote}
            onChange={e => setReasonNote(e.target.value)}
            placeholder="What they said, who they went with, whether it’s worth another run in six months."
          />
          {error && reason && <p className="m-0 text-[12.5px] text-crm-danger">{error}</p>}
        </div>
      </Dialog>
    );
  }

  return (
    <Dialog
      open
      wide
      onClose={onCancel}
      title="Won — set up the project"
      description="This creates a real project on the delivery board. Check the client before you confirm."
      footer={
        <>
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="primary" loading={busy} onClick={confirmWon}>
            Create project
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Select
          label="Client"
          value={clientId}
          onChange={e => setClientId(e.target.value)}
          placeholder="— Create a new client —"
          options={clients.map(c => ({
            value: c.id,
            label: c.company ? `${c.name} · ${c.company}` : c.name,
          }))}
          hint={
            suggestedClient && clientId === suggestedClient
              ? 'Matched on name — change it if this is a different client.'
              : undefined
          }
        />

        {!clientId && (
          <Input
            label="New client name"
            required
            value={newClientName}
            onChange={e => setNewClientName(e.target.value)}
            hint="Contact details from the deal carry across automatically."
          />
        )}

        <Input
          label="Project name"
          required
          value={projectName}
          onChange={e => setProjectName(e.target.value)}
        />

        <div className="grid grid-cols-2 gap-3">
          <Input
            label={`Value (${deal.currency})`}
            type="number"
            min={0}
            step="any"
            value={value}
            onChange={e => setValue(e.target.value)}
          />
          <Input
            label="Start date"
            type="date"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
          />
          <Input
            label="Target end date"
            type="date"
            value={endDate}
            onChange={e => setEndDate(e.target.value)}
            hint="Optional"
          />
        </div>

        {error && <p className="m-0 text-[12.5px] text-crm-danger">{error}</p>}
      </div>
    </Dialog>
  );
};

export default CloseDealDialog;
