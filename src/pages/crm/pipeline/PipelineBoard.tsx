import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { useState } from 'react';
import type { Deal, DealStage, TeamMember } from '../../../types/database';
import {
  ATTENTION_LABEL,
  ATTENTION_TONE,
  OPEN_STAGES,
  attentionOf,
  forecastOf,
} from '../../../lib/deals';
import { formatMoneyCompact, formatMoney } from '../../../lib/money';
import { toPkr } from '../../../lib/settings';
import { Avatar, Badge, Dot, EmptyState } from '../../../components/crm/ui';
import { cn } from '../../../lib/utils';

interface BoardProps {
  deals: Deal[];
  membersById: Record<string, TeamMember>;
  usdRate: number;
  onStageChange: (deal: Deal, stage: DealStage) => void;
  onOpen: (deal: Deal) => void;
}

const formatClose = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : null;

/* ── Card ──────────────────────────────────────────────────────
   Deliberately not a link. The panel opens over the board so the
   column context stays visible, and a real <a> here would fight the
   drag handle for the same pointer events. */
const DealCard = ({
  deal,
  member,
  usdRate,
  onOpen,
  overlay = false,
}: {
  deal: Deal;
  member: TeamMember | null;
  usdRate: number;
  onOpen?: (deal: Deal) => void;
  overlay?: boolean;
}) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: deal.id,
    disabled: overlay,
  });

  const attention = attentionOf(deal);
  const close = formatClose(deal.expected_close);
  const pkr = toPkr(Number(deal.value), deal.currency, usdRate);

  return (
    <div
      ref={overlay ? undefined : setNodeRef}
      {...(overlay ? {} : listeners)}
      {...(overlay ? {} : attributes)}
      role={overlay ? undefined : 'button'}
      tabIndex={overlay ? undefined : 0}
      onClick={() => onOpen?.(deal)}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen?.(deal);
        }
      }}
      className={cn(
        'group w-full cursor-grab rounded-crm-md border bg-crm-surface p-3 text-left',
        'transition-colors duration-150 ease-crm',
        overlay
          ? 'cursor-grabbing border-crm-copper shadow-crm-drag'
          : 'border-crm-line hover:border-crm-line-hi hover:bg-crm-raised',
        /* The dragged original goes quiet rather than disappearing, so
           the column doesn't reflow under the cursor mid-drag. */
        isDragging && !overlay && 'opacity-35',
      )}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <span className="line-clamp-2 text-[13px] font-medium leading-snug text-crm-ink">
          {deal.title}
        </span>
        {member && <Avatar name={member.name} size="xs" />}
      </div>

      {(deal.company || deal.contact_name) && (
        <p className="m-0 mb-2.5 truncate text-[11.5px] text-crm-ink-3">
          {deal.company || deal.contact_name}
        </p>
      )}

      <div className="flex items-center justify-between gap-2">
        <span
          className="crm-num font-crm-mono text-[12.5px] text-crm-ink-2"
          title={formatMoney(pkr)}
        >
          {formatMoneyCompact(pkr)}
        </span>
        <span className="crm-num font-crm-mono text-[11px] text-crm-faint">
          {deal.probability}%
        </span>
      </div>

      {(attention !== 'none' || close) && (
        <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-crm-line pt-2.5">
          {attention !== 'none' ? (
            <Badge tone={ATTENTION_TONE[attention]} dot>
              {ATTENTION_LABEL[attention]}
            </Badge>
          ) : (
            <span />
          )}
          {close && (
            <span className="crm-num font-crm-mono text-[10.5px] text-crm-faint">{close}</span>
          )}
        </div>
      )}
    </div>
  );
};

