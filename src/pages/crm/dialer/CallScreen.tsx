import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';
import type { CallLead, CallScript, DialerListSummary } from '../../../types/database';
import {
  INSTANT_HINT, OUTCOMES, SKIP_SHORTCUT, TIER_CHOICES, clockFor, dayStartInZone, dayStats, formatInZone,
  formatPhone, instantOutcome, outcomeByShortcut, parseTiers, renderTemplate, scriptVars, tiersParam, voiceLink,
  type DayStats, type OutcomeDef, type OutcomeGroup, type TierChoice,
} from '../../../lib/dialer-calls';
import { SCRIPT, type ScriptBlock } from '../../../lib/dialer-script';
import {
  Badge, Button, ButtonLink, Card, CardHeader, EmptyState, ErrorState, Input, PageHeader,
  Select, Skeleton, useToast,
} from '../../../components/crm/ui';
import { cn } from '../../../lib/utils';
import OutcomePanel, { type OutcomeSubmit } from './OutcomePanel';
import TouchTimeline from './TouchTimeline';
import { logOutcome } from './logOutcome';

const ET = 'America/New_York';
const LIST_KEY = 'dialer:list';
const TIERS_KEY = 'dialer:tiers';
const COPY_KEY = 'dialer:autocopy';
const UNDO_WINDOW_MS = 30 * 60_000;

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
const savedTiers = (): TierChoice[] => {
  try {
    return parseTiers(localStorage.getItem(TIERS_KEY));
  } catch {
    return [];
  }
};
const saveTiers = (t: TierChoice[]) => {
  try {
    if (t.length) localStorage.setItem(TIERS_KEY, t.join(','));
    else localStorage.removeItem(TIERS_KEY);
  } catch {
    /* session only */
  }
};
/* Auto-copy is on unless the rep turns it off. */
const savedAutoCopy = (): boolean => {
  try {
    return localStorage.getItem(COPY_KEY) !== 'off';
  } catch {
    return true;
  }
};

/* Didn't reach them but we have their address: an email can land where the call didn't. */
const emailHint = (message: string, email: string | null, group: OutcomeGroup) =>
  group === 'no_contact' && email ? `${message} · has an email — it’s on your Email outreach list` : message;

