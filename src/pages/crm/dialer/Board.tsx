import { useCallback, useEffect, useState } from 'react';
import {
  DndContext, DragOverlay, PointerSensor, useDraggable, useDroppable, useSensor, useSensors,
  type DragEndEvent, type DragStartEvent,
} from '@dnd-kit/core';
import { supabase } from '../../../lib/supabase';
import type { CallLead } from '../../../types/database';
import {
  BOARD_COLUMNS, OUTCOMES, clockFor, columnForStatus, formatInZone,
  type BoardColumn, type OutcomeDef,
} from '../../../lib/dialer-calls';
import { Badge, Button, Dialog, ErrorState, PageHeader, useToast } from '../../../components/crm/ui';
import { cn } from '../../../lib/utils';
import { useAuth } from '../../../context/AuthContext';
import OutcomePanel, { type OutcomeSubmit } from './OutcomePanel';

const PER_COLUMN = 40;
const ET = 'America/New_York';

type BoardLead = Pick<
  CallLead,
  'id' | 'company_name' | 'tier' | 'score' | 'status' | 'next_call_at' | 'contact_name' | 'timezone' | 'attempt_count'
>;
const COLS = 'id, company_name, tier, score, status, next_call_at, contact_name, timezone, attempt_count';

const Card = ({ lead, onOpen, overlay }: { lead: BoardLead; onOpen?: () => void; overlay?: boolean }) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: lead.id, data: { lead } });
  const tz = lead.timezone ?? ET;
  return (
    <div
      ref={overlay ? undefined : setNodeRef}
      {...(overlay ? {} : listeners)}
      {...(overlay ? {} : attributes)}
      onClick={onOpen}
      className={cn(
        'cursor-grab rounded-crm-md border border-crm-line bg-crm-surface px-3 py-2.5 text-left shadow-sm',
        'hover:border-crm-line-hi',
        isDragging && !overlay && 'opacity-40',
        overlay && 'cursor-grabbing shadow-lg',
      )}
    >
      <p className="m-0 truncate text-[13px] font-medium text-crm-ink">{lead.company_name}</p>
      <p className="m-0 mt-0.5 truncate text-[11.5px] text-crm-ink-3">
        {lead.contact_name ?? 'No contact yet'}
        {lead.attempt_count > 0 && ` · ${lead.attempt_count} call${lead.attempt_count === 1 ? '' : 's'}`}
      </p>
      <div className="mt-1.5 flex items-center gap-1.5">
        {lead.tier && <Badge tone={lead.tier === 'A' ? 'copper' : 'neutral'}>{lead.tier}</Badge>}
        {lead.next_call_at && (
          <span className="truncate text-[11px] text-crm-ink-3">{formatInZone(new Date(lead.next_call_at), tz)}</span>
        )}
      </div>
    </div>
  );
};

const Column = ({
  column, leads, total, onOpen, dragging,
}: {
  column: BoardColumn;
  leads: BoardLead[];
  total: number;
  onOpen: (lead: BoardLead) => void;
  dragging: boolean;
}) => {
  const droppable = column.outcomes.length > 0;
  const { setNodeRef, isOver } = useDroppable({ id: column.key, disabled: !droppable });
  return (
    <section
      ref={setNodeRef}
      aria-label={column.title}
      className={cn(
        'flex w-[250px] shrink-0 flex-col rounded-crm-lg border bg-crm-ground transition-colors',
        isOver && droppable ? 'border-crm-copper bg-crm-copper/5' : 'border-crm-line',
        dragging && droppable && !isOver && 'border-dashed border-crm-line-hi',
      )}
    >
      <header className="flex items-center justify-between px-3 py-2.5">
        <h3 className="m-0 font-crm-mono text-[11px] font-medium uppercase tracking-[0.12em] text-crm-ink-2">{column.title}</h3>
        <span className="text-[12px] tabular-nums text-crm-ink-3">{total.toLocaleString()}</span>
      </header>
      <div className="flex max-h-[68vh] min-h-[80px] flex-col gap-2 overflow-y-auto px-2 pb-2">
        {leads.map(l => (
          <Card key={l.id} lead={l} onOpen={() => onOpen(l)} />
        ))}
        {total > leads.length && (
          <p className="m-0 px-1 py-1 text-center text-[11.5px] text-crm-ink-3">
            +{(total - leads.length).toLocaleString()} more
          </p>
        )}
      </div>
    </section>
  );
};

/* Review and clean-up, not the main way to call. Moving a card never
   just rewrites a status: it logs a call, because that is what drives
   retry dates, deals and follow-ups. Dropping on a column asks which
   outcome you mean; clicking a card offers all of them. */
