import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';
import type { CallActivity, CallLead, CallScript, DialerListSummary } from '../../../types/database';
import {
  OUTCOMES, SKIP_SHORTCUT, clockFor, dayStartInZone, dayStats, formatInZone,
  formatPhone, outcomeByShortcut, voiceLink,
  type DayStats, type OutcomeDef, type OutcomeGroup,
} from '../../../lib/dialer-calls';
import { SCRIPT, type ScriptBlock } from '../../../lib/dialer-script';
import {
  Badge, Button, ButtonLink, Card, CardHeader, EmptyState, ErrorState, Input, PageHeader,
  Select, Skeleton, useToast,
} from '../../../components/crm/ui';
import { cn } from '../../../lib/utils';
import OutcomePanel, { type OutcomeSubmit } from './OutcomePanel';

const ET = 'America/New_York';
const LIST_KEY = 'dialer:list';

/* The rep's last list choice survives a reload. Storage can be blocked
   or full, so every touch is guarded and the screen works without it. */
const savedList = (): string | null => {
  try {
    return localStorage.getItem(LIST_KEY) || null;
  } catch {
    return null;
  }
};
const saveList = (id: string | null) => {
  try {
    if (id) localStorage.setItem(LIST_KEY, id);
    else localStorage.removeItem(LIST_KEY);
  } catch {
    /* not persisted; still applied for this session */
  }
};
const GROUPS: { key: OutcomeGroup; title: string }[] = [
  { key: 'no_contact', title: 'Couldn’t reach them' },
  { key: 'interested', title: 'Interested' },
  { key: 'not_interested', title: 'Not interested' },
  { key: 'dead', title: 'Dead end' },
];

const Kbd = ({ children }: { children: string }) => (
  <kbd className="rounded border border-crm-line-hi bg-crm-ground px-1.5 py-px font-crm-mono text-[10.5px] text-crm-ink-3">
    {children}
  </kbd>
);

const Stat = ({ label, value, sub }: { label: string; value: string | number; sub?: string }) => (
  <div className="min-w-[88px]">
    <p className="m-0 font-crm-mono text-[10px] uppercase tracking-[0.12em] text-crm-ink-3">{label}</p>
    <p className="m-0 text-[20px] font-semibold tabular-nums text-crm-ink">
      {value}
      {sub && <span className="text-[13px] font-normal text-crm-ink-3"> {sub}</span>}
    </p>
  </div>
);

