import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import type { CallScript, DialerSettings as Settings, EmailTemplate } from '../../../types/database';
import {
  Button, Card, CardHeader, ErrorState, Input, PageHeader, SkeletonRows, Textarea, useToast,
} from '../../../components/crm/ui';

type CadenceKey = Exclude<keyof Settings, 'id' | 'updated_at'>;

const CADENCE: { key: CadenceKey; label: string; hint: string }[] = [
  { key: 'no_answer_days', label: 'No answer → retry after', hint: 'business days' },
  { key: 'voicemail_days', label: 'Voicemail → retry after', hint: 'business days' },
  { key: 'gatekeeper_name_days', label: 'Gatekeeper, got a name → retry after', hint: 'business days' },
  { key: 'gatekeeper_blocked_days', label: 'Gatekeeper, blocked → retry after', hint: 'business days' },
  { key: 'nurture_outsources_days', label: 'Already outsources → call again after', hint: 'days' },
  { key: 'nurture_timing_days', label: 'Bad timing / budget → call again after', hint: 'days' },
  { key: 'max_attempts', label: 'Stop calling after', hint: 'attempts with no conversation' },
];

const TEMPLATE_TITLE: Record<string, string> = {
  email_info: 'Email — send info',
  email_proposal: 'Email — proposal',
  linkedin: 'LinkedIn message',
  admin_call: 'Owner call script',
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
      <Textarea label="Body" rows={10} value={body} onChange={e => setBody(e.target.value)} />
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
  const [busy, setBusy] = useState(false);
  const dirty = title !== script.title || body !== script.body;

  const save = async () => {
    setBusy(true);
    const { error } = await supabase.from('call_scripts').update({ title, body }).eq('id', script.id);
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
        if (row) setDraft(Object.fromEntries(CADENCE.map(c2 => [c2.key, String(row[c2.key])])));
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

  const saveCadence = async () => {
    const next: Partial<Record<CadenceKey, number>> = {};
    for (const c of CADENCE) {
      const n = Math.round(Number(draft[c.key]));
      if (!Number.isFinite(n) || n < 1) return toast(`${c.label}: enter a number of 1 or more.`, 'danger');
      next[c.key] = n;
    }
    setSaving(true);
    const { error } = await supabase.from('dialer_settings').update(next).eq('id', true);
    setSaving(false);
    if (error) return toast('Out of range — check the limits (e.g. retries 1–30, nurture 7–730, attempts 2–20).', 'danger');
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
            <CardHeader title="Retry rules" />
            <div className="p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                {CADENCE.map(c => (
                  <Input
                    key={c.key}
                    label={c.label}
                    hint={c.hint}
                    type="number"
                    min={1}
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
              when you open an email in the inbox, and you can edit the result before sending.
            </p>
            {templates.map(t => (
              <TemplateEditor key={t.type + t.updated_at} template={t} onSaved={refresh} />
            ))}
          </Card>

          <Card>
            <CardHeader title="Call script (shown to the rep)" />
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
