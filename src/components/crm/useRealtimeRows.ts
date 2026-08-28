import { useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { applyChange, type RowLike } from '../../lib/realtime';

/* Subscribes a list of rows to its table.

   The setter is held in a ref so the subscription doesn't tear down
   and rebuild every render — resubscribing on each keystroke would
   drop events between the unsubscribe and the resubscribe, which is
   exactly when a teammate's change would go missing.

   Returns nothing: this is a side channel that keeps the caller's
   existing state honest, not a data source of its own. */
export const useRealtimeRows = <T extends RowLike>(
  table: 'tasks' | 'deals',
  setRows: (updater: (rows: T[]) => T[]) => void,
  enabled = true,
) => {
  const setRowsRef = useRef(setRows);
  /* Assigned in an effect, not during render: writing a ref while
     rendering is a rule violation, and under concurrent rendering a
     discarded render could otherwise leave the ref pointing at a
     setter from a tree React threw away. */
  useEffect(() => {
    setRowsRef.current = setRows;
  });

  useEffect(() => {
    if (!enabled) return undefined;

    const channel = supabase
      .channel(`crm:${table}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        payload => {
          const type = payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE';
          const row = (type === 'DELETE' ? payload.old : payload.new) as T;
          if (!row?.id) return;
          setRowsRef.current(rows => applyChange(rows, { type, row }));
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [table, enabled]);
};

/* Who else is on this screen. Cheap enough to be worth it: a shared
   board where you can see someone else is already dragging cards
   prevents most of the collisions rather than resolving them. */
export const usePresence = (
  room: string,
  me: { id: string; name: string } | null,
  onChange: (names: string[]) => void,
) => {
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  useEffect(() => {
    if (!me) return undefined;

    const channel = supabase.channel(`presence:${room}`, {
      config: { presence: { key: me.id } },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<{ name: string }>();
        const names = Object.entries(state)
          .filter(([key]) => key !== me.id)
          .map(([, entries]) => entries[0]?.name)
          .filter((n): n is string => Boolean(n));
        onChangeRef.current(names);
      })
      .subscribe(status => {
        if (status === 'SUBSCRIBED') channel.track({ name: me.name });
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [room, me]);
};
