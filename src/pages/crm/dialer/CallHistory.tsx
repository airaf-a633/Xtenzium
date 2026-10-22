import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';
import type { CallActivity, CallLead } from '../../../types/database';
import { OUTCOMES, customLabelOf, formatInZone } from '../../../lib/dialer-calls';
import { Badge, Card, CardHeader } from '../../../components/crm/ui';

type Row = Pick<CallActivity, 'id' | 'outcome' | 'note' | 'reason_tags' | 'caller_id' | 'created_at'>;

/* What happened on earlier calls to this company. A lead only comes back
   because of one of these (a retry or a callback), so the rep sees WHY it
   is back and what was said last time, instead of starting cold. */
const CallHistory = ({ lead, tz }: { lead: CallLead; tz: string }) => {
  const { user } = useAuth();
  const userId = user?.id;
  const [rows, setRows] = useState<Row[] | null>(null);
  const untouched = lead.attempt_count === 0 && lead.status === 'new';

  useEffect(() => {
    if (untouched) return undefined;
    let cancelled = false;
    supabase
      .from('call_activities')
      .select('id, outcome, note, reason_tags, caller_id, created_at')
      .eq('lead_id', lead.id)
      .order('created_at', { ascending: false })
      .limit(5)
      .then(({ data }) => {
        if (!cancelled) setRows((data as Row[] | null) ?? []);
      });
    return () => {
      cancelled = true;
    };
  }, [lead.id, lead.status, untouched]);

  if (untouched || !rows || rows.length === 0) return null;

  return (
    <Card>
      <CardHeader title="Earlier calls" />
      <ul className="m-0 flex list-none flex-col divide-y divide-crm-line p-0">
        {rows.map(r => {
          const custom = r.outcome === 'other' ? (customLabelOf(r.reason_tags) ?? 'Custom outcome') : null;
          const label = custom ?? OUTCOMES.find(o => o.key === r.outcome)?.label ?? r.outcome;
          return (
            <li key={r.id} className="flex flex-col gap-1 px-4 py-2.5 text-[13px]">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="neutral">{label}</Badge>
                <span className="text-crm-ink-3">
                  {formatInZone(new Date(r.created_at), tz)} · {r.caller_id === userId ? 'you' : 'a teammate'}
                </span>
              </div>
              {r.reason_tags?.filter(t => !t.startsWith('Custom: ')).length > 0 && <span className="text-crm-ink-3">{r.reason_tags.filter(t => !t.startsWith('Custom: ')).join(' · ')}</span>}
              {r.note && <span className="whitespace-pre-wrap text-crm-ink-2">{r.note}</span>}
            </li>
          );
        })}
      </ul>
    </Card>
  );
};

export default CallHistory;
