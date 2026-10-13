import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import type { GoogleStatus } from '../../../types/database';

/* Is Google Calendar connected? Asked once per page load and shared —
   it only changes when an admin connects or disconnects, and `refresh`
   is for exactly that. Any failure reads as "not connected", which is
   the safe answer: the rep falls back to typing the time. */
let cached: Promise<GoogleStatus> | null = null;

const load = (): Promise<GoogleStatus> => {
  cached ??= Promise.resolve(supabase.rpc('google_status')).then(({ data, error }) => {
    if (error || !data) {
      cached = null;
      return { connected: false };
    }
    return data as GoogleStatus;
  });
  return cached;
};

export const useCalendar = () => {
  const [status, setStatus] = useState<GoogleStatus | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    load().then(s => {
      if (!cancelled) setStatus(s);
    });
    return () => {
      cancelled = true;
    };
  }, [tick]);

  const refresh = useCallback(() => {
    cached = null;
    setTick(n => n + 1);
  }, []);

  return { status, connected: status?.connected === true, loading: status === null, refresh };
};
