-- ============================================================
-- Xtenzium — First-party analytics
-- Run this in: Supabase Dashboard → SQL Editor → New query
--
-- Renumbered from 006, which collided: the CRM session had already taken
-- that number with 006_identity_and_deals.sql. Two migrations sharing a
-- number is how a schema history stops being an order. If this has
-- already been run as 006, nothing needs redoing — the rename is to the
-- file, not to anything in the database.
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
-- `visitor` is a random id minted in the browser and held in
-- sessionStorage. Not a hash of anything: the site is static and posts
-- straight to Supabase, so there is no server in the path and the client
-- never learns its own IP. An identifier that cannot be built is worse
-- than a plain one, so this is the plain one.
--
-- What that buys and what it costs:
--
--   - It separates two people on a page right now, which is what makes a
--     session, a bounce and a funnel step mean anything.
--   - It dies when the tab closes. The same person tomorrow — or in a
--     second tab today — is a new visitor, so `visitors` reads closer to
--     sessions than to people.
--
-- Multi-session identity is the thing given up, and it is worth giving
-- up: it is exactly what would require a cookie and therefore a consent
-- banner. The questions worth answering — which page produced an
-- enquiry, where enquiries come from, where the estimator is abandoned —
-- all live inside one session.

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

  -- Per-session pseudonymous id. See the note above.
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

-- "What did this visitor do" — the session: bounce, funnel order, and
-- the path that preceded an enquiry.
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

-- The one Google Analytics cannot produce: enquiries joined to the
-- traffic that produced them.
--
-- The first draft of this view joined leads to events by day, which
-- credited every landing path with every lead created that day. That is
-- not attribution, it is multiplication, and it would have read as a
-- wildly successful site.
--
-- Real attribution needs the two tables to share a key. `leads.payload`
-- is already jsonb and already written by both forms, so the beacon puts
-- its `visitor` in there and nothing about the leads table has to change
-- — which matters, because that table belongs to the CRM.
create or replace view public.analytics_attribution as
with sessions as (
  select
    visitor,
    min(created_at)                                          as started_at,
    (array_agg(path order by created_at))[1]                 as landing_path,
    (array_agg(referrer order by created_at))[1]             as referring_host,
    count(*) filter (where name = 'pageview')                as pageviews
  from public.page_events
  group by visitor
)
select
  s.referring_host,
  s.landing_path,
  count(*)                                    as sessions,
  count(l.id)                                 as leads,
  round(
    count(l.id)::numeric / nullif(count(*), 0) * 100,
    1
  )                                           as conversion_percent
from sessions s
left join public.leads l
  on l.payload->>'visitor' = s.visitor
group by 1, 2
order by leads desc, sessions desc;

comment on view public.analytics_attribution is
  'Sessions joined to the enquiries they produced, keyed on the visitor id the forms carry in leads.payload. A lead with no visitor in its payload — anything submitted before the beacon shipped, or with JS blocked — counts as a session-less lead and simply does not appear here.';

comment on table public.page_events is
  'First-party, cookieless analytics. `visitor` is a per-session random id held in sessionStorage and is not stable across sessions by design. Public role may insert and must never be granted select.';
