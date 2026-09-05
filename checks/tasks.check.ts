/* Task logic checks. Same contract as deals.check.ts — outside `src`,
   no framework, run with `npm run check`.

   The duration parser gets the heaviest coverage because it is the one
   place in the CRM that accepts free text and turns it into a number
   somebody later bills against. */

import {
  PRIORITIES,
  daysUntilDue,
  estimateOverrun,
  extractMentions,
  formatDuration,
  parseDuration,
  priorityOf,
  rankBetween,
  sortStatuses,
  toneOf,
} from '../src/lib/tasks';
import { toDateInput } from '../src/lib/date';
import type { Task, TaskStatusRow, TeamMember } from '../src/types/database';

let failures = 0;
/* Key order is not meaning. Stringifying with sorted keys makes the
   comparison about the value, not about the order the object happened
   to be built in. */
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

const iso = (daysFromToday: number) => {
  const d = new Date();
  d.setDate(d.getDate() + daysFromToday);
  return toDateInput(d);
};

const task = (over: Partial<Task>): Task => ({
  id: 't', project_id: null, title: 'Task', description: null,
  due_date: null, status: 'pending', assigned_to: null, recurrence_days: null,
  priority: 3, status_id: 'status-todo', parent_task_id: null, rank: 0,
  estimate_minutes: null, started_at: null, completed_at: null,
  created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  ...over,
});

const statuses: TaskStatusRow[] = [
  { id: 's-todo', key: 'todo', label: 'To Do', kind: 'open', tone: 'neutral', position: 1 },
  { id: 's-prog', key: 'in_progress', label: 'In Progress', kind: 'active', tone: 'info', position: 2 },
  { id: 's-done', key: 'done', label: 'Done', kind: 'done', tone: 'success', position: 5 },
];

const members: TeamMember[] = [
  { id: 'm1', name: 'Airaf Adil', designation: 'CEO', user_id: 'u1', created_at: '' },
  { id: 'm2', name: 'Sara Khan', designation: 'COO', user_id: null, created_at: '' },
];

console.log('\n── Duration: formatting ──');
check('minutes only', formatDuration(45), '45m');
check('exact hours drop the minutes', formatDuration(120), '2h');
check('hours and minutes', formatDuration(90), '1h 30m');
check('never renders 0h', formatDuration(59), '59m');
check('null is a dash, not zero', formatDuration(null), '—');
check('zero is a dash', formatDuration(0), '—');

console.log('\n── Duration: parsing what people actually type ──');
check('bare number is minutes', parseDuration('90'), 90);
check('decimal hours', parseDuration('1.5h'), 90);
check('hours and minutes', parseDuration('1h 30m'), 90);
check('no space', parseDuration('1h30m'), 90);
check('hours only', parseDuration('2h'), 120);
check('minutes only', parseDuration('45m'), 45);
check('uppercase', parseDuration('2H'), 120);
check('surrounding space', parseDuration('  45m  '), 45);
check('written out', parseDuration('2 hours'), 120);
check('minutes written out', parseDuration('30 mins'), 30);
check('empty is null, not zero', parseDuration(''), null);
check('nonsense is null', parseDuration('soon'), null);
check('zero is null — logging 0 is a mistake', parseDuration('0'), null);
check('negative is rejected', parseDuration('-30'), null);
check('a bare unit with no number is null', parseDuration('h'), null);

console.log('\n── Estimate overrun ──');
check('under estimate is not an overrun', estimateOverrun(60, 120), null);
check('over estimate reports the excess', estimateOverrun(180, 120), 60);
check('no estimate means no overrun', estimateOverrun(180, null), null);
check('nothing logged means no overrun', estimateOverrun(0, 120), null);
check('exactly on estimate is not over', estimateOverrun(120, 120), null);

console.log('\n── Priority ──');
check('four levels', PRIORITIES.length, 4);
check('urgent sorts first', PRIORITIES[0].label, 'Urgent');
check('valid value passes through', priorityOf(1), 1);
check('garbage falls back to Normal', priorityOf(9), 3);
check('non-numeric falls back to Normal', priorityOf(Number('x')), 3);
check('only Urgent and High are marked', PRIORITIES.filter(p => p.marked).map(p => p.label), ['Urgent', 'High']);

console.log('\n── Status tones ──');
check('known tone passes through', toneOf('success'), 'success');
check('a typo in the table degrades safely', toneOf('greenish'), 'neutral');
check('statuses sort by position', sortStatuses([statuses[2], statuses[0], statuses[1]]).map(s => s.key),
  ['todo', 'in_progress', 'done']);

console.log('\n── Due-date arithmetic ──');
check('today is zero days out', daysUntilDue(iso(0)), 0);
check('tomorrow is one', daysUntilDue(iso(1)), 1);
check('yesterday is minus one', daysUntilDue(iso(-1)), -1);

console.log('\n── Mentions ──');
check('first name matches', extractMentions('can you look @sara', members), ['m2']);
check('case insensitive', extractMentions('@AIRAF ping', members), ['m1']);
check('full name with no space', extractMentions('@sarakhan please', members), ['m2']);
check('two mentions', extractMentions('@airaf @sara sync?', members).sort(), ['m1', 'm2']);
check('unknown handle is ignored', extractMentions('@nobody hello', members), []);
check('no mentions is empty, not null', extractMentions('just a comment', members), []);
check('an email is not a mention', extractMentions('mail me at a@b.com', members), []);

console.log('\n── Ranking ──');
check('empty column', rankBetween(null, null), 0);
check('drop at top', rankBetween(null, 5), 4);
check('drop at bottom', rankBetween(5, null), 6);
check('drop between', rankBetween(2, 4), 3);

console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}\n`);
process.exit(failures === 0 ? 0 : 1);
