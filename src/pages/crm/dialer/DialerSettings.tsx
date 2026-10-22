import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import type { CallScript, DialerSettings as Settings, EmailTemplate } from '../../../types/database';
import { formatPhone } from '../../../lib/dialer-calls';
import { normalizePhone } from '../../../lib/dialer-import';
import {
  Badge, Button, Card, CardHeader, ErrorState, Input, PageHeader, Select, SkeletonRows, Textarea, useToast,
} from '../../../components/crm/ui';
import { startGoogleConnect } from '../../../lib/google-api';
import { useCalendar } from './useCalendar';

const GOOGLE_RETURN: Record<string, string> = {
  denied: 'You declined access, so nothing was connected.',
  state: 'That connection link expired. Try again.',
  exchange: 'Google rejected the sign-in. Try again.',
  no_refresh: 'Google didn’t grant lasting access. Remove “Xtenzium” from myaccount.google.com/permissions, then connect again.',
  save: 'Connected to Google, but saving it failed. Try again.',
  not_configured: 'Google isn’t set up on the server yet — the Client ID and secret are missing in Vercel.',
};

const MEETING_MINUTES = [15, 20, 30, 45, 60];
const OWNER_ZONES = ['Asia/Karachi', 'Asia/Dubai', 'Europe/London', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles'];

type CadenceKey =
  | 'no_answer_days' | 'voicemail_days' | 'gatekeeper_name_days' | 'gatekeeper_blocked_days'
  | 'nurture_outsources_days' | 'nurture_timing_days' | 'max_attempts' | 'retry_every' | 'email_after_attempts';

const CADENCE: { key: CadenceKey; label: string; hint: string }[] = [
  { key: 'no_answer_days', label: 'No answer → retry after', hint: 'business days' },
  { key: 'voicemail_days', label: 'Voicemail → retry after', hint: 'business days' },
  { key: 'gatekeeper_name_days', label: 'Gatekeeper, got a name → retry after', hint: 'business days' },
  { key: 'gatekeeper_blocked_days', label: 'Gatekeeper, blocked → retry after', hint: 'business days' },
  { key: 'nurture_outsources_days', label: 'Already outsources → call again after', hint: 'days' },
  { key: 'nurture_timing_days', label: 'Bad timing / budget → call again after', hint: 'days' },
  { key: 'max_attempts', label: 'Stop calling after', hint: 'attempts with no conversation' },
  { key: 'email_after_attempts', label: 'Open email as a second channel after … missed calls', hint: 'the lead appears on the Email outreach list · 0 = never' },
  { key: 'retry_every', label: 'Make every … dial a due retry', hint: 'e.g. 3 = one retry in three dials · 0 = fresh leads always first' },
];

const TEMPLATE_TITLE: Record<string, string> = {
  email_info: 'Email — send info',
  email_proposal: 'Email — proposal',
  linkedin: 'LinkedIn message',
  admin_call: 'Owner call script',
  outreach_first: 'Cold email — first touch',
  outreach_followup: 'Cold email — follow-up',
  followup_nudge: 'Email — nudge (no reply to the follow-up)',
  email_after_meeting: 'Email — thank you after the meeting',
  email_noshow: 'Email — no-show / cancelled: pick a new time',
};

const TemplateEditor = ({ template, onSaved }: { template: EmailTemplate; onSaved: () => void }) => {
  const { toast } = useToast();
  const [subject, setSubject] = useState(template.subject);
  const [body, setBody] = useState(template.body);
  const [saving, setSaving] = useState(false);
  const dirty = subject !== template.subject || body !== template.body;

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from('email_templates').update({ subject, body }).eq('type', template.type);
    setSaving(false);
    if (error) return toast('That didn’t save.', 'danger');
    toast('Template saved', 'success');
    onSaved();
  };

  return (
    <div className="flex flex-col gap-2 border-b border-crm-line p-4 last:border-b-0">
      <p className="m-0 text-[13.5px] font-medium text-crm-ink">{TEMPLATE_TITLE[template.type] ?? template.type}</p>
      <Input label="Subject" value={subject} onChange={e => setSubject(e.target.value)} />
      <Textarea label="Body — links as [text](https://…)" rows={14} value={body} onChange={e => setBody(e.target.value)} />
      <div>
        <Button variant="primary" loading={saving} disabled={!dirty} onClick={save}>Save template</Button>
      </div>
    </div>
  );
};

