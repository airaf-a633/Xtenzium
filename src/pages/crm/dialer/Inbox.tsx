import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';
import type { CallActivity, CallLead, EmailTemplate, FollowupItem, Meeting, TeamMember } from '../../../types/database';
import { callGoogle } from '../../../lib/google-api';
import { formatInZone, formatPhone, gmailCompose, outcomeLabel, renderTemplate, voiceLink } from '../../../lib/dialer-calls';
import {
  Badge, Button, Card, EmptyState, ErrorState, Input, PageHeader, SegmentedControl,
  Select, SkeletonRows, Textarea, useToast,
} from '../../../components/crm/ui';

type Tab = 'email' | 'interested' | 'meetings' | 'flags';
const ET = 'America/New_York';
const FOLLOWUP_LABEL: Record<FollowupItem['type'], string> = {
  email_info: 'Send info',
  email_proposal: 'Send proposal',
  linkedin: 'LinkedIn',
  admin_call: 'Call them',
};

interface Data {
  queue: FollowupItem[];
  interested: CallLead[];
  meetings: CallLead[];
  flags: CallActivity[];
  leads: Record<string, CallLead>;
  reps: Record<string, string>;
  templates: Record<string, EmailTemplate>;
  notes: Record<string, string>;
  members: TeamMember[];
  /** The scheduled calendar meeting for a lead, when one was booked through Google. */
  scheduled: Record<string, Meeting>;
}

const EMPTY: Data = { queue: [], interested: [], meetings: [], flags: [], leads: {}, reps: {}, templates: {}, notes: {}, members: [], scheduled: {} };

const ago = (iso: string) => {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins}m ago`;
  if (mins < 2880) return `${Math.round(mins / 60)}h ago`;
  return `${Math.round(mins / 1440)}d ago`;
};

/* One follow-up email, opened. Everything is editable before it's
   copied or sent: the template is a starting point, not a form letter. */
const Composer = ({
  item, lead, template, onDone,
}: {
  item: FollowupItem;
  lead: CallLead;
  template: EmailTemplate | undefined;
  onDone: (status: 'sent' | 'done' | 'cancelled') => void;
}) => {
  const { toast } = useToast();
  const vars = {
    company_name: lead.company_name,
    contact_name: lead.contact_name || 'there',
    website: lead.website,
    rep_note: item.note,
  };
  const [to, setTo] = useState(lead.email ?? '');
  const [subject, setSubject] = useState(renderTemplate(template?.subject ?? '', vars));
  const [body, setBody] = useState(renderTemplate(template?.body ?? '', vars));

  const saveEmail = async () => {
    const email = to.trim().toLowerCase();
    if (!email || email === lead.email) return;
    const { error } = await supabase.from('call_leads').update({ email }).eq('id', lead.id);
    toast(error ? 'Couldn’t save that email.' : 'Email saved to the lead', error ? 'danger' : 'success');
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`);
      toast('Email copied', 'success');
    } catch {
      toast('Couldn’t copy.', 'danger');
    }
  };

  return (
    <div className="flex flex-col gap-3 border-t border-crm-line bg-crm-ground p-4">
      {!template && (
        <p className="m-0 text-[12.5px] text-crm-ink-3">
          No template for “{FOLLOWUP_LABEL[item.type]}” — write it below, or add one in Dialer settings.
        </p>
      )}
      <div className="grid gap-2 sm:grid-cols-2">
        <Input label="To" type="email" value={to} onChange={e => setTo(e.target.value)} onBlur={saveEmail} placeholder="no email on file" />
        <Input label="Subject" value={subject} onChange={e => setSubject(e.target.value)} />
      </div>
      <Textarea label="Message" rows={11} value={body} onChange={e => setBody(e.target.value)} />
      <div className="flex flex-wrap gap-2">
        <a
          href={gmailCompose(to.trim() || null, subject, body)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-9 items-center rounded-crm-md bg-crm-copper px-3 text-[13px] font-medium text-crm-copper-ink no-underline"
        >
          Open in Gmail
        </a>
        <Button onClick={copy}>Copy email</Button>
        <span className="flex-1" />
        <Button variant="primary" onClick={() => onDone('sent')}>Mark sent</Button>
        <Button onClick={() => onDone('done')}>Done</Button>
        <Button variant="ghost" onClick={() => onDone('cancelled')}>Cancel</Button>
      </div>
    </div>
  );
};

