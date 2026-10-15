import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import type { Person } from '../../../lib/dialer-calls';

/* The team, for the @mention picker. One fetch per page load, shared by
   every panel that asks — the list changes when someone joins, not
   between calls. A failed fetch just means no suggestions; typing
   "@Airaf" by hand still works, because the database does the matching. */
let cached: Promise<Person[]> | null = null;

const load = (): Promise<Person[]> => {
  cached ??= Promise.resolve(supabase.rpc('dialer_mentionables'))
    .then(({ data, error }) => {
      if (error) {
        cached = null;
        return [];
      }
      return (data ?? []) as Person[];
    });
  return cached;
};

export const useMentionables = (): Person[] => {
  const [people, setPeople] = useState<Person[]>([]);
  useEffect(() => {
    let cancelled = false;
    load().then(p => {
      if (!cancelled) setPeople(p);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return people;
};
