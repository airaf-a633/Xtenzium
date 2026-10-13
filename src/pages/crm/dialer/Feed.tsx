import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import type { CallActivity } from '../../../types/database';
import { OUTCOMES, formatInZone, outcomeLabel } from '../../../lib/dialer-calls';
import { Badge, Card, EmptyState, ErrorState, PageHeader, Select, SkeletonRows } from '../../../components/crm/ui';

interface Row extends CallActivity {
  company: string;
  rep: string;
}

const TONE: Record<string, 'success' | 'copper' | 'danger' | 'neutral' | 'warning'> = {
  meeting_booked: 'success',
  interested_proposal: 'copper',
  interested_info: 'copper',
  callback: 'warning',
  dnc: 'danger',
};

/* What the rep is doing, as it happens. A realtime subscription says
   "something changed" and the page reloads the list; that costs one
   query per call but keeps the joined names correct without caching
   them by hand. A slow poll backs it up in case the socket drops. */
const Feed = () => {
  const [rows, setRows] = useState<Row[]>([]);
  const [reps, setReps] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState<string | null>(null);
  const [rep, setRep] = useState('');
  const [outcome, setOutcome] = useState('');

  const fetchRows = useCallback(async () => {
    let q = supabase.from('call_activities').select('*').order('created_at', { ascending: false }).limit(100);
    if (rep) q = q.eq('caller_id', rep);
    if (outcome) q = q.eq('outcome', outcome);
    const [acts, profiles] = await Promise.all([q, supabase.from('profiles').select('id, full_name')]);
    if (acts.error) throw new Error(acts.error.message);

    const list = (acts.data ?? []) as CallActivity[];
    const ids = [...new Set(list.map(a => a.lead_id))];
    const names: Record<string, string> = {};
    if (ids.length) {
      const { data } = await supabase.from('call_leads').select('id, company_name').in('id', ids);
      ((data ?? []) as { id: string; company_name: string }[]).forEach(l => (names[l.id] = l.company_name));
    }
    const repMap = Object.fromEntries(
      ((profiles.data ?? []) as { id: string; full_name: string | null }[]).map(p => [p.id, p.full_name ?? 'Rep']),
    );
    return {
      repMap,
      rows: list.map(a => ({ ...a, company: names[a.lead_id] ?? 'Lead', rep: (a.caller_id && repMap[a.caller_id]) || 'Rep' })),
    };
  }, [rep, outcome]);

  useEffect(() => {
    let cancelled = false;
    const run = () =>
      fetchRows()
        .then(r => {
          if (cancelled) return;
          setRows(r.rows);
          setReps(r.repMap);
          setFailed(null);
          setLoading(false);
        })
        .catch((e: Error) => {
          if (cancelled) return;
          setFailed(e.message);
          setLoading(false);
        });
    run();

    const channel = supabase
      .channel('crm:call_activities')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'call_activities' }, () => void run())
      .subscribe();
    const poll = setInterval(run, 30_000);

    return () => {
      cancelled = true;
      clearInterval(poll);
      supabase.removeChannel(channel);
    };
  }, [fetchRows]);

  return (
    <div className="flex max-w-[900px] flex-col gap-4">
      <PageHeader title="Live feed" subtitle="Every call as it’s logged. Updates on its own." />

      <div className="flex flex-wrap gap-2">
        <Select
          className="w-[200px]"
          label="Rep"
          value={rep}
          onChange={e => {
            setLoading(true);
            setRep(e.target.value);
          }}
          placeholder="Everyone"
          options={Object.entries(reps).map(([value, label]) => ({ value, label }))}
        />
        <Select
          className="w-[240px]"
          label="Outcome"
          value={outcome}
          onChange={e => {
            setLoading(true);
            setOutcome(e.target.value);
          }}
          placeholder="All outcomes"
          options={OUTCOMES.map(o => ({ value: o.key, label: o.label }))}
        />
      </div>

      {failed && <ErrorState title="The feed couldn’t load" body={failed} />}
      {loading && <SkeletonRows rows={5} />}
      {!loading && !failed && rows.length === 0 && (
        <EmptyState title="No calls yet" body="Calls appear here the moment the rep logs them." />
      )}
      {!loading && rows.length > 0 && (
        <Card>
          {rows.map(r => (
            <div key={r.id} className="flex flex-wrap items-start gap-3 border-b border-crm-line px-4 py-3 last:border-b-0">
              <div className="min-w-0 flex-1">
                <p className="m-0 text-[14px] font-medium text-crm-ink">
                  {r.company}
                  <span className="font-normal text-crm-ink-3"> · {r.rep}</span>
                </p>
                {r.note && <p className="m-0 mt-0.5 text-[13px] text-crm-ink-2">“{r.note}”</p>}
                {r.reason_tags.length > 0 && (
                  <p className="m-0 mt-1 flex flex-wrap gap-1">
                    {r.reason_tags.map(t => <Badge key={t} tone="neutral">{t}</Badge>)}
                  </p>
                )}
              </div>
              {r.flagged && <Badge tone="warning" dot>Flagged</Badge>}
              <Badge tone={TONE[r.outcome] ?? 'neutral'}>{outcomeLabel(r.outcome)}</Badge>
              <span className="w-[150px] shrink-0 text-right text-[12px] text-crm-ink-3">
                {formatInZone(new Date(r.created_at), 'Asia/Karachi')}
              </span>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
};

export default Feed;
