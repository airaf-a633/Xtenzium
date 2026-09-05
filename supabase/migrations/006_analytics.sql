-- ============================================================
-- Xtenzium — First-party analytics
-- Run this in: Supabase Dashboard → SQL Editor → New query
--
-- NOT APPLIED BY THE AUTHOR. The CRM is being built in a separate
-- session that owns this schema, so this file is written and left for
-- whoever is holding the database to run. If 006_ is already taken by
-- then, renumber the file — nothing here depends on the number.
-- ============================================================
--
-- Why this exists rather than Google Analytics:
--
--   1. Leads already live in this database. GA can tell you which page a
--      session landed on and can never tell you that the session became a
--      £40k project, because it cannot see `leads`. A join can. That is
--      the entire argument, and it is not a small one.
--   2. No third-party script, so no consent banner and no cookie. The
--      site's privacy page currently says it sets none, and this is
--      designed to keep that true rather than to make it a lie.
--
-- ── The visitor identifier ─────────────────────────────────────────
--
-- `visitor` is a hash of (IP + user agent + a daily-rotating salt),
-- computed on the way in and never reversible. It is deliberately
-- useless the day after it is written:
--
--   - It distinguishes two people on the same page today, which is what
--     makes a session and a bounce rate meaningful.
--   - It cannot follow anybody into tomorrow, which is what makes it
--     cookieless in substance and not just in mechanism.
--
-- That trade is the point. Multi-day attribution is the thing being
-- given up, and it is worth giving up: it is what forces a consent
-- banner, and the funnel questions worth answering — which page produced
-- the enquiry, where enquiries come from, where the estimator is
-- abandoned — are all answerable inside a day.

-- ─── Events ───────────────────────────────────────────────

create table if not exists public.page_events (
  id           bigint generated always as identity primary key,

  -- What happened. Kept as text with a check rather than an enum, so
  -- adding an event type is a migration that cannot fail on an enum
  -- value already in flight.
  name         text not null
                 check (name in (
                   'pageview',
                   'scroll_depth',
                   'outbound_click',
                   'form_start',
                   'form_submit',
                   'estimate_step',
                   'estimate_complete',
                   'exit_prompt_shown',
                   'exit_prompt_click'
                 )),

  -- Where it happened. Path only, never the full URL: a query string can
  -- carry an email address from a form somebody typed into, and a table
  -- of paths cannot leak what a table of URLs can.
  path         text not null,

  -- How they arrived. Host only, for the same reason — the referring
  -- host answers the attribution question and the full referring URL
  -- carries other people's query strings.
  referrer     text,

  -- Daily-rotating pseudonymous id. See the note above.
  visitor      text not null,

  -- Coarse device class, from viewport width at send time. Not a
  -- fingerprint: three buckets.
  device       text check (device in ('mobile', 'tablet', 'desktop')),

  -- Event-specific detail. Scroll depth as a percentage, the outbound
  -- host that was clicked, which estimator step was reached.
  props        jsonb not null default '{}',

  created_at   timestamptz not null default now()
);

-- ─── Indexes ──────────────────────────────────────────────
-- Written for the three questions this table exists to answer.

-- "What happened over this period, of this kind" — every dashboard panel.
create index if not exists page_events_created_name_idx
  on public.page_events (created_at desc, name);

-- "Which pages perform" — the funnel, page by page.
create index if not exists page_events_path_idx
  on public.page_events (path, created_at desc);

-- "What did this visitor do" — sessions, bounce, and the path that
-- preceded an enquiry. Only useful within a day, by design.
create index if not exists page_events_visitor_idx
  on public.page_events (visitor, created_at desc);

-- ─── Row level security ───────────────────────────────────
--
-- Deliberately the same shape as `leads`: the public site may write and
-- may never read. An anon SELECT policy here would expose every visitor's
-- browsing path on the site to anyone holding the anon key, which ships
-- in the client bundle. Do not add one.

alter table public.page_events enable row level security;

create policy "page_events_public_insert"
  on public.page_events for insert
  to anon, authenticated
  with check (true);

create policy "page_events_auth_select"
  on public.page_events for select
  to authenticated
  using (true);

create policy "page_events_auth_delete"
  on public.page_events for delete
  to authenticated
  using (true);

-- ─── Retention ────────────────────────────────────────────
--
-- The privacy page commits to keeping only what is needed. Aggregates
-- are what matter after a few weeks; raw rows are not, and holding them
-- indefinitely is a liability rather than an asset.
--
-- Supabase runs pg_cron. Enable it and schedule this if you want the
-- promise kept automatically rather than remembered:
--
--   select cron.schedule(
--     'prune-page-events', '0 3 * * *',
--     $$ delete from public.page_events
--        where created_at < now() - interval '90 days' $$
--   );

-- ─── Reporting views ──────────────────────────────────────
--
-- The dashboard reads these rather than the raw table, so a change to
-- how a metric is defined happens in one place.

create or replace view public.analytics_daily as
select
  date_trunc('day', created_at)                        as day,
  count(*) filter (where name = 'pageview')            as pageviews,
  count(distinct visitor) filter (where name = 'pageview') as visitors,
  count(*) filter (where name = 'form_submit')         as form_submits,
  count(*) filter (where name = 'estimate_complete')   as estimates_completed
from public.page_events
group by 1
order by 1 desc;

create or replace view public.analytics_pages as
select
  path,
  count(*) filter (where name = 'pageview')                as pageviews,
  count(distinct visitor) filter (where name = 'pageview') as visitors,
  round(avg((props->>'percent')::numeric)
        filter (where name = 'scroll_depth'), 1)           as avg_scroll_percent,
  count(*) filter (where name = 'form_submit')             as form_submits
from public.page_events
group by 1
order by pageviews desc;

-- The one Google Analytics cannot produce: enquiries joined to the page
-- the visitor was on when they sent one. `leads.source` is already
-- written by the forms, so this is the bridge between traffic and money.
create or replace view public.analytics_lead_sources as
select
  e.referrer                as referring_host,
  e.path                    as landing_path,
  count(distinct e.visitor) as visitors,
  count(distinct l.id)      as leads
from public.page_events e
left join public.leads l
  on date_trunc('day', l.created_at) = date_trunc('day', e.created_at)
where e.name = 'pageview'
group by 1, 2
order by leads desc nulls last, visitors desc;

comment on table public.page_events is
  'First-party, cookieless analytics. `visitor` is a daily-rotating hash and is not stable across days by design. Public role may insert and must never be granted select.';
