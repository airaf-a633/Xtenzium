/* Realtime reconciliation and inbox checks.

   The merge rules are the whole phase. The failure they exist to
   prevent is subtle and infuriating: you drag a card, it moves, and
   then half a second later it jumps back because the echo of your own
   change arrived carrying the state from before your second edit. */

import { applyChange, applyChanges, reconcile, type RowLike } from '../src/lib/realtime';
import {
  badgeCount,
  dealNudges,
  relativeTime,
  sortNudges,
  taskNudges,
  unreadCount,
} from '../src/lib/notifications';
import { toDateInput } from '../src/lib/date';
import type { Deal, Notification, Task } from '../src/types/database';

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

interface Row extends RowLike {
  id: string;
  title: string;
  updated_at?: string | null;
}

const row = (id: string, title: string, updated_at?: string | null): Row => ({ id, title, updated_at });

const T1 = '2026-08-28T10:00:00Z';
const T2 = '2026-08-28T10:00:05Z';
const T3 = '2026-08-28T10:00:09Z';

console.log('\n── applyChange ──');
check('insert appends',
  applyChange([row('a', 'A', T1)], { type: 'INSERT', row: row('b', 'B', T1) }).map(r => r.id),
  ['a', 'b']);
check('delete removes',
  applyChange([row('a', 'A', T1), row('b', 'B', T1)], { type: 'DELETE', row: row('b', 'B') }).map(r => r.id),
  ['a']);
check('deleting something absent leaves the list identical',
  applyChange([row('a', 'A', T1)], { type: 'DELETE', row: row('zzz', '?') }).length, 1);
check('a delete that changes nothing keeps the same array reference', (() => {
  const rows = [row('a', 'A', T1)];
  return applyChange(rows, { type: 'DELETE', row: row('zzz', '?') }) === rows;
})(), true);

check('a newer update is applied',
  applyChange([row('a', 'Old', T1)], { type: 'UPDATE', row: row('a', 'New', T2) })[0].title,
  'New');
check('a stale echo is ignored — this is the card-jumping-back bug',
  applyChange([row('a', 'Local edit', T2)], { type: 'UPDATE', row: row('a', 'Server echo', T1) })[0].title,
  'Local edit');
check('an equal timestamp is applied — same write, safe either way',
  applyChange([row('a', 'Old', T2)], { type: 'UPDATE', row: row('a', 'New', T2) })[0].title,
  'New');
check('a stale echo keeps the same array reference', (() => {
  const rows = [row('a', 'Local', T2)];
  return applyChange(rows, { type: 'UPDATE', row: row('a', 'Echo', T1) }) === rows;
})(), true);
check('an update for a row we do not hold is added — it may have just become visible',
  applyChange([row('a', 'A', T1)], { type: 'UPDATE', row: row('c', 'C', T2) }).map(r => r.id),
  ['a', 'c']);
check('an update merges rather than replacing wholesale', (() => {
  const local = { id: 'a', title: 'A', updated_at: T1, extra: 'kept' };
  const merged = applyChange([local], { type: 'UPDATE', row: { id: 'a', title: 'B', updated_at: T2 } });
  return (merged[0] as typeof local).extra;
})(), 'kept');
check('a row with no timestamp is always applied — nothing to compare',
  applyChange([row('a', 'Old')], { type: 'UPDATE', row: row('a', 'New') })[0].title, 'New');

console.log('\n── applyChanges ──');
check('folds a burst in order',
  applyChanges([row('a', 'A', T1)], [
    { type: 'INSERT', row: row('b', 'B', T1) },
    { type: 'UPDATE', row: row('a', 'A2', T2) },
    { type: 'DELETE', row: row('b', 'B') },
  ]).map(r => `${r.id}:${r.title}`),
  ['a:A2']);
check('an empty burst is a no-op', (() => {
  const rows = [row('a', 'A', T1)];
  return applyChanges(rows, []) === rows;
})(), true);

console.log('\n── reconcile after a reconnect ──');
check('server rows win when newer',
  reconcile([row('a', 'Local', T1)], [row('a', 'Server', T2)])[0].title, 'Server');
check('a local edit newer than the server survives the refetch',
  reconcile([row('a', 'Local', T3)], [row('a', 'Server', T2)])[0].title, 'Local');
check('rows deleted while offline disappear',
  reconcile([row('a', 'A', T1), row('b', 'B', T1)], [row('a', 'A', T1)]).map(r => r.id), ['a']);
check('an in-flight local insert is not swallowed',
  reconcile([row('a', 'A', T1), row('new', 'Pending')], [row('a', 'A', T1)]).map(r => r.id),
  ['a', 'new']);
check('a saved local row absent from the server is treated as deleted',
  reconcile([row('a', 'A', T1), row('gone', 'Gone', T1)], [row('a', 'A', T1)]).map(r => r.id),
  ['a']);

/* ── Inbox ──────────────────────────────────────────────────────── */

