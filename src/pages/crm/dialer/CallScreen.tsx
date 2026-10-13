import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';
import type { CallActivity, CallLead } from '../../../types/database';
import {
  GENERAL_CHIPS, OUTCOMES, SKIP_SHORTCUT, clockFor, dayStartInZone, dayStats, formatInZone,
  formatPhone, outcomeByShortcut, voiceLink, zonedToUtc,
  type DayStats, type OutcomeDef, type OutcomeGroup,
} from '../../../lib/dialer-calls';
import { SCRIPT } from '../../../lib/dialer-script';
import {
  Badge, Button, ButtonLink, Card, CardHeader, EmptyState, ErrorState, Input, PageHeader,
  Skeleton, Textarea, useToast,
} from '../../../components/crm/ui';
import { cn } from '../../../lib/utils';

const ET = 'America/New_York';
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
  const [waiting, setWaiting] = useState(0);
  const [showScript, setShowScript] = useState(false);
  const skipped = useRef<string[]>([]);

  // Contact details live on the card, because the rep learns them mid-call.
  const [contactName, setContactName] = useState('');
  const [contactTitle, setContactTitle] = useState('');
  const [contactEmail, setContactEmail] = useState('');

  // The outcome panel.
  const [outcome, setOutcome] = useState<OutcomeDef | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [flagged, setFlagged] = useState(false);
  const [atLocal, setAtLocal] = useState('');
  const [saving, setSaving] = useState(false);

  const leadTz = lead?.timezone ?? ET;

  /* ── data ── */

  const fetchNext = useCallback(
    (ignore: boolean) =>
      supabase.rpc('dialer_next_lead', { p_skip: skipped.current, p_ignore_hours: ignore }),
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
    const [acts, due, queued] = await Promise.all([
      supabase.from('call_activities').select('outcome').eq('caller_id', user.id).gte('created_at', since),
      supabase.from('call_leads').select('id', { count: 'exact', head: true }).eq('status', 'callback').lte('next_call_at', new Date().toISOString()),
      supabase.from('call_leads').select('id', { count: 'exact', head: true }).in('status', ['new', 'retry', 'callback']).eq('phone_is_us', true),
    ]);
    return {
      day: dayStats(((acts.data ?? []) as { outcome: string }[]).map(a => a.outcome)),
      due: due.count ?? 0,
      queued: queued.count ?? 0,
    };
  }, [user, myTz]);

  const applyStats = useCallback((s: Awaited<ReturnType<typeof fetchStats>>) => {
    if (!s) return;
    setDay(s.day);
    setCallbacksDue(s.due);
    setWaiting(s.queued);
  }, []);

  useEffect(() => {
    let cancelled = false;
    skipped.current = [];
    fetchNext(ignoreHours).then(res => {
      if (!cancelled) applyLead(res);
    });
    return () => {
      cancelled = true;
    };
  }, [ignoreHours, fetchNext, applyLead]);

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

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  /* ── actions ── */

  const closePanel = () => {
    setOutcome(null);
    setTags([]);
    setNote('');
    setFlagged(false);
    setAtLocal('');
  };

  const openOutcome = (def: OutcomeDef) => {
    setOutcome(def);
    setTags([]);
    setNote('');
    setFlagged(false);
    setAtLocal('');
  };

  const advance = () => {
    setLoading(true);
    fetchNext(ignoreHours).then(applyLead);
    fetchStats().then(applyStats);
  };

  const skip = () => {
    if (!lead) return;
    skipped.current = [...skipped.current, lead.id];
    advance();
  };

  const save = async () => {
    if (!lead || !outcome || saving) return;

    let at: string | null = null;
    if (outcome.needs === 'callback_time' || outcome.needs === 'meeting_time') {
      if (!atLocal) {
        toast(outcome.needs === 'callback_time' ? 'Pick a callback time.' : 'Enter the meeting time.', 'danger');
        return;
      }
      const when = zonedToUtc(atLocal, leadTz);
      if (when.getTime() < Date.now() - 60_000) {
        toast('That time has already passed.', 'danger');
        return;
      }
      at = when.toISOString();
    }

    setSaving(true);
    const { data, error } = await supabase.rpc('log_call', {
      p_lead_id: lead.id,
      p_outcome: outcome.key,
      p_tags: tags,
      p_note: note.trim() || null,
      p_flagged: flagged,
      p_at: at,
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

  const onPanelKeyDown = (e: React.KeyboardEvent) => {
    const tag = (e.target as HTMLElement).tagName;
    if (e.key === 'Enter' && !e.shiftKey && tag !== 'BUTTON') {
      e.preventDefault();
      void save();
    }
  };

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
  const wantsTime = outcome?.needs === 'callback_time' || outcome?.needs === 'meeting_time';
  const preview = wantsTime && atLocal ? zonedToUtc(atLocal, leadTz) : null;
  const chips = outcome?.chips ?? GENERAL_CHIPS;

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
              ? `${waiting.toLocaleString()} lead${waiting === 1 ? ' is' : 's are'} queued, but outside their business hours or not due for a retry yet. Check back later.`
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
                  {SCRIPT.map(b => (
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
                <div className="flex flex-col gap-3 p-4" onKeyDown={onPanelKeyDown}>
                  {wantsTime && (
                    <div>
                      <Input
                        label={`${outcome.needs === 'callback_time' ? 'Call back' : 'Meeting'} at — their time (${clock?.zoneLabel ?? 'ET'})`}
                        type="datetime-local"
                        value={atLocal}
                        onChange={e => setAtLocal(e.target.value)}
                        autoFocus
                      />
                      {preview && (
                        <p className="m-0 mt-1.5 text-[12.5px] text-crm-ink-3">
                          = {formatInZone(preview, leadTz)} · {formatInZone(preview, myTz)}
                        </p>
                      )}
                    </div>
                  )}

                  <div className="flex flex-wrap gap-1.5">
                    {chips.map(c => {
                      const on = tags.includes(c);
                      return (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setTags(t => (on ? t.filter(x => x !== c) : [...t, c]))}
                          className={cn(
                            'cursor-pointer rounded-full border px-2.5 py-1 text-[12px] transition-colors',
                            on
                              ? 'border-crm-copper bg-crm-copper/10 text-crm-ink'
                              : 'border-crm-line bg-crm-surface text-crm-ink-2 hover:border-crm-line-hi',
                          )}
                        >
                          {c}
                        </button>
                      );
                    })}
                  </div>

                  <Textarea
                    label="Note (optional)"
                    rows={3}
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    autoFocus={!wantsTime}
                    hint="Enter saves · Shift+Enter for a new line"
                  />

                  <label className="flex cursor-pointer items-center gap-2 text-[13px] text-crm-ink-2">
                    <input type="checkbox" checked={flagged} onChange={e => setFlagged(e.target.checked)} />
                    Flag for the owner
                  </label>

                  {outcome.key === 'dnc' && (
                    <p className="m-0 text-[12.5px] text-crm-danger">
                      This blocks the number and the website for good.
                    </p>
                  )}

                  <div className="flex gap-2">
                    <Button variant={outcome.key === 'dnc' ? 'danger' : 'primary'} loading={saving} onClick={save}>
                      Save &amp; next <Kbd>Enter</Kbd>
                    </Button>
                    <Button onClick={closePanel} disabled={saving}>
                      Cancel <Kbd>Esc</Kbd>
                    </Button>
                  </div>
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
