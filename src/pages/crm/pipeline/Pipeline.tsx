import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';
import { getUsdToPkrRate, DEFAULT_USD_TO_PKR, toPkr } from '../../../lib/settings';
import { formatMoney } from '../../../lib/money';
import type { Client, Deal, DealStage, TeamMember } from '../../../types/database';
import {
  OPEN_STAGES,
  STAGE_LABEL,
  STAGE_TONE,
  attentionOf,
  forecastOf,
  isOpen,
  stageConfig,
} from '../../../lib/deals';
import {
  Badge,
  Button,
  Dialog,
  ErrorState,
  Input,
  PageHeader,
  SegmentedControl,
  Select,
  SkeletonTiles,
  Stat,
  TableShell,
  Td,
  Th,
  Tr,
  useToast,
} from '../../../components/crm/ui';
import ViewBar from '../../../components/crm/ViewBar';
import { useView } from '../../../components/crm/useView';
import { useRealtimeRows } from '../../../components/crm/useRealtimeRows';
import { dealFields } from '../../../lib/view-fields';
import { applyFilters, applySearch, applySort } from '../../../lib/views';
import PipelineBoard from './PipelineBoard';
import DealPanel from './DealPanel';
import CloseDealDialog from './CloseDealDialog';

type View = 'open' | 'closed';

const VIEWS = [
  { value: 'open' as const, label: 'Pipeline' },
  { value: 'closed' as const, label: 'Closed' },
];

const PlusIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
    <path d="M12 5v14M5 12h14" />
  </svg>
);

