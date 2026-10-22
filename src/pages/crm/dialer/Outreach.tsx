import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';
import type { CallLead, EmailTemplate } from '../../../types/database';
import { TIER_CHOICES, formatInZone, gmailCompose, renderTemplate, safeHref, tiersParam, type TierChoice } from '../../../lib/dialer-calls';
import {
  ACTION_LABEL, MAILTO_SAFE_LENGTH, OUTREACH_TABS, mailtoCompose, sendActionFor, templateFor, touchLabel,
  type OutreachAction, type OutreachTab,
} from '../../../lib/outreach';
import {
  Badge, Button, Card, EmptyState, ErrorState, Input, PageHeader, SegmentedControl, SkeletonRows, Textarea, useToast,
} from '../../../components/crm/ui';
import { cn } from '../../../lib/utils';
import TouchTimeline from './TouchTimeline';

const PAGE = 50;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Counts = Record<OutreachTab | 'sent_today', number>;

const ExternalLink = ({ href: raw, children }: { href: string | null; children: string }) => {
  const href = safeHref(raw);
  return href ? (
    <a className="text-crm-copper" href={href} target="_blank" rel="noopener noreferrer">{children}</a>
  ) : null;
};

/* One lead, opened: the email to send, and every way it can turn out. */
const Work = ({
  lead, templates, senderName, onChanged,
}: {
  lead: CallLead;
  templates: Record<string, EmailTemplate>;
  senderName: string;
  onChanged: () => void;
}) => {
  const { toast } = useToast();
  const tpl = templates[templateFor(lead.outreach_touches)];
  const vars = { company_name: lead.company_name, contact_name: lead.contact_name || 'there', sender_name: senderName };

  const [to, setTo] = useState(lead.email ?? '');
  const [subject, setSubject] = useState(renderTemplate(tpl?.subject ?? '', vars));
  const [body, setBody] = useState(renderTemplate(tpl?.body ?? '', vars));
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const validTo = EMAIL_RE.test(to.trim());
  const mailto = mailtoCompose(to.trim() || null, subject, body);
  const stillPlaceholder = body.includes('[Your business postal address]');

  const record = async (action: OutreachAction, opts: { email?: string; confirmText?: string } = {}) => {
    if (opts.confirmText && !confirm(opts.confirmText)) return;
    setBusy(true);
    const { error } = await supabase.rpc('log_outreach', {
      p_lead_id: lead.id, p_action: action, p_note: note.trim() || null, p_email: opts.email ?? null,
    });
    setBusy(false);
    if (error) return toast(error.message, 'danger');
    toast(`${lead.company_name}: ${ACTION_LABEL[action].toLowerCase()}`, 'success');
    onChanged();
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`To: ${to}\nSubject: ${subject}\n\n${body}`);
      toast('Email copied — paste it into Zoho', 'success');
    } catch {
      toast('Couldn’t copy.', 'danger');
    }
  };

  const markSent = () => record(sendActionFor(lead.outreach_touches), { email: validTo && to.trim().toLowerCase() !== lead.email ? to.trim() : undefined });

  return (
    <div className="flex flex-col gap-4 border-t border-crm-line bg-crm-ground p-4">
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[13px]">
        <ExternalLink href={lead.website}>Website</ExternalLink>
        <ExternalLink href={lead.contact_url}>Contact page</ExternalLink>
        <ExternalLink href={lead.profile_url}>Profile</ExternalLink>
        {lead.hq && <span className="text-crm-ink-3">{lead.hq}</span>}
        {lead.phone_raw && <span className="text-crm-ink-3">Phone on file: {lead.phone_raw}{lead.phone_is_us === false ? ' (not US)' : ''}</span>}
      </div>

      {lead.why && <p className="m-0 text-[13px] text-crm-ink-2">{lead.why}</p>}

      <div className="flex flex-wrap items-end gap-2">
        <Input
          className="min-w-[240px] flex-1"
          label="Their email"
          type="email"
          value={to}
          onChange={e => setTo(e.target.value)}
          placeholder="Find it on their site or contact page"
        />
        {!lead.email && (
          <Button disabled={!validTo || busy} onClick={() => record('email_found', { email: to.trim() })}>Save email</Button>
        )}
        {!lead.email && lead.contact_url && (
          <Button disabled={busy} onClick={() => record('form_sent')}>I used their contact form</Button>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Input label="Subject" value={subject} onChange={e => setSubject(e.target.value)} />
        <Textarea label="Message" rows={11} value={body} onChange={e => setBody(e.target.value)} />
        {stillPlaceholder && (
          <p className="m-0 text-[12.5px] text-crm-warning">
            The message still has “[Your business postal address]”. Cold email needs a real postal address and an opt-out
            line (CAN-SPAM). Put the address in the template once, in Dialer settings.
          </p>
        )}
        {mailto.length > MAILTO_SAFE_LENGTH && (
          <p className="m-0 text-[12.5px] text-crm-ink-3">This message is long for a mail link — use Copy instead.</p>
        )}
        <div className="flex flex-wrap gap-2">
          <a
            href={mailto}
            className="inline-flex h-9 items-center rounded-crm-md bg-crm-copper px-3 text-[13px] font-medium text-crm-copper-ink no-underline"
          >
            Open in mail app
          </a>
          <a
            href={gmailCompose(to.trim() || null, subject, body)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-9 items-center rounded-crm-md border border-crm-line-hi px-3 text-[13px] text-crm-ink no-underline hover:bg-crm-surface"
          >
            Gmail
          </a>
          <Button onClick={copy}>Copy for Zoho</Button>
        </div>
      </div>

      <Input label="Note (optional)" value={note} onChange={e => setNote(e.target.value)} placeholder="Anything worth remembering" />

      <div className="flex flex-wrap gap-2">
        <Button variant="primary" loading={busy} onClick={markSent}>
          {lead.outreach_touches > 0 ? 'Mark follow-up sent' : 'Mark as sent'}
        </Button>
        <span className="flex-1" />
        <Button disabled={busy} onClick={() => record('replied')}>They replied</Button>
        <Button disabled={busy} onClick={() => record('not_interested')}>Not interested</Button>
        <Button disabled={busy} onClick={() => record('bad_contact')}>Bad address</Button>
        <Button
          disabled={busy}
          variant="danger"
          onClick={() => record('opted_out', { confirmText: `Mark ${lead.company_name} as asked-to-stop? They will be blocked from calls and email for good.` })}
        >
          Asked to stop
        </Button>
      </div>

      <TouchTimeline lead={lead} />
    </div>
  );
};

/* The leads that can't be phoned, worked by email on a widening
   schedule: first email, then follow-ups 4, 7 and 10 business days
   apart. Sending is manual (from your own mailbox); this decides who
   is next and remembers what happened. */
const Outreach = () => {
  const { profile, user } = useAuth();
  const [tab, setTab] = useState<OutreachTab>('to_email');
  const [tiers, setTiers] = useState<TierChoice[]>([]);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState<CallLead[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState<string | null>(null);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [templates, setTemplates] = useState<Record<string, EmailTemplate>>({});
  const [open, setOpen] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  const tiersKey = tiers.join(',');
  const senderName = profile?.full_name ?? user?.email?.split('@')[0] ?? 'Xtenzium';

  useEffect(() => {
    const t = setTimeout(() => setQuery(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    let cancelled = false;
    supabase.from('email_templates').select('*').in('type', ['outreach_first', 'outreach_followup']).then(({ data }) => {
      if (!cancelled) setTemplates(Object.fromEntries(((data ?? []) as EmailTemplate[]).map(t => [t.type, t])));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    supabase
      .rpc('outreach_list', { p_tab: tab, p_limit: PAGE, p_offset: 0, p_tiers: tiersParam(tiers), p_search: query || null })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) setFailed(error.message);
        else {
          setFailed(null);
          setRows((data ?? []) as CallLead[]);
          setHasMore((data ?? []).length === PAGE);
        }
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // tiersKey stands in for the tiers array
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, tiersKey, query, reload]);

  useEffect(() => {
    let cancelled = false;
    supabase.rpc('outreach_counts', { p_tiers: tiersParam(tiers) }).then(({ data }) => {
      if (!cancelled && data) setCounts(data as Counts);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tiersKey, reload]);

  const loadMore = async () => {
    const { data } = await supabase.rpc('outreach_list', {
      p_tab: tab, p_limit: PAGE, p_offset: rows.length, p_tiers: tiersParam(tiers), p_search: query || null,
    });
    const more = (data ?? []) as CallLead[];
    setRows(r => [...r, ...more]);
    setHasMore(more.length === PAGE);
  };

  const def = OUTREACH_TABS.find(t => t.key === tab)!;

  return (
    <div className="flex max-w-[900px] flex-col gap-4">
      <PageHeader
        title="Email outreach"
        subtitle="Leads we can’t phone, worked by email. Sent today: see the counter."
        back={{ to: '/crm/dialer', label: 'Dialer' }}
        actions={<Badge tone="neutral">Sent today · {counts?.sent_today ?? 0}</Badge>}
      />

      <SegmentedControl
        label="Outreach list"
        value={tab}
        onChange={v => {
          setLoading(true);
          setOpen(null);
          setTab(v);
        }}
        options={OUTREACH_TABS.map(t => ({ value: t.key, label: `${t.label}${counts ? ` (${counts[t.key].toLocaleString()})` : ''}` }))}
      />
      <p className="m-0 text-[13px] text-crm-ink-2">{def.hint}</p>

      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Tiers">
        {TIER_CHOICES.map(c => {
          const on = tiers.includes(c.value);
          return (
            <button
              key={c.value}
              type="button"
              aria-pressed={on}
              onClick={() => {
                setLoading(true);
                setTiers(on ? tiers.filter(t => t !== c.value) : [...tiers, c.value]);
              }}
              className={cn(
                'cursor-pointer rounded-full border px-3 py-1 text-[12.5px] transition-colors',
                on ? 'border-crm-copper bg-crm-copper/10 text-crm-ink' : 'border-crm-line bg-crm-surface text-crm-ink-2 hover:border-crm-line-hi',
              )}
            >
              {c.label}
            </button>
          );
        })}
        <Input
          className="ml-auto w-[240px]"
          label="Search"
          value={search}
          onChange={e => {
            setLoading(true);
            setSearch(e.target.value);
          }}
          placeholder="Company or website"
        />
      </div>

      {failed && <ErrorState title="The list couldn’t load" body={failed} />}
      {loading && <SkeletonRows rows={5} />}

      {!loading && !failed && rows.length === 0 && (
        <EmptyState
          title="Nothing here"
          body={tab === 'due' ? 'No follow-ups are due. Check the Waiting tab to see what’s coming.' : query || tiers.length ? 'Nothing matches your filters.' : 'This list is empty.'}
        />
      )}

      {!loading && rows.length > 0 && (
        <Card>
          {rows.map(l => {
            const isOpen = open === l.id;
            return (
              <div key={l.id} className="border-b border-crm-line last:border-b-0">
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : l.id)}
                  aria-expanded={isOpen}
                  className="flex w-full cursor-pointer flex-wrap items-center gap-2 border-0 bg-transparent px-4 py-3 text-left"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-medium text-crm-ink">{l.company_name}</span>
                    <span className="block truncate text-[12.5px] text-crm-ink-3">
                      {l.email ?? (l.contact_url ? 'No email · contact form available' : 'No email yet')}
                      {l.outreach_due && ` · next touch ${formatInZone(new Date(l.outreach_due), 'Asia/Karachi')}`}
                    </span>
                  </span>
                  {l.tier && <Badge tone={l.tier === 'A' ? 'copper' : 'neutral'}>Tier {l.tier}</Badge>}
                  {l.score !== null && <Badge tone="neutral">Score {l.score}</Badge>}
                  {l.outreach_touches > 0 && <Badge tone="info" dot>{touchLabel(l.outreach_touches)}</Badge>}
                  {l.phone_is_us === false && <Badge tone="warning">International</Badge>}
                </button>
                {isOpen && (
                  <Work
                    key={l.id}
                    lead={l}
                    templates={templates}
                    senderName={senderName}
                    onChanged={() => {
                      setOpen(null);
                      setReload(n => n + 1);
                    }}
                  />
                )}
              </div>
            );
          })}
        </Card>
      )}

      {hasMore && !loading && (
        <div>
          <Button onClick={loadMore}>Load more</Button>
        </div>
      )}
    </div>
  );
};

export default Outreach;
