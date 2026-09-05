-- ============================================================
-- Xtenzium — Google Search Console ingest
-- Run this in: Supabase Dashboard → SQL Editor → New query
-- ============================================================
--
-- The one panel the beacon cannot build.
--
-- `page_events` knows everything that happens after somebody arrives and
-- nothing about how they came to arrive. The query someone typed into
-- Google is not in the referrer — it has not been for a decade — so
-- "what visitors search for" can only come from Search Console, and only
-- through its API.
--
-- Why store it rather than call the API from the dashboard:
--
--   1. Search Console keeps 16 months. Copying it daily means the day it
--      rolls off, we still have it, and a year from now there is a
--      history nobody thought to start keeping.
--   2. The API needs a service-account signature, which cannot live in a
--      browser. Something server-side has to do it regardless.
--   3. It is rate limited and slow. A dashboard that hits it on every
--      page load is a dashboard that is sometimes empty.
--
-- Data lands here from `api/gsc-sync.ts`, which Vercel runs daily.

create table if not exists public.search_queries (
  -- The date the impressions happened, not the date we fetched them.
  day          date not null,

  -- What was typed. Search Console withholds this for rare queries to
  -- protect the people who typed them, so the totals here will always be
  -- a little under the totals in the Performance report. That gap is the
  -- anonymised tail, not a bug in this pipeline.
  query        text not null,

  -- Which page of ours the result pointed at.
  page         text not null,

  clicks       integer not null default 0,
  impressions  integer not null default 0,
  -- Average position across those impressions. Fractional and worth
  -- keeping so: a move from 8.9 to 7.2 is real progress that rounding
  -- would hide.
  position     numeric(5, 2),

  fetched_at   timestamptz not null default now(),

  -- Search Console restates recent days as its own data settles, so the
  -- sync re-fetches a trailing window and upserts. Without this key that
  -- would double every number in it.
  primary key (day, query, page)
);

comment on table public.search_queries is
  'Daily Google Search Console query data, copied in by api/gsc-sync.ts. Recent days are restated by Google for about three days, so the sync re-fetches a trailing window and upserts on (day, query, page).';

create index if not exists search_queries_day_idx
  on public.search_queries (day desc);

-- ─── Row level security ───────────────────────────────────
--
-- Same shape as page_events: the dashboard reads it as an authenticated
-- user, and the public role has no business with it at all. The sync
-- writes with the service role, which bypasses RLS by design, so there
-- is deliberately no insert policy here.

alter table public.search_queries enable row level security;

create policy "search_queries_auth_select"
  on public.search_queries for select
  to authenticated
  using (true);

-- ─── Reporting views ──────────────────────────────────────
--
-- security_invoker on every one. A view without it runs as its owner and
-- hands the public role data the table just refused it — which is
-- exactly what happened in 011 and had to be fixed in 012.

-- What people type. The panel this whole file exists for.
create or replace view public.search_console_queries
with (security_invoker = on) as
select
  day,
  query,
  sum(clicks)::int      as clicks,
  sum(impressions)::int as impressions,
  round(avg(position), 1) as position
from public.search_queries
group by day, query;

-- Which of our pages earns the impressions.
create or replace view public.search_console_pages
with (security_invoker = on) as
select
  day,
  page,
  sum(clicks)::int      as clicks,
  sum(impressions)::int as impressions,
  round(avg(position), 1) as position
from public.search_queries
group by day, page;

-- The daily totals, and the number that matters most on a site with 23
-- pages and almost no index coverage: how many of the searches we appear
-- in produce a visit.
create or replace view public.search_console_daily
with (security_invoker = on) as
select
  day,
  sum(clicks)::int                      as clicks,
  sum(impressions)::int                 as impressions,
  count(distinct query)::int            as queries,
  round(
    sum(clicks)::numeric / nullif(sum(impressions), 0) * 100, 2
  )                                     as ctr_percent,
  round(avg(position), 1)               as position
from public.search_queries
group by day;
