/* ────────────────────────────────────────────────────────────────
   The views engine.

   One shape — group by, filter, sort, search — that every board in
   the CRM reads. Pure on purpose: no Supabase import, no React, so
   the whole thing can be exercised directly.

   The single design decision worth stating: view state lives in the
   URL, and a saved view is just a stored copy of that URL's state.
   That makes "send me your view" a copy-paste rather than a feature,
   and it means the back button does the obvious thing.
   ──────────────────────────────────────────────────────────────── */

export type FieldType = 'text' | 'select' | 'member' | 'date' | 'number' | 'boolean';

export interface FieldOption {
  value: string;
  label: string;
}

/* What a board knows about itself. Registered per entity, so the bar
   is generic and the entity supplies the vocabulary. */
export interface FieldDef<Row> {
  key: string;
  label: string;
  type: FieldType;
  /* The comparable value for this row. Null means "empty", which is a
     first-class state — filtering for unassigned work is common. */
  get: (row: Row) => string | number | boolean | null;
  /* For select/member fields: what to offer in the dropdown, and how
     to label a value in a chip. */
  options?: FieldOption[];
  /* Whether this field can head columns on a board. Free text can be
     filtered on but never grouped by. */
  groupable?: boolean;
  /* Label for a group heading, when the raw value isn't presentable. */
  groupLabel?: (value: string) => string;
}

export type Operator =
  | 'is'
  | 'is_not'
  | 'contains'
  | 'gt'
  | 'lt'
  | 'is_empty'
  | 'is_not_empty';

export const OPERATOR_LABEL: Record<Operator, string> = {
  is: 'is',
  is_not: 'is not',
  contains: 'contains',
  gt: 'after',
  lt: 'before',
  is_empty: 'is empty',
  is_not_empty: 'is not empty',
};

/* Which operators make sense for which field type. Offering "before"
   on a status is how filter builders end up feeling like SQL. */
export const OPERATORS_FOR: Record<FieldType, Operator[]> = {
  text: ['contains', 'is', 'is_not', 'is_empty', 'is_not_empty'],
  select: ['is', 'is_not', 'is_empty', 'is_not_empty'],
  member: ['is', 'is_not', 'is_empty', 'is_not_empty'],
  date: ['is', 'gt', 'lt', 'is_empty', 'is_not_empty'],
  number: ['is', 'gt', 'lt', 'is_empty', 'is_not_empty'],
  boolean: ['is'],
};

export const OPERATOR_NEEDS_VALUE = (op: Operator) =>
  op !== 'is_empty' && op !== 'is_not_empty';

export interface Filter {
  field: string;
  op: Operator;
  value: string;
}

export interface SortRule {
  field: string;
  dir: 'asc' | 'desc';
}

export interface ViewState {
  groupBy: string | null;
  filters: Filter[];
  sort: SortRule[];
  search: string;
}

export const EMPTY_VIEW: ViewState = {
  groupBy: null,
  filters: [],
  sort: [],
  search: '',
};

export const isDefaultView = (v: ViewState, base: ViewState = EMPTY_VIEW) =>
  v.groupBy === base.groupBy &&
  v.search.trim() === base.search.trim() &&
  v.filters.length === base.filters.length &&
  v.sort.length === base.sort.length &&
  v.filters.every((f, i) => {
    const b = base.filters[i];
    return b && f.field === b.field && f.op === b.op && f.value === b.value;
  }) &&
  v.sort.every((srt, i) => {
    const b = base.sort[i];
    return b && srt.field === b.field && srt.dir === b.dir;
  });

/* ── Applying a view ──────────────────────────────────────────── */

const asComparable = (v: string | number | boolean | null) =>
  v === null || v === undefined ? null : typeof v === 'boolean' ? String(v) : v;

const matches = <Row>(row: Row, filter: Filter, fields: FieldDef<Row>[]): boolean => {
  const def = fields.find(f => f.key === filter.field);
  /* A filter naming a field this entity doesn't have is ignored rather
     than treated as false — otherwise a stale URL empties the board
     with no explanation. */
  if (!def) return true;

  const raw = asComparable(def.get(row));

  switch (filter.op) {
    case 'is_empty':
      return raw === null || raw === '';
    case 'is_not_empty':
      return raw !== null && raw !== '';
    case 'is':
      return String(raw ?? '') === filter.value;
    case 'is_not':
      return String(raw ?? '') !== filter.value;
    case 'contains':
      return String(raw ?? '').toLowerCase().includes(filter.value.toLowerCase());
    case 'gt':
      if (raw === null) return false;
      return def.type === 'number' ? Number(raw) > Number(filter.value) : String(raw) > filter.value;
    case 'lt':
      if (raw === null) return false;
      return def.type === 'number' ? Number(raw) < Number(filter.value) : String(raw) < filter.value;
    default:
      return true;
  }
};

