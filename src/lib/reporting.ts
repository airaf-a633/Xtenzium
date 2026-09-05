/* ────────────────────────────────────────────────────────────────
   Every figure on the dashboard, as a pure function.

   Aggregating in the client rather than in SQL views is a deliberate
   choice for this size of business — see the note at the top of
   migration 010. The payoff is here: each number below can be checked
   directly, which matters more for numbers somebody makes decisions
   on than for almost anything else in the app.
   ──────────────────────────────────────────────────────────────── */

import type { Deal, Project, Task, TeamMember } from '../types/database';
import { OPEN_STAGES, STAGE_LABEL, isOpen } from './deals';
import { toPkr } from './money';
import { parseDateOnly, today } from './date';

export interface StageSlice {
  stage: string;
  label: string;
  count: number;
  total: number;
  weighted: number;
}

export const pipelineByStage = (deals: Deal[], rate: number): StageSlice[] =>
  OPEN_STAGES.map(stage => {
    const inStage = deals.filter(d => d.stage === stage.value);
    return {
      stage: stage.value,
      label: stage.label,
      count: inStage.length,
      total: inStage.reduce((sum, d) => sum + toPkr(Number(d.value), d.currency, rate), 0),
      weighted: inStage.reduce(
        (sum, d) => sum + toPkr(Number(d.value), d.currency, rate) * (d.probability / 100),
        0,
      ),
    };
  });

/* Stage-to-stage conversion.

   A deal sitting in Negotiation also passed through Qualified, so
   "how many got this far" is cumulative — not the number in that
   column right now.

   Lost deals are excluded, and that is a real limitation rather than a
   simplification: when a deal is lost, `stage` becomes 'lost' and the
   stage it died in is not retained anywhere queryable. Counting a lost
   deal at step one would understate every downstream conversion;
   counting it at every step would overstate them. So the funnel reads
   "of the deals still alive or won, how far did they get" — which is
   true, and says so on the chart.

   Fixing this properly means recording the stage at close. That is a
   one-column migration, worth doing when the funnel starts driving
   decisions. */
export interface FunnelStep {
  stage: string;
  label: string;
  reached: number;
  /* Share of the previous step that made it here. Null for the first
     step, which has nothing to convert from. */
  conversion: number | null;
}

export const funnel = (deals: Deal[]): FunnelStep[] => {
  const order = OPEN_STAGES.map(s => s.value);
  const counted = deals.filter(d => d.stage === 'won' || isOpen(d.stage));

  const reached = order.map((_, i) =>
    counted.filter(d => d.stage === 'won' || order.indexOf(d.stage) >= i).length,
  );

  return order.map((stage, i) => ({
    stage,
    label: STAGE_LABEL[stage as keyof typeof STAGE_LABEL] ?? stage,
    reached: reached[i],
    conversion:
      i === 0 || reached[i - 1] === 0 ? null : Math.round((reached[i] / reached[i - 1]) * 100),
  }));
};

export interface WinStats {
  won: number;
  lost: number;
  winRate: number | null;
  averageWon: number;
}

export const winStats = (deals: Deal[], rate: number): WinStats => {
  const won = deals.filter(d => d.stage === 'won');
  const lost = deals.filter(d => d.stage === 'lost');
  const closed = won.length + lost.length;
  return {
    won: won.length,
    lost: lost.length,
    /* Null, not zero, when nothing has closed. A 0% win rate and "no
       data yet" mean opposite things. */
    winRate: closed === 0 ? null : Math.round((won.length / closed) * 100),
    averageWon:
      won.length === 0
        ? 0
        : won.reduce((s, d) => s + toPkr(Number(d.value), d.currency, rate), 0) / won.length,
  };
};

export interface Slice {
  label: string;
  value: number;
}

/* Lost reasons, grouped on the prefix before the em dash — which is
   the fixed list the close dialog writes, with any free text after it. */
export const lostReasons = (deals: Deal[]): Slice[] => {
  const counts = new Map<string, number>();
  deals
    .filter(d => d.stage === 'lost' && d.lost_reason)
    .forEach(d => {
      const label = (d.lost_reason as string).split(' — ')[0].trim();
      counts.set(label, (counts.get(label) ?? 0) + 1);
    });
  return [...counts.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
};

/* ── Money over time ───────────────────────────────────────────── */

export interface MonthPoint {
  month: string;
  label: string;
  value: number;
}

const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const monthLabel = (key: string) => {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'short' });
};

/* A continuous run of months, so a quiet month renders as a gap at
   zero rather than being silently skipped — which would make a flat
   line look like growth. */
export const monthsBack = (count: number, from = new Date()): string[] => {
  const keys: string[] = [];
  const cursor = new Date(from.getFullYear(), from.getMonth(), 1);
  for (let i = count - 1; i >= 0; i -= 1) {
    const d = new Date(cursor.getFullYear(), cursor.getMonth() - i, 1);
    keys.push(monthKey(d));
  }
  return keys;
};

export const wonByMonth = (deals: Deal[], rate: number, months = 6, from = new Date()): MonthPoint[] => {
  const keys = monthsBack(months, from);
  const totals = new Map(keys.map(k => [k, 0]));
  deals
    .filter(d => d.stage === 'won' && d.closed_at)
    .forEach(d => {
      const key = monthKey(new Date(d.closed_at as string));
      if (totals.has(key)) {
        totals.set(key, (totals.get(key) ?? 0) + toPkr(Number(d.value), d.currency, rate));
      }
    });
  return keys.map(month => ({ month, label: monthLabel(month), value: totals.get(month) ?? 0 }));
};

