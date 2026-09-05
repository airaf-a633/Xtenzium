import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { Testimonial, TestimonialPlacement as Placement } from '../../types/database';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  IconButton,
  Input,
  PageHeader,
  SegmentedControl,
  Select,
  SkeletonRows,
  Textarea,
  useToast,
} from '../../components/crm/ui';

/* Client testimonials.
 *
 * ── Two flags, not one ─────────────────────────────────────────────
 *
 * `status` is whether we are ready to show a quote. `consent` is whether
 * we are allowed to. They are different facts and the site requires both
 * — the RLS policy on the table enforces it, so this page cannot publish
 * something the database will refuse to serve.
 *
 * That is why consent is a checkbox with a note beside it rather than a
 * step in a status dropdown. A dropdown would let "published" imply
 * permission, and the day someone pastes a quote out of a private Slack
 * thread, nothing would object.
 *
 * ── Publishing is not deploying ────────────────────────────────────
 *
 * The site fetches this table during `astro build`, so a quote saved
 * here appears on the live site at the next deploy, not immediately. The
 * banner below says so, because a page that looks like a CMS and behaves
 * like one everywhere except the part that matters is a trap.
 */


/* The columns a person edits. The timestamps are the database's to set —
   `updated_at` is stamped by a trigger, so accepting one from the form
   would be a value the server immediately overwrites. */
type Draft = Omit<Testimonial, 'id' | 'created_at' | 'updated_at' | 'published_at'>;

const BLANK: Draft = {
  quote: '',
  author_name: '',
  author_role: '',
  company: '',
  project: '',
  placement: 'any',
  status: 'draft',
  consent: false,
  consent_note: '',
  sort_order: 0,
};

const PLACEMENTS: Array<{ value: string; label: string }> = [
  { value: 'any', label: 'Any page' },
  { value: 'home', label: 'Home' },
  { value: 'work', label: 'Work' },
  { value: 'estimate', label: 'Estimate' },
];

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'live', label: 'Live' },
  { value: 'draft', label: 'Not live' },
] as const;

type Filter = (typeof FILTERS)[number]['value'];

/* One place decides what "live" means, so the badge and the filter can
   never disagree with each other or with the RLS policy. */
const isLive = (t: Testimonial) => t.status === 'published' && t.consent;

const TrashIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
  </svg>
);