const CallScreen = () => {
  const { user, profile, role } = useAuth();
  const { toast } = useToast();
  const myTz = profile?.timezone ?? 'Asia/Karachi';
  const target = profile?.daily_dial_target ?? 80;

  const [lead, setLead] = useState<CallLead | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState<string | null>(null);
  const [history, setHistory] = useState<CallActivity[]>([]);
  const [ignoreHours, setIgnoreHours] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [day, setDay] = useState<DayStats>({ dials: 0, conversations: 0, meetings: 0 });
  const [callbacksDue, setCallbacksDue] = useState(0);
  const [lists, setLists] = useState<DialerListSummary[]>([]);
  const [listId, setListId] = useState<string | null>(savedList);
  const [showScript, setShowScript] = useState(false);
  const [script, setScript] = useState<ScriptBlock[]>(SCRIPT);
  const skipped = useRef<string[]>([]);

  // Contact details live on the card, because the rep learns them mid-call.
  const [contactName, setContactName] = useState('');
  const [contactTitle, setContactTitle] = useState('');
  const [contactEmail, setContactEmail] = useState('');

  const [outcome, setOutcome] = useState<OutcomeDef | null>(null);
  const [saving, setSaving] = useState(false);

  const leadTz = lead?.timezone ?? ET;
  const waiting = lists.filter(l => !listId || l.id === listId).reduce((n, l) => n + l.in_play, 0);

  /* ── data ── */

  const fetchNext = useCallback(
    (ignore: boolean, list: string | null) =>
      supabase.rpc('dialer_next_lead', { p_skip: skipped.current, p_ignore_hours: ignore, p_list_id: list }),
    [],
  );

  const applyLead = useCallback(({ data, error }: Awaited<ReturnType<typeof fetchNext>>) => {
    if (error) {
      setFailed(error.message);
      setLoading(false);
      return;
    }
    const next = ((data ?? []) as CallLead[])[0] ?? null;
    setFailed(null);
    setLead(next);
    setContactName(next?.contact_name ?? '');
    setContactTitle(next?.contact_title ?? '');
    setContactEmail(next?.email ?? '');
    setLoading(false);
  }, []);

  const fetchStats = useCallback(async () => {
    if (!user) return null;
    const since = dayStartInZone(new Date(), myTz).toISOString();
    const dueQuery = supabase
      .from('call_leads')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'callback')
      .lte('next_call_at', new Date().toISOString());
    const [acts, due, summary] = await Promise.all([
      supabase.from('call_activities').select('outcome').eq('caller_id', user.id).gte('created_at', since),
      listId ? dueQuery.eq('list_id', listId) : dueQuery,
      supabase.rpc('dialer_list_summary'),
    ]);
    return {
      day: dayStats(((acts.data ?? []) as { outcome: string }[]).map(a => a.outcome)),
      due: due.count ?? 0,
      lists: (summary.data ?? []) as DialerListSummary[],
    };
  }, [user, myTz, listId]);

  const applyStats = useCallback((s: Awaited<ReturnType<typeof fetchStats>>) => {
    if (!s) return;
    setDay(s.day);
    setCallbacksDue(s.due);
    setLists(s.lists);
    /* A remembered list that has since been deleted would leave the rep
       staring at an empty queue with no way to see why. */
    setListId(current => {
      if (current && s.lists.length > 0 && !s.lists.some(l => l.id === current)) {
        saveList(null);
        return null;
      }
      return current;
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    skipped.current = [];
    fetchNext(ignoreHours, listId).then(res => {
      if (!cancelled) applyLead(res);
    });
    return () => {
      cancelled = true;
    };
  }, [ignoreHours, listId, fetchNext, applyLead]);

  useEffect(() => {
    let cancelled = false;
    fetchStats().then(s => {
      if (!cancelled) applyStats(s);
    });
    return () => {
      cancelled = true;
    };
  }, [fetchStats, applyStats]);

  const leadId = lead?.id ?? null;
  useEffect(() => {
    if (!leadId) return undefined;
    let cancelled = false;
    supabase
      .from('call_activities')
      .select('*')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false })
      .limit(5)
      .then(({ data }) => {
        if (!cancelled) setHistory((data ?? []) as CallActivity[]);
      });
    return () => {
      cancelled = true;
    };
  }, [leadId]);

  /* The pitch is edited by an admin in Dialer settings. The built-in
     copy stays as the fallback so the screen is never blank. */
  useEffect(() => {
    let cancelled = false;
    supabase
      .from('call_scripts')
      .select('*')
      .order('sort_order')
      .then(({ data }) => {
        const rows = (data ?? []) as CallScript[];
        if (!cancelled && rows.length > 0) {
          setScript(rows.map(r => ({ title: r.title, lines: r.body.split('\n').filter(l => l.trim()) })));
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  /* ── actions ── */

  const closePanel = () => setOutcome(null);
  const openOutcome = (def: OutcomeDef) => setOutcome(def);

  const advance = () => {
    setLoading(true);
    fetchNext(ignoreHours, listId).then(applyLead);
    fetchStats().then(applyStats);
  };

  const skip = () => {
    if (!lead) return;
    skipped.current = [...skipped.current, lead.id];
    advance();
  };

  const save = async (v: OutcomeSubmit) => {
    if (!lead || !outcome || saving) return;

    setSaving(true);
    const { data, error } = await supabase.rpc('log_call', {
      p_lead_id: lead.id,
      p_outcome: outcome.key,
      p_tags: v.tags,
      p_note: v.note || null,
      p_flagged: v.flagged,
      p_at: v.at,
      p_contact_name: contactName.trim() || null,
      p_contact_title: contactTitle.trim() || null,
      p_contact_email: contactEmail.trim() || null,
    });
    setSaving(false);

    if (error) {
      toast(error.message, 'danger');
      return;
    }
    const next = data?.next_call_at ? ` · next ${formatInZone(new Date(data.next_call_at), leadTz)}` : '';
    toast(`${lead.company_name}: ${outcome.label}${next}`, 'success');
    closePanel();
    advance();
  };

  /* Global shortcuts. The handler is re-pointed on every render so it
     always sees current state, while the listener itself is attached once. */
  const keyHandler = useRef<(e: KeyboardEvent) => void>(() => {});
  useEffect(() => {
    keyHandler.current = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (outcome) {
        if (e.key === 'Escape') closePanel();
        return;
      }
      const el = e.target as HTMLElement;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) || !lead || saving) return;
      if (e.key.toLowerCase() === SKIP_SHORTCUT) {
        e.preventDefault();
        skip();
        return;
      }
      const def = outcomeByShortcut(e.key);
      if (def) {
        e.preventDefault();
        openOutcome(def);
      }
    };
  });
  useEffect(() => {
    const h = (e: KeyboardEvent) => keyHandler.current(e);
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  const copyPhone = async () => {
    if (!lead?.phone_e164) return;
    try {
      await navigator.clipboard.writeText(lead.phone_e164);
      toast('Number copied', 'success');
    } catch {
      toast('Couldn’t copy — select the number manually.', 'danger');
    }
  };

  /* ── render ── */

  const clock = lead ? clockFor(lead.timezone, now) : null;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Call"
        back={{ to: '/crm/dialer', label: 'Dialer' }}
        actions={
          role === 'admin' ? (
            <label className="flex cursor-pointer items-center gap-2 text-[12.5px] text-crm-ink-2">
              <input type="checkbox" checked={ignoreHours} onChange={e => setIgnoreHours(e.target.checked)} />
              Ignore business hours (admin)
            </label>
          ) : undefined
        }
      />

      {lists.length > 0 && (
        <Select
          className="max-w-[420px]"
          label="Calling from"
          value={listId ?? ''}
          placeholder={`All lists (${lists.reduce((n, l) => n + l.callable_now, 0).toLocaleString()} ready now)`}
          options={lists.map(l => ({
            value: l.id,
            label: `${l.name} — ${l.callable_now.toLocaleString()} ready now · ${l.in_play.toLocaleString()} in play`,
          }))}
          onChange={e => {
            const next = e.target.value || null;
            saveList(next);
            setLoading(true);
            setListId(next);
          }}
        />
      )}

      {/* My day */}
      <Card>
        <div className="flex flex-wrap items-center gap-x-8 gap-y-3 p-4">
          <Stat label="Dials today" value={day.dials} sub={`/ ${target}`} />
          <Stat label="Conversations" value={day.conversations} />
          <Stat label="Meetings" value={day.meetings} />
          <Stat label="Callbacks due" value={callbacksDue} />
          <div className="ml-auto h-1.5 w-full min-w-[160px] max-w-[260px] overflow-hidden rounded-full bg-crm-line">
            <div
              className="h-full rounded-full bg-crm-copper transition-[width] duration-300"
              style={{ width: `${Math.min(100, Math.round((day.dials / Math.max(1, target)) * 100))}%` }}
            />
          </div>
        </div>
      </Card>

      {failed && <ErrorState title="Couldn’t load the next lead" body={failed} />}

      {loading && !lead && <Skeleton className="h-[320px] w-full" />}

      {!loading && !lead && !failed && (
        <EmptyState
          title="Nothing to call right now"
          body={
            waiting > 0
              ? `${waiting.toLocaleString()} lead${waiting === 1 ? ' is' : 's are'} ${listId ? 'in this list' : 'queued'}, but outside their business hours or not due for a retry yet. Check back later${listId ? ', or switch to another list' : ''}.`
              : 'Import a CSV to load leads.'
          }
          action={<ButtonLink to="/crm/dialer/import" variant="primary">Import leads</ButtonLink>}
        />
      )}

      {lead && (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          {/* ── The lead ── */}
          <div className="flex flex-col gap-4">
            <Card>
              <div className="flex flex-col gap-3 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="m-0 text-[18px] font-semibold text-crm-ink">{lead.company_name}</h2>
                  {lead.tier && <Badge tone={lead.tier === 'A' ? 'copper' : 'neutral'}>Tier {lead.tier}</Badge>}
                  {lead.score !== null && <Badge tone="neutral">Score {lead.score}</Badge>}
                  {lead.status === 'callback' && <Badge tone="warning" dot>Callback due</Badge>}
                  {lead.status === 'retry' && <Badge tone="info" dot>Attempt {lead.attempt_count + 1}</Badge>}
                </div>

                <p className="m-0 text-[13px] text-crm-ink-3">
                  {[lead.hq, lead.team_size && `${lead.team_size} people`, lead.hourly_rate_usd && `$${lead.hourly_rate_usd}/hr`]
                    .filter(Boolean)
                    .join(' · ')}
                </p>

                <p className="m-0 select-all font-crm-mono text-[30px] font-semibold tracking-tight text-crm-ink">
                  {formatPhone(lead.phone_e164, lead.phone_raw)}
                </p>

                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="primary" onClick={copyPhone}>Copy number</Button>
                  <a
                    href={lead.phone_e164 ? voiceLink(lead.phone_e164) : undefined}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-9 items-center rounded-crm-md border border-crm-line-hi px-3 text-[13px] text-crm-ink no-underline hover:bg-crm-ground"
                  >
                    Open in Google Voice
                  </a>
                  {clock && (
                    <Badge tone={clock.open ? 'success' : 'warning'} dot>
                      {clock.time} {clock.zoneLabel}
                      {clock.known ? '' : ' (zone unknown)'} · {clock.open ? 'open' : 'closed'}
                    </Badge>
                  )}
                </div>

                <div className="flex flex-wrap gap-x-4 gap-y-1 text-[13px]">
                  {lead.website && <a className="text-crm-copper" href={lead.website} target="_blank" rel="noopener noreferrer">Website</a>}
                  {lead.profile_url && <a className="text-crm-copper" href={lead.profile_url} target="_blank" rel="noopener noreferrer">Profile</a>}
                  {lead.contact_url && <a className="text-crm-copper" href={lead.contact_url} target="_blank" rel="noopener noreferrer">Contact page</a>}
                </div>

                {lead.services && (
                  <div className="flex flex-wrap gap-1.5">
                    {lead.services.split(',').map(s => s.trim()).filter(Boolean).slice(0, 8).map(s => (
                      <Badge key={s} tone="neutral">{s}</Badge>
                    ))}
                  </div>
                )}

                {lead.why && (
                  <div className="rounded-crm-md border border-crm-line bg-crm-ground px-3 py-2.5">
                    <p className="m-0 font-crm-mono text-[10px] uppercase tracking-[0.12em] text-crm-ink-3">Why call</p>
                    <p className="m-0 mt-1 text-[13px] leading-relaxed text-crm-ink-2">{lead.why}</p>
                  </div>
                )}
              </div>
            </Card>

            <Card>
              <CardHeader title="Who you spoke to" />
              <div className="grid grid-cols-1 gap-2 p-4 sm:grid-cols-3">
                <Input label="Name" value={contactName} onChange={e => setContactName(e.target.value)} />
                <Input label="Title" value={contactTitle} onChange={e => setContactTitle(e.target.value)} />
                <Input label="Email" type="email" value={contactEmail} onChange={e => setContactEmail(e.target.value)} />
              </div>
            </Card>

            {history.length > 0 && (
              <Card>
                <CardHeader title="Previous calls" />
                <ul className="m-0 list-none p-0">
                  {history.map(h => (
                    <li key={h.id} className="border-b border-crm-line px-4 py-2.5 text-[13px] last:border-b-0">
                      <span className="font-medium text-crm-ink">
                        {OUTCOMES.find(o => o.key === h.outcome)?.label ?? h.outcome}
                      </span>
                      <span className="text-crm-ink-3"> · {formatInZone(new Date(h.created_at), myTz)}</span>
                      {h.note && <p className="m-0 mt-0.5 text-crm-ink-2">{h.note}</p>}
                    </li>
                  ))}
                </ul>
              </Card>
            )}

            <Card>
              <button
                type="button"
                onClick={() => setShowScript(s => !s)}
                className="flex w-full cursor-pointer items-center justify-between border-0 bg-transparent px-4 py-3 text-left text-[13.5px] font-medium text-crm-ink"
              >
                Pitch &amp; objections
                <span className="text-crm-ink-3">{showScript ? 'Hide' : 'Show'}</span>
              </button>
              {showScript && (
                <div className="flex flex-col gap-4 border-t border-crm-line p-4">
                  {script.map(b => (
                    <div key={b.title}>
                      <p className="m-0 font-crm-mono text-[10px] uppercase tracking-[0.12em] text-crm-ink-3">{b.title}</p>
                      {b.lines.map((line, i) => (
                        <p key={i} className="m-0 mt-1.5 text-[13px] leading-relaxed text-crm-ink-2">{line}</p>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* ── Outcome ── */}
          <div className="flex flex-col gap-4">
            {!outcome ? (
              <Card>
                <CardHeader title="How did it go?" />
                <div className="flex flex-col gap-4 p-4">
                  {GROUPS.map(g => (
                    <div key={g.key}>
                      <p className="m-0 mb-1.5 font-crm-mono text-[10px] uppercase tracking-[0.12em] text-crm-ink-3">{g.title}</p>
                      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                        {OUTCOMES.filter(o => o.group === g.key).map(o => (
                          <button
                            key={o.key}
                            type="button"
                            onClick={() => openOutcome(o)}
                            className={cn(
                              'flex cursor-pointer items-start justify-between gap-2 rounded-crm-md border border-crm-line bg-crm-surface px-3 py-2 text-left transition-colors',
                              'hover:border-crm-copper hover:bg-crm-ground',
                              o.key === 'dnc' && 'hover:border-crm-danger',
                            )}
                          >
                            <span className="min-w-0">
                              <span className="block text-[13px] font-medium text-crm-ink">{o.label}</span>
                              <span className="block text-[11.5px] text-crm-ink-3">{o.effect}</span>
                            </span>
                            <Kbd>{o.shortcut.toUpperCase()}</Kbd>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                  <Button onClick={skip}>
                    Skip this lead <Kbd>S</Kbd>
                  </Button>
                </div>
              </Card>
            ) : (
              <Card>
                <CardHeader title={outcome.label} />
                <div className="p-4">
                  <OutcomePanel
                    key={outcome.key + lead.id}
                    outcome={outcome}
                    leadTz={leadTz}
                    zoneLabel={clock?.zoneLabel ?? 'ET'}
                    myTz={myTz}
                    saving={saving}
                    onSubmit={save}
                    onCancel={closePanel}
                    onInvalid={m => toast(m, 'danger')}
                  />
                </div>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CallScreen;