const iso = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return toDateInput(d);
};

const deal = (over: Partial<Deal>): Deal => ({
  id: 'd1', title: 'A deal', lead_id: null, client_id: null,
  contact_name: null, contact_email: null, contact_phone: null, company: null,
  stage: 'negotiation', value: 0, currency: 'PKR', probability: 50,
  expected_close: null, owner_id: 'm1', source: 'manual',
  next_action: null, next_action_date: null, lost_reason: null,
  project_id: null, rank: 0,
  stage_changed_at: new Date().toISOString(), closed_at: null,
  created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  ...over,
});

const task = (over: Partial<Task>): Task => ({
  id: 't1', project_id: null, title: 'A task', description: null,
  due_date: null, status: 'pending', assigned_to: 'm1', recurrence_days: null,
  priority: 3, status_id: 's1', parent_task_id: null, rank: 0,
  estimate_minutes: null, started_at: null, completed_at: null,
  created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  ...over,
});

const note = (over: Partial<Notification>): Notification => ({
  id: 'n1', recipient_id: 'm1', actor_id: 'm2', type: 'mention',
  entity_type: 'task', entity_id: 't1', title: 'A task', body: null,
  read_at: null, created_at: new Date().toISOString(),
  ...over,
});

console.log('\n── Nudges ──');
check('a deal with no next step is flagged',
  dealNudges([deal({})], 'm1').map(n => n.kind), ['deal_no_action']);
check('a deal with an overdue action is flagged',
  dealNudges([deal({ next_action_date: iso(-1) })], 'm1').map(n => n.kind), ['deal_overdue']);
check('a deal in hand is quiet',
  dealNudges([deal({ next_action_date: iso(2) })], 'm1'), []);
check('a won deal never nags',
  dealNudges([deal({ stage: 'won', lost_reason: null })], 'm1'), []);
check('another person’s deal is not your problem',
  dealNudges([deal({ owner_id: 'm2' })], 'm1'), []);
check('passing null owner returns the whole pipeline’s',
  dealNudges([deal({ owner_id: 'm2' })], null).length, 1);

check('an overdue task is flagged',
  taskNudges([task({ due_date: iso(-3) })], 'm1').map(n => n.body), ['Overdue by 3 days']);
check('one day overdue reads as a day, not 1 days',
  taskNudges([task({ due_date: iso(-1) })], 'm1').map(n => n.body), ['Overdue by a day']);
check('due today is flagged, but softly',
  taskNudges([task({ due_date: iso(0) })], 'm1').map(n => n.kind), ['task_today']);
check('due later is quiet', taskNudges([task({ due_date: iso(4) })], 'm1'), []);
check('a done task never nags', taskNudges([task({ due_date: iso(-5), status: 'done' })], 'm1'), []);
check('an undated task never nags', taskNudges([task({ due_date: null })], 'm1'), []);

console.log('\n── Ordering and the badge ──');
check('late things sort above unplanned ones',
  sortNudges([
    ...dealNudges([deal({ id: 'x' })], 'm1'),
    ...taskNudges([task({ due_date: iso(-1) })], 'm1'),
  ]).map(n => n.kind),
  ['task_overdue', 'deal_no_action']);
check('ties break alphabetically, so the order is stable',
  sortNudges([
    ...taskNudges([task({ id: 'b', title: 'Beta', due_date: iso(-1) })], 'm1'),
    ...taskNudges([task({ id: 'a', title: 'Alpha', due_date: iso(-1) })], 'm1'),
  ]).map(n => n.title),
  ['Alpha', 'Beta']);

check('unread counts only unread', unreadCount([note({}), note({ id: 'n2', read_at: '2026-01-01' })]), 1);
check('the badge adds unread and late',
  badgeCount([note({})], [...dealNudges([deal({})], 'm1')]), 2);
check('due-today is excluded from the badge — it would never reach zero',
  badgeCount([], taskNudges([task({ due_date: iso(0) })], 'm1')), 0);
check('going cold is excluded from the badge too',
  badgeCount([], dealNudges([deal({
    next_action_date: iso(3),
    stage_changed_at: new Date(Date.now() - 40 * 86400000).toISOString(),
  })], 'm1')), 0);
check('nothing pending means no badge', badgeCount([], []), 0);

console.log('\n── Relative time ──');
const NOW = new Date('2026-08-28T12:00:00Z').getTime();
check('under a minute', relativeTime('2026-08-28T11:59:30Z', NOW), 'just now');
check('minutes', relativeTime('2026-08-28T11:30:00Z', NOW), '30m');
check('hours', relativeTime('2026-08-28T09:00:00Z', NOW), '3h');
check('days', relativeTime('2026-08-26T12:00:00Z', NOW), '2d');
check('past a week it becomes a date', relativeTime('2026-08-01T12:00:00Z', NOW), 'Aug 1');

console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}\n`);
process.exit(failures === 0 ? 0 : 1);