/* ── Column ────────────────────────────────────────────────── */
const Column = ({
  id,
  label,
  tone,
  deals,
  membersById,
  usdRate,
  onOpen,
}: {
  id: DealStage;
  label: string;
  tone: Parameters<typeof Dot>[0]['tone'];
  deals: Deal[];
  membersById: Record<string, TeamMember>;
  usdRate: number;
  onOpen: (deal: Deal) => void;
}) => {
  const { setNodeRef, isOver } = useDroppable({ id });
  const forecast = forecastOf(deals, usdRate);

  return (
    <section
      ref={setNodeRef}
      aria-label={`${label}, ${forecast.count} deals`}
      className={cn(
        'flex min-h-[220px] w-full flex-col rounded-crm-lg border bg-crm-ground/40 p-2.5',
        'transition-colors duration-150 ease-crm',
        isOver ? 'border-crm-copper bg-crm-raised' : 'border-crm-line',
      )}
    >
      <header className="mb-2.5 px-1">
        <div className="flex items-center gap-2">
          <Dot tone={tone} />
          <span className="text-[12.5px] font-medium text-crm-ink">{label}</span>
          <span className="crm-num ml-auto font-crm-mono text-[11px] text-crm-faint">
            {forecast.count}
          </span>
        </div>
        {/* Weighted, not total — the column header is the one place
            the honest number belongs. */}
        <div className="crm-num mt-1 font-crm-mono text-[11px] text-crm-ink-3">
          {forecast.count > 0 ? formatMoneyCompact(forecast.weighted) : '—'}
        </div>
      </header>

      <div className="flex flex-col gap-2">
        {deals.map(d => (
          <DealCard
            key={d.id}
            deal={d}
            member={d.owner_id ? membersById[d.owner_id] ?? null : null}
            usdRate={usdRate}
            onOpen={onOpen}
          />
        ))}
      </div>
    </section>
  );
};

/* ── Close strip ───────────────────────────────────────────────
   Won and Lost get drop zones instead of columns. Closing a deal is a
   deliberate act with consequences — a project gets created, or a
   reason gets recorded — so it shouldn't be as casual as sliding one
   more column to the right, and the five live stages get the width. */
const CloseZone = ({
  id,
  label,
  hint,
  tone,
  dragging,
}: {
  id: 'won' | 'lost';
  label: string;
  hint: string;
  tone: 'success' | 'danger';
  dragging: boolean;
}) => {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      aria-label={label}
      className={cn(
        'flex flex-1 flex-col items-center justify-center gap-0.5 rounded-crm-lg border border-dashed px-4 py-4 text-center',
        'transition-all duration-150 ease-crm',
        dragging ? 'opacity-100' : 'opacity-45',
        isOver && tone === 'success' && 'border-crm-success bg-crm-success-quiet',
        isOver && tone === 'danger' && 'border-crm-danger bg-crm-danger-quiet',
        !isOver && 'border-crm-line-hi',
      )}
    >
      <span
        className={cn(
          'text-[13px] font-medium',
          tone === 'success' ? 'text-crm-success' : 'text-crm-danger',
        )}
      >
        {label}
      </span>
      <span className="text-[11.5px] text-crm-ink-3">{hint}</span>
    </div>
  );
};

const PipelineBoard = ({ deals, membersById, usdRate, onStageChange, onOpen }: BoardProps) => {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  /* 6px of slop so a click that drifts slightly still opens the panel
     instead of starting a drag nobody wanted. */
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const handleDragStart = (e: DragStartEvent) => setDraggingId(String(e.active.id));

  const handleDragEnd = (e: DragEndEvent) => {
    setDraggingId(null);
    if (!e.over) return;
    const deal = deals.find(d => d.id === e.active.id);
    if (!deal) return;
    const stage = e.over.id as DealStage;
    if (stage === deal.stage) return;
    onStageChange(deal, stage);
  };

  const dragging = draggingId ? deals.find(d => d.id === draggingId) ?? null : null;

  if (deals.length === 0) {
    return (
      <EmptyState
        title="No open deals"
        body="Every enquiry from the website opens a deal here automatically. Add one manually for anything that arrives by phone, referral or DM."
      />
    );
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setDraggingId(null)}
    >
      <div className="overflow-x-auto pb-1">
        <div className="grid min-w-[980px] gap-2.5 [grid-template-columns:repeat(5,minmax(190px,1fr))] items-start">
          {OPEN_STAGES.map(stage => (
            <Column
              key={stage.value}
              id={stage.value}
              label={stage.label}
              tone={stage.tone}
              deals={deals.filter(d => d.stage === stage.value)}
              membersById={membersById}
              usdRate={usdRate}
              onOpen={onOpen}
            />
          ))}
        </div>
      </div>

      <div className="mt-3 flex gap-2.5">
        <CloseZone
          id="won"
          label="Won"
          hint="Drop here to create the project"
          tone="success"
          dragging={Boolean(dragging)}
        />
        <CloseZone
          id="lost"
          label="Lost"
          hint="Drop here to record why"
          tone="danger"
          dragging={Boolean(dragging)}
        />
      </div>

      <DragOverlay dropAnimation={null}>
        {dragging && (
          <div className="w-[210px]">
            <DealCard
              deal={dragging}
              member={dragging.owner_id ? membersById[dragging.owner_id] ?? null : null}
              usdRate={usdRate}
              overlay
            />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
};

export default PipelineBoard;
