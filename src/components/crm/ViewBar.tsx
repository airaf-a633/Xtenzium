import { useState } from 'react';
import {
  OPERATORS_FOR,
  OPERATOR_LABEL,
  OPERATOR_NEEDS_VALUE,
  type FieldDef,
  type Filter,
  type Operator,
  type ViewState,
} from '../../lib/views';
import type { SavedView } from '../../types/database';
import { Button, Dialog, IconButton, Input, Menu, SearchInput, useToast } from './ui';
import { cn } from '../../lib/utils';

const XIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
);

const ChevronIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
    <path d="m6 9 6 6 6-6" />
  </svg>
);

const CONTROL =
  'h-8 rounded-crm-sm border border-crm-line bg-crm-ground px-2 text-[12.5px] text-crm-ink ' +
  'transition-colors duration-150 ease-crm hover:border-crm-line-hi';

/* A trigger that looks like a control rather than a button: quiet
   until it holds a value, then it carries the accent. */
const Trigger = ({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      'inline-flex h-8 items-center gap-1.5 rounded-crm-sm border px-2.5 text-[12.5px]',
      'transition-colors duration-150 ease-crm',
      active
        ? 'border-crm-copper-line bg-crm-copper-quiet text-crm-copper'
        : 'border-crm-line text-crm-ink-2 hover:border-crm-line-hi hover:text-crm-ink',
    )}
  >
    {label}
    <ChevronIcon />
  </button>
);

interface ViewBarProps<Row> {
  fields: FieldDef<Row>[];
  view: ViewState;
  onChange: (view: ViewState) => void;
  onReset: () => void;
  savedViews: SavedView[];
  activeViewId: string | null;
  onApplySaved: (id: string) => void;
  onSave: (name: string, shared: boolean) => Promise<SavedView | null>;
  onUpdateActive: () => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
  shareUrl: () => string;
  viewsUnavailable?: boolean;
  searchPlaceholder?: string;
  /* For boards whose columns are the point — the pipeline is grouped
     by stage by definition, so offering a Group control there would
     promise something the board can't do. */
  hideGroup?: boolean;
  /* Extra controls the page owns — a view switcher, a New button. */
  children?: React.ReactNode;
}

