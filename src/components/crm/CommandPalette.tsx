import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { highlight, rank } from '../../lib/command-search';
import { PRIORITIES, priorityOf } from '../../lib/tasks';
import { STAGE_LABEL, OPEN_STAGES } from '../../lib/deals';
import { toDateInput, today } from '../../lib/date';
import { formatMoneyCompact } from '../../lib/money';
import type {
  Client,
  Deal,
  Project,
  Task,
  TaskPriority,
  TaskStatusRow,
  TeamMember,
} from '../../types/database';
import { useToast } from './ui';
import { cn } from '../../lib/utils';

export interface PaletteData {
  tasks: Task[];
  deals: Deal[];
  projects: Project[];
  clients: Client[];
  members: TeamMember[];
  statuses: TaskStatusRow[];
}

/* Three screens, and the palette never leaves them:

     root    — search everything, plus the standing commands
     record  — what you can do to the thing you just picked
     picker  — choosing the value that action needs

   Every screen is a list with the same key handling, which is why the
   whole thing can be driven without ever reaching for the mouse. */
type Screen =
  | { kind: 'root' }
  | { kind: 'record'; task?: Task; deal?: Deal }
  | { kind: 'picker'; field: 'assignee' | 'priority' | 'due' | 'stage'; task?: Task; deal?: Deal };

interface Row {
  id: string;
  label: string;
  hint?: string;
  group: string;
  indices?: number[];
  run: () => void | Promise<void>;
}

const GROUP_ORDER = ['Create', 'Actions', 'Tasks', 'Deals', 'Projects', 'Clients', 'Go to', 'App'];

const Kbd = ({ children }: { children: React.ReactNode }) => (
  <kbd className="rounded-crm-sm border border-crm-line-hi bg-crm-raised px-1.5 py-0.5 font-crm-mono text-[10px] text-crm-ink-3">
    {children}
  </kbd>
);

interface CommandPaletteProps {
  onClose: () => void;
  data: PaletteData;
  loading: boolean;
  me: TeamMember | null;
  onShowShortcuts: () => void;
  onToggleTheme: () => void;
  /* Lets a page refresh itself after the palette changes something
     under it, rather than leaving a stale board on screen. */
  onDataChanged: () => void;
}

