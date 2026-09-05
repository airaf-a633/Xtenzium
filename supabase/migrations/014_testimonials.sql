-- ============================================================
-- Xtenzium — Testimonials
-- Run this in: Supabase Dashboard → SQL Editor → New query
-- ============================================================
--
-- Every testimonial on the site today is invented, and each one is
-- wrapped in `unverified(true)` so none of them render. That was the
-- right holding position — a fabricated quote attributed to a real
-- client's job title is not a placeholder, it is a lie with a byline —
-- but a gate is not a system. This is the system.
--
-- ── Consent is a column, not a convention ──────────────────────────
--
-- `consent` is separate from `status`, and both must be true before a
-- quote reaches the public site. They are different facts: status is
-- whether we are ready to show it, consent is whether we are allowed to.
-- Collapsing them into one flag means the day someone publishes a quote
-- pulled from a private Slack message, nothing in the schema objects.
--
-- The RLS policy enforces both, so the guarantee does not depend on the
-- build remembering to filter. See `web/src/lib/testimonials.ts`.
--
-- ── Placement ──────────────────────────────────────────────────────
--
-- Three pages carry a pull quote and each wants a different argument:
-- the home page wants "they built the thing our business runs on", the
-- work page wants "the write-up was honest", the estimate page wants
-- "they talked us out of spending more". A quote written for one reads
-- as filler on another, so placement is chosen rather than random.

create table if not exists public.testimonials (
  id            uuid primary key default gen_random_uuid(),

  quote         text not null check (length(trim(quote)) > 0),

  -- Attribution. All three are optional because the useful middle ground
  -- exists: a client who will let their words be used but not their name
  -- still gives "Operations Director, logistics" — which is attributable
  -- enough to be worth something and anonymous enough to be agreed to.
  author_name   text,
  author_role   text,
  company       text,

  -- Which piece of work it is about. Free text rather than a foreign key
  -- to `projects`: the oldest credits predate the CRM, and a quote that
  -- cannot be filed should still be storable.
  project       text,

  placement     text not null default 'any'
                  check (placement in ('any', 'home', 'work', 'estimate')),

  -- Ready to show.
  status        text not null default 'draft'
                  check (status in ('draft', 'published')),

  -- Allowed to show. Set only when the client has actually said yes, in
  -- writing, to these exact words and this exact attribution.
  consent       boolean not null default false,
  consent_note  text,

  -- Ascending, so the intended order is the reading order.
  sort_order    integer not null default 0,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  published_at  timestamptz
);

comment on table public.testimonials is
  'Client quotes. A row reaches the public site only when status = published AND consent = true; the RLS policy enforces both, so a build cannot leak one by forgetting a filter.';
comment on column public.testimonials.consent is
  'Whether the client has agreed to these words and this attribution being published. Not a workflow state — a permission.';

-- The build fetches exactly one shape: publishable rows, in order.
create index if not exists testimonials_live_idx
  on public.testimonials (placement, sort_order)
  where status = 'published' and consent;

-- ─── Row level security ───────────────────────────────────
--
-- Unlike `leads` and `page_events`, this table has a public read — the
-- static build fetches it with the anon key at build time, the same way
-- the journal fetches `blogs`. The policy is the filter: a draft or an
-- unconsented quote is invisible to that key, whatever the query says.

alter table public.testimonials enable row level security;

create policy "testimonials_public_select"
  on public.testimonials for select
  to anon, authenticated
  using (status = 'published' and consent = true);

create policy "testimonials_auth_all"
  on public.testimonials for all
  to authenticated
  using (true)
  with check (true);

-- ─── Keep updated_at honest ───────────────────────────────

create or replace function public.touch_testimonials()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  -- Stamped on the transition into published, and never moved by a later
  -- edit: "published on" is when it went up, not when it was last typed.
  if new.status = 'published' and coalesce(old.status, '') <> 'published' then
    new.published_at := coalesce(new.published_at, now());
  end if;
  return new;
end $$;

drop trigger if exists testimonials_touch on public.testimonials;
create trigger testimonials_touch
  before update on public.testimonials
  for each row execute function public.touch_testimonials();