const NewDealDialog = ({
  members,
  onCancel,
  onCreated,
}: {
  members: TeamMember[];
  onCancel: () => void;
  onCreated: (deal: Deal) => void;
}) => {
  const { toast } = useToast();
  const [title, setTitle] = useState('');
  const [company, setCompany] = useState('');
  const [contact, setContact] = useState('');
  const [value, setValue] = useState('0');
  const [currency, setCurrency] = useState('PKR');
  const [ownerId, setOwnerId] = useState('');
  const [source, setSource] = useState('manual');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = async () => {
    if (!title.trim()) {
      setError('Give the deal a title.');
      return;
    }
    setBusy(true);
    const { data, error: insertError } = await supabase
      .from('deals')
      .insert({
        title: title.trim(),
        company: company.trim() || null,
        contact_name: contact.trim() || null,
        value: Number(value) || 0,
        currency,
        owner_id: ownerId || null,
        source: source as Deal['source'],
        stage: 'new',
        probability: stageConfig('new')?.defaultProbability ?? 10,
      })
      .select()
      .single();
    setBusy(false);

    if (insertError || !data) {
      setError('That didn’t save. Check the connection and try again.');
      return;
    }
    toast('Deal added', 'success');
    onCreated(data as Deal);
  };

  return (
    <Dialog
      open
      onClose={onCancel}
      title="New deal"
      description="For anything that arrived by phone, referral or DM. Website enquiries land here on their own."
      footer={
        <>
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="primary" loading={busy} onClick={create}>
            Add deal
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Input label="Title" required value={title} onChange={e => setTitle(e.target.value)} placeholder="Meezan Bank — IoT sensor rollout" />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Company" value={company} onChange={e => setCompany(e.target.value)} />
          <Input label="Contact" value={contact} onChange={e => setContact(e.target.value)} />
          <Input label="Value" type="number" min={0} step="any" value={value} onChange={e => setValue(e.target.value)} />
          <Select
            label="Currency"
            value={currency}
            onChange={e => setCurrency(e.target.value)}
            options={[{ value: 'PKR', label: 'PKR' }, { value: 'USD', label: 'USD' }]}
          />
          <Select
            label="Owner"
            value={ownerId}
            onChange={e => setOwnerId(e.target.value)}
            placeholder="Unassigned"
            options={members.map(m => ({ value: m.id, label: m.name }))}
          />
          <Select
            label="Source"
            value={source}
            onChange={e => setSource(e.target.value)}
            options={[
              { value: 'referral', label: 'Referral' },
              { value: 'outbound', label: 'Outbound' },
              { value: 'repeat', label: 'Repeat client' },
              { value: 'manual', label: 'Added manually' },
            ]}
          />
        </div>
        {error && <p className="m-0 text-[12.5px] text-crm-danger">{error}</p>}
      </div>
    </Dialog>
  );
};

const Pipeline = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [rate, setRate] = useState(DEFAULT_USD_TO_PKR);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const [layout, setLayout] = useState<View>('open');
  const [selected, setSelected] = useState<Deal | null>(null);
  const [closing, setClosing] = useState<{ deal: Deal; outcome: 'won' | 'lost' } | null>(null);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const [dealsResult, clientsResult, membersResult, usdRate] = await Promise.all([
        supabase.from('deals').select('*').order('rank', { ascending: true }).order('created_at', { ascending: false }),
        supabase.from('clients').select('*').order('name'),
        supabase.from('team_members').select('*').order('name'),
        getUsdToPkrRate(),
      ]);
      if (cancelled) return;

      if (dealsResult.error) {
        setFailed(true);
        setLoading(false);
        return;
      }
      setDeals((dealsResult.data ?? []) as Deal[]);
      setClients((clientsResult.data ?? []) as Client[]);
      setMembers((membersResult.data ?? []) as TeamMember[]);
      setRate(usdRate);
      setLoading(false);
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  /* Live across the four of you: a card someone else moves moves here
     too, and a website enquiry appears in New the moment it lands. */
  useRealtimeRows<Deal>('deals', setDeals);

  const membersById = useMemo(
    () => Object.fromEntries(members.map(m => [m.id, m])),
    [members],
  );

  const me = useMemo(
    () => members.find(m => m.user_id && m.user_id === user?.id) ?? null,
    [members, user],
  );

  const view = useView('deals', me);
  const fields = useMemo(() => dealFields(members), [members]);

  const replace = (deal: Deal) => {
    setDeals(list => list.map(d => (d.id === deal.id ? deal : d)));
    setSelected(s => (s && s.id === deal.id ? deal : s));
  };

  /* Filter, search and sort come from the shared engine; the board
     keeps its own stage columns, because on a pipeline the stages ARE
     the board — that's why the Group control is hidden here. */
  const filtered = useMemo(
    () =>
      applySort(
        applySearch(applyFilters(deals, view.view.filters, fields), view.view.search, fields),
        view.view.sort,
        fields,
      ),
    [deals, view.view, fields],
  );

  const openDeals = filtered.filter(d => isOpen(d.stage));
  const closedDeals = filtered.filter(d => !isOpen(d.stage));

  const forecast = forecastOf(openDeals, rate);
  const needsAttention = openDeals.filter(d => attentionOf(d) !== 'none').length;

  /* Won and lost both have consequences, so a drop onto the close
     strip opens the confirmation rather than committing. Every other
     move is a single field change and commits straight away. */
  const handleStageChange = async (deal: Deal, stage: DealStage) => {
    if (stage === 'won' || stage === 'lost') {
      setClosing({ deal, outcome: stage });
      return;
    }

    const wasDefault = stageConfig(deal.stage)?.defaultProbability === deal.probability;
    const probability = wasDefault
      ? stageConfig(stage)?.defaultProbability ?? deal.probability
      : deal.probability;

    const previous = deal;
    replace({ ...deal, stage, probability });

    const { data, error } = await supabase
      .from('deals')
      .update({ stage, probability })
      .eq('id', deal.id)
      .select()
      .single();

    if (error || !data) {
      replace(previous);
      toast('That move didn’t stick — the board has been put back.', 'danger');
      return;
    }
    replace(data as Deal);
  };

  const wonThisPeriod = closedDeals.filter(d => d.stage === 'won');
  const winRate =
    closedDeals.length > 0 ? Math.round((wonThisPeriod.length / closedDeals.length) * 100) : null;

  return (
    <div>
      <PageHeader
        title="Pipeline"
        subtitle={
          loading
            ? undefined
            : `${forecast.count} open ${forecast.count === 1 ? 'deal' : 'deals'}${
                needsAttention > 0 ? ` · ${needsAttention} need a next step` : ''
              }`
        }
        actions={
          <Button variant="primary" icon={<PlusIcon />} onClick={() => setAdding(true)}>
            New deal
          </Button>
        }
      />

      {failed && (
        <ErrorState
          title="The pipeline couldn’t load"
          body="If this is the first time you’re opening it, migration 006 may not have been run yet — the deals table has to exist before this page has anything to show."
        />
      )}

      {!failed && (
        <>
          <section className="mb-5" aria-label="Forecast">
            {loading ? (
              <SkeletonTiles count={4} />
            ) : (
              <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(180px,1fr))]">
                <Stat
                  label="Weighted forecast"
                  value={formatMoney(forecast.weighted)}
                  sub="Value × probability"
                  tone="copper"
                />
                <Stat
                  label="Total on the table"
                  value={formatMoney(forecast.total)}
                  sub={`Across ${forecast.count} open deals`}
                />
                <Stat
                  label="Needs a next step"
                  value={needsAttention}
                  sub={needsAttention === 0 ? 'Everything has an agreed action' : 'Overdue, stale or unplanned'}
                  tone={needsAttention > 0 ? 'warning' : 'success'}
                />
                <Stat
                  label="Win rate"
                  value={winRate === null ? '—' : `${winRate}%`}
                  sub={
                    closedDeals.length === 0
                      ? 'No closed deals yet'
                      : `${wonThisPeriod.length} won of ${closedDeals.length} closed`
                  }
                  tone="success"
                />
              </div>
            )}
          </section>

          <ViewBar
            fields={fields}
            view={view.view}
            onChange={view.setView}
            onReset={view.resetView}
            savedViews={view.savedViews}
            activeViewId={view.activeViewId}
            onApplySaved={view.applySavedView}
            onSave={view.saveView}
            onUpdateActive={view.updateActiveView}
            onDelete={view.deleteView}
            shareUrl={view.shareUrl}
            viewsUnavailable={view.viewsUnavailable}
            searchPlaceholder="Search deals…"
            hideGroup
          >
            <SegmentedControl
              label="Pipeline view"
              value={layout}
              onChange={setLayout}
              options={VIEWS}
            />
          </ViewBar>

          {loading ? (
            <SkeletonTiles count={5} />
          ) : layout === 'open' ? (
            <PipelineBoard
              deals={openDeals}
              membersById={membersById}
              usdRate={rate}
              onStageChange={handleStageChange}
              onOpen={setSelected}
            />
          ) : (
            <TableShell>
              <thead>
                <tr>
                  <Th>Deal</Th>
                  <Th>Outcome</Th>
                  <Th>Why / project</Th>
                  <Th align="right">Value</Th>
                  <Th align="right">Closed</Th>
                </tr>
              </thead>
              <tbody>
                {closedDeals.length === 0 && (
                  <Tr>
                    <Td className="text-crm-ink-3">Nothing closed yet.</Td>
                    <Td /> <Td /> <Td /> <Td />
                  </Tr>
                )}
                {closedDeals.map(d => (
                  <Tr key={d.id} onClick={() => setSelected(d)}>
                    <Td className="text-crm-ink">
                      {d.title}
                      {d.company && (
                        <span className="mt-0.5 block text-[12px] text-crm-ink-3">{d.company}</span>
                      )}
                    </Td>
                    <Td>
                      <Badge tone={STAGE_TONE[d.stage]} dot>
                        {STAGE_LABEL[d.stage]}
                      </Badge>
                    </Td>
                    <Td className="max-w-[260px] truncate">
                      {d.stage === 'lost' ? d.lost_reason : d.project_id ? 'Project created' : '—'}
                    </Td>
                    <Td align="right">
                      {formatMoney(toPkr(Number(d.value), d.currency, rate))}
                    </Td>
                    <Td align="right" className="font-crm-mono text-[12px] text-crm-ink-3">
                      {d.closed_at
                        ? new Date(d.closed_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })
                        : '—'}
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </TableShell>
          )}

          {!loading && layout === 'open' && openDeals.length > 0 && (
            <p className="m-0 mt-4 font-crm-mono text-[10.5px] uppercase tracking-[0.1em] text-crm-faint">
              {OPEN_STAGES.map(s => `${s.label} ${openDeals.filter(d => d.stage === s.value).length}`).join('  ·  ')}
            </p>
          )}
        </>
      )}

      <DealPanel
        key={selected?.id ?? 'none'}
        deal={selected}
        members={members}
        usdRate={rate}
        onClose={() => setSelected(null)}
        onSaved={replace}
        onRequestClose={(deal, outcome) => setClosing({ deal, outcome })}
      />

      {closing && (
        <CloseDealDialog
          deal={closing.deal}
          outcome={closing.outcome}
          clients={clients}
          onCancel={() => setClosing(null)}
          onDone={deal => {
            replace(deal);
            setClosing(null);
            setSelected(null);
          }}
        />
      )}

      {adding && (
        <NewDealDialog
          members={members}
          onCancel={() => setAdding(false)}
          onCreated={deal => {
            setDeals(list => [deal, ...list]);
            setAdding(false);
            setSelected(deal);
          }}
        />
      )}
    </div>
  );
};

export default Pipeline;