const Testimonials = () => {
  const { toast } = useToast();
  const [rows, setRows] = useState<Testimonial[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState<string | null>(null);
  const [notInstalled, setNotInstalled] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');

  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(BLANK);
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    supabase
      .from('testimonials')
      .select('*')
      .order('sort_order')
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error?.code === '42P01') setNotInstalled(true);
        else if (error) setFailed(error.message);
        else setRows((data ?? []) as unknown as Testimonial[]);
        setLoading(false);
      });
  };

  useEffect(load, []);

  const visible = useMemo(
    () =>
      rows.filter(t => (filter === 'all' ? true : filter === 'live' ? isLive(t) : !isLive(t))),
    [rows, filter],
  );

  const liveCount = useMemo(() => rows.filter(isLive).length, [rows]);

  const reset = () => {
    setEditing(null);
    setDraft(BLANK);
  };

  const edit = (t: Testimonial) => {
    setEditing(t.id);
    setDraft({
      quote: t.quote,
      author_name: t.author_name ?? '',
      author_role: t.author_role ?? '',
      company: t.company ?? '',
      project: t.project ?? '',
      placement: t.placement,
      status: t.status,
      consent: t.consent,
      consent_note: t.consent_note ?? '',
      sort_order: t.sort_order,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const save = async () => {
    if (!draft.quote.trim()) {
      toast('A testimonial needs a quote.', 'danger');
      return;
    }
    setSaving(true);
    /* Empty strings become null. A column holding "" is a column that
       reads as answered when nobody answered it. */
    const blank = (v: string | null) => (v && v.trim() ? v.trim() : null);
    const payload = {
      ...draft,
      quote: draft.quote.trim(),
      author_name: blank(draft.author_name),
      author_role: blank(draft.author_role),
      company: blank(draft.company),
      project: blank(draft.project),
      consent_note: blank(draft.consent_note),
    };

    const { error } = editing
      ? await supabase.from('testimonials').update(payload).eq('id', editing)
      : await supabase.from('testimonials').insert(payload);

    setSaving(false);
    if (error) {
      toast(`Could not save: ${error.message}`, 'danger');
      return;
    }
    toast(
      (editing ? 'Testimonial updated' : 'Testimonial added') +
        (payload.status === 'published' && payload.consent
          ? ' — it goes live at the next deploy'
          : ''),
      'success',
    );
    reset();
    load();
  };

  const remove = async (t: Testimonial) => {
    if (!window.confirm(`Delete this testimonial permanently?\n\n"${t.quote.slice(0, 90)}…"`)) return;
    const { error } = await supabase.from('testimonials').delete().eq('id', t.id);
    if (error) {
      toast(`Could not delete: ${error.message}`, 'danger');
      return;
    }
    toast('Testimonial deleted', 'success');
    if (editing === t.id) reset();
    load();
  };

  if (notInstalled) {
    return (
      <>
        <PageHeader title="Testimonials" />
        <ErrorState
          title="Not installed yet"
          body="Run 014_testimonials.sql in the SQL editor. The table does not exist, so there is nothing to manage — and the site renders no quotes until it does."
        />
      </>
    );
  }

  if (failed) {
    return (
      <>
        <PageHeader title="Testimonials" />
        <ErrorState title="Could not load testimonials" body={failed} />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Testimonials"
        actions={
          <SegmentedControl
            label="Show"
            options={FILTERS as unknown as Array<{ value: Filter; label: string }>}
            value={filter}
            onChange={setFilter}
          />
        }
      />

      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader title={editing ? 'Edit testimonial' : 'Add a testimonial'} />
          <div className="flex flex-col gap-3 p-4 pt-0">
            <Textarea
              label="Quote"
              required
              rows={4}
              value={draft.quote}
              onChange={e => setDraft({ ...draft, quote: e.target.value })}
              hint="Their words, unedited. Tightening a client's sentence is how a real quote starts sounding like a written one."
            />

            <div className="grid gap-3 sm:grid-cols-3">
              <Input
                label="Name"
                value={draft.author_name ?? ''}
                onChange={e => setDraft({ ...draft, author_name: e.target.value })}
                hint="Leave blank if they agreed to the words but not their name."
              />
              <Input
                label="Role"
                value={draft.author_role ?? ''}
                onChange={e => setDraft({ ...draft, author_role: e.target.value })}
                placeholder="Operations Director"
              />
              <Input
                label="Company"
                value={draft.company ?? ''}
                onChange={e => setDraft({ ...draft, company: e.target.value })}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <Input
                label="Project"
                value={draft.project ?? ''}
                onChange={e => setDraft({ ...draft, project: e.target.value })}
                hint="Which piece of work it is about."
              />
              <Select
                label="Placement"
                options={PLACEMENTS}
                value={draft.placement}
                onChange={e => setDraft({ ...draft, placement: e.target.value as Placement })}
                hint="Each page shows one quote. A page-specific quote wins over a general one."
              />
              <Input
                label="Order"
                type="number"
                value={String(draft.sort_order)}
                onChange={e => setDraft({ ...draft, sort_order: Number(e.target.value) || 0 })}
                hint="Lower shows first."
              />
            </div>

            {/* Consent sits apart from everything else on purpose. It is
                not a formatting choice, and grouping it with the status
                dropdown would make it read like one. */}
            <div className="flex flex-col gap-3 rounded-crm-md border border-crm-line bg-crm-raised p-3">
              <label className="flex cursor-pointer items-start gap-2.5">
                <input
                  type="checkbox"
                  checked={draft.consent}
                  onChange={e => setDraft({ ...draft, consent: e.target.checked })}
                  className="mt-0.5 h-4 w-4 accent-crm-copper"
                />
                <span className="text-[13px] leading-snug text-crm-ink">
                  The client has agreed to <strong>these words</strong> and{' '}
                  <strong>this attribution</strong> being published.
                  <span className="mt-0.5 block text-[12px] text-crm-ink-3">
                    Without this the quote stays off the site whatever its status says.
                  </span>
                </span>
              </label>
              <Input
                label="Where that agreement is recorded"
                value={draft.consent_note ?? ''}
                onChange={e => setDraft({ ...draft, consent_note: e.target.value })}
                placeholder="Email from 12 Aug, thread with Sarah"
              />
            </div>

            <div className="flex flex-wrap items-end justify-between gap-3">
              <Select
                label="Status"
                className="w-44"
                options={[
                  { value: 'draft', label: 'Draft' },
                  { value: 'published', label: 'Published' },
                ]}
                value={draft.status}
                onChange={e => setDraft({ ...draft, status: e.target.value as 'draft' | 'published' })}
              />
              <div className="flex gap-2">
                {editing && (
                  <Button variant="ghost" onClick={reset}>
                    Cancel
                  </Button>
                )}
                <Button onClick={save} disabled={saving}>
                  {saving ? 'Saving…' : editing ? 'Save changes' : 'Add testimonial'}
                </Button>
              </div>
            </div>

            {draft.status === 'published' && !draft.consent && (
              <p className="m-0 text-[12px] text-crm-warning">
                Marked published, but consent is not recorded — so it will not appear on the site.
              </p>
            )}
          </div>
        </Card>

        {/* The one thing a CMS-shaped page must not leave implicit. */}
        <p className="m-0 text-[12px] text-crm-ink-3">
          {liveCount === 0
            ? 'No quote is live yet, so the home, work and estimate pages render no testimonial section at all.'
            : `${liveCount} live. `}
          The site reads this table during its build, so changes here appear at the next deploy — not immediately.
        </p>

        {loading ? (
          <SkeletonRows />
        ) : visible.length === 0 ? (
          <EmptyState
            title={rows.length === 0 ? 'No testimonials yet' : 'Nothing matches this filter'}
            body={
              rows.length === 0
                ? 'Every quote on the site is currently absent rather than invented. Add the first real one above.'
                : undefined
            }
          />
        ) : (
          <div className="flex flex-col gap-2">
            {visible.map(t => (
              <Card key={t.id}>
                <div className="flex flex-col gap-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <blockquote className="m-0 text-[13.5px] leading-relaxed text-crm-ink">
                      “{t.quote}”
                    </blockquote>
                    <div className="flex shrink-0 gap-1">
                      <Button variant="ghost" onClick={() => edit(t)}>
                        Edit
                      </Button>
                      <IconButton label="Delete testimonial" icon={<TrashIcon />} onClick={() => remove(t)} />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-[12px] text-crm-ink-3">
                    <span>
                      {[t.author_name, t.author_role, t.company].filter(Boolean).join(', ') ||
                        'No attribution'}
                    </span>
                    {t.project && <span>· {t.project}</span>}
                    <span>· {PLACEMENTS.find(p => p.value === t.placement)?.label}</span>
                    <span className="ml-auto flex gap-1.5">
                      <Badge tone={isLive(t) ? 'success' : 'neutral'}>
                        {isLive(t) ? 'Live' : t.status === 'published' ? 'Awaiting consent' : 'Draft'}
                      </Badge>
                      {t.consent && <Badge tone="neutral">Consented</Badge>}
                    </span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </>
  );
};

export default Testimonials;