export const applyFilters = <Row>(
  rows: Row[],
  filters: Filter[],
  fields: FieldDef<Row>[],
): Row[] => rows.filter(row => filters.every(f => matches(row, f, fields)));

/* Search runs across every text-ish field the entity registered, so a
   board doesn't need to declare a separate "searchable" list that
   drifts out of date. */
export const applySearch = <Row>(
  rows: Row[],
  search: string,
  fields: FieldDef<Row>[],
): Row[] => {
  const q = search.trim().toLowerCase();
  if (!q) return rows;
  const searchable = fields.filter(f => f.type === 'text' || f.type === 'select' || f.type === 'member');
  return rows.filter(row =>
    searchable.some(f => {
      const raw = f.get(row);
      if (raw === null || raw === undefined) return false;
      /* For select/member the stored value is an id, so match the
         label a person actually sees rather than a uuid. */
      const label = f.options?.find(o => o.value === String(raw))?.label;
      return String(label ?? raw).toLowerCase().includes(q);
    }),
  );
};

/* Nulls always sort last, in both directions. "No due date" is not
   earlier than every date — it's the absence of one, and burying it
   under real work is what people expect. */
export const applySort = <Row>(rows: Row[], sort: SortRule[], fields: FieldDef<Row>[]): Row[] => {
  if (sort.length === 0) return rows;
  const rules = sort
    .map(rule => ({ rule, def: fields.find(f => f.key === rule.field) }))
    .filter((r): r is { rule: SortRule; def: FieldDef<Row> } => Boolean(r.def));
  if (rules.length === 0) return rows;

  return [...rows].sort((a, b) => {
    for (const { rule, def } of rules) {
      const av = asComparable(def.get(a));
      const bv = asComparable(def.get(b));

      if (av === null && bv === null) continue;
      if (av === null) return 1;
      if (bv === null) return -1;

      let cmp: number;
      if (typeof av === 'number' && typeof bv === 'number') cmp = av - bv;
      else cmp = String(av).localeCompare(String(bv));

      if (cmp !== 0) return rule.dir === 'asc' ? cmp : -cmp;
    }
    return 0;
  });
};

export interface Group<Row> {
  key: string;
  label: string;
  rows: Row[];
}

export const applyGroup = <Row>(
  rows: Row[],
  groupBy: string | null,
  fields: FieldDef<Row>[],
): Group<Row>[] => {
  if (!groupBy) return [{ key: '', label: '', rows }];
  const def = fields.find(f => f.key === groupBy && f.groupable);
  if (!def) return [{ key: '', label: '', rows }];

  const buckets = new Map<string, Row[]>();
  /* Declared options come first and appear even when empty — an empty
     "Blocked" column is information. Values not in the registry get
     appended in encounter order. */
  def.options?.forEach(o => buckets.set(o.value, []));

  rows.forEach(row => {
    const raw = def.get(row);
    const key = raw === null || raw === undefined || raw === '' ? '' : String(raw);
    const list = buckets.get(key);
    if (list) list.push(row);
    else buckets.set(key, [row]);
  });

  return Array.from(buckets.entries()).map(([key, groupRows]) => ({
    key,
    label:
      key === ''
        ? 'None'
        : def.options?.find(o => o.value === key)?.label ?? def.groupLabel?.(key) ?? key,
    rows: groupRows,
  }));
};

/* The whole pipeline, in the order that matters: filter, then search,
   then sort, then group. Sorting before grouping means every column is
   sorted the same way. */
export const applyView = <Row>(
  rows: Row[],
  view: ViewState,
  fields: FieldDef<Row>[],
): Group<Row>[] =>
  applyGroup(
    applySort(applySearch(applyFilters(rows, view.filters, fields), view.search, fields), view.sort, fields),
    view.groupBy,
    fields,
  );