const Board = () => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const myTz = profile?.timezone ?? 'Asia/Karachi';
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const [leads, setLeads] = useState<Record<string, BoardLead[]>>({});
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [failed, setFailed] = useState<string | null>(null);
  const [dragged, setDragged] = useState<BoardLead | null>(null);
  const [pending, setPending] = useState<{ lead: BoardLead; options: OutcomeDef[] } | null>(null);
  const [choice, setChoice] = useState<OutcomeDef | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchBoard = useCallback(async () => {
    const [c, ...cols] = await Promise.all([
      supabase.rpc('dialer_board_counts'),
      ...BOARD_COLUMNS.map(col => {
        const q = supabase.from('call_leads').select(COLS).in('status', col.statuses).limit(PER_COLUMN);
        return col.key === 'new'
          ? q.eq('phone_is_us', true).order('tier', { nullsFirst: false }).order('score', { ascending: false })
          : q.order('updated_at', { ascending: false });
      }),
    ]);
    const err = c.error ?? cols.find(r => r.error)?.error;
    if (err) throw new Error(err.message);
    return {
      counts: (c.data ?? {}) as Record<string, number>,
      leads: Object.fromEntries(BOARD_COLUMNS.map((col, i) => [col.key, (cols[i].data ?? []) as BoardLead[]])),
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchBoard()
      .then(b => {
        if (cancelled) return;
        setCounts(b.counts);
        setLeads(b.leads);
      })
      .catch((e: Error) => !cancelled && setFailed(e.message));
    return () => {
      cancelled = true;
    };
  }, [fetchBoard]);

  const open = (lead: BoardLead, column: BoardColumn | null) => {
    const options = column ? OUTCOMES.filter(o => column.outcomes.includes(o.key)) : OUTCOMES;
    setPending({ lead, options });
    setChoice(options.length === 1 ? options[0] : null);
  };

  const close = () => {
    setPending(null);
    setChoice(null);
  };

  const onDragStart = (e: DragStartEvent) => setDragged((e.active.data.current?.lead as BoardLead) ?? null);

  const onDragEnd = (e: DragEndEvent) => {
    setDragged(null);
    const lead = e.active.data.current?.lead as BoardLead | undefined;
    const target = BOARD_COLUMNS.find(c => c.key === e.over?.id);
    if (!lead || !target || target.outcomes.length === 0) return;
    if (columnForStatus(lead.status)?.key === target.key) return;
    open(lead, target);
  };

  const submit = async (v: OutcomeSubmit) => {
    if (!pending || !choice) return;
    setSaving(true);
    const { error } = await supabase.rpc('log_call', {
      p_lead_id: pending.lead.id,
      p_outcome: choice.key,
      p_tags: v.tags,
      p_note: v.note || null,
      p_flagged: v.flagged,
      p_at: v.at,
    });
    setSaving(false);
    if (error) return toast(error.message, 'danger');
    toast(`${pending.lead.company_name}: ${choice.label}`, 'success');
    close();
    fetchBoard().then(b => {
      setCounts(b.counts);
      setLeads(b.leads);
    }).catch((err: Error) => toast(err.message, 'danger'));
  };

  const total = (col: BoardColumn) => col.statuses.reduce((n, s) => n + (counts[s] ?? 0), 0);
  const tz = pending?.lead.timezone ?? ET;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Board"
        subtitle="Drag a lead to a column to log what happened, or click one. New shows the best Tier A leads first."
        back={{ to: '/crm/dialer', label: 'Dialer' }}
      />

      {failed && <ErrorState title="The board couldn’t load" body={failed} />}

      <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setDragged(null)}>
        <div className="flex gap-3 overflow-x-auto pb-3">
          {BOARD_COLUMNS.map(col => (
            <Column
              key={col.key}
              column={col}
              leads={leads[col.key] ?? []}
              total={total(col)}
              dragging={dragged !== null}
              onOpen={l => open(l, null)}
            />
          ))}
        </div>
        <DragOverlay dropAnimation={null}>{dragged ? <Card lead={dragged} overlay /> : null}</DragOverlay>
      </DndContext>

      <Dialog
        open={pending !== null}
        onClose={close}
        title={pending ? pending.lead.company_name : ''}
        description={choice ? choice.label : 'What happened?'}
      >
        {pending && !choice && (
          <div className="flex flex-col gap-1.5">
            {pending.options.map(o => (
              <Button key={o.key} onClick={() => setChoice(o)}>
                {o.label} <span className="text-crm-ink-3">· {o.effect}</span>
              </Button>
            ))}
          </div>
        )}
        {pending && choice && (
          <OutcomePanel
            key={choice.key + pending.lead.id}
            outcome={choice}
            leadTz={tz}
            zoneLabel={clockFor(pending.lead.timezone).zoneLabel}
            myTz={myTz}
            saving={saving}
            onSubmit={submit}
            onCancel={pending.options.length > 1 ? () => setChoice(null) : close}
            onInvalid={m => toast(m, 'danger')}
          />
        )}
      </Dialog>
    </div>
  );
};

export default Board;
