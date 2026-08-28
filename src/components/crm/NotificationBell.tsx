import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import {
  NOTIFICATION_LABEL,
  NOTIFICATION_TONE,
  badgeCount,
  dealNudges,
  relativeTime,
  sortNudges,
  taskNudges,
  unreadCount,
  type Nudge,
} from '../../lib/notifications';
import type { Deal, Notification, Task, TeamMember } from '../../types/database';
import { Avatar, Badge, Button, Dot, IconButton } from './ui';
import { cn } from '../../lib/utils';

const BellIcon = ({ alert }: { alert: boolean }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M18 8.5a6 6 0 1 0-12 0c0 6-2 7-2 7h16s-2-1-2-7" />
    {alert ? <path d="M10.5 20.5a2 2 0 0 0 3 0" /> : <path d="M10.5 20.5a2 2 0 0 0 3 0" />}
  </svg>
);

interface NotificationBellProps {
  me: TeamMember | null;
  membersById: Record<string, TeamMember>;
}

const NotificationBell = ({ me, membersById }: NotificationBellProps) => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [nudges, setNudges] = useState<Nudge[]>([]);
  const [available, setAvailable] = useState(true);
  const rootRef = useRef<HTMLDivElement>(null);

  /* Pure I/O — fetches and returns, writes no state. */
  const fetchInbox = () =>
    Promise.all([
      supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(40),
      supabase.from('deals').select('*'),
      supabase.from('tasks').select('*'),
    ]);

  const memberId = me?.id;
  useEffect(() => {
    if (!memberId) return undefined;
    let cancelled = false;

    fetchInbox().then(([inbox, deals, tasks]) => {
      if (cancelled) return;

      /* Migration 009 may not have run yet. The bell simply doesn't
         appear rather than throwing an error into the shell. */
      if (inbox.error) {
        setAvailable(false);
        return;
      }
      setNotifications((inbox.data ?? []) as Notification[]);
      setNudges(
        sortNudges([
          ...dealNudges((deals.data ?? []) as Deal[], memberId),
          ...taskNudges((tasks.data ?? []) as Task[], memberId),
        ]),
      );
    });

    return () => {
      cancelled = true;
    };
  }, [memberId]);

  /* Live: a mention should light the bell without a refresh. RLS keeps
     the stream to this person's own rows. */
  useEffect(() => {
    if (!me || !available) return undefined;
    const channel = supabase
      .channel('crm:notifications')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `recipient_id=eq.${me.id}` },
        payload => setNotifications(list => [payload.new as Notification, ...list]),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [me, available]);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const count = useMemo(() => badgeCount(notifications, nudges), [notifications, nudges]);
  const unread = unreadCount(notifications);

  const markAllRead = async () => {
    if (!me || unread === 0) return;
    const now = new Date().toISOString();
    setNotifications(list => list.map(n => (n.read_at ? n : { ...n, read_at: now })));
    await supabase
      .from('notifications')
      .update({ read_at: now })
      .eq('recipient_id', me.id)
      .is('read_at', null);
  };

  const openNotification = async (n: Notification) => {
    if (!n.read_at) {
      const now = new Date().toISOString();
      setNotifications(list => list.map(x => (x.id === n.id ? { ...x, read_at: now } : x)));
      await supabase.from('notifications').update({ read_at: now }).eq('id', n.id);
    }
    setOpen(false);
    navigate(n.entity_type === 'deal' ? '/crm/pipeline' : '/crm/tasks');
  };

  if (!me || !available) return null;

  return (
    <div ref={rootRef} className="relative">
      <IconButton
        label={count > 0 ? `Notifications, ${count} needing attention` : 'Notifications'}
        size="sm"
        onClick={() => setOpen(o => !o)}
        icon={
          <span className="relative flex">
            <BellIcon alert={count > 0} />
            {count > 0 && (
              <span
                className="absolute -right-1.5 -top-1 flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-crm-copper px-1 font-crm-mono text-[9px] font-medium text-crm-copper-ink"
                aria-hidden="true"
              >
                {count > 9 ? '9+' : count}
              </span>
            )}
          </span>
        }
      />

      {/* Opens rightward, over the content. Anchored right-0 it would
          extend 340px leftward from a bell sitting inside a 212px
          sidebar — i.e. off the edge of the screen. The width also
          clamps to the viewport so the mobile drawer can't push it off
          the other side. */}
      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          className="absolute bottom-[calc(100%+8px)] left-0 z-50 w-[min(340px,calc(100vw-2rem))] overflow-hidden rounded-crm-lg border border-crm-line-hi bg-crm-surface shadow-crm-pop"
        >
          <header className="flex items-center justify-between gap-2 border-b border-crm-line px-3.5 py-2.5">
            <span className="font-crm-display text-[13.5px] font-bold text-crm-ink">Inbox</span>
            {unread > 0 && (
              <Button size="sm" variant="ghost" onClick={markAllRead}>
                Mark all read
              </Button>
            )}
          </header>

          <div className="max-h-[420px] overflow-y-auto">
            {/* Needs attention: conditions, not events. They clear
                themselves when the underlying thing is dealt with. */}
            {nudges.length > 0 && (
              <section>
                <div className="px-3.5 pb-1 pt-2.5 font-crm-mono text-[10px] uppercase tracking-[0.12em] text-crm-faint">
                  Needs you
                </div>
                {nudges.slice(0, 6).map(n => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      navigate(n.entity === 'deal' ? '/crm/pipeline' : '/crm/tasks');
                    }}
                    className="flex w-full cursor-pointer items-start gap-2.5 px-3.5 py-2 text-left transition-colors duration-100 ease-crm hover:bg-crm-raised"
                  >
                    <Dot tone={n.tone} className="mt-1.5" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12.5px] text-crm-ink">{n.title}</span>
                      <span className="block text-[11.5px] text-crm-ink-3">{n.body}</span>
                    </span>
                  </button>
                ))}
              </section>
            )}

            {/* Recent: events that happened, which stay until read. */}
            <section>
              {notifications.length > 0 && (
                <div className="px-3.5 pb-1 pt-2.5 font-crm-mono text-[10px] uppercase tracking-[0.12em] text-crm-faint">
                  Recent
                </div>
              )}
              {notifications.slice(0, 20).map(n => {
                const actor = n.actor_id ? membersById[n.actor_id] : null;
                return (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => openNotification(n)}
                    className={cn(
                      'flex w-full cursor-pointer items-start gap-2.5 px-3.5 py-2 text-left transition-colors duration-100 ease-crm hover:bg-crm-raised',
                      !n.read_at && 'bg-crm-copper-quiet/40',
                    )}
                  >
                    {actor ? (
                      <Avatar name={actor.name} size="xs" className="mt-0.5" />
                    ) : (
                      <Dot tone={NOTIFICATION_TONE[n.type]} className="mt-1.5" />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block text-[12.5px] text-crm-ink-2">
                        <span className="font-medium text-crm-ink">
                          {actor?.name.split(' ')[0] ?? 'Someone'}
                        </span>{' '}
                        {NOTIFICATION_LABEL[n.type]}
                      </span>
                      <span className="block truncate text-[12px] text-crm-ink">{n.title}</span>
                      {n.body && (
                        <span className="block truncate text-[11.5px] text-crm-ink-3">{n.body}</span>
                      )}
                    </span>
                    <span className="crm-num shrink-0 font-crm-mono text-[10px] text-crm-faint">
                      {relativeTime(n.created_at)}
                    </span>
                  </button>
                );
              })}
            </section>

            {nudges.length === 0 && notifications.length === 0 && (
              <div className="px-3.5 py-8 text-center">
                <p className="m-0 text-[13px] text-crm-ink-2">Nothing needs you</p>
                <p className="m-0 mt-1 text-[12px] text-crm-ink-3">
                  Mentions, assignments and deals going quiet land here.
                </p>
              </div>
            )}
          </div>

          {!me.user_id && (
            <div className="border-t border-crm-line px-3.5 py-2">
              <Badge tone="warning">Link your account in Team to receive these</Badge>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
