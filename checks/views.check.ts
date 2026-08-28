/* Views engine checks.

   This is the phase-03 core: filter, search, sort, group, and the URL
   codec that makes a view shareable. Every board in the CRM runs
   through it, so a bug here is a bug everywhere at once. */

import {
  EMPTY_VIEW,
  applyFilters,
  applyGroup,
  applySearch,
  applySort,
  applyView,
  configToView,
  describeView,
  paramsToView,
  viewToConfig,
  viewToParams,
  type FieldDef,
  type ViewState,
} from '../src/lib/views';

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

interface Row {
  id: string;
  title: string;
  status: string | null;
  owner: string | null;
  value: number;
  due: string | null;
}

const fields: FieldDef<Row>[] = [
  { key: 'title', label: 'Title', type: 'text', get: r => r.title },
  {
    key: 'status',
    label: 'Status',
    type: 'select',
    groupable: true,
    get: r => r.status,
    options: [
      { value: 'todo', label: 'To Do' },
      { value: 'doing', label: 'Doing' },
      { value: 'done', label: 'Done' },
    ],
  },
  {
    key: 'owner',
    label: 'Owner',
    type: 'member',
    groupable: true,
    get: r => r.owner,
    options: [
      { value: 'm1', label: 'Airaf' },
      { value: 'm2', label: 'Sara' },
    ],
  },
  { key: 'value', label: 'Value', type: 'number', get: r => r.value },
  { key: 'due', label: 'Due', type: 'date', get: r => r.due },
];

const rows: Row[] = [
  { id: 'a', title: 'Rewire the estimator', status: 'todo', owner: 'm1', value: 300, due: '2026-09-10' },
  { id: 'b', title: 'PCB revision B', status: 'doing', owner: 'm2', value: 1200, due: '2026-08-01' },
  { id: 'c', title: 'Invoice chase', status: 'done', owner: 'm1', value: 50, due: null },
  { id: 'd', title: 'Brand deck', status: null, owner: null, value: 800, due: '2026-12-01' },
];

const ids = (list: Row[]) => list.map(r => r.id);
const view = (over: Partial<ViewState> = {}): ViewState => ({ ...EMPTY_VIEW, ...over });

console.log('\n── Filtering ──');
check('is', ids(applyFilters(rows, [{ field: 'status', op: 'is', value: 'todo' }], fields)), ['a']);
check('is_not excludes only that value',
  ids(applyFilters(rows, [{ field: 'status', op: 'is_not', value: 'todo' }], fields)), ['b', 'c', 'd']);
check('contains is case-insensitive',
  ids(applyFilters(rows, [{ field: 'title', op: 'contains', value: 'PCB' }], fields)), ['b']);
check('is_empty finds nulls',
  ids(applyFilters(rows, [{ field: 'owner', op: 'is_empty', value: '' }], fields)), ['d']);
check('is_not_empty is the complement',
  ids(applyFilters(rows, [{ field: 'owner', op: 'is_not_empty', value: '' }], fields)), ['a', 'b', 'c']);
check('numeric gt compares as numbers, not strings',
  ids(applyFilters(rows, [{ field: 'value', op: 'gt', value: '100' }], fields)), ['a', 'b', 'd']);
check('numeric lt',
  ids(applyFilters(rows, [{ field: 'value', op: 'lt', value: '100' }], fields)), ['c']);
check('date after',
  ids(applyFilters(rows, [{ field: 'due', op: 'gt', value: '2026-09-01' }], fields)), ['a', 'd']);
check('a null date never satisfies a comparison',
  ids(applyFilters(rows, [{ field: 'due', op: 'lt', value: '2030-01-01' }], fields)), ['a', 'b', 'd']);
check('two filters are AND',
  ids(applyFilters(rows, [
    { field: 'owner', op: 'is', value: 'm1' },
    { field: 'value', op: 'gt', value: '100' },
  ], fields)), ['a']);
check('a filter on an unknown field is ignored, not fatal',
  ids(applyFilters(rows, [{ field: 'ghost', op: 'is', value: 'x' }], fields)), ['a', 'b', 'c', 'd']);
check('no filters returns everything', ids(applyFilters(rows, [], fields)), ['a', 'b', 'c', 'd']);

console.log('\n── Search ──');
check('matches text fields', ids(applySearch(rows, 'invoice', fields)), ['c']);
check('matches an option label, not the stored id', ids(applySearch(rows, 'sara', fields)), ['b']);
check('does not match on the raw id', ids(applySearch(rows, 'm2', fields)), []);
check('empty search is a no-op', ids(applySearch(rows, '   ', fields)), ['a', 'b', 'c', 'd']);
check('no match is empty', ids(applySearch(rows, 'zzz', fields)), []);

console.log('\n── Sorting ──');
check('ascending by number', ids(applySort(rows, [{ field: 'value', dir: 'asc' }], fields)), ['c', 'a', 'd', 'b']);
check('descending by number', ids(applySort(rows, [{ field: 'value', dir: 'desc' }], fields)), ['b', 'd', 'a', 'c']);
check('nulls sort last ascending',
  ids(applySort(rows, [{ field: 'due', dir: 'asc' }], fields)), ['b', 'a', 'd', 'c']);
check('nulls sort last descending too — absence is not a value',
  ids(applySort(rows, [{ field: 'due', dir: 'desc' }], fields)), ['d', 'a', 'b', 'c']);