/* A request for a call isn't an email to write — it's a person to ring.
   Everything needed to do it is on one card. */
const CallPlan = ({ item, lead, onDone }: { item: FollowupItem; lead: CallLead; onDone: (s: 'done' | 'cancelled') => void }) => {
  const { toast } = useToast();
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(lead.phone_e164 ?? lead.phone_raw ?? '');
      toast('Number copied', 'success');
    } catch {
      toast('Couldn’t copy.', 'danger');
    }
  };
  const zone = lead.timezone ? `their zone: ${(lead.timezone.split('/')[1] ?? lead.timezone).replace('_', ' ')}` : null;
  return (
    <div className="flex flex-col gap-3 border-t border-crm-line bg-crm-ground p-4">
      <p className="m-0 font-crm-mono text-[26px] font-semibold tracking-tight text-crm-ink">
        {formatPhone(lead.phone_e164, lead.phone_raw) || 'No phone on file'}
      </p>
      <p className="m-0 text-[13px] text-crm-ink-2">
        {[lead.contact_name, lead.contact_title, lead.email, zone].filter(Boolean).join(' · ') || 'No contact details yet'}
      </p>
      {item.note && (
        <p className="m-0 whitespace-pre-line rounded-crm-md border border-crm-line bg-crm-surface px-3 py-2 text-[13px] text-crm-ink-2">
          {item.note}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" onClick={copy}>Copy number</Button>
        {lead.phone_e164 && (
          <a
            href={voiceLink(lead.phone_e164)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-9 items-center rounded-crm-md border border-crm-line-hi px-3 text-[13px] text-crm-ink no-underline hover:bg-crm-surface"
          >
            Open in Google Voice
          </a>
        )}
        {lead.website && (
          <a
            href={lead.website}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-9 items-center rounded-crm-md border border-crm-line-hi px-3 text-[13px] text-crm-ink no-underline hover:bg-crm-surface"
          >
            Website
          </a>
        )}
        <span className="flex-1" />
        <Button variant="primary" onClick={() => onDone('done')}>Called — done</Button>
        <Button variant="ghost" onClick={() => onDone('cancelled')}>Cancel</Button>
      </div>
    </div>
  );
};

const Inbox = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>('email');
  const [data, setData] = useState<Data>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [mineOnly, setMineOnly] = useState(false);
  const [nowMs] = useState(() => Date.now());

  const fetchAll = useCallback(async (): Promise<Data> => {
    const weekAhead = new Date(Date.now() + 7 * 86400000).toISOString();
    const [q, i, m, f, t, p, tm, sc] = await Promise.all([
      supabase.from('followup_queue').select('*').eq('status', 'queued').order('created_at'),
      supabase.from('call_leads').select('*').eq('status', 'followup').order('updated_at', { ascending: false }).limit(100),
      supabase.from('call_leads').select('*').eq('status', 'meeting').lte('next_call_at', weekAhead).order('next_call_at'),
      supabase.from('call_activities').select('*').eq('flagged', true).is('flag_resolved_at', null).order('created_at', { ascending: false }).limit(100),
      supabase.from('email_templates').select('*'),
      supabase.from('profiles').select('id, full_name'),
      supabase.from('team_members').select('*').order('name'),
      supabase.from('meetings').select('*').eq('status', 'scheduled').order('starts_at'),
    ]);
    const err = [q, i, m, f, t, p, tm, sc].find(r => r.error)?.error;
    if (err) throw new Error(err.message);

    const queue = (q.data ?? []) as FollowupItem[];
    const flags = (f.data ?? []) as CallActivity[];
    const interested = (i.data ?? []) as CallLead[];
    const meetings = (m.data ?? []) as CallLead[];

    // Leads referenced by the queue / flags that aren't already loaded.
    const leads: Record<string, CallLead> = {};
    [...interested, ...meetings].forEach(l => (leads[l.id] = l));
    const missing = [...new Set([...queue.map(x => x.lead_id), ...flags.map(x => x.lead_id)])].filter(id => !leads[id]);
    if (missing.length) {
      const { data: more } = await supabase.from('call_leads').select('*').in('id', missing);
      ((more ?? []) as CallLead[]).forEach(l => (leads[l.id] = l));
    }

    // Latest rep note per interested / meeting lead.
    const noteIds = [...interested, ...meetings].map(l => l.id);
    const notes: Record<string, string> = {};
    if (noteIds.length) {
      const { data: acts } = await supabase
        .from('call_activities').select('lead_id, note, created_at').in('lead_id', noteIds).not('note', 'is', null)
        .order('created_at', { ascending: false });
      ((acts ?? []) as { lead_id: string; note: string }[]).forEach(a => {
        if (!notes[a.lead_id]) notes[a.lead_id] = a.note;
      });
    }

    return {
      queue, interested, meetings, flags, leads, notes,
      members: (tm.data ?? []) as TeamMember[],
      scheduled: Object.fromEntries(((sc.data ?? []) as Meeting[]).map(x => [x.lead_id, x])),
      templates: Object.fromEntries(((t.data ?? []) as EmailTemplate[]).map(x => [x.type, x])),
      reps: Object.fromEntries(((p.data ?? []) as { id: string; full_name: string | null }[]).map(x => [x.id, x.full_name ?? 'Rep'])),
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchAll()
      .then(d => {
        if (cancelled) return;
        setData(d);
        setLoading(false);
      })
      .catch((e: Error) => {
        if (cancelled) return;
        setFailed(e.message);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fetchAll]);

  const finish = async (item: FollowupItem, status: 'sent' | 'done' | 'cancelled') => {
    const { error } = await supabase
      .from('followup_queue')
      .update({ status, handled_by: user?.id ?? null, handled_at: new Date().toISOString() })
      .eq('id', item.id);
    if (error) {
      toast('That didn’t save.', 'danger');
      return;
    }
    setData(d => ({ ...d, queue: d.queue.filter(x => x.id !== item.id) }));
    setOpen(null);
    toast(status === 'sent' ? 'Marked sent' : status === 'done' ? 'Done' : 'Cancelled', 'success');
  };

  /* A meeting booked through Google has a record; one the rep only
     logged by hand doesn't. Both are handled — the record just carries
     the calendar side too. */
  const setMeeting = async (lead: CallLead, status: 'held' | 'no_show') => {
    const row = data.scheduled[lead.id];
    const { error } = row
      ? await supabase.rpc('meeting_set_status', { p_meeting_id: row.id, p_status: status })
      : status === 'held'
        ? await supabase.from('call_leads').update({ next_call_at: null }).eq('id', lead.id)
        : await supabase.from('call_leads').update({ status: 'callback', next_call_at: new Date().toISOString() }).eq('id', lead.id);
    if (error) return toast('That didn’t save.', 'danger');
    setData(d => ({ ...d, meetings: d.meetings.filter(x => x.id !== lead.id) }));
    toast(status === 'held' ? 'Marked held' : 'No-show — back in the rep’s queue as a callback', status === 'held' ? 'success' : 'info');
  };

  const cancelMeeting = async (lead: CallLead) => {
    const row = data.scheduled[lead.id];
    if (!row) return;
    if (!confirm(`Cancel the meeting with ${lead.company_name}? It will be removed from your calendar and the invitees are told.`)) return;
    const r = await callGoogle({ action: 'cancel', meeting_id: row.id });
    if (r.error) return toast(r.error, 'danger');
    setData(d => ({ ...d, meetings: d.meetings.filter(x => x.id !== lead.id) }));
    toast('Meeting cancelled', 'info');
  };

  const resolveFlag = async (a: CallActivity) => {
    const { error } = await supabase
      .from('call_activities').update({ flag_resolved_at: new Date().toISOString(), flag_resolved_by: user?.id ?? null }).eq('id', a.id);
    if (error) return toast('That didn’t save.', 'danger');
    setData(d => ({ ...d, flags: d.flags.filter(x => x.id !== a.id) }));
  };

  const copyInvite = async (lead: CallLead) => {
    const tz = lead.timezone ?? ET;
    const when = new Date(lead.next_call_at!);
    const text = `Meeting with ${lead.company_name}${lead.contact_name ? ` (${lead.contact_name})` : ''}\n${formatInZone(when, tz)}\n${formatInZone(when, 'Asia/Karachi')}\n${lead.email ?? ''}\n${lead.website ?? ''}`.trim();
    try {
      await navigator.clipboard.writeText(text);
      toast('Meeting details copied', 'success');
    } catch {
      toast('Couldn’t copy.', 'danger');
    }
  };

  const me = useMemo(() => data.members.find(m => m.user_id === user?.id) ?? null, [data.members, user]);
  const memberName = (id: string | null) => data.members.find(m => m.id === id)?.name.split(' ')[0] ?? null;

  const assign = async (item: FollowupItem, memberId: string | null) => {
    const { error } = await supabase.rpc('dialer_assign_followup', { p_id: item.id, p_member: memberId });
    if (error) return toast('Couldn’t assign that.', 'danger');
    setData(d => ({ ...d, queue: d.queue.map(x => (x.id === item.id ? { ...x, assignee_id: memberId } : x)) }));
    toast(memberId ? `Assigned to ${memberName(memberId)}` : 'Unassigned', 'success');
  };

  const queue = mineOnly && me ? data.queue.filter(x => x.assignee_id === me.id) : data.queue;
  const mineCount = me ? data.queue.filter(x => x.assignee_id === me.id).length : 0;

  const counts = useMemo(
    () => ({ email: data.queue.length, interested: data.interested.length, meetings: data.meetings.length, flags: data.flags.length }),
    [data],
  );

  return (
    <div className="flex max-w-[900px] flex-col gap-4">
      <PageHeader title="Needs your action" subtitle="Everything the rep has handed to you." />

      <SegmentedControl
        label="Inbox section"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'email', label: `Follow-ups (${counts.email})` },
          { value: 'interested', label: `Interested (${counts.interested})` },
          { value: 'meetings', label: `Meetings (${counts.meetings})` },
          { value: 'flags', label: `Flagged (${counts.flags})` },
        ]}
      />

      {tab === 'email' && me && (
        <SegmentedControl
          label="Whose follow-ups"
          value={mineOnly ? 'mine' : 'all'}
          onChange={v => setMineOnly(v === 'mine')}
          options={[
            { value: 'all', label: `Everyone (${data.queue.length})` },
            { value: 'mine', label: `Mine (${mineCount})` },
          ]}
        />
      )}
      {tab === 'email' && !me && !loading && data.members.length > 0 && (
        <p className="m-0 text-[12.5px] text-crm-ink-3">
          Link your account on the Team page to see tasks assigned to you and get notified when the rep tags you.
        </p>
      )}

      {failed && <ErrorState title="The inbox couldn’t load" body={failed} />}
      {loading && <SkeletonRows rows={4} />}

      {!loading && !failed && tab === 'email' && (
        queue.length === 0 ? (
          <EmptyState
            title={mineOnly ? 'Nothing assigned to you' : 'Nothing waiting'}
            body={mineOnly ? 'Tasks the rep tags you on, or that someone assigns to you, show up here.' : 'When the rep logs “send info”, “wants proposal” or “wants a call”, the task lands here.'}
          />
        ) : (
          <Card>
            {queue.map(item => {
              const lead = data.leads[item.lead_id];
              if (!lead) return null;
              const isOpen = open === item.id;
              return (
                <div key={item.id} className="border-b border-crm-line last:border-b-0">
                  <button
                    type="button"
                    onClick={() => setOpen(isOpen ? null : item.id)}
                    className="flex w-full cursor-pointer items-start gap-3 border-0 bg-transparent px-4 py-3 text-left"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-[14px] font-medium text-crm-ink">{lead.company_name}</span>
                      <span className="block truncate text-[12.5px] text-crm-ink-3">
                        {item.note ?? 'No note from the rep'}
                      </span>
                    </span>
                    <Badge tone={item.type === 'email_proposal' ? 'copper' : 'neutral'}>{FOLLOWUP_LABEL[item.type]}</Badge>
                    {item.type !== 'admin_call' && !lead.email && <Badge tone="warning">No email</Badge>}
                    {item.assignee_id ? (
                      <Badge tone="info" dot>{memberName(item.assignee_id) ?? 'Assigned'}</Badge>
                    ) : (
                      <Badge tone="neutral">Unassigned</Badge>
                    )}
                    <span className="shrink-0 text-[12px] text-crm-ink-3">{ago(item.created_at)}</span>
                  </button>
                  {isOpen && (
                    <>
                      <div className="flex items-end gap-2 border-t border-crm-line bg-crm-ground px-4 pt-3">
                        <Select
                          className="w-[220px]"
                          label="Handled by"
                          value={item.assignee_id ?? ''}
                          placeholder="Unassigned"
                          options={data.members.map(m => ({ value: m.id, label: m.name }))}
                          onChange={e => assign(item, e.target.value || null)}
                        />
                      </div>
                      {item.type === 'admin_call' ? (
                        <CallPlan key={item.id} item={item} lead={lead} onDone={s => finish(item, s)} />
                      ) : (
                        <Composer
                          key={item.id}
                          item={item}
                          lead={lead}
                          template={data.templates[item.type]}
                          onDone={s => finish(item, s)}
                        />
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </Card>
        )
      )}

      {!loading && !failed && tab === 'interested' && (
        data.interested.length === 0 ? (
          <EmptyState title="No interested leads" body="Leads that asked for info or a proposal appear here." />
        ) : (
          <Card>
            {data.interested.map(l => (
              <div key={l.id} className="flex flex-wrap items-start gap-3 border-b border-crm-line px-4 py-3 last:border-b-0">
                <div className="min-w-0 flex-1">
                  <p className="m-0 text-[14px] font-medium text-crm-ink">{l.company_name}</p>
                  <p className="m-0 text-[12.5px] text-crm-ink-3">
                    {[l.contact_name, l.contact_title, l.email, formatPhone(l.phone_e164, l.phone_raw)].filter(Boolean).join(' · ')}
                  </p>
                  {data.notes[l.id] && <p className="m-0 mt-1 text-[13px] text-crm-ink-2">“{data.notes[l.id]}”</p>}
                </div>
                {l.tier && <Badge tone="neutral">Tier {l.tier}</Badge>}
                {l.deal_id && <Link to="/crm/pipeline" className="text-[13px] text-crm-copper">View deal</Link>}
              </div>
            ))}
          </Card>
        )
      )}

      {!loading && !failed && tab === 'meetings' && (
        data.meetings.length === 0 ? (
          <EmptyState title="No meetings in the next 7 days" body="Meetings the rep agrees will show here with their time in both zones." />
        ) : (
          <Card>
            {data.meetings.map(l => {
              const when = new Date(l.next_call_at!);
              const tz = l.timezone ?? ET;
              const past = when.getTime() < nowMs;
              return (
                <div key={l.id} className="flex flex-wrap items-start gap-3 border-b border-crm-line px-4 py-3 last:border-b-0">
                  <div className="min-w-0 flex-1">
                    <p className="m-0 text-[14px] font-medium text-crm-ink">
                      {l.company_name} {past && <Badge tone="warning">Past</Badge>}
                    </p>
                    <p className="m-0 text-[13px] text-crm-ink-2">{formatInZone(when, tz)} · {formatInZone(when, 'Asia/Karachi')}</p>
                    <p className="m-0 text-[12.5px] text-crm-ink-3">
                      {[l.contact_name, l.email ?? 'no email yet', formatPhone(l.phone_e164, l.phone_raw)].filter(Boolean).join(' · ')}
                    </p>
                    <p className="m-0 mt-0.5 text-[12px] text-crm-ink-3">
                      {data.scheduled[l.id]
                        ? `On your calendar · invite sent to ${data.scheduled[l.id].attendee_email ?? 'the prospect'}${data.scheduled[l.id].rep_email ? ` and ${data.scheduled[l.id].rep_email}` : ''}`
                        : 'Not on a calendar — send the invite yourself'}
                    </p>
                    {data.notes[l.id] && <p className="m-0 mt-1 text-[13px] text-crm-ink-2">“{data.notes[l.id]}”</p>}
                  </div>
                  {data.scheduled[l.id]?.meet_link && (
                    <a
                      href={data.scheduled[l.id].meet_link ?? undefined}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-8 items-center rounded-crm-md bg-crm-copper px-3 text-[12.5px] font-medium text-crm-copper-ink no-underline"
                    >
                      Join Meet
                    </a>
                  )}
                  {data.scheduled[l.id]?.calendar_link && (
                    <a
                      href={data.scheduled[l.id].calendar_link ?? undefined}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-8 items-center rounded-crm-md border border-crm-line-hi px-3 text-[12.5px] text-crm-ink no-underline hover:bg-crm-ground"
                    >
                      Calendar
                    </a>
                  )}
                  <Button size="sm" onClick={() => copyInvite(l)}>Copy details</Button>
                  <Button size="sm" variant="primary" onClick={() => setMeeting(l, 'held')}>Held</Button>
                  <Button size="sm" onClick={() => setMeeting(l, 'no_show')}>No-show</Button>
                  {data.scheduled[l.id] && <Button size="sm" variant="ghost" onClick={() => cancelMeeting(l)}>Cancel</Button>}
                </div>
              );
            })}
          </Card>
        )
      )}

      {!loading && !failed && tab === 'flags' && (
        data.flags.length === 0 ? (
          <EmptyState title="Nothing flagged" body="When the rep flags a call for you, it shows up here until you resolve it." />
        ) : (
          <Card>
            {data.flags.map(a => {
              const lead = data.leads[a.lead_id];
              return (
                <div key={a.id} className="flex flex-wrap items-start gap-3 border-b border-crm-line px-4 py-3 last:border-b-0">
                  <div className="min-w-0 flex-1">
                    <p className="m-0 text-[14px] font-medium text-crm-ink">{lead?.company_name ?? 'Lead'}</p>
                    <p className="m-0 text-[12.5px] text-crm-ink-3">
                      {outcomeLabel(a.outcome)} · {a.caller_id ? data.reps[a.caller_id] ?? 'Rep' : 'Rep'} · {ago(a.created_at)}
                    </p>
                    {a.note && <p className="m-0 mt-1 text-[13px] text-crm-ink-2">“{a.note}”</p>}
                  </div>
                  <Button size="sm" onClick={() => resolveFlag(a)}>Resolve</Button>
                </div>
              );
            })}
          </Card>
        )
      )}
    </div>
  );
};

export default Inbox;