export const lostByMonth = (deals: Deal[], rate: number, months = 6, from = new Date()): MonthPoint[] => {
  const keys = monthsBack(months, from);
  const totals = new Map(keys.map(k => [k, 0]));
  deals
    .filter(d => d.stage === 'lost' && d.closed_at)
    .forEach(d => {
      const key = monthKey(new Date(d.closed_at as string));
      if (totals.has(key)) {
        totals.set(key, (totals.get(key) ?? 0) + toPkr(Number(d.value), d.currency, rate));
      }
    });
  return keys.map(month => ({ month, label: monthLabel(month), value: totals.get(month) ?? 0 }));
};

/* ── Receivables ───────────────────────────────────────────────── */

export interface AgeBucket {
  label: string;
  value: number;
  count: number;
}

/* Aged from the project's end date — the point money became due. A
   project with no end date is not overdue, it is simply unbilled, and
   putting it in "90+" would invent a debt nobody is owed. */
export const receivablesAging = (projects: Project[], rate: number, now = today()): AgeBucket[] => {
  const buckets: AgeBucket[] = [
    { label: 'Not yet due', value: 0, count: 0 },
    { label: '1–30 days', value: 0, count: 0 },
    { label: '31–60 days', value: 0, count: 0 },
    { label: '61–90 days', value: 0, count: 0 },
    { label: '90+ days', value: 0, count: 0 },
  ];

  projects.forEach(project => {
    if (project.status === 'cancelled') return;
    const outstanding = Number(project.total_value) - Number(project.amount_paid);
    if (outstanding <= 0) return;

    const pkr = toPkr(outstanding, project.currency, rate);
    let index = 0;
    if (project.end_date) {
      const days = Math.floor((now.getTime() - parseDateOnly(project.end_date).getTime()) / 86_400_000);
      if (days > 90) index = 4;
      else if (days > 60) index = 3;
      else if (days > 30) index = 2;
      else if (days > 0) index = 1;
    }
    buckets[index].value += pkr;
    buckets[index].count += 1;
  });

  return buckets;
};

/* ── Team ──────────────────────────────────────────────────────── */

export interface Load {
  memberId: string | null;
  name: string;
  open: number;
  overdue: number;
  loggedMinutes: number;
}

export const teamLoad = (
  tasks: Task[],
  members: TeamMember[],
  loggedByTask: Record<string, number>,
  now = today(),
): Load[] => {
  const rows: Load[] = members.map(m => ({
    memberId: m.id,
    name: m.name,
    open: 0,
    overdue: 0,
    loggedMinutes: 0,
  }));
  const unassigned: Load = { memberId: null, name: 'Unassigned', open: 0, overdue: 0, loggedMinutes: 0 };
  const byId = new Map(rows.map(r => [r.memberId, r]));

  tasks.forEach(task => {
    const row = task.assigned_to ? byId.get(task.assigned_to) : unassigned;
    if (!row) return;
    row.loggedMinutes += loggedByTask[task.id] ?? 0;
    if (task.status === 'done') return;
    row.open += 1;
    if (task.due_date && parseDateOnly(task.due_date) < now) row.overdue += 1;
  });

  const all = unassigned.open > 0 ? [...rows, unassigned] : rows;
  /* Busiest first, so the person to worry about is at the top. */
  return all.sort((a, b) => b.overdue - a.overdue || b.open - a.open || a.name.localeCompare(b.name));
};

/* Tasks completed per month, from the timestamp 007's trigger sets. */
export const throughputByMonth = (tasks: Task[], months = 6, from = new Date()): MonthPoint[] => {
  const keys = monthsBack(months, from);
  const counts = new Map(keys.map(k => [k, 0]));
  tasks
    .filter(t => t.completed_at)
    .forEach(t => {
      const key = monthKey(new Date(t.completed_at as string));
      if (counts.has(key)) counts.set(key, (counts.get(key) ?? 0) + 1);
    });
  return keys.map(month => ({ month, label: monthLabel(month), value: counts.get(month) ?? 0 }));
};

/* ── Headline ──────────────────────────────────────────────────── */

export interface Headline {
  openDeals: number;
  weightedPipeline: number;
  outstanding: number;
  activeProjects: number;
  overdueTasks: number;
}

export const headline = (
  deals: Deal[],
  projects: Project[],
  tasks: Task[],
  rate: number,
  now = today(),
): Headline => {
  const open = deals.filter(d => isOpen(d.stage));
  return {
    openDeals: open.length,
    weightedPipeline: open.reduce(
      (s, d) => s + toPkr(Number(d.value), d.currency, rate) * (d.probability / 100),
      0,
    ),
    outstanding: projects
      .filter(p => p.status !== 'cancelled')
      .reduce((s, p) => {
        const due = Number(p.total_value) - Number(p.amount_paid);
        return due > 0 ? s + toPkr(due, p.currency, rate) : s;
      }, 0),
    activeProjects: projects.filter(p => p.status === 'active').length,
    overdueTasks: tasks.filter(
      t => t.status !== 'done' && t.due_date != null && parseDateOnly(t.due_date) < now,
    ).length,
  };
};
