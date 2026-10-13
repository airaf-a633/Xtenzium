/* One lead, every touch.

   A lead can be reached by phone AND by email, and the people working
   it should see both in one place: what has already been tried, and
   what happens next. This merges the two logs into a single timeline
   and works out the next steps from the lead's own state. Pure, so the
   rules are checked rather than eyeballed. */

import type { CallLeadStatus } from '../types/database';

export interface CallTouch {
  id: string;
  outcome: string;
  note: string | null;
  created_at: string;
}

export interface EmailTouch {
  id: string;
  action: string;
  note: string | null;
  touch: number | null;
  created_at: string;
}

export interface TimelineEvent {
  id: string;
  at: string;
  channel: 'call' | 'email';
  label: string;
  note: string | null;
  /** An email that was actually sent (or a form submitted), as opposed to an outcome or a note. */
  isSend: boolean;
}

const SENDS = new Set(['emailed', 'followed_up', 'form_sent']);

/** Newest first. `callLabel` / `emailLabel` turn the raw codes into words. */
export function buildTimeline(
  calls: CallTouch[],
  emails: EmailTouch[],
  callLabel: (outcome: string) => string,
  emailLabel: (action: string) => string,
): TimelineEvent[] {
  const events: TimelineEvent[] = [
    ...calls.map(c => ({ id: `c${c.id}`, at: c.created_at, channel: 'call' as const, label: callLabel(c.outcome), note: c.note, isSend: false })),
    ...emails.map(e => ({
      id: `e${e.id}`, at: e.created_at, channel: 'email' as const,
      label: `${emailLabel(e.action)}${e.touch ? ` (touch ${e.touch})` : ''}`, note: e.note, isSend: SENDS.has(e.action),
    })),
  ];
  return events.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
}

export const touchCounts = (events: TimelineEvent[]) => ({
  calls: events.filter(e => e.channel === 'call').length,
  emails: events.filter(e => e.isSend).length,
});

export interface PlanLead {
  status: CallLeadStatus;
  next_call_at: string | null;
  attempt_count: number;
  email: string | null;
  phone_e164: string | null;
  phone_is_us: boolean | null;
  outreach_touches: number;
  outreach_due: string | null;
}

export interface NextStep {
  channel: 'call' | 'email' | 'team';
  label: string;
  /** When it is due; null when it just needs doing. */
  at: string | null;
  overdue: boolean;
}

/** The first number and the last — `touches` of the sequence have gone out. */
const MAX_TOUCHES = 4;

/**
 * What happens next for this lead, across both channels. `emailAfter` is
 * the number of missed calls after which email opens as a second channel
 * (Dialer settings; 0 = never).
 */
export function nextSteps(lead: PlanLead, emailAfter: number, now: Date = new Date()): NextStep[] {
  const steps: NextStep[] = [];
  const due = (iso: string | null) => iso !== null && new Date(iso).getTime() <= now.getTime();
  const callable = lead.phone_e164 !== null && lead.phone_is_us === true;
  const closed = ['lost', 'disqualified', 'bad_data', 'dnc', 'exhausted'].includes(lead.status);
  if (closed) return [];

  // ── Phone ──
  if (lead.status === 'callback') steps.push({ channel: 'call', label: 'Call back (they asked for it)', at: lead.next_call_at, overdue: due(lead.next_call_at) });
  else if (lead.status === 'retry' && callable) steps.push({ channel: 'call', label: `Call again (attempt ${lead.attempt_count + 1})`, at: lead.next_call_at, overdue: due(lead.next_call_at) });
  else if (lead.status === 'new' && callable) steps.push({ channel: 'call', label: 'First call', at: null, overdue: false });
  else if (lead.status === 'nurture') steps.push({ channel: 'call', label: 'Call again (they said not now)', at: lead.next_call_at, overdue: due(lead.next_call_at) });

  // ── With the team ──
  if (lead.status === 'meeting') steps.push({ channel: 'team', label: 'Meeting', at: lead.next_call_at, overdue: due(lead.next_call_at) });
  if (lead.status === 'followup') steps.push({ channel: 'team', label: 'Waiting on the team to follow up', at: null, overdue: false });

  // ── Email ──
  const inSequence = lead.outreach_touches > 0;
  if (inSequence && lead.outreach_due) {
    steps.push({ channel: 'email', label: `Email follow-up (touch ${lead.outreach_touches + 1} of ${MAX_TOUCHES})`, at: lead.outreach_due, overdue: due(lead.outreach_due) });
  } else if (!inSequence && ['no_phone', 'new', 'retry'].includes(lead.status)) {
    if (!callable) {
      steps.push(lead.email
        ? { channel: 'email', label: 'Send the first email', at: null, overdue: false }
        : { channel: 'email', label: 'Find an email address', at: null, overdue: false });
    } else if (lead.status === 'retry' && emailAfter > 0 && lead.attempt_count >= emailAfter) {
      steps.push(lead.email
        ? { channel: 'email', label: 'Email them too — the calls haven’t connected', at: null, overdue: false }
        : { channel: 'email', label: 'Find an email — the calls haven’t connected', at: null, overdue: false });
    }
  }
  return steps;
}
