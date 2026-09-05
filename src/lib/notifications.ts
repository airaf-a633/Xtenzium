/* Inbox logic.

   Two kinds of thing end up in the bell, and keeping them distinct
   matters:

     Notifications are records of something that happened. They are
     written by database triggers, they persist, and they get marked
     read.

     Nudges are derived from the current state — a deal with no next
     step, a task overdue on you. Nothing writes them and nothing marks
     them read; they disappear when the thing that caused them is
     dealt with, which is the only correct behaviour for a condition
     rather than an event.

   Deriving nudges in the client rather than storing them also means no
   scheduled function to run, nothing to backfill, and no stale row
   nagging about a deal that was closed an hour ago. */

import type { Deal, Notification, Task } from '../types/database';
import { attentionOf, isOpen } from './deals';
import { parseDateOnly, today } from './date';
import type { Tone } from '../components/crm/ui';

export const NOTIFICATION_LABEL: Record<Notification['type'], string> = {
  mention: 'mentioned you',
  assignment: 'assigned you',
  deal_stage: 'moved a deal',
  deal_owner: 'handed you a deal',
  comment: 'commented',
};

export const NOTIFICATION_TONE: Record<Notification['type'], Tone> = {
  mention: 'copper',
  assignment: 'info',
  deal_stage: 'violet',
  deal_owner: 'violet',
  comment: 'neutral',
};

export const unreadCount = (list: Notification[]): number =>
  list.filter(n => n.read_at === null).length;

/* ── Nudges ────────────────────────────────────────────────────── */

export type NudgeKind = 'deal_no_action' | 'deal_overdue' | 'deal_stale' | 'task_overdue' | 'task_today';

export interface Nudge {
  id: string;
  kind: NudgeKind;
  title: string;
  body: string;
  tone: Tone;
  entity: 'deal' | 'task';
  entityId: string;
  /* Lower sorts first. Things that are late outrank things that are
     merely unplanned, and both outrank what's due later today. */
  weight: number;
}

const DEAL_NUDGE: Record<'no-action' | 'overdue' | 'stale', { label: string; tone: Tone; weight: number; kind: NudgeKind }> = {
  overdue: { label: 'Next step is overdue', tone: 'danger', weight: 0, kind: 'deal_overdue' },
  'no-action': { label: 'No next step agreed', tone: 'danger', weight: 1, kind: 'deal_no_action' },
  stale: { label: 'Going cold in this stage', tone: 'warning', weight: 2, kind: 'deal_stale' },
};

/* `ownerId` narrows to one person's deals. Passing null returns the
   whole pipeline's, which is what the dashboard wants. */
export const dealNudges = (deals: Deal[], ownerId: string | null): Nudge[] =>
  deals
    .filter(d => isOpen(d.stage) && (ownerId === null || d.owner_id === ownerId))
    .map((deal): Nudge | null => {
      const attention = attentionOf(deal);
      if (attention === 'none') return null;
      const spec = DEAL_NUDGE[attention];
      return {
        id: `deal-${deal.id}-${spec.kind}`,
        kind: spec.kind,
        title: deal.title,
        body: spec.label,
        tone: spec.tone,
        entity: 'deal',
        entityId: deal.id,
        weight: spec.weight,
      };
    })
    .filter((n): n is Nudge => n !== null);

export const taskNudges = (tasks: Task[], assigneeId: string | null): Nudge[] => {
  const now = today();
  return tasks
    .filter(t => t.status !== 'done' && t.due_date != null)
    .filter(t => assigneeId === null || t.assigned_to === assigneeId)
    .map((task): Nudge | null => {
      const due = parseDateOnly(task.due_date as string);
      if (due < now) {
        const days = Math.round((now.getTime() - due.getTime()) / 86_400_000);
        return {
          id: `task-${task.id}-overdue`,
          kind: 'task_overdue',
          title: task.title,
          body: days === 1 ? 'Overdue by a day' : `Overdue by ${days} days`,
          tone: 'danger',
          entity: 'task',
          entityId: task.id,
          weight: 0,
        };
      }
      if (due.getTime() === now.getTime()) {
        return {
          id: `task-${task.id}-today`,
          kind: 'task_today',
          title: task.title,
          body: 'Due today',
          tone: 'copper',
          entity: 'task',
          entityId: task.id,
          weight: 3,
        };
      }
      return null;
    })
    .filter((n): n is Nudge => n !== null);
};

/* Most urgent first, then alphabetical so the order is stable between
   renders — a list that reshuffles on every poll is unreadable. */
export const sortNudges = (nudges: Nudge[]): Nudge[] =>
  [...nudges].sort((a, b) => a.weight - b.weight || a.title.localeCompare(b.title));

/* The bell's number. Unread notifications plus anything actively late;
   "due today" is deliberately excluded — a badge that never reaches
   zero is a badge people stop reading. */
export const badgeCount = (notifications: Notification[], nudges: Nudge[]): number =>
  unreadCount(notifications) + nudges.filter(n => n.weight <= 1).length;

export const relativeTime = (iso: string, now = Date.now()): string => {
  const mins = Math.floor((now - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};
