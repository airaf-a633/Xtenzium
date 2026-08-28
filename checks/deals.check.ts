/* Pipeline logic checks — the parts of the CRM that are pure functions
   and therefore worth pinning down: currency conversion, forecast
   weighting, the attention states a deal card shows, and rank
   insertion.

   Deliberately outside `src` so the app build never sees it (tsconfig
   includes only `src`). No test framework — one file, one command:

       npm run check

   Two of these exist because they caught real bugs:
     - "today is NOT overdue" caught date-only columns being parsed as
       UTC midnight, which reads as yesterday anywhere behind UTC.
     - the "UTC trap" block guards the fix.
*/

import {
  OPEN_STAGES,
  attentionOf,
  forecastOf,
  isOpen,
  rankBetween,
  stageConfig,
} from '../src/lib/deals';
import { formatMoney, formatMoneyCompact, toPkr } from '../src/lib/money';
import { toDateInput, parseDateOnly, daysBetween } from '../src/lib/date';
import type { Deal } from '../src/types/database';

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
  return toDateInput(d);          // local calendar date, not the UTC one
};

const deal = (over: Partial<Deal>): Deal => ({
  id: 'd', title: 't', lead_id: null, client_id: null,
  contact_name: null, contact_email: null, contact_phone: null, company: null,
  stage: 'new', value: 0, currency: 'PKR', probability: 10,
  expected_close: null, owner_id: null, source: 'manual',
  next_action: null, next_action_date: null, lost_reason: null,
  project_id: null, rank: 0,
  stage_changed_at: new Date().toISOString(), closed_at: null,
  created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  ...over,
});

console.log('\n── Currency ──');
check('PKR passes through', toPkr(100000, 'PKR', 280), 100000);
check('USD converts', toPkr(2500, 'USD', 280), 700000);
check('lowercase usd still converts', toPkr(100, 'usd', 280), 28000);
check('whitespace tolerated', toPkr(100, ' USD ', 280), 28000);

console.log('\n── Formatting ──');
check('grouped', formatMoney(1234567), 'PKR 1,234,567');
check('rounds, never truncates', formatMoney(999.6), 'PKR 1,000');
check('thousands', formatMoneyCompact(45000), 'PKR 45K');
check('lakh', formatMoneyCompact(450000), 'PKR 4.5L');
check('lakh, no decimal past 10L', formatMoneyCompact(2500000), 'PKR 25L');
check('crore', formatMoneyCompact(15000000), 'PKR 1.5Cr');
check('under 1000 stays exact', formatMoneyCompact(850), 'PKR 850');

console.log('\n── Forecast ──');
const pipeline = [
  deal({ value: 1000000, currency: 'PKR', probability: 50 }),
  deal({ value: 1000, currency: 'USD', probability: 100 }),
];
const f = forecastOf(pipeline, 280);
check('counts every deal', f.count, 2);
check('total normalises USD', f.total, 1000000 + 280000);
check('weighted applies probability', f.weighted, 500000 + 280000);
check('empty pipeline is zero, not NaN', forecastOf([], 280), { count: 0, total: 0, weighted: 0 });

console.log('\n── Attention ──');
check('closed deals never nag', attentionOf(deal({ stage: 'won', next_action_date: null })), 'none');
check('lost deals never nag', attentionOf(deal({ stage: 'lost', next_action_date: null })), 'none');
check('no next action is flagged', attentionOf(deal({ next_action_date: null })), 'no-action');
check('yesterday is overdue', attentionOf(deal({ next_action_date: iso(-1) })), 'overdue');
check('today is NOT overdue', attentionOf(deal({ next_action_date: iso(0) })), 'none');
check('future action is fine', attentionOf(deal({ next_action_date: iso(3) })), 'none');
check(
  'stale when it outsits the stage',
  attentionOf(deal({
    stage: 'negotiation',            // 7-day fuse
    next_action_date: iso(5),
    stage_changed_at: new Date(Date.now() - 20 * 86400000).toISOString(),
  })),
  'stale',
);
check(
  'inside the fuse is not stale',
  attentionOf(deal({
    stage: 'qualified',              // 14-day fuse
    next_action_date: iso(5),
    stage_changed_at: new Date(Date.now() - 3 * 86400000).toISOString(),
  })),
  'none',
);
check(
  'overdue outranks stale',
  attentionOf(deal({
    stage: 'negotiation',
    next_action_date: iso(-2),
    stage_changed_at: new Date(Date.now() - 40 * 86400000).toISOString(),
  })),
  'overdue',
);

console.log('\n── Date handling (the UTC trap) ──');
check('date-only string is a LOCAL date', parseDateOnly('2026-08-28').getDate(), 28);
check('local month survives parsing', parseDateOnly('2026-08-28').getMonth(), 7);
check('round-trips through the input format', toDateInput(parseDateOnly('2026-01-01')), '2026-01-01');
check('no off-by-one on the 1st', toDateInput(parseDateOnly('2026-03-01')), '2026-03-01');
check('same day is zero days apart', daysBetween(parseDateOnly('2026-08-28'), parseDateOnly('2026-08-28')), 0);
check('spans a DST-style boundary', daysBetween(parseDateOnly('2026-03-28'), parseDateOnly('2026-03-30')), 2);

console.log('\n── Stage config ──');
check('five open stages', OPEN_STAGES.length, 5);
check('open stages exclude won', isOpen('won'), false);
check('open stages exclude lost', isOpen('lost'), false);
check('new is open', isOpen('new'), true);
check('probability rises across stages',
  OPEN_STAGES.map(s => s.defaultProbability),
  [10, 25, 45, 65, 85]);
check('every open stage has config', OPEN_STAGES.every(s => stageConfig(s.value) !== undefined), true);
check('closed stages have no column config', stageConfig('won'), undefined);

console.log('\n── Ranking ──');
check('empty column', rankBetween(null, null), 0);
check('drop at top', rankBetween(null, 5), 4);
check('drop at bottom', rankBetween(5, null), 6);
check('drop between', rankBetween(2, 4), 3);
check('halves a tight gap', rankBetween(1, 1.5), 1.25);
check('stays strictly between after repeated splits', (() => {
  let lo = 0, hi = 1;
  for (let i = 0; i < 40; i += 1) {
    const mid = rankBetween(lo, hi);
    if (!(mid > lo && mid < hi)) return `broke at split ${i}`;
    hi = mid;
  }
  return 'ok';
})(), 'ok');

console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}\n`);
process.exit(failures === 0 ? 0 : 1);
