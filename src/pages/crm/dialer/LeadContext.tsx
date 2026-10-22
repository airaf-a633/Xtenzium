import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import type { CallLead } from '../../../types/database';
import { formatInZone, leadStatusLine } from '../../../lib/dialer-calls';
import { Badge, Card } from '../../../components/crm/ui';

const KIND: Record<string, string> = {
  email_info: 'Info email',
  email_proposal: 'Proposal email',
  email_after_meeting: 'Thank-you email',
  email_noshow: 'Reschedule email',
  admin_call: 'Call from the team',
  linkedin: 'LinkedIn message',
};

interface Task {
  id: string;
  type: string;
  status: string;
  created_at: string;
}

/* Shown when somebody rings BACK: where this company stands, what the team has
   already sent them, and what is still owed. The rest of the card underneath
   (contact, links, earlier calls, the touch plan) is the usual lead screen. */
const LeadContext = ({ lead, tz, fresh }: { lead: CallLead; tz: string; fresh: boolean }) => {
  const [tasks, setTasks] = useState<Task[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from('followup_queue')
      .select('id, type, status, created_at')
      .eq('lead_id', lead.id)
      .order('created_at', { ascending: false })
      .limit(6)
      .then(({ data }) => {
        if (!cancelled) setTasks((data ?? []) as Task[]);
      });
    return () => {
      cancelled = true;
    };
  }, [lead.id, lead.status]);

  return (
    <Card>
      <div className="flex flex-col gap-2 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="warning" dot>{fresh ? 'New caller' : 'Incoming call'}</Badge>
          <span className="text-[13px] font-medium text-crm-ink">{lead.company_name} is calling you back</span>
        </div>
        <p className="m-0 text-[13.5px] text-crm-ink-2">
          {fresh ? 'They were not in the list, so this is the first record of them.' : leadStatusLine(lead, tasks ?? [], tz)}
        </p>
        {tasks && tasks.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {tasks.map(t => (
              <Badge key={t.id} tone={t.status === 'queued' ? 'warning' : 'neutral'}>
                {KIND[t.type] ?? t.type} · {t.status === 'queued' ? 'to send' : t.status} · {formatInZone(new Date(t.created_at), tz).split(',').slice(0, 2).join(',')}
              </Badge>
            ))}
          </div>
        )}
        {lead.outreach_touches > 0 && (
          <p className="m-0 text-[12.5px] text-crm-ink-3">
            Emailed {lead.outreach_touches} time{lead.outreach_touches === 1 ? '' : 's'} by cold outreach.
          </p>
        )}
        <p className="m-0 text-[12px] text-crm-ink-3">Log what they say as usual; it lands on this company’s history.</p>
      </div>
    </Card>
  );
};

export default LeadContext;