interface LastCall {
  activityId: string;
  company: string;
  label: string;
  at: number;
}

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
  const [ignoreHours, setIgnoreHours] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [day, setDay] = useState<DayStats>({ dials: 0, conversations: 0, meetings: 0 });
  const [callbacksDue, setCallbacksDue] = useState(0);
  const [lists, setLists] = useState<DialerListSummary[]>([]);
  const [listId, setListId] = useState<string | null>(savedList);
  const [showScript, setShowScript] = useState(true);
  const [tiers, setTiers] = useState<TierChoice[]>(savedTiers);
  const [tierCounts, setTierCounts] = useState<{ A: number; B: number; C: number; none: number } | null>(null);
  const [autoCopy, setAutoCopy] = useState(savedAutoCopy);
  const [copiedFor, setCopiedFor] = useState<string | null>(null);
  const [lastCall, setLastCall] = useState<LastCall | null>(null);
  const [script, setScript] = useState<ScriptBlock[]>(SCRIPT);
  const skipped = useRef<string[]>([]);
  /* The next lead, fetched while the rep is still on this one. */
  const preloaded = useRef<{ key: string; result: Awaited<ReturnType<typeof supabase.rpc<'dialer_next_lead'>>> | null } | null>(null);
  const tiersKey = tiers.join(',');

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
    (ignore: boolean, list: string | null, picked: TierChoice[], assumeDials = 0, skip: string[] = skipped.current) =>
      supabase.rpc('dialer_next_lead', {
        p_skip: skip,
        p_ignore_hours: ignore,
        p_list_id: list,
        p_tiers: tiersParam(picked),
        p_assume_dials: assumeDials,
      }),
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

  /* Keyed on the id, not the user OBJECT: Supabase hands out a new object on
     every tab focus, and switching to Google Voice and back is exactly what a
     rep does all day. */
  const userId = user?.id ?? null;
  const fetchStats = useCallback(async () => {
    if (!userId) return null;
    const since = dayStartInZone(new Date(), myTz).toISOString();
    const dueQuery = supabase
      .from('call_leads')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'callback')
      .lte('next_call_at', new Date().toISOString());
    const [acts, due, summary, tierSummary] = await Promise.all([
      supabase.from('call_activities').select('outcome').eq('caller_id', userId).gte('created_at', since),
      listId ? dueQuery.eq('list_id', listId) : dueQuery,
      supabase.rpc('dialer_list_summary'),
      supabase.rpc('dialer_tier_counts', { p_list_id: listId }),
    ]);
    return {
      day: dayStats(((acts.data ?? []) as { outcome: string }[]).map(a => a.outcome)),
      due: due.count ?? 0,
      lists: (summary.data ?? []) as DialerListSummary[],
      tiers: (tierSummary.data ?? null) as { A: number; B: number; C: number; none: number } | null,
    };
  }, [userId, myTz, listId]);

  const applyStats = useCallback((s: Awaited<ReturnType<typeof fetchStats>>) => {
    if (!s) return;
    setDay(s.day);
    setCallbacksDue(s.due);
    setLists(s.lists);
    setTierCounts(s.tiers);
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
    preloaded.current = null;
    fetchNext(ignoreHours, listId, tiers).then(res => {
      if (!cancelled) applyLead(res);
    });
    return () => {
      cancelled = true;
    };
    // tiersKey stands in for the tiers array, which is a new object each render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ignoreHours, listId, tiersKey, fetchNext, applyLead]);

  /* While the rep is on this lead, fetch the one after — as if this call
     were already logged (assume 1) so the every-Nth-dial retry turn lands
     right. Moving on is then instant instead of a round trip. */
  const leadIdNow = lead?.id ?? null;
  useEffect(() => {
    if (!leadIdNow) {
      preloaded.current = null;
      return undefined;
    }
    const key = `${leadIdNow}|${ignoreHours}|${listId}|${tiersKey}`;
    preloaded.current = { key, result: null };
    let cancelled = false;
    fetchNext(ignoreHours, listId, tiers, 1, [...skipped.current, leadIdNow]).then(result => {
      if (!cancelled && preloaded.current?.key === key) preloaded.current = { key, result };
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadIdNow, ignoreHours, listId, tiersKey, fetchNext]);

  /* Each new lead's number goes straight to the clipboard, so the next
     step is simply paste-and-dial. Browsers only allow this shortly after
     a keypress; if one refuses, the Copy button is still right there. */
  const phone = lead?.phone_e164 ?? null;
  useEffect(() => {
    if (!autoCopy || !phone || !leadIdNow) return;
    navigator.clipboard.writeText(phone).then(
      () => setCopiedFor(leadIdNow),
      () => setCopiedFor(null),
    );
  }, [autoCopy, phone, leadIdNow]);

  useEffect(() => {
    let cancelled = false;
    fetchStats().then(s => {
      if (!cancelled) applyStats(s);
    });
    return () => {
      cancelled = true;
    };
  }, [fetchStats, applyStats]);

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

  /* Move to the next lead. After a logged call the pre-loaded one is used
     straight away (it was fetched for exactly this moment); after a skip,
     or if it isn't ready, ask again. */
  const advance = (afterLoggedCall = false) => {
    const pre = preloaded.current;
    const key = `${lead?.id}|${ignoreHours}|${listId}|${tiersKey}`;
    if (afterLoggedCall && pre && pre.key === key && pre.result) {
      applyLead(pre.result);
    } else {
      setLoading(true);
      fetchNext(ignoreHours, listId, tiers).then(applyLead);
    }
    fetchStats().then(applyStats);
  };

  const skip = () => {
    if (!lead) return;
    skipped.current = [...skipped.current, lead.id];
    advance(false);
  };

  const remember = (company: string, label: string, activityId: string | null) =>
    setLastCall(activityId ? { activityId, company, label, at: Date.now() } : null);

  const save = async (v: OutcomeSubmit) => {
    if (!lead || !outcome || saving) return;
    setSaving(true);
    const result = await logOutcome(lead, outcome, v, { name: contactName, title: contactTitle, email: contactEmail });
    setSaving(false);

    if (!result.ok) {
      toast(result.error, 'danger');
      return;
    }
    toast(emailHint(result.message, lead.email || contactEmail, outcome.group), 'success');
    remember(lead.company_name, outcome.label, result.activityId);
    closePanel();
    advance(true);
  };

  /* One keystroke for the two commonest outcomes — no note step. */
  const quickLog = async (def: OutcomeDef) => {
    if (!lead || saving) return;
    setSaving(true);
    const result = await logOutcome(lead, def, { tags: [], note: '', flagged: false, at: null }, { name: contactName, title: contactTitle, email: contactEmail });
    setSaving(false);
    if (!result.ok) {
      toast(result.error, 'danger');
      return;
    }
    toast(emailHint(result.message, lead.email || contactEmail, def.group), 'success');
    remember(lead.company_name, def.label, result.activityId);
    advance(true);
  };

  /* Put the last call back as it was, and bring that lead back up. */
  const undo = async () => {
    if (!lastCall || saving) return;
    setSaving(true);
    const { data, error } = await supabase.rpc('undo_last_call', { p_activity_id: lastCall.activityId });
    if (error || !data) {
      setSaving(false);
      toast(error?.message ?? 'Couldn’t undo that.', 'danger');
      if (error && /already undone|Too late|called again/.test(error.message)) setLastCall(null);
      return;
    }
    const { data: row } = await supabase.from('call_leads').select('*').eq('id', data.lead_id).maybeSingle();
    setSaving(false);
    toast(`Undid ${lastCall.company}: ${lastCall.label}`, 'info');
    setLastCall(null);
    skipped.current = skipped.current.filter(id => id !== data.lead_id);
    if (row) applyLead({ data: [row as CallLead], error: null } as Awaited<ReturnType<typeof fetchNext>>);
    fetchStats().then(applyStats);
  };

  const setTier = async (value: string) => {
    if (!lead) return;
    const tier = value === '-' ? null : (value as 'A' | 'B' | 'C');
    const { error } = await supabase.from('call_leads').update({ tier }).eq('id', lead.id);
    if (error) {
      toast('Couldn’t change the tier.', 'danger');
      return;
    }
    setLead({ ...lead, tier });
    toast(tier ? `Moved to Tier ${tier}` : 'Tier cleared', 'success');
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
      const quick = instantOutcome(e.code, e.shiftKey);
      if (quick) {
        e.preventDefault();
        void quickLog(quick);
        return;
      }
      if (e.key.toLowerCase() === 'z' && lastCall) {
        e.preventDefault();
        void undo();
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
      setCopiedFor(lead.id);
      toast('Number copied', 'success');
    } catch {
      toast('Couldn’t copy — select the number manually.', 'danger');
    }
  };

  /* ── render ── */

  const clock = lead ? clockFor(lead.timezone, now) : null;
  const vars = scriptVars(lead ? { company_name: lead.company_name, contact_name: contactName || lead.contact_name } : null, profile?.full_name ?? user?.email?.split('@')[0] ?? null);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Call"
        back={{ to: '/crm/dialer', label: 'Dialer' }}
        actions={
          <>
            <label className="flex cursor-pointer items-center gap-2 text-[12.5px] text-crm-ink-2">
              <input
                type="checkbox"
                checked={autoCopy}
                onChange={e => {
                  setAutoCopy(e.target.checked);
                  try {
                    localStorage.setItem(COPY_KEY, e.target.checked ? 'on' : 'off');
                  } catch {
                    /* session only */
                  }
                }}
              />
              Auto-copy number
            </label>
            {role === 'admin' && (
              <label className="flex cursor-pointer items-center gap-2 text-[12.5px] text-crm-ink-2">
                <input type="checkbox" checked={ignoreHours} onChange={e => setIgnoreHours(e.target.checked)} />
                Ignore business hours (admin)
              </label>
            )}
          </>
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

      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Tiers to call">
        <span className="font-crm-mono text-[10.5px] uppercase tracking-[0.12em] text-crm-ink-3">Tiers</span>
        {TIER_CHOICES.map(c => {
          const on = tiers.includes(c.value);
          const n = tierCounts ? (c.value === '-' ? tierCounts.none : tierCounts[c.value]) : null;
          return (
            <button
              key={c.value}
              type="button"
              aria-pressed={on}
              onClick={() => {
                const next = on ? tiers.filter(t => t !== c.value) : [...tiers, c.value];
                saveTiers(next);
                setLoading(true);
                setTiers(next);
              }}
              className={cn(
                'cursor-pointer rounded-full border px-3 py-1 text-[12.5px] transition-colors',
                on ? 'border-crm-copper bg-crm-copper/10 text-crm-ink' : 'border-crm-line bg-crm-surface text-crm-ink-2 hover:border-crm-line-hi',
              )}
            >
              {c.label}
              {n !== null && <span className="text-crm-ink-3"> · {n.toLocaleString()}</span>}
            </button>
          );
        })}
        <span className="text-[12px] text-crm-ink-3">{tiers.length === 0 ? 'All tiers, best first' : 'Only the ticked tiers'}</span>
      </div>

      {/* Undo — for the 30 minutes after a call it can still be taken back. */}
      {lastCall && now.getTime() - lastCall.at < UNDO_WINDOW_MS && (
        <div className="flex flex-wrap items-center gap-3 rounded-crm-md border border-crm-line bg-crm-surface px-3.5 py-2 text-[13px] text-crm-ink-2">
          <span>
            Last call: <strong className="text-crm-ink">{lastCall.company}</strong> — {lastCall.label}
          </span>
          <Button size="sm" onClick={undo} disabled={saving}>
            Undo <Kbd>Z</Kbd>
          </Button>
        </div>
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
              ? `${waiting.toLocaleString()} lead${waiting === 1 ? ' is' : 's are'} ${listId ? 'in this list' : 'queued'}, but ${tiers.length ? 'none matching the ticked tiers is ready — they may be outside their business hours, not due for a retry, or in another tier. ' : 'outside their business hours or not due for a retry yet. '}Check back later${listId ? ', or switch to another list' : ''}${tiers.length ? ', or tick more tiers' : ''}.`
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
                  <label className="flex items-center gap-1 text-[12px] text-crm-ink-3">
                    <span className="sr-only">Tier</span>
                    <select
                      value={lead.tier ?? '-'}
                      onChange={e => setTier(e.target.value)}
                      aria-label="Tier"
                      className={cn(
                        'h-6 cursor-pointer rounded-full border border-crm-line bg-crm-ground px-2 text-[12px]',
                        lead.tier === 'A' ? 'text-crm-copper' : 'text-crm-ink-2',
                      )}
                    >
                      <option value="A">Tier A</option>
                      <option value="B">Tier B</option>
                      <option value="C">Tier C</option>
                      <option value="-">No tier</option>
                    </select>
                  </label>
                  {lead.score !== null && <Badge tone="neutral">Score {lead.score}</Badge>}
                  {lead.status === 'callback' && <Badge tone="warning" dot>Callback due</Badge>}
                  {lead.status === 'retry' && <Badge tone="info" dot>Attempt {lead.attempt_count + 1}</Badge>}
                  {lead.outreach_touches > 0 && (
                    <Badge tone="info" dot>
                      Emailed{lead.outreach_last_at ? ` ${formatInZone(new Date(lead.outreach_last_at), myTz).split(',').slice(0, 2).join(',')}` : ''}
                    </Badge>
                  )}
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
                  <Button variant="primary" onClick={copyPhone}>{copiedFor === lead.id ? 'Copied ✓' : 'Copy number'}</Button>
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

            <TouchTimeline key={lead.id} lead={lead} tz={myTz} />

            <Card>
              <button
                type="button"
                onClick={() => setShowScript(s => !s)}
                className="flex w-full cursor-pointer items-center justify-between border-0 bg-transparent px-4 py-3 text-left text-[13.5px] font-medium text-crm-ink"
              >
                Script — what to say
                <span className="text-crm-ink-3">{showScript ? 'Hide' : 'Show'}</span>
              </button>
              {showScript && (
                <div className="flex flex-col gap-4 border-t border-crm-line p-4">
                  {script.map(b => (
                    <div key={b.title}>
                      <p className="m-0 font-crm-mono text-[10px] uppercase tracking-[0.12em] text-crm-ink-3">{b.title}</p>
                      {b.lines.map((line, i) => (
                        <p key={i} className="m-0 mt-1.5 text-[13px] leading-relaxed text-crm-ink-2">
                          {renderTemplate(line, vars)}
                        </p>
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
                            <span className="flex shrink-0 flex-col items-end gap-1">
                              <Kbd>{o.shortcut.toUpperCase()}</Kbd>
                              {INSTANT_HINT[o.key] && (
                                <span title="Log instantly, no note" className="font-crm-mono text-[10px] text-crm-ink-3">{INSTANT_HINT[o.key]} quick</span>
                              )}
                            </span>
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
                    booking={{ leadId: lead.id, email: contactEmail || null, name: contactName || null }}
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
