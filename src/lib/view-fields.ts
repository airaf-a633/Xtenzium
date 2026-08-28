/* Field registries.

   The views engine is generic; this is where each board tells it what
   it can be sliced by. Everything here is a pure function of the
   lookup data a page has already loaded, so the same registry drives
   the filter dropdowns, the group-by columns, the sort menu and the
   free-text search — with no chance of the four drifting apart.

   `get` returns the comparable value, not the display value. Ids for
   anything with options; the id is turned back into a label by the
   registry's own `options`. */

import type { FieldDef, FieldOption } from './views';
import { PRIORITIES, daysUntilDue } from './tasks';
import { OPEN_STAGES, STAGE_LABEL } from './deals';
import type {
  Client,
  Deal,
  Project,
  Task,
  TaskStatusRow,
  TeamMember,
} from '../types/database';

/* Shared by the task registry and by the board's drop handling, so a
   card always lands in the column it was dropped on. */
export const dueBucket = (due: string | null, isDone: boolean): string => {
  if (!due) return 'no_date';
  const diff = daysUntilDue(due);
  if (isDone) return 'later';
  if (diff < 0) return 'overdue';
  if (diff === 0) return 'today';
  if (diff <= 6) return 'this_week';
  return 'later';
};

const memberOptions = (members: TeamMember[]): FieldOption[] =>
  members.map(m => ({ value: m.id, label: m.name }));

const projectOptions = (projects: Project[]): FieldOption[] =>
  projects.map(p => ({ value: p.id, label: p.name }));

/* ── Tasks ─────────────────────────────────────────────────────── */
export const taskFields = (
  statuses: TaskStatusRow[],
  members: TeamMember[],
  projects: Project[],
): FieldDef<Task>[] => [
  { key: 'title', label: 'Title', type: 'text', get: t => t.title },
  {
    key: 'status_id',
    label: 'Status',
    type: 'select',
    groupable: true,
    get: t => t.status_id,
    options: statuses.map(s => ({ value: s.id, label: s.label })),
  },
  {
    key: 'priority',
    label: 'Priority',
    type: 'select',
    groupable: true,
    get: t => String(t.priority),
    options: PRIORITIES.map(p => ({ value: String(p.value), label: p.label })),
  },
  {
    key: 'assigned_to',
    label: 'Assignee',
    type: 'member',
    groupable: true,
    get: t => t.assigned_to,
    options: memberOptions(members),
  },
  {
    key: 'project_id',
    label: 'Project',
    type: 'select',
    groupable: true,
    get: t => t.project_id,
    options: projectOptions(projects),
  },
  { key: 'due_date', label: 'Due date', type: 'date', get: t => t.due_date },
  {
    /* Grouping by the raw date would make one column per calendar day.
       This is the bucket people actually think in, and it stays a
       derived value so there is no column to keep in sync. */
    key: 'due_bucket',
    label: 'Due',
    type: 'select',
    groupable: true,
    get: t => dueBucket(t.due_date, t.status === 'done'),
    options: [
      { value: 'overdue', label: 'Overdue' },
      { value: 'today', label: 'Today' },
      { value: 'this_week', label: 'This Week' },
      { value: 'later', label: 'Later' },
      { value: 'no_date', label: 'No Date' },
    ],
  },
  {
    key: 'estimate_minutes',
    label: 'Estimate',
    type: 'number',
    get: t => t.estimate_minutes,
  },
  {
    key: 'has_subtasks',
    label: 'Is a subtask',
    type: 'boolean',
    get: t => (t.parent_task_id ? 'true' : 'false'),
    options: [
      { value: 'true', label: 'Yes' },
      { value: 'false', label: 'No' },
    ],
  },
];

/* ── Deals ─────────────────────────────────────────────────────── */
export const dealFields = (members: TeamMember[]): FieldDef<Deal>[] => [
  { key: 'title', label: 'Title', type: 'text', get: d => d.title },
  { key: 'company', label: 'Company', type: 'text', get: d => d.company },
  {
    key: 'stage',
    label: 'Stage',
    type: 'select',
    groupable: true,
    get: d => d.stage,
    /* Open stages only: the board never shows won or lost as columns,
       so offering them as a grouping would produce two columns that
       are always empty. They remain filterable through the Closed
       view, which is a separate surface. */
    options: OPEN_STAGES.map(s => ({ value: s.value, label: s.label })),
    groupLabel: key => STAGE_LABEL[key as keyof typeof STAGE_LABEL] ?? key,
  },
  {
    key: 'owner_id',
    label: 'Owner',
    type: 'member',
    groupable: true,
    get: d => d.owner_id,
    options: memberOptions(members),
  },
  {
    key: 'source',
    label: 'Source',
    type: 'select',
    groupable: true,
    get: d => d.source,
    options: [
      { value: 'contact', label: 'Contact form' },
      { value: 'estimate', label: 'Estimator' },
      { value: 'referral', label: 'Referral' },
      { value: 'outbound', label: 'Outbound' },
      { value: 'repeat', label: 'Repeat client' },
      { value: 'manual', label: 'Added manually' },
    ],
  },
  { key: 'value', label: 'Value', type: 'number', get: d => Number(d.value) },
  { key: 'probability', label: 'Probability', type: 'number', get: d => d.probability },
  { key: 'expected_close', label: 'Expected close', type: 'date', get: d => d.expected_close },
  { key: 'next_action_date', label: 'Next action', type: 'date', get: d => d.next_action_date },
];

/* ── Projects ──────────────────────────────────────────────────── */
export const projectFields = (clients: Client[]): FieldDef<Project>[] => [
  { key: 'name', label: 'Name', type: 'text', get: p => p.name },
  {
    key: 'status',
    label: 'Status',
    type: 'select',
    groupable: true,
    get: p => p.status,
    options: [
      { value: 'proposal', label: 'Proposal' },
      { value: 'active', label: 'Active' },
      { value: 'on_hold', label: 'On hold' },
      { value: 'completed', label: 'Completed' },
      { value: 'cancelled', label: 'Cancelled' },
    ],
  },
  {
    key: 'client_id',
    label: 'Client',
    type: 'select',
    groupable: true,
    get: p => p.client_id,
    options: clients.map(c => ({ value: c.id, label: c.name })),
  },
  { key: 'total_value', label: 'Value', type: 'number', get: p => Number(p.total_value) },
  {
    key: 'outstanding',
    label: 'Outstanding',
    type: 'number',
    /* A derived field: what's still owed. Filterable even though no
       column holds it, which is most of the point of a registry. */
    get: p => Number(p.total_value) - Number(p.amount_paid),
  },
  { key: 'start_date', label: 'Start date', type: 'date', get: p => p.start_date },
  { key: 'end_date', label: 'End date', type: 'date', get: p => p.end_date },
  {
    key: 'currency',
    label: 'Currency',
    type: 'select',
    groupable: true,
    get: p => p.currency,
    options: [
      { value: 'PKR', label: 'PKR' },
      { value: 'USD', label: 'USD' },
    ],
  },
];

/* ── Clients ───────────────────────────────────────────────────── */
export const clientFields = (): FieldDef<Client>[] => [
  { key: 'name', label: 'Name', type: 'text', get: c => c.name },
  { key: 'company', label: 'Company', type: 'text', groupable: true, get: c => c.company },
  { key: 'email', label: 'Email', type: 'text', get: c => c.email },
  { key: 'phone', label: 'Phone', type: 'text', get: c => c.phone },
  { key: 'created_at', label: 'Added', type: 'date', get: c => c.created_at.slice(0, 10) },
];
