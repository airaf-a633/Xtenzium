import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import type { CallLead } from '../../../types/database';
import { dealStageLabel, formatInZone, leadStatusLine } from '../../../lib/dialer-calls';
import { Badge, Card } from '../../../components/crm/ui';

const KIND: Record<string, string> = {
  email_info: 'Info email',
  email_proposal: 'Proposal email',
  email_after_meeting: 'Thank-you email',
  email_noshow: 'Reschedule email',
  admin_call: 'Call from the team',
  linkedin: 'LinkedIn message',
};

interface DealView {
  stage: string;
  next_action: string | null;
}

/* The deal's stage and next action — all a rep is allowed to see of a deal (migration 033).
   Quietly nothing before that migration, or for a lead with no deal. */
function useDealView(lead: CallLead): DealView | null {
  const [view, setView] = useState<{ id: string; deal: DealView | null } | null>(null);
  const dealId = lead.deal_id;

  useEffect(() => {
    if (!dealId) return undefined;
    let cancelled = false;
    supabase.rpc('lead_deal_view', { p_lead_id: lead.id }).then(({ data, error }) => {
      if (!cancelled) setView({ id: lead.id, deal: error ? null : (data ?? null) });
    });
    return () => {
      cancelled = true;
    };
  }, [lead.id, dealId]);

  return dealId && view?.id === lead.id ? view.deal : null;
}

export const DealBadge = ({ lead }: { lead: CallLead }) => {
  const deal = useDealView(lead);
  const label = dealStageLabel(deal?.stage);
  return label ? <Badge tone="copper">Deal: {label}</Badge> : null;
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
  const deal = useDealView(lead);

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
        {deal && (
          <p className="m-0 text-[13px] text-crm-ink-2">
            <strong className="text-crm-ink">Deal: {dealStageLabel(deal.stage)}</strong>
            {deal.next_action ? ` · the team's next step: ${deal.next_action}` : ''}
          </p>
        )}
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
