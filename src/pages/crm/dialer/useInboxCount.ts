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
      ]).then(([q, f]) => {
        if (!cancelled && !q.error && !f.error) setCount((q.count ?? 0) + (f.count ?? 0));
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