const CommandPalette = ({
  onClose,
  data,
  loading,
  me,
  onShowShortcuts,
  onToggleTheme,
  onDataChanged,
}: CommandPaletteProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [query, setQuery] = useState('');
  const [screen, setScreen] = useState<Screen>({ kind: 'root' });
  const [active, setActive] = useState(0);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  /* Mounted fresh each time it opens, so there is nothing to reset —
     only focus to claim, one frame after the input exists. */
  useEffect(() => {
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, []);

  /* All four wrapped so the row list can depend on them honestly —
     an unlisted dependency here would mean rows built in one render
     calling handlers captured from an earlier one. */
  const go = useCallback((path: string) => {
    navigate(path);
    onClose();
  }, [navigate, onClose]);

  type TaskPatch = Partial<Pick<Task, 'assigned_to' | 'priority' | 'due_date' | 'status_id'>>;
  const patchTask = useCallback(async (task: Task, patch: TaskPatch, message: string) => {
    setBusy(true);
    const { error } = await supabase.from('tasks').update(patch).eq('id', task.id);
    setBusy(false);
    if (error) {
      toast('That didn’t save.', 'danger');
      return;
    }
    toast(message, 'success');
    onDataChanged();
    onClose();
  }, [toast, onDataChanged, onClose]);

  type DealPatch = Partial<Pick<Deal, 'owner_id' | 'stage' | 'next_action_date'>>;
  const patchDeal = useCallback(async (deal: Deal, patch: DealPatch, message: string) => {
    setBusy(true);
    const { error } = await supabase.from('deals').update(patch).eq('id', deal.id);
    setBusy(false);
    if (error) {
      toast('That didn’t save.', 'danger');
      return;
    }
    toast(message, 'success');
    onDataChanged();
    onClose();
  }, [toast, onDataChanged, onClose]);

  /* Creating from the palette lands you straight on the new task's
     action screen — which is what turns "create, assign, date, flag"
     into one uninterrupted keyboard run. */
  const createTask = useCallback(async (title: string) => {
    setBusy(true);
    const { data: created, error } = await supabase
      .from('tasks')
      .insert({ title: title.trim(), status: 'pending' })
      .select()
      .single();
    setBusy(false);
    if (error || !created) {
      toast('That task didn’t save.', 'danger');
      return;
    }
    toast('Task created', 'success');
    onDataChanged();
    setQuery('');
    setActive(0);
    setScreen({ kind: 'record', task: created as Task });
  }, [toast, onDataChanged]);

  const rows = useMemo((): Row[] => {
    const q = query.trim();

    /* ── Action screen ─────────────────────────────────────── */
    if (screen.kind === 'record') {
      const { task, deal } = screen;
      const list: Row[] = [];

      if (task) {
        const doneStatus = data.statuses.find(s => s.kind === 'done');
        const openStatus = data.statuses.find(s => s.kind === 'open');
        list.push(
          {
            id: 'assign', group: 'Actions', label: 'Assign to…', hint: 'a',
            run: () => { setScreen({ kind: 'picker', field: 'assignee', task }); setQuery(''); setActive(0); },
          },
          {
            id: 'priority', group: 'Actions', label: 'Set priority…', hint: 'p',
            run: () => { setScreen({ kind: 'picker', field: 'priority', task }); setQuery(''); setActive(0); },
          },
          {
            id: 'due', group: 'Actions', label: 'Set due date…', hint: 'd',
            run: () => { setScreen({ kind: 'picker', field: 'due', task }); setQuery(''); setActive(0); },
          },
          task.status === 'done'
            ? {
                id: 'reopen', group: 'Actions', label: 'Reopen',
                run: () => openStatus && patchTask(task, { status_id: openStatus.id }, 'Reopened'),
              }
            : {
                id: 'done', group: 'Actions', label: 'Mark done',
                run: () => doneStatus && patchTask(task, { status_id: doneStatus.id }, 'Marked done'),
              },
          { id: 'open', group: 'Actions', label: 'Open in Tasks', run: () => go('/crm/tasks') },
        );
      }

      if (deal) {
        list.push(
          {
            id: 'stage', group: 'Actions', label: 'Move stage…', hint: 's',
            run: () => { setScreen({ kind: 'picker', field: 'stage', deal }); setQuery(''); setActive(0); },
          },
          {
            id: 'owner', group: 'Actions', label: 'Assign owner…', hint: 'a',
            run: () => { setScreen({ kind: 'picker', field: 'assignee', deal }); setQuery(''); setActive(0); },
          },
          { id: 'open', group: 'Actions', label: 'Open in Pipeline', run: () => go('/crm/pipeline') },
        );
      }

      return q ? rank(q, list, r => r.label, 20).map(r => ({ ...r.item, indices: r.indices })) : list;
    }

    /* ── Value picker ──────────────────────────────────────── */
    if (screen.kind === 'picker') {
      const { field, task, deal } = screen;
      let list: Row[] = [];

      if (field === 'assignee') {
        list = [
          {
            id: 'none', group: 'Actions', label: 'Unassigned',
            run: () =>
              task
                ? patchTask(task, { assigned_to: null }, 'Unassigned')
                : deal && patchDeal(deal, { owner_id: null }, 'Owner cleared'),
          },
          ...data.members.map(m => ({
            id: m.id, group: 'Actions', label: m.name,
            hint: m.id === me?.id ? 'you' : m.designation ?? undefined,
            run: () =>
              task
                ? patchTask(task, { assigned_to: m.id }, `Assigned to ${m.name}`)
                : deal && patchDeal(deal, { owner_id: m.id }, `Owner set to ${m.name}`),
          })),
        ];
      }

      if (field === 'priority' && task) {
        list = PRIORITIES.map(p => ({
          id: String(p.value), group: 'Actions', label: p.label,
          run: () => patchTask(task, { priority: priorityOf(p.value) as TaskPriority }, `Priority set to ${p.label}`),
        }));
      }

      if (field === 'due' && task) {
        /* Relative options rather than a date field, because the
           keyboard path has to stay a list. */
        const offsets: Array<[string, number | null]> = [
          ['Today', 0], ['Tomorrow', 1], ['This Friday', ((5 - today().getDay() + 7) % 7) || 7],
          ['Next week', 7], ['In two weeks', 14], ['No date', null],
        ];
        list = offsets.map(([label, days]) => ({
          id: label, group: 'Actions', label,
          run: () => {
            if (days === null) return patchTask(task, { due_date: null }, 'Due date cleared');
            const d = today();
            d.setDate(d.getDate() + days);
            return patchTask(task, { due_date: toDateInput(d) }, `Due ${label.toLowerCase()}`);
          },
        }));
      }

      if (field === 'stage' && deal) {
        list = OPEN_STAGES.map(s => ({
          id: s.value, group: 'Actions', label: s.label,
          run: () => patchDeal(deal, { stage: s.value }, `Moved to ${STAGE_LABEL[s.value]}`),
        }));
      }

      return q ? rank(q, list, r => r.label, 20).map(r => ({ ...r.item, indices: r.indices })) : list;
    }

    /* ── Root ──────────────────────────────────────────────── */
    const commands: Row[] = [
      { id: 'go-dash', group: 'Go to', label: 'Dashboard', hint: 'g d', run: () => go('/crm') },
      { id: 'go-pipe', group: 'Go to', label: 'Pipeline', hint: 'g p', run: () => go('/crm/pipeline') },
      { id: 'go-clients', group: 'Go to', label: 'Clients', hint: 'g c', run: () => go('/crm/clients') },
      { id: 'go-projects', group: 'Go to', label: 'Projects', hint: 'g r', run: () => go('/crm/projects') },
      { id: 'go-tasks', group: 'Go to', label: 'Tasks', hint: 'g t', run: () => go('/crm/tasks') },
      { id: 'go-team', group: 'Go to', label: 'Team', hint: 'g m', run: () => go('/crm/team') },
      { id: 'theme', group: 'App', label: 'Toggle light / dark theme', run: () => { onToggleTheme(); onClose(); } },
      { id: 'shortcuts', group: 'App', label: 'Keyboard shortcuts', hint: '?', run: () => { onClose(); onShowShortcuts(); } },
    ];

    if (!q) {
      /* Cold open: the standing commands, plus whatever is on you
         right now — which is more useful than a blank list. */
      const mine = me
        ? data.tasks.filter(t => t.assigned_to === me.id && t.status !== 'done').slice(0, 5)
        : [];
      return [
        ...mine.map(t => ({
          id: t.id, group: 'Tasks', label: t.title, hint: 'assigned to you',
          run: () => { setScreen({ kind: 'record', task: t }); setQuery(''); setActive(0); },
        })),
        ...commands,
      ];
    }

    const taskRows = rank(q, data.tasks, t => t.title, 5).map(r => ({
      id: r.item.id, group: 'Tasks', label: r.item.title, indices: r.indices,
      hint: r.item.status === 'done' ? 'done' : undefined,
      run: () => { setScreen({ kind: 'record', task: r.item }); setQuery(''); setActive(0); },
    }));

    const dealRows = rank(q, data.deals, d => `${d.title} ${d.company ?? ''}`, 5).map(r => ({
      id: r.item.id, group: 'Deals', label: r.item.title,
      hint: `${STAGE_LABEL[r.item.stage]} · ${formatMoneyCompact(Number(r.item.value), r.item.currency)}`,
      run: () => { setScreen({ kind: 'record', deal: r.item }); setQuery(''); setActive(0); },
    }));

    const projectRows = rank(q, data.projects, p => p.name, 4).map(r => ({
      id: r.item.id, group: 'Projects', label: r.item.name, indices: r.indices,
      run: () => go(`/crm/projects/${r.item.id}`),
    }));

    const clientRows = rank(q, data.clients, c => `${c.name} ${c.company ?? ''}`, 4).map(r => ({
      id: r.item.id, group: 'Clients', label: r.item.name,
      hint: r.item.company ?? undefined,
      run: () => go(`/crm/clients/${r.item.id}`),
    }));

    return [
      { id: 'create-task', group: 'Create', label: `Create task “${q}”`, hint: 'Enter', run: () => createTask(q) },
      ...taskRows,
      ...dealRows,
      ...projectRows,
      ...clientRows,
      ...rank(q, commands, c => c.label, 6).map(r => ({ ...r.item, indices: r.indices })),
    ];
  }, [query, screen, data, me, go, patchTask, patchDeal, createTask, onClose, onShowShortcuts, onToggleTheme]);

  const grouped = useMemo(() => {
    const map = new Map<string, Row[]>();
    rows.forEach(r => {
      const list = map.get(r.group) ?? [];
      list.push(r);
      map.set(r.group, list);
    });
    return [...map.entries()].sort(
      ([a], [b]) => GROUP_ORDER.indexOf(a) - GROUP_ORDER.indexOf(b),
    );
  }, [rows]);

  /* Flat order must match the rendered order, or arrow keys walk a
     different list than the one on screen. */
  const flat = useMemo(() => grouped.flatMap(([, list]) => list), [grouped]);

  /* Clamped during render rather than corrected in an effect, so the
     list never paints with a highlight pointing past its end. */
  const activeIndex = flat.length === 0 ? 0 : Math.min(active, flat.length - 1);

  useEffect(() => {
    listRef.current
      ?.querySelector(`[data-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      /* Escape steps back one screen before it closes — losing a
         half-finished action to a stray keypress is infuriating. */
      if (screen.kind === 'picker') {
        const { task, deal } = screen;
        setScreen({ kind: 'record', task, deal });
        setQuery('');
        setActive(0);
      } else if (screen.kind === 'record') {
        setScreen({ kind: 'root' });
        setQuery('');
        setActive(0);
      } else {
        onClose();
      }
      return;
    }
    if (e.key === 'ArrowDown' || (e.key === 'n' && e.ctrlKey)) {
      e.preventDefault();
      setActive(i => (flat.length === 0 ? 0 : (i + 1) % flat.length));
      return;
    }
    if (e.key === 'ArrowUp' || (e.key === 'p' && e.ctrlKey)) {
      e.preventDefault();
      setActive(i => (flat.length === 0 ? 0 : (i - 1 + flat.length) % flat.length));
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      flat[activeIndex]?.run();
    }
  };

  const context =
    screen.kind === 'record'
      ? screen.task?.title ?? screen.deal?.title ?? ''
      : screen.kind === 'picker'
        ? `${screen.task?.title ?? screen.deal?.title ?? ''} · ${screen.field}`
        : '';

  return createPortal(
    <div className="crm-root fixed inset-0 z-[70] flex items-start justify-center px-4 pt-[12vh]">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden="true" />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="relative z-10 w-full max-w-[560px] overflow-hidden rounded-crm-xl border border-crm-line-hi bg-crm-surface shadow-crm-pop"
      >
        {context && (
          <div className="flex items-center gap-2 border-b border-crm-line bg-crm-raised px-4 py-2">
            <span className="truncate font-crm-mono text-[10.5px] uppercase tracking-[0.1em] text-crm-copper">
              {context}
            </span>
            <span className="ml-auto shrink-0">
              <Kbd>esc</Kbd>
            </span>
          </div>
        )}

        <input
          ref={inputRef}
          value={query}
          onChange={e => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={onKeyDown}
          placeholder={
            screen.kind === 'root'
              ? 'Search, or type to create a task…'
              : screen.kind === 'picker'
                ? 'Pick a value…'
                : 'What would you like to do?'
          }
          aria-label="Command palette search"
          className="w-full border-0 bg-transparent px-4 py-3.5 text-[15px] text-crm-ink outline-none placeholder:text-crm-faint"
        />

        <div ref={listRef} className="max-h-[52vh] overflow-y-auto border-t border-crm-line">
          {loading && (
            <p className="m-0 px-4 py-6 text-center text-[13px] text-crm-ink-3">Loading…</p>
          )}

          {!loading && flat.length === 0 && (
            <p className="m-0 px-4 py-6 text-center text-[13px] text-crm-ink-3">
              Nothing matches “{query}”.
            </p>
          )}

          {!loading &&
            grouped.map(([group, list]) => (
              <div key={group} className="py-1">
                <div className="px-4 py-1 font-crm-mono text-[10px] uppercase tracking-[0.12em] text-crm-faint">
                  {group}
                </div>
                {list.map(row => {
                  const index = flat.indexOf(row);
                  const isActive = index === activeIndex;
                  const parts = row.indices ? highlight(row.label, row.indices) : null;
                  return (
                    <button
                      key={`${group}-${row.id}`}
                      type="button"
                      data-index={index}
                      disabled={busy}
                      onMouseEnter={() => setActive(index)}
                      onClick={() => row.run()}
                      className={cn(
                        'flex w-full cursor-pointer items-center gap-3 px-4 py-2 text-left transition-colors duration-100 ease-crm',
                        isActive ? 'bg-crm-copper-quiet' : 'hover:bg-crm-raised',
                      )}
                    >
                      <span
                        className={cn(
                          'min-w-0 flex-1 truncate text-[13.5px]',
                          isActive ? 'text-crm-copper' : 'text-crm-ink',
                        )}
                      >
                        {parts
                          ? parts.map((p, i) =>
                              p.hit ? (
                                <strong key={i} className="font-semibold text-crm-copper">
                                  {p.text}
                                </strong>
                              ) : (
                                <span key={i}>{p.text}</span>
                              ),
                            )
                          : row.label}
                      </span>
                      {row.hint && (
                        <span className="shrink-0 font-crm-mono text-[10.5px] text-crm-faint">
                          {row.hint}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
        </div>

        <div className="flex items-center gap-3 border-t border-crm-line px-4 py-2 text-[11px] text-crm-faint">
          <span className="flex items-center gap-1"><Kbd>↑</Kbd><Kbd>↓</Kbd> navigate</span>
          <span className="flex items-center gap-1"><Kbd>↵</Kbd> select</span>
          <span className="ml-auto flex items-center gap-1"><Kbd>esc</Kbd> back</span>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default CommandPalette;
