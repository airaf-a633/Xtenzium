import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';

/* How many things are waiting on the owner: queued follow-ups plus
   unresolved flags. Polled lightly rather than subscribed — it feeds a
   badge, and a minute of lag on a badge is not worth a socket. */
export const useInboxCount = (enabled: boolean): number => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;

    const run = () =>
      Promise.all([
        supabase.from('followup_queue').select('id', { count: 'exact', head: true }).eq('status', 'queued'),
        supabase.from('call_activities').select('id', { count: 'exact', head: true }).eq('flagged', true).is('flag_resolved_at', null),
        // Nudges that have come due. Harmless (counts as 0) before migration 031.
        supabase.from('call_leads').select('id', { count: 'exact', head: true }).eq('status', 'followup').not('nudge_due_at', 'is', null).lte('nudge_due_at', new Date().toISOString()),
      ]).then(([q, f, n]) => {
        if (!cancelled && !q.error && !f.error) setCount((q.count ?? 0) + (f.count ?? 0) + (n.error ? 0 : (n.count ?? 0)));
      });

    run();
    const timer = setInterval(run, 60_000);
    window.addEventListener('focus', run);
    return () => {
      cancelled = true;
      clearInterval(timer);
      window.removeEventListener('focus', run);
    };
  }, [enabled]);

  return count;
};
