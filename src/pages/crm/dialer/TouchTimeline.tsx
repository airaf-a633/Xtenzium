import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import type { CallLead } from '../../../types/database';
import { formatInZone, outcomeLabel } from '../../../lib/dialer-calls';
import { ACTION_LABEL } from '../../../lib/outreach';
import { buildTimeline, nextSteps, touchCounts, type CallTouch, type EmailTouch } from '../../../lib/touch-plan';
import { Badge, Card, CardHeader } from '../../../components/crm/ui';
import { cn } from '../../../lib/utils';

/* "After how many missed calls does email open up?" — a setting, read
   once and shared; falls back to the default if it can't be read. */
let cachedAfter: Promise<number> | null = null;
const loadEmailAfter = (): Promise<number> => {
  cachedAfter ??= Promise.resolve(supabase.from('dialer_settings').select('email_after_attempts').maybeSingle()).then(
    ({ data }) => (data as { email_after_attempts: number } | null)?.email_after_attempts ?? 2,
  );
  return cachedAfter;
};

/* Every touch on one lead, calls and emails together — and what
   happens next. Whoever picks the lead up (rep on a call, someone
   sending a follow-up) sees the same picture. */
const TouchTimeline = ({ lead, tz = 'Asia/Karachi' }: { lead: CallLead; tz?: string }) => {
  const [calls, setCalls] = useState<CallTouch[]>([]);
  const [emails, setEmails] = useState<EmailTouch[]>([]);
  const [emailAfter, setEmailAfter] = useState(2);
  const [now] = useState(() => new Date());

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      supabase.from('call_activities').select('id, outcome, note, created_at').eq('lead_id', lead.id).order('created_at', { ascending: false }).limit(20),
      supabase.from('outreach_activities').select('id, action, note, touch, created_at').eq('lead_id', lead.id).order('created_at', { ascending: false }).limit(20),
      loadEmailAfter(),
    ]).then(([c, e, after]) => {
      if (cancelled) return;
      setCalls((c.data ?? []) as CallTouch[]);
      setEmails((e.data ?? []) as EmailTouch[]);
      setEmailAfter(after);
    });
    return () => {
      cancelled = true;
    };
  }, [lead.id]);

  const events = buildTimeline(calls, emails, outcomeLabel, a => ACTION_LABEL[a as keyof typeof ACTION_LABEL] ?? a);
  const counts = touchCounts(events);
  const steps = nextSteps(lead, emailAfter, now);

  if (events.length === 0 && steps.length === 0) return null;

  return (
    <Card>
      <CardHeader title="Touch plan" />
      <div className="flex flex-col gap-3 p-4">
        <p className="m-0 text-[12.5px] text-crm-ink-3">
          {counts.calls} call{counts.calls === 1 ? '' : 's'} · {counts.emails} email{counts.emails === 1 ? '' : 's'} sent
        </p>

        {steps.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <p className="m-0 font-crm-mono text-[10px] uppercase tracking-[0.12em] text-crm-ink-3">Next</p>
            {steps.map(s => (
              <div key={s.label} className="flex flex-wrap items-center gap-2 text-[13px] text-crm-ink">
                <Badge tone={s.channel === 'email' ? 'info' : s.channel === 'call' ? 'copper' : 'neutral'}>
                  {s.channel === 'email' ? 'Email' : s.channel === 'call' ? 'Call' : 'Team'}
                </Badge>
                <span>{s.label}</span>
                {s.at && (
                  <span className={cn('text-[12px]', s.overdue ? 'text-crm-warning' : 'text-crm-ink-3')}>
                    {s.overdue ? 'due now · ' : ''}
                    {formatInZone(new Date(s.at), tz)}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        {events.length > 0 && (
          <ul className="m-0 flex list-none flex-col gap-1.5 border-t border-crm-line p-0 pt-3">
            {events.map(e => (
              <li key={e.id} className="flex flex-wrap items-baseline gap-2 text-[13px]">
                <span className="w-[44px] shrink-0 font-crm-mono text-[10px] uppercase tracking-[0.1em] text-crm-ink-3">
                  {e.channel === 'call' ? 'Call' : 'Email'}
                </span>
                <span className="font-medium text-crm-ink">{e.label}</span>
                <span className="text-crm-ink-3">{formatInZone(new Date(e.at), tz)}</span>
                {e.note && <span className="basis-full pl-[52px] text-crm-ink-2">{e.note}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
};

export default TouchTimeline;