check('no sort preserves input order', ids(applySort(rows, [], fields)), ['a', 'b', 'c', 'd']);
check('sorting does not mutate the input', (() => {
  const copy = [...rows];
  applySort(copy, [{ field: 'value', dir: 'desc' }], fields);
  return ids(copy);
})(), ['a', 'b', 'c', 'd']);

console.log('\n── Grouping ──');
check('declared options appear even when empty',
  applyGroup(rows, 'status', fields).map(g => `${g.label}:${g.rows.length}`),
  ['To Do:1', 'Doing:1', 'Done:1', 'None:1']);
check('rows with no value land in None',
  applyGroup(rows, 'status', fields).find(g => g.label === 'None')?.rows.map(r => r.id), ['d']);
check('grouping by a non-groupable field is ignored',
  applyGroup(rows, 'title', fields).length, 1);
check('no grouping yields one bucket', applyGroup(rows, null, fields).length, 1);
check('option labels are used, not raw values',
  applyGroup(rows, 'owner', fields).map(g => g.label), ['Airaf', 'Sara', 'None']);

console.log('\n── The whole pipeline ──');
check('filter then sort then group, in that order',
  applyView(rows, view({
    filters: [{ field: 'value', op: 'gt', value: '100' }],
    sort: [{ field: 'value', dir: 'desc' }],
    groupBy: 'status',
  }), fields).map(g => `${g.label}:${g.rows.map(r => r.id).join(',')}`),
  ['To Do:a', 'Doing:b', 'Done:', 'None:d']);

console.log('\n── URL codec ──');
const roundTrip = (v: ViewState) => paramsToView(viewToParams(v));

check('empty view round-trips', roundTrip(view()), EMPTY_VIEW);
check('group survives', roundTrip(view({ groupBy: 'status' })).groupBy, 'status');
check('search survives', roundTrip(view({ search: 'pcb' })).search, 'pcb');
check('filters survive',
  roundTrip(view({ filters: [{ field: 'status', op: 'is', value: 'todo' }] })).filters,
  [{ field: 'status', op: 'is', value: 'todo' }]);
check('valueless operators survive',
  roundTrip(view({ filters: [{ field: 'owner', op: 'is_empty', value: '' }] })).filters,
  [{ field: 'owner', op: 'is_empty', value: '' }]);
check('sort survives',
  roundTrip(view({ sort: [{ field: 'value', dir: 'desc' }] })).sort,
  [{ field: 'value', dir: 'desc' }]);
check('a value containing the separator survives',
  roundTrip(view({ filters: [{ field: 'title', op: 'contains', value: 'a:b:c' }] })).filters[0].value,
  'a:b:c');
check('a value containing an ampersand survives',
  roundTrip(view({ filters: [{ field: 'title', op: 'contains', value: 'R&D' }] })).filters[0].value,
  'R&D');
check('multiple filters keep their order',
  roundTrip(view({ filters: [
    { field: 'status', op: 'is', value: 'todo' },
    { field: 'owner', op: 'is', value: 'm1' },
  ] })).filters.map(f => f.field), ['status', 'owner']);
check('the URL is readable, not encoded blob',
  viewToParams(view({ groupBy: 'status', sort: [{ field: 'value', dir: 'desc' }] })).toString(),
  'group=status&s=value%3Adesc');

console.log('\n── Hostile URLs ──');
check('an unknown operator is dropped',
  paramsToView(new URLSearchParams('f=status:explode:1')).filters, []);
check('a malformed filter is dropped',
  paramsToView(new URLSearchParams('f=garbage')).filters, []);
check('a filter needing a value but missing one is dropped',
  paramsToView(new URLSearchParams('f=status:is')).filters, []);
check('an unknown sort direction falls back to asc',
  paramsToView(new URLSearchParams('s=value:sideways')).sort, [{ field: 'value', dir: 'asc' }]);
check('missing params give the empty view', paramsToView(new URLSearchParams('')), EMPTY_VIEW);

console.log('\n── Stored config ──');
check('config round-trips',
  configToView(viewToConfig(view({
    groupBy: 'owner',
    search: 'x',
    filters: [{ field: 'value', op: 'gt', value: '10' }],
    sort: [{ field: 'due', dir: 'asc' }],
  }))),
  { groupBy: 'owner', search: 'x', filters: [{ field: 'value', op: 'gt', value: '10' }], sort: [{ field: 'due', dir: 'asc' }] });
check('null config degrades to empty', configToView(null), EMPTY_VIEW);
check('a string config degrades to empty', configToView('nope'), EMPTY_VIEW);
check('a config with junk filters keeps only the valid ones',
  configToView({ filters: [{ field: 'a', op: 'is', value: '1' }, { nope: true }, { field: 'b', op: 'boom' }] }).filters,
  [{ field: 'a', op: 'is', value: '1' }]);
check('a config with a junk sort entry drops it',
  configToView({ sort: [{ dir: 'asc' }, { field: 'due', dir: 'desc' }] }).sort,
  [{ field: 'due', dir: 'desc' }]);

console.log('\n── Description ──');
check('describes nothing', describeView(view(), fields), 'No filters');
check('describes a grouping', describeView(view({ groupBy: 'status' }), fields), 'Grouped by status');
check('pluralises filters',
  describeView(view({ filters: [
    { field: 'status', op: 'is', value: 'todo' },
    { field: 'owner', op: 'is', value: 'm1' },
  ] }), fields), '2 filters');
check('singular for one', describeView(view({ filters: [{ field: 'status', op: 'is', value: 'todo' }] }), fields), '1 filter');

console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}\n`);
process.exit(failures === 0 ? 0 : 1);
