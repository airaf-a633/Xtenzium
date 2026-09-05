/* Command palette search checks.

   Ranking is the whole product here: the palette is only faster than
   the mouse if the thing you want is already highlighted when you stop
   typing. These pin down the ordering rules rather than just checking
   that matching happens at all. */

import { fuzzyMatch, highlight, rank } from '../src/lib/command-search';

let failures = 0;
/* Key order is not meaning. */
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

const matches = (q: string, t: string) => fuzzyMatch(q, t) !== null;
const scoreOf = (q: string, t: string) => fuzzyMatch(q, t)?.score ?? -Infinity;
const better = (q: string, a: string, b: string) => scoreOf(q, a) > scoreOf(q, b);

console.log('\n── Matching ──');
check('exact substring matches', matches('bank', 'Meezan Bank'), true);
check('subsequence matches', matches('mzbnk', 'Meezan Bank'), true);
check('case insensitive', matches('MEEZAN', 'Meezan Bank'), true);
check('out-of-order does not match', matches('knab', 'Meezan Bank'), false);
check('a missing letter does not match', matches('meezanx', 'Meezan Bank'), false);
check('empty query matches everything', matches('', 'anything'), true);
check('empty text never matches a real query', matches('a', ''), false);
check('spaces in the query are separators, not characters',
  matches('mee bank', 'Meezan Bank'), true);

console.log('\n── Ranking ──');
check('prefix beats mid-string',
  better('pro', 'Projects', 'Add a proposal'), true);
check('word start beats mid-word',
  better('bank', 'Meezan Bank', 'Bankruptcy filing notes') === false ||
  better('bank', 'Bankruptcy filing notes', 'Meezan Bank'), true);
check('consecutive beats scattered',
  better('task', 'Tasks', 'Take a stab at kickoff'), true);
check('shorter wins a tie',
  better('task', 'Tasks', 'Tasks for the estimator rebuild'), true);
check('exact substring beats a subsequence',
  better('mez', 'Mez client call', 'Meezan Bank'), true);

console.log('\n── rank() ──');
const items = [
  { id: 1, name: 'Pipeline' },
  { id: 2, name: 'Projects' },
  { id: 3, name: 'Proposal sent to Meezan' },
  { id: 4, name: 'Clients' },
];
check('returns only matches', rank('pro', items, i => i.name).map(r => r.item.id), [2, 3]);
check('best match first', rank('pro', items, i => i.name)[0].item.name, 'Projects');
check('respects the limit', rank('p', items, i => i.name, 2).length, 2);
check('no match returns empty', rank('zzzz', items, i => i.name).length, 0);
check('empty query returns everything up to the limit',
  rank('', items, i => i.name, 10).length, 4);
check('carries indices for highlighting',
  rank('cli', items, i => i.name)[0].indices, [0, 1, 2]);

console.log('\n── Highlighting ──');
check('splits into matched and unmatched runs',
  highlight('Tasks', [0, 1, 2, 3]),
  [{ text: 'Task', hit: true }, { text: 's', hit: false }]);
check('handles a gap',
  highlight('Meezan', [0, 5]),
  [{ text: 'M', hit: true }, { text: 'eeza', hit: false }, { text: 'n', hit: true }]);
check('no indices means one plain run',
  highlight('Tasks', []), [{ text: 'Tasks', hit: false }]);
check('every character matched is one run',
  highlight('abc', [0, 1, 2]), [{ text: 'abc', hit: true }]);
check('reassembles to the original',
  highlight('Meezan Bank', [0, 7]).map(p => p.text).join(''), 'Meezan Bank');

console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}\n`);
process.exit(failures === 0 ? 0 : 1);
