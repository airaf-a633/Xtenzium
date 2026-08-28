/* Dashboard figures.

   Every number a person might act on, pinned down. A wrong win rate or
   a receivables bucket that ages from the wrong date is worse than no
   dashboard — it's a confident lie. */

import {
  funnel,
  headline,
  lostByMonth,
  lostReasons,
  monthsBack,
  pipelineByStage,
  receivablesAging,
  teamLoad,
  throughputByMonth,
  winStats,
  wonByMonth,
} from '../src/lib/reporting';
import type { Deal, Project, Task, TeamMember } from '../src/types/database';

let failures = 0;
const stable = (v: unknown): string =>
  JSON.stringify(v, (_k, val) =>
    val && typeof val === 'object' && !Array.isArray(val)
      ? Object.fromEntries(
          Object.entries(val as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)),
        )
      : val,
  );

const check = (name: string, actual: unknown, expected: unknown) => {
  const a = stable(actual);
  const e = stable(expected);
  const ok = a === e;
  if (!ok) failures += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `\n        expected ${e}\n        actual   ${a}`}`);
};

const RATE = 280;

const deal = (over: Partial<Deal>): Deal => ({
  id: Math.random().toString(36).slice(2), title: 'Deal', lead_id: null, client_id: null,
  contact_name: null, contact_email: null, contact_phone: null, company: null,
  stage: 'new', value: 0, currency: 'PKR', probability: 50,
  expected_close: null, owner_id: null, source: 'manual',
  next_action: null, next_action_date: null, lost_reason: null,
  project_id: null, rank: 0,
  stage_changed_at: '2026-08-01T00:00:00Z', closed_at: null,
  created_at: '2026-08-01T00:00:00Z', updated_at: '2026-08-01T00:00:00Z',
  ...over,
});

const project = (over: Partial<Project>): Project => ({
  id: Math.random().toString(36).slice(2), client_id: 'c1', name: 'Project', description: null,
  status: 'active', total_value: 0, amount_paid: 0, currency: 'PKR',
  start_date: null, end_date: null,
  created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
  ...over,
});

const task = (over: Partial<Task>): Task => ({
  id: Math.random().toString(36).slice(2), project_id: null, title: 'Task', description: null,
  due_date: null, status: 'pending', assigned_to: null, recurrence_days: null,
  priority: 3, status_id: 's1', parent_task_id: null, rank: 0,
  estimate_minutes: null, started_at: null, completed_at: null,
  created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
  ...over,
});

const members: TeamMember[] = [
  { id: 'm1', name: 'Airaf Adil', designation: 'CEO', user_id: 'u1', created_at: '' },
  { id: 'm2', name: 'Sara Khan', designation: 'COO', user_id: null, created_at: '' },
];

const NOW = new Date('2026-08-28T12:00:00Z');
const dayOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

console.log('\n── Pipeline by stage ──');
const stageDeals = [
  deal({ stage: 'new', value: 100000, probability: 10 }),
  deal({ stage: 'new', value: 100000, probability: 30 }),
  deal({ stage: 'negotiation', value: 1000, currency: 'USD', probability: 100 }),
];
const stages = pipelineByStage(stageDeals, RATE);
check('one row per open stage, in order', stages.map(s => s.stage),
  ['new', 'contacted', 'qualified', 'proposal_sent', 'negotiation']);
check('counts', stages.find(s => s.stage === 'new')?.count, 2);
check('totals sum the stage', stages.find(s => s.stage === 'new')?.total, 200000);
check('weighted applies each deal’s own probability',
  stages.find(s => s.stage === 'new')?.weighted, 40000);
check('USD is normalised', stages.find(s => s.stage === 'negotiation')?.total, 280000);
check('an empty stage is present at zero, not missing',
  stages.find(s => s.stage === 'qualified'), { stage: 'qualified', label: 'Qualified', count: 0, total: 0, weighted: 0 });

console.log('\n── Funnel ──');
const funnelDeals = [
  deal({ stage: 'new' }),
  deal({ stage: 'qualified' }),
  deal({ stage: 'negotiation' }),
  deal({ stage: 'won' }),
  deal({ stage: 'lost', lost_reason: 'Price — too expensive' }),
];
const steps = funnel(funnelDeals);
check('a deal counts at every stage it passed',
  steps.map(s => s.reached), [4, 3, 3, 2, 2]);
check('lost deals are excluded — their stage at death is not recorded',
  funnel([deal({ stage: 'lost', lost_reason: 'x' })]).map(s => s.reached), [0, 0, 0, 0, 0]);
check('a won deal reaches every stage',
  funnel([deal({ stage: 'won' })]).map(s => s.reached), [1, 1, 1, 1, 1]);
check('first step has no conversion to report', steps[0].conversion, null);
check('conversion is a share of the previous step', steps[1].conversion, 75);
check('conversion is null, not zero, when the previous step was empty',
  funnel([]).map(s => s.conversion), [null, null, null, null, null]);

console.log('\n── Win stats ──');
check('win rate over closed deals only',
  winStats([deal({ stage: 'won' }), deal({ stage: 'lost', lost_reason: 'x' }), deal({ stage: 'new' })], RATE).winRate,
  50);
check('null when nothing has closed — 0% and "no data" differ',
  winStats([deal({ stage: 'new' })], RATE).winRate, null);
check('average is over won deals only',
  winStats([deal({ stage: 'won', value: 100 }), deal({ stage: 'won', value: 300 }), deal({ stage: 'new', value: 9999 })], RATE).averageWon,
  200);
check('average is zero when nothing is won', winStats([], RATE).averageWon, 0);
check('average normalises currency',
  winStats([deal({ stage: 'won', value: 100, currency: 'USD' })], RATE).averageWon, 28000);

console.log('\n── Lost reasons ──');
check('groups on the prefix before the dash',
  lostReasons([
    deal({ stage: 'lost', lost_reason: 'Price — we were too expensive — they said so' }),
    deal({ stage: 'lost', lost_reason: 'Price — we were too expensive' }),
    deal({ stage: 'lost', lost_reason: 'Went quiet' }),
  ]),
  [{ label: 'Price', value: 2 }, { label: 'Went quiet', value: 1 }]);
check('open deals are not counted', lostReasons([deal({ stage: 'new' })]), []);
check('a lost deal with no reason is skipped rather than grouped as blank',
  lostReasons([deal({ stage: 'lost', lost_reason: null })]), []);

console.log('\n── Months ──');
check('a continuous run, oldest first',
  monthsBack(3, new Date('2026-08-15T00:00:00Z')), ['2026-06', '2026-07', '2026-08']);
check('crosses a year boundary',
  monthsBack(3, new Date('2026-01-15T00:00:00Z')), ['2025-11', '2025-12', '2026-01']);
check('a quiet month renders as zero, not a missing point',
  wonByMonth([deal({ stage: 'won', value: 500, closed_at: '2026-08-10T00:00:00Z' })], RATE, 3, new Date('2026-08-15T00:00:00Z'))
    .map(p => p.value),
  [0, 0, 500]);
check('deals outside the window are ignored',
  wonByMonth([deal({ stage: 'won', value: 500, closed_at: '2020-01-01T00:00:00Z' })], RATE, 3, new Date('2026-08-15T00:00:00Z'))
    .map(p => p.value), [0, 0, 0]);
check('a won deal with no close date is not counted',
  wonByMonth([deal({ stage: 'won', value: 500, closed_at: null })], RATE, 3, new Date('2026-08-15T00:00:00Z'))
    .map(p => p.value), [0, 0, 0]);
check('lost is separate from won',
  lostByMonth([deal({ stage: 'lost', lost_reason: 'x', value: 700, closed_at: '2026-08-10T00:00:00Z' })], RATE, 2, new Date('2026-08-15T00:00:00Z'))
    .map(p => p.value), [0, 700]);
check('completed tasks by month',
  throughputByMonth([task({ completed_at: '2026-08-02T00:00:00Z' }), task({ completed_at: '2026-07-02T00:00:00Z' })], 3, new Date('2026-08-15T00:00:00Z'))
    .map(p => p.value), [0, 1, 1]);

console.log('\n── Receivables ──');
const aged = receivablesAging([
  project({ total_value: 1000, amount_paid: 0, end_date: '2026-08-27' }),   // 1 day
  project({ total_value: 2000, amount_paid: 0, end_date: '2026-07-10' }),   // ~49 days
  project({ total_value: 4000, amount_paid: 0, end_date: '2026-01-01' }),   // 90+
  project({ total_value: 5000, amount_paid: 0, end_date: null }),           // not yet due
  project({ total_value: 9000, amount_paid: 9000, end_date: '2026-01-01' }),// settled
  project({ total_value: 7000, amount_paid: 0, end_date: '2026-01-01', status: 'cancelled' }),
], RATE, dayOf(NOW));
check('buckets in order', aged.map(b => b.label),
  ['Not yet due', '1–30 days', '31–60 days', '61–90 days', '90+ days']);
check('an undated project is not overdue, it is unbilled',
  aged.find(b => b.label === 'Not yet due')?.value, 5000);
check('one day past the end date', aged.find(b => b.label === '1–30 days')?.value, 1000);
check('seven weeks past', aged.find(b => b.label === '31–60 days')?.value, 2000);
check('long overdue', aged.find(b => b.label === '90+ days')?.value, 4000);
check('a fully paid project owes nothing',
  aged.reduce((s, b) => s + b.count, 0), 4);
check('a cancelled project is not a receivable',
  aged.every(b => b.value !== 7000), true);
check('overpayment is not a negative debt',
  receivablesAging([project({ total_value: 100, amount_paid: 150 })], RATE, dayOf(NOW))
    .reduce((s, b) => s + b.value, 0), 0);

console.log('\n── Team load ──');
const loads = teamLoad([
  task({ assigned_to: 'm1', due_date: '2026-08-01' }),
  task({ assigned_to: 'm1', due_date: '2026-12-01' }),
  task({ assigned_to: 'm2' }),
  task({ assigned_to: 'm2', status: 'done' }),
  task({ assigned_to: null }),
], members, {}, dayOf(NOW));
check('most overdue first', loads[0].name, 'Airaf Adil');
check('open excludes done', loads.find(l => l.name === 'Sara Khan')?.open, 1);
check('overdue counted', loads.find(l => l.name === 'Airaf Adil')?.overdue, 1);
check('unassigned appears only when it has work',
  loads.some(l => l.name === 'Unassigned'), true);
check('unassigned is hidden when there is none',
  teamLoad([task({ assigned_to: 'm1' })], members, {}, dayOf(NOW)).some(l => l.name === 'Unassigned'),
  false);
check('logged minutes roll up per person',
  teamLoad([task({ id: 'x', assigned_to: 'm1' })], members, { x: 90 }, dayOf(NOW))
    .find(l => l.name === 'Airaf Adil')?.loggedMinutes, 90);
check('every member appears even with nothing on them',
  teamLoad([], members, {}, dayOf(NOW)).map(l => l.name), ['Airaf Adil', 'Sara Khan']);

console.log('\n── Headline ──');
const top = headline(
  [deal({ stage: 'new', value: 1000, probability: 50 }), deal({ stage: 'won', value: 9999 })],
  [project({ total_value: 500, amount_paid: 100 }), project({ status: 'cancelled', total_value: 800 })],
  [task({ due_date: '2026-08-01' }), task({ due_date: '2026-08-01', status: 'done' })],
  RATE,
  dayOf(NOW),
);
check('open deals exclude closed', top.openDeals, 1);
check('weighted pipeline excludes won', top.weightedPipeline, 500);
check('outstanding excludes cancelled', top.outstanding, 400);
check('overdue excludes done', top.overdueTasks, 1);
check('active project count', top.activeProjects, 1);

console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}\n`);
process.exit(failures === 0 ? 0 : 1);
