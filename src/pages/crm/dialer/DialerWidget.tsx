import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';
import type { FollowupItem } from '../../../types/database';
import { cn } from '../../../lib/utils';

interface Summary {
  followups: number;
  calls: number;
  mine: number;
  flagged: number;
  meetings: number;
}

const Tile = ({ label, value, sub, hot }: { label: string; value: number; sub?: string; hot?: boolean }) => (
  <Link
    to="/crm/inbox"
    className={cn(
      'block rounded-crm-md border bg-crm-surface px-3.5 py-3 no-underline transition-colors duration-150 ease-crm hover:border-crm-line-hi',
      hot && value > 0 ? 'border-crm-copper/50' : 'border-crm-line',
    )}
  >
    <p className="m-0 font-crm-mono text-[10.5px] uppercase tracking-[0.12em] text-crm-ink-3">{label}</p>
    <p className={cn('m-0 mt-1 text-[24px] font-semibold tabular-nums', hot && value > 0 ? 'text-crm-copper' : 'text-crm-ink')}>
      {value}
    </p>
    {sub && <p className="m-0 text-[12px] text-crm-ink-3">{sub}</p>}
  </Link>
);

/* What the cold-calling rep has handed to the team, on the first screen
   anyone sees. Shows nothing at all if the dialer isn't set up yet, so
   the dashboard never grows an error box for a feature that's off. */
const DialerWidget = () => {
  const { user } = useAuth();
  const [s, setS] = useState<Summary | null>(null);

  useEffect(() => {
    if (!user) return undefined;
    let cancelled = false;
    const weekAhead = new Date(Date.now() + 7 * 86400000).toISOString();

    Promise.all([
      supabase.from('team_members').select('id').eq('user_id', user.id).maybeSingle(),
      supabase.from('followup_queue').select('type, assignee_id').eq('status', 'queued'),
      supabase.from('call_activities').select('id', { count: 'exact', head: true }).eq('flagged', true).is('flag_resolved_at', null),
      supabase.from('call_leads').select('id', { count: 'exact', head: true }).eq('status', 'meeting').lte('next_call_at', weekAhead),
    ]).then(([me, q, f, m]) => {
      if (cancelled || q.error || f.error || m.error) return;
      const myId = (me.data as { id: string } | null)?.id ?? null;
      const rows = (q.data ?? []) as Pick<FollowupItem, 'type' | 'assignee_id'>[];
      setS({
        followups: rows.length,
        calls: rows.filter(r => r.type === 'admin_call').length,
        mine: myId ? rows.filter(r => r.assignee_id === myId).length : 0,
        flagged: f.count ?? 0,
        meetings: m.count ?? 0,
      });
    });

    return () => {
      cancelled = true;
    };
  }, [user]);

  if (!s) return null;

  return (
    <section className="mb-5" aria-label="From the dialer">
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="m-0 font-crm-mono text-[11px] font-medium uppercase tracking-[0.14em] text-crm-ink-3">
          From the dialer
        </h2>
        <Link to="/crm/inbox" className="text-[12.5px] text-crm-copper no-underline hover:underline">
          Open inbox →
        </Link>
      </div>
      <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(170px,1fr))]">
        <Tile label="Follow-ups waiting" value={s.followups} sub={s.mine > 0 ? `${s.mine} assigned to you` : undefined} hot />
        <Tile label="Calls to make" value={s.calls} hot />
        <Tile label="Flagged by the rep" value={s.flagged} hot />
        <Tile label="Meetings · 7 days" value={s.meetings} />
      </div>
    </section>
  );
};

export default DialerWidget;