const ScriptEditor = ({
  script, first, last, onChanged,
}: { script: CallScript; first: boolean; last: boolean; onChanged: () => void }) => {
  const { toast } = useToast();
  const [title, setTitle] = useState(script.title);
  const [body, setBody] = useState(script.body);
  const [segment, setSegment] = useState<string>(script.segment ?? '');
  const [busy, setBusy] = useState(false);
  const dirty = title !== script.title || body !== script.body || segment !== (script.segment ?? '');

  const save = async () => {
    setBusy(true);
    const { error } = await supabase.from('call_scripts').update({ title, body, segment: (segment || null) as CallScript['segment'] }).eq('id', script.id);
    setBusy(false);
    if (error) return toast('That didn’t save.', 'danger');
    toast('Script saved', 'success');
    onChanged();
  };

  const remove = async () => {
    if (!confirm(`Delete “${script.title}”?`)) return;
    const { error } = await supabase.from('call_scripts').delete().eq('id', script.id);
    if (error) return toast('Couldn’t delete that.', 'danger');
    onChanged();
  };

  return (
    <div className="flex flex-col gap-2 border-b border-crm-line p-4 last:border-b-0">
      <Input label="Section title" value={title} onChange={e => setTitle(e.target.value)} />
      <Textarea label="Lines (one per line)" rows={6} value={body} onChange={e => setBody(e.target.value)} />
      <Select
        label="Show this section for"
        className="w-[220px]"
        options={[{ value: '', label: 'Every call' }, { value: 'agency', label: 'Agencies only' }, { value: 'dev_shop', label: 'Dev shops only' }]}
        value={segment}
        onChange={e => setSegment(e.target.value)}
      />
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" loading={busy} disabled={!dirty} onClick={save}>Save</Button>
        <Button disabled={first} onClick={() => move(script, -1, onChanged, toast)}>Move up</Button>
        <Button disabled={last} onClick={() => move(script, 1, onChanged, toast)}>Move down</Button>
        <Button variant="ghost" onClick={remove}>Delete</Button>
      </div>
    </div>
  );
};

/* Reordering swaps sort_order with the neighbour. Two writes, but the
   list is a handful of rows edited by one person. */
async function move(
  script: CallScript,
  dir: -1 | 1,
  done: () => void,
  toast: (m: string, t?: 'success' | 'danger' | 'info') => void,
) {
  const { data } = await supabase.from('call_scripts').select('*').order('sort_order');
  const rows = (data ?? []) as CallScript[];
  const i = rows.findIndex(r => r.id === script.id);
  const other = rows[i + dir];
  if (!other) return;
  const [a, b] = await Promise.all([
    supabase.from('call_scripts').update({ sort_order: other.sort_order }).eq('id', script.id),
    supabase.from('call_scripts').update({ sort_order: script.sort_order }).eq('id', other.id),
  ]);
  if (a.error || b.error) return toast('Couldn’t reorder.', 'danger');
  done();
}