/* ── URL encoding ─────────────────────────────────────────────────
   Readable on purpose. `?group=status&f=priority:is:1&s=due_date:asc`
   is something you can eyeball in a Slack message and understand,
   which base64 or JSON-in-a-param would not be. */

const SEP = ':';

const encodeFilter = (f: Filter) =>
  OPERATOR_NEEDS_VALUE(f.op)
    ? `${f.field}${SEP}${f.op}${SEP}${encodeURIComponent(f.value)}`
    : `${f.field}${SEP}${f.op}`;

const decodeFilter = (raw: string): Filter | null => {
  const [field, op, ...rest] = raw.split(SEP);
  if (!field || !op) return null;
  if (!(op in OPERATOR_LABEL)) return null;
  const operator = op as Operator;
  const value = rest.length > 0 ? decodeURIComponent(rest.join(SEP)) : '';
  if (OPERATOR_NEEDS_VALUE(operator) && value === '') return null;
  return { field, op: operator, value };
};

export const viewToParams = (view: ViewState): URLSearchParams => {
  const params = new URLSearchParams();
  if (view.groupBy) params.set('group', view.groupBy);
  if (view.search.trim()) params.set('q', view.search.trim());
  view.filters.forEach(f => params.append('f', encodeFilter(f)));
  view.sort.forEach(s => params.append('s', `${s.field}${SEP}${s.dir}`));
  return params;
};

export const paramsToView = (params: URLSearchParams): ViewState => ({
  groupBy: params.get('group'),
  search: params.get('q') ?? '',
  filters: params
    .getAll('f')
    .map(decodeFilter)
    .filter((f): f is Filter => f !== null),
  sort: params
    .getAll('s')
    .map(raw => {
      const [field, dir] = raw.split(SEP);
      if (!field) return null;
      return { field, dir: dir === 'desc' ? 'desc' : 'asc' } as SortRule;
    })
    .filter((s): s is SortRule => s !== null),
});

/* What gets stored in saved_views.config, and read back out. Kept
   separate from the URL codec so a stored view survives a change to
   the URL format. */
export const viewToConfig = (view: ViewState) => ({
  groupBy: view.groupBy,
  filters: view.filters,
  sort: view.sort,
  search: view.search,
});

export const configToView = (config: unknown): ViewState => {
  if (!config || typeof config !== 'object') return { ...EMPTY_VIEW };
  const c = config as Record<string, unknown>;

  const filters = Array.isArray(c.filters)
    ? (c.filters as unknown[])
        .map(f => {
          if (!f || typeof f !== 'object') return null;
          const o = f as Record<string, unknown>;
          if (typeof o.field !== 'string' || typeof o.op !== 'string') return null;
          if (!(o.op in OPERATOR_LABEL)) return null;
          return { field: o.field, op: o.op as Operator, value: String(o.value ?? '') };
        })
        .filter((f): f is Filter => f !== null)
    : [];

  const sort = Array.isArray(c.sort)
    ? (c.sort as unknown[])
        .map(sr => {
          if (!sr || typeof sr !== 'object') return null;
          const o = sr as Record<string, unknown>;
          if (typeof o.field !== 'string') return null;
          return { field: o.field, dir: o.dir === 'desc' ? 'desc' : 'asc' } as SortRule;
        })
        .filter((sr): sr is SortRule => sr !== null)
    : [];

  return {
    groupBy: typeof c.groupBy === 'string' ? c.groupBy : null,
    search: typeof c.search === 'string' ? c.search : '',
    filters,
    sort,
  };
};

/* A short human description of what a view is doing, for the bar when
   it's collapsed: "Grouped by status · 2 filters · sorted by due". */
export const describeView = <Row>(view: ViewState, fields: FieldDef<Row>[]): string => {
  const label = (key: string) => fields.find(f => f.key === key)?.label ?? key;
  const parts: string[] = [];
  if (view.groupBy) parts.push(`Grouped by ${label(view.groupBy).toLowerCase()}`);
  if (view.filters.length === 1) parts.push('1 filter');
  else if (view.filters.length > 1) parts.push(`${view.filters.length} filters`);
  if (view.sort.length > 0) parts.push(`sorted by ${label(view.sort[0].field).toLowerCase()}`);
  if (view.search.trim()) parts.push(`matching “${view.search.trim()}”`);
  return parts.join(' · ') || 'No filters';
};