function ViewBar<Row>({
  fields,
  view,
  onChange,
  onReset,
  savedViews,
  activeViewId,
  onApplySaved,
  onSave,
  onUpdateActive,
  onDelete,
  shareUrl,
  viewsUnavailable,
  searchPlaceholder = 'Search…',
  hideGroup = false,
  children,
}: ViewBarProps<Row>) {
  const { toast } = useToast();
  const [addingFilter, setAddingFilter] = useState(false);
  const [savingAs, setSavingAs] = useState(false);
  const [newName, setNewName] = useState('');
  const [newShared, setNewShared] = useState(false);
  const [busy, setBusy] = useState(false);

  const [draftField, setDraftField] = useState(fields[0]?.key ?? '');
  const [draftOp, setDraftOp] = useState<Operator>('is');
  const [draftValue, setDraftValue] = useState('');

  const groupable = fields.filter(f => f.groupable);
  const fieldOf = (key: string) => fields.find(f => f.key === key);
  const activeView = savedViews.find(v => v.id === activeViewId) ?? null;
  const dirty =
    view.filters.length > 0 ||
    view.sort.length > 0 ||
    (!hideGroup && Boolean(view.groupBy)) ||
    Boolean(view.search);

  const addFilter = () => {
    const def = fieldOf(draftField);
    if (!def) return;
    if (OPERATOR_NEEDS_VALUE(draftOp) && !draftValue.trim()) return;
    const filter: Filter = { field: draftField, op: draftOp, value: draftValue };
    onChange({ ...view, filters: [...view.filters, filter] });
    setAddingFilter(false);
    setDraftValue('');
  };

  const removeFilter = (index: number) =>
    onChange({ ...view, filters: view.filters.filter((_, i) => i !== index) });

  const describeFilter = (f: Filter) => {
    const def = fieldOf(f.field);
    const label = def?.label ?? f.field;
    if (!OPERATOR_NEEDS_VALUE(f.op)) return `${label} ${OPERATOR_LABEL[f.op]}`;
    const valueLabel = def?.options?.find(o => o.value === f.value)?.label ?? f.value;
    return `${label} ${OPERATOR_LABEL[f.op]} ${valueLabel}`;
  };

  const draftDef = fieldOf(draftField);
  const operators = draftDef ? OPERATORS_FOR[draftDef.type] : [];

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl());
      toast('View link copied', 'success');
    } catch {
      /* Clipboard is permission-gated and refuses in some contexts.
         Saying so beats a button that silently does nothing. */
      toast('Couldn’t reach the clipboard — copy the address bar instead.', 'danger');
    }
  };

  const save = async () => {
    if (!newName.trim()) return;
    setBusy(true);
    const saved = await onSave(newName, newShared);
    setBusy(false);
    if (!saved) {
      toast('That view didn’t save. A view with this name may already exist.', 'danger');
      return;
    }
    toast(`Saved “${saved.name}”`, 'success');
    setSavingAs(false);
    setNewName('');
    setNewShared(false);
  };

  return (
    <div className="mb-4 flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <SearchInput
          className="w-[190px]"
          value={view.search}
          onValueChange={v => onChange({ ...view, search: v })}
          placeholder={searchPlaceholder}
        />

        {/* Group by */}
        {!hideGroup && groupable.length > 0 && (
          <Menu
            label="Group by"
            align="start"
            items={[
              { label: 'No grouping', onSelect: () => onChange({ ...view, groupBy: null }) },
              ...groupable.map(f => ({
                label: f.label,
                onSelect: () => onChange({ ...view, groupBy: f.key }),
              })),
            ]}
            trigger={({ toggle }) => (
              <Trigger
                label={view.groupBy ? `Group: ${fieldOf(view.groupBy)?.label ?? view.groupBy}` : 'Group'}
                active={Boolean(view.groupBy)}
                onClick={toggle}
              />
            )}
          />
        )}

        {/* Sort */}
        <Menu
          label="Sort by"
          align="start"
          items={[
            { label: 'No sorting', onSelect: () => onChange({ ...view, sort: [] }) },
            ...fields.flatMap(f => [
              {
                label: `${f.label} ↑`,
                onSelect: () => onChange({ ...view, sort: [{ field: f.key, dir: 'asc' as const }] }),
              },
              {
                label: `${f.label} ↓`,
                onSelect: () => onChange({ ...view, sort: [{ field: f.key, dir: 'desc' as const }] }),
              },
            ]),
          ]}
          trigger={({ toggle }) => (
            <Trigger
              label={
                view.sort.length > 0
                  ? `Sort: ${fieldOf(view.sort[0].field)?.label ?? view.sort[0].field}`
                  : 'Sort'
              }
              active={view.sort.length > 0}
              onClick={toggle}
            />
          )}
        />

        <Button size="sm" onClick={() => setAddingFilter(true)}>
          + Filter
        </Button>

        {/* Saved views */}
        {!viewsUnavailable && (
          <Menu
            label="Saved views"
            align="start"
            items={[
              ...(savedViews.length === 0
                ? [{ label: 'No saved views yet', onSelect: () => {}, disabled: true }]
                : savedViews.map(v => ({
                    label: v.shared ? `${v.name} · shared` : v.name,
                    onSelect: () => onApplySaved(v.id),
                  }))),
              ...(activeView
                ? [
                    {
                      label: `Update “${activeView.name}”`,
                      onSelect: async () => {
                        const ok = await onUpdateActive();
                        toast(ok ? 'View updated' : 'That update didn’t save.', ok ? 'success' : 'danger');
                      },
                    },
                    {
                      label: `Delete “${activeView.name}”`,
                      tone: 'danger' as const,
                      onSelect: async () => {
                        const ok = await onDelete(activeView.id);
                        toast(ok ? 'View deleted' : 'Couldn’t delete that view.', ok ? 'info' : 'danger');
                      },
                    },
                  ]
                : []),
            ]}
            trigger={({ toggle }) => (
              <Trigger
                label={activeView ? activeView.name : 'Views'}
                active={Boolean(activeView)}
                onClick={toggle}
              />
            )}
          />
        )}

        {dirty && (
          <>
            {!viewsUnavailable && (
              <Button size="sm" onClick={() => setSavingAs(true)}>
                Save as…
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={copyLink}>
              Copy link
            </Button>
            <Button size="sm" variant="ghost" onClick={onReset}>
              Reset
            </Button>
          </>
        )}

        <div className="ml-auto flex flex-wrap items-center gap-2">{children}</div>
      </div>

      {/* Active filters read as chips, each removable on its own —
          a filter you can't see is a filter you'll blame the data for. */}
      {view.filters.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {view.filters.map((f, i) => (
            <span
              key={`${f.field}-${f.op}-${f.value}-${i}`}
              className="inline-flex items-center gap-1 rounded-crm-sm bg-crm-raised py-0.5 pl-2 pr-0.5 text-[11.5px] text-crm-ink-2"
            >
              {describeFilter(f)}
              <IconButton
                label={`Remove filter ${describeFilter(f)}`}
                size="sm"
                className="h-5 w-5"
                icon={<XIcon />}
                onClick={() => removeFilter(i)}
              />
            </span>
          ))}
        </div>
      )}

      {/* ── Add filter ─────────────────────────────────────────── */}
      {addingFilter && (
        <Dialog
          open
          onClose={() => setAddingFilter(false)}
          title="Add a filter"
          footer={
            <>
              <Button variant="ghost" onClick={() => setAddingFilter(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={addFilter}>
                Add filter
              </Button>
            </>
          }
        >
          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="font-crm-mono text-[10.5px] uppercase tracking-[0.12em] text-crm-ink-3">
                Field
              </span>
              <select
                value={draftField}
                onChange={e => {
                  setDraftField(e.target.value);
                  const def = fieldOf(e.target.value);
                  /* Reset the operator to one that's valid for the new
                     field type, so the form can never be in a state
                     that describes nothing. */
                  setDraftOp(def ? OPERATORS_FOR[def.type][0] : 'is');
                  setDraftValue('');
                }}
                className={cn(CONTROL, 'h-9 w-full px-3 text-[13.5px]')}
              >
                {fields.map(f => (
                  <option key={f.key} value={f.key}>
                    {f.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="font-crm-mono text-[10.5px] uppercase tracking-[0.12em] text-crm-ink-3">
                Condition
              </span>
              <select
                value={draftOp}
                onChange={e => setDraftOp(e.target.value as Operator)}
                className={cn(CONTROL, 'h-9 w-full px-3 text-[13.5px]')}
              >
                {operators.map(op => (
                  <option key={op} value={op}>
                    {OPERATOR_LABEL[op]}
                  </option>
                ))}
              </select>
            </label>

            {OPERATOR_NEEDS_VALUE(draftOp) && (
              <label className="flex flex-col gap-1.5">
                <span className="font-crm-mono text-[10.5px] uppercase tracking-[0.12em] text-crm-ink-3">
                  Value
                </span>
                {draftDef?.options ? (
                  <select
                    value={draftValue}
                    onChange={e => setDraftValue(e.target.value)}
                    className={cn(CONTROL, 'h-9 w-full px-3 text-[13.5px]')}
                  >
                    <option value="">Pick one</option>
                    {draftDef.options.map(o => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type={draftDef?.type === 'date' ? 'date' : draftDef?.type === 'number' ? 'number' : 'text'}
                    value={draftValue}
                    onChange={e => setDraftValue(e.target.value)}
                    className={cn(CONTROL, 'h-9 w-full px-3 text-[13.5px]')}
                  />
                )}
              </label>
            )}
          </div>
        </Dialog>
      )}

      {/* ── Save as ────────────────────────────────────────────── */}
      {savingAs && (
        <Dialog
          open
          onClose={() => setSavingAs(false)}
          title="Save this view"
          description="Name it after the question it answers, not the filters it uses."
          footer={
            <>
              <Button variant="ghost" onClick={() => setSavingAs(false)}>
                Cancel
              </Button>
              <Button variant="primary" loading={busy} onClick={save}>
                Save view
              </Button>
            </>
          }
        >
          <div className="flex flex-col gap-3">
            <Input
              label="Name"
              required
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="Crunch this week"
            />
            <label className="flex cursor-pointer items-center gap-2 text-[13px] text-crm-ink-2">
              <input
                type="checkbox"
                checked={newShared}
                onChange={e => setNewShared(e.target.checked)}
                className="h-3.5 w-3.5 accent-crm-copper"
              />
              Share with the team
            </label>
            <p className="m-0 text-[12px] text-crm-ink-3">
              Views are private unless shared. Either way the link in the address bar works for anyone
              who can sign in.
            </p>
          </div>
        </Dialog>
      )}

    </div>
  );
}

export default ViewBar;
