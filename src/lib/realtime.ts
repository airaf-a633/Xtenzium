/* ────────────────────────────────────────────────────────────────
   Reconciling live changes with what's already on screen.

   The hard case isn't receiving a change — it's receiving the echo of
   your own change after you've already applied it optimistically, and
   sometimes after you've made a second edit. Applying that echo blindly
   makes a card visibly jump backwards.

   The rule: a remote row only replaces a local one if it is at least as
   new. `updated_at` is maintained by triggers on every table this runs
   against, so it is a reliable clock.
   ──────────────────────────────────────────────────────────────── */

export interface RowLike {
  id: string;
  updated_at?: string | null;
}

export type ChangeType = 'INSERT' | 'UPDATE' | 'DELETE';

export interface Change<T extends RowLike> {
  type: ChangeType;
  /* Postgres sends the new row for INSERT/UPDATE and the old row for
     DELETE — for a delete only the id is depended on here. */
  row: T;
}

const isNewer = (incoming: RowLike, existing: RowLike): boolean => {
  if (!incoming.updated_at || !existing.updated_at) return true;
  return incoming.updated_at >= existing.updated_at;
};

export const applyChange = <T extends RowLike>(rows: T[], change: Change<T>): T[] => {
  const { type, row } = change;

  if (type === 'DELETE') {
    return rows.some(r => r.id === row.id) ? rows.filter(r => r.id !== row.id) : rows;
  }

  const index = rows.findIndex(r => r.id === row.id);

  if (index === -1) {
    /* An UPDATE for a row we don't hold is still worth adding: it may
       have just become visible to this board — reassigned to you,
       moved into the stage you're filtered to. */
    return [...rows, row];
  }

  /* A stale echo. Keep what's on screen. */
  if (!isNewer(row, rows[index])) return rows;

  const next = [...rows];
  next[index] = { ...next[index], ...row };
  return next;
};

/* Several changes can arrive in one tick — a board move that touches
   two rows, or a reconnect replaying a backlog. Folding them keeps the
   list identity stable when nothing actually changed, which matters
   because a new array reference re-renders every card. */
export const applyChanges = <T extends RowLike>(rows: T[], changes: Change<T>[]): T[] =>
  changes.reduce((acc, change) => applyChange(acc, change), rows);

/* Realtime can drop and reconnect. On reconnect the client refetches,
   and this folds the authoritative server list back in without
   discarding an optimistic edit that hasn't round-tripped yet. */
export const reconcile = <T extends RowLike>(local: T[], server: T[]): T[] => {
  const byId = new Map(local.map(r => [r.id, r]));
  const merged = server.map(serverRow => {
    const localRow = byId.get(serverRow.id);
    if (!localRow) return serverRow;
    return isNewer(serverRow, localRow) ? { ...localRow, ...serverRow } : localRow;
  });

  /* Rows created locally that the server hasn't returned yet — an
     insert still in flight — would otherwise vanish and reappear. */
  const serverIds = new Set(server.map(r => r.id));
  const pending = local.filter(r => !serverIds.has(r.id) && !r.updated_at);
  return [...merged, ...pending];
};