const DialerSettings = () => {
  const { toast } = useToast();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [scripts, setScripts] = useState<CallScript[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [reload, setReload] = useState(0);

  const calendar = useCalendar();
  const [connecting, setConnecting] = useState(false);
  const [meeting, setMeeting] = useState({ tz: 'Asia/Karachi', from: '18', to: '2', minutes: '30' });
  const [meetingSaving, setMeetingSaving] = useState(false);
  const [callerId, setCallerId] = useState('');
  const [links, setLinks] = useState({ booking: '', portfolio: '' });
  const [linksSaving, setLinksSaving] = useState(false);
  const [callerSaving, setCallerSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      supabase.from('dialer_settings').select('*').maybeSingle(),
      supabase.from('email_templates').select('*').order('type'),
      supabase.from('call_scripts').select('*').order('sort_order'),
    ]).then(([s, t, c]) => {
      if (cancelled) return;
      const err = s.error ?? t.error ?? c.error;
      if (err) {
        setFailed(err.message);
      } else {
        const row = s.data as Settings | null;
        setSettings(row);
        if (row) {
          setCallerId(row.caller_id_number ? formatPhone(row.caller_id_number) : '');
          setLinks({ booking: row.booking_link ?? '', portfolio: row.portfolio_link ?? '' });
          setDraft(Object.fromEntries(CADENCE.map(c2 => [c2.key, String(row[c2.key])])));
          setMeeting({
            tz: row.meeting_owner_tz,
            from: String(row.meeting_hours_from),
            to: String(row.meeting_hours_to),
            minutes: String(row.meeting_default_minutes),
          });
        }
        setTemplates((t.data ?? []) as EmailTemplate[]);
        setScripts((c.data ?? []) as CallScript[]);
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [reload]);

  const refresh = () => setReload(n => n + 1);

  /* Google sends the browser back here with ?google=connected or
     ?google=error&reason=…; say what happened, then tidy the address. */
  const { refresh: refreshCalendar } = calendar;
  /* Read once, into state: the address is cleaned straight away, and
     React may run the effect twice in development — a second pass must
     still know what Google said. */
  const [returned] = useState(() => new URLSearchParams(window.location.search));
  useEffect(() => {
    const outcome = returned.get('google');
    if (!outcome) return;
    window.history.replaceState(null, '', window.location.pathname);
    const reason = returned.get('reason') ?? '';
    const t = setTimeout(() => {
      if (outcome === 'connected') toast('Google Calendar connected', 'success');
      else toast(GOOGLE_RETURN[reason] ?? 'Couldn’t connect Google Calendar.', 'danger');
      refreshCalendar();
    }, 0);
    return () => clearTimeout(t);
  }, [returned, toast, refreshCalendar]);

  const connect = async () => {
    setConnecting(true);
    const problem = await startGoogleConnect();
    // On success the browser is already on its way to Google.
    if (problem) {
      setConnecting(false);
      toast(problem, 'danger');
    }
  };

  const disconnect = async () => {
    if (!confirm('Disconnect Google Calendar? Reps will go back to typing meeting times by hand. Meetings already booked stay on your calendar.')) return;
    const { error } = await supabase.rpc('google_disconnect');
    if (error) return toast('Couldn’t disconnect.', 'danger');
    toast('Disconnected', 'info');
    refreshCalendar();
  };

  const saveMeeting = async () => {
    const from = Number(meeting.from);
    const to = Number(meeting.to);
    if (!Number.isInteger(from) || from < 0 || from > 23 || !Number.isInteger(to) || to < 0 || to > 24) {
      return toast('Hours must be whole numbers: start 0–23, end 0–24.', 'danger');
    }
    setMeetingSaving(true);
    const { error } = await supabase.from('dialer_settings').update({
      meeting_owner_tz: meeting.tz.trim(),
      meeting_hours_from: from,
      meeting_hours_to: to,
      meeting_default_minutes: Number(meeting.minutes),
    }).eq('id', true);
    setMeetingSaving(false);
    if (error) return toast('That didn’t save — check the timezone name (for example Asia/Karachi).', 'danger');
    toast('Meeting hours saved', 'success');
    refresh();
  };

  const saveLinks = async () => {
    const clean = (v: string) => v.trim();
    const ok = (v: string) => v === '' || /^https?:\/\/\S+$/i.test(v);
    if (!ok(clean(links.booking)) || !ok(clean(links.portfolio))) return toast('Links must start with https:// and have no spaces.', 'danger');
    setLinksSaving(true);
    const { error } = await supabase.from('dialer_settings').update({
      booking_link: clean(links.booking) || null,
      portfolio_link: clean(links.portfolio) || null,
    }).eq('id', true);
    setLinksSaving(false);
    if (error) return toast('That didn’t save.', 'danger');
    toast('Links saved — they fill into every follow-up email', 'success');
    refresh();
  };

  const saveCallerId = async () => {
    const raw = callerId.trim();
    const parsed = raw ? normalizePhone(raw, true) : null;
    if (raw && !parsed?.e164) return toast('That doesn’t look like a US phone number.', 'danger');
    setCallerSaving(true);
    const { error } = await supabase.from('dialer_settings').update({ caller_id_number: parsed?.e164 ?? null }).eq('id', true);
    setCallerSaving(false);
    if (error) return toast('That didn’t save — it must be a US number.', 'danger');
    toast(raw ? 'Caller ID saved — the rep sees it on the call screen' : 'Caller ID cleared', 'success');
    refresh();
  };

  const saveCadence = async () => {
    const next: Partial<Record<CadenceKey, number>> = {};
    for (const c of CADENCE) {
      const n = Math.round(Number(draft[c.key]));
      const min = c.key === 'retry_every' || c.key === 'email_after_attempts' ? 0 : 1;
      if (!Number.isFinite(n) || n < min) return toast(`${c.label}: enter a number of ${min} or more.`, 'danger');
      next[c.key] = n;
    }
    setSaving(true);
    const { error } = await supabase.from('dialer_settings').update(next).eq('id', true);
    setSaving(false);
    if (error) return toast('Out of range — check the limits (retries 1–30, nurture 7–730, attempts 2–20, retry mix 0–20, email after 0–10).', 'danger');
    toast('Saved — applies to the next call logged', 'success');
    refresh();
  };

  const addScript = async () => {
    const max = Math.max(0, ...scripts.map(s => s.sort_order));
    const { error } = await supabase.from('call_scripts').insert({ title: 'New section', body: '', sort_order: max + 1 });
    if (error) return toast('Couldn’t add that.', 'danger');
    refresh();
  };

  return (
    <div className="flex max-w-[820px] flex-col gap-5">
      <PageHeader title="Dialer settings" subtitle="The rules, the emails and the pitch." />

      {failed && <ErrorState title="Settings couldn’t load" body={failed} />}
      {loading && <SkeletonRows rows={4} />}

      {!loading && !failed && (
        <>
          <Card>
            <CardHeader title="Google Calendar" />
            <div className="flex flex-col gap-3 p-4">
              <div className="flex flex-wrap items-center gap-3">
                {calendar.loading ? (
                  <Badge tone="neutral">Checking…</Badge>
                ) : calendar.connected ? (
                  <Badge tone="success" dot>Connected as {calendar.status?.email}</Badge>
                ) : calendar.status?.status === 'error' ? (
                  <Badge tone="danger" dot>Connection lost — reconnect</Badge>
                ) : (
                  <Badge tone="neutral">Not connected</Badge>
                )}
                <span className="flex-1" />
                <Button variant={calendar.connected ? 'secondary' : 'primary'} loading={connecting} onClick={connect}>
                  {calendar.connected ? 'Reconnect' : calendar.status?.status === 'error' ? 'Reconnect Google' : 'Connect Google Calendar'}
                </Button>
                {(calendar.connected || calendar.status?.status === 'error') && (
                  <Button variant="ghost" onClick={disconnect}>Disconnect</Button>
                )}
              </div>
              <p className="m-0 text-[12.5px] text-crm-ink-3">
                When connected, “Meeting agreed” shows your real free times, and booking creates the event on this
                calendar with a Google Meet link and emails the invite to the prospect and the rep. If it ever
                isn’t available, the rep just types the time and you send the invite yourself.
              </p>
              {calendar.status?.error && <p className="m-0 text-[12.5px] text-crm-danger">{calendar.status.error}</p>}
            </div>
          </Card>

          <Card>
            <CardHeader title="Follow-up email links" />
            <div className="flex flex-col gap-3 p-4">
              <Input
                label="Booking link (your Zoho calendar page)"
                value={links.booking}
                onChange={e => setLinks(l => ({ ...l, booking: e.target.value }))}
                placeholder="https://…"
              />
              <Input
                label="Portfolio link"
                value={links.portfolio}
                onChange={e => setLinks(l => ({ ...l, portfolio: e.target.value }))}
                placeholder="https://xtenzium.com/…"
              />
              <div>
                <Button variant="primary" loading={linksSaving} onClick={saveLinks}>Save links</Button>
              </div>
              <p className="m-0 text-[12.5px] text-crm-ink-3">
                Templates use {'{{booking_link}}'} and {'{{portfolio_link}}'} (write a link as <code>[text]({'{{booking_link}}'})</code>), plus {'{{contact_first}}'}, {'{{company_name}}'} and {'{{contact_name}}'}.
                Until a link is set, the Inbox warns before you send.
              </p>
            </div>
          </Card>

          <Card>
            <CardHeader title="Caller ID" />
            <div className="flex flex-wrap items-end gap-3 p-4">
              <Input
                className="min-w-[220px]"
                label="The number prospects see (Google Voice)"
                value={callerId}
                onChange={e => setCallerId(e.target.value)}
                placeholder="(407) 243-8456"
              />
              <Button variant="primary" loading={callerSaving} onClick={saveCallerId}>Save</Button>
            </div>
            <p className="m-0 px-4 pb-4 text-[12.5px] text-crm-ink-3">
              Shown on the rep’s call screen so they check Google Voice is using it, and available to the pitch as {'{{caller_id}}'}.
            </p>
          </Card>

          <Card>
            <CardHeader title="Meeting hours" />
            <div className="p-4">
              <p className="m-0 mb-3 text-[12.5px] text-crm-ink-3">
                When you can take meetings, in your own timezone. Times offered to the rep must also fall inside the
                prospect’s 9–5, so with US prospects an evening window such as 18 → 2 is normal. Hours can wrap past midnight.
              </p>
              <div className="grid gap-3 sm:grid-cols-4">
                <Select
                  label="Your timezone"
                  value={OWNER_ZONES.includes(meeting.tz) ? meeting.tz : ''}
                  placeholder={OWNER_ZONES.includes(meeting.tz) ? undefined : meeting.tz}
                  options={OWNER_ZONES.map(z => ({ value: z, label: z.replace('_', ' ') }))}
                  onChange={e => e.target.value && setMeeting(m => ({ ...m, tz: e.target.value }))}
                />
                <Input label="Available from (hour)" type="number" min={0} max={23} value={meeting.from} onChange={e => setMeeting(m => ({ ...m, from: e.target.value }))} />
                <Input label="Until (hour)" type="number" min={0} max={24} value={meeting.to} onChange={e => setMeeting(m => ({ ...m, to: e.target.value }))} />
                <Select
                  label="Default length"
                  value={meeting.minutes}
                  options={MEETING_MINUTES.map(m => ({ value: String(m), label: `${m} minutes` }))}
                  onChange={e => setMeeting(m => ({ ...m, minutes: e.target.value }))}
                />
              </div>
              <div className="mt-4">
                <Button variant="primary" loading={meetingSaving} onClick={saveMeeting}>Save meeting hours</Button>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title="Retry rules" />
            <div className="p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                {CADENCE.map(c => (
                  <Input
                    key={c.key}
                    label={c.label}
                    hint={c.hint}
                    type="number"
                    min={c.key === 'retry_every' || c.key === 'email_after_attempts' ? 0 : 1}
                    value={draft[c.key] ?? ''}
                    onChange={e => setDraft(d => ({ ...d, [c.key]: e.target.value }))}
                  />
                ))}
              </div>
              <div className="mt-4">
                <Button variant="primary" loading={saving} disabled={!settings} onClick={saveCadence}>Save rules</Button>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title="Email templates" />
            <p className="m-0 border-b border-crm-line px-4 py-3 text-[12.5px] text-crm-ink-3">
              Merge fields: <code>{'{{company_name}}'}</code> <code>{'{{contact_name}}'}</code>{' '}
              <code>{'{{website}}'}</code> <code>{'{{rep_note}}'}</code> (what the rep wrote). They’re filled in
              when you open an email in the inbox, and you can edit the result before sending. The cold emails also use
              <code>{'{{sender_name}}'}</code>. <strong>Replace “[Your business postal address]” in both cold emails with your real
              address</strong> — cold email must carry a postal address and an opt-out line.
            </p>
            {templates.map(t => (
              <TemplateEditor key={t.type + t.updated_at} template={t} onSaved={refresh} />
            ))}
          </Card>

          <Card>
            <CardHeader title="Call script (shown to the rep)" />
            <p className="m-0 border-b border-crm-line px-4 py-3 text-[12.5px] text-crm-ink-3">
              These placeholders are filled in on the call screen: <code>{'{{who}}'}</code> (the contact’s name at the
              company, or “a representative at” the company), <code>{'{{company}}'}</code> and <code>{'{{rep}}'}</code>{' '}
              (the rep’s first name). One line per row; keep each line short enough to say in one breath.
            </p>
            {scripts.map((s, i) => (
              <ScriptEditor
                key={s.id + s.updated_at + s.sort_order}
                script={s}
                first={i === 0}
                last={i === scripts.length - 1}
                onChanged={refresh}
              />
            ))}
            <div className="p-4">
              <Button onClick={addScript}>Add a section</Button>
            </div>
          </Card>
        </>
      )}
    </div>
  );
};

export default DialerSettings;
