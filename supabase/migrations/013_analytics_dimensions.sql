-- ============================================================
-- Xtenzium — Analytics dimensions
-- Run this in: Supabase Dashboard → SQL Editor → New query
--
-- Run after 011 and 012. Safe to re-run.
-- ============================================================
--
-- 011 answered three questions: how much traffic, which pages, and which
-- sessions produced enquiries. This adds the rest of the panel set —
-- when people come, where from, on what, and from where — and fixes a
-- flaw in the first shape while it is here.
--
-- ── The flaw ───────────────────────────────────────────────────────
--
-- `analytics_pages` had no time column, so the dashboard's date range
-- silently did not apply to it: the daily chart moved when you switched
-- to 7 days and "most read pages" did not. A control that governs some
-- of a screen and not the rest is worse than no control, because nothing
-- on the page says which half you are looking at.
--
-- So every view here carries `day`, and the dashboard filters and
-- re-aggregates. That keeps the range honest and keeps the rows small:
-- these are grouped counts per day, not events.
--
-- ── Local time ─────────────────────────────────────────────────────
--
-- Days and hours are bucketed in Asia/Karachi rather than UTC. "Busiest
-- hour" is a claim about when people are awake, and in UTC it is a claim
-- about nothing. Change the literal in one place below if the answer
-- should be given in a client's timezone instead.

-- ─── New dimensions on the event ──────────────────────────
--
-- Geo and client are set by the collector, not the browser: the site is
-- static and posts straight to PostgREST, so nothing in the page ever
-- learns its own IP. `api/collect.ts` reads Vercel's geo headers and
-- the user agent, writes these columns, and forwards the rest untouched.
--
-- Country and city only. No region, no postal, no coordinates, and never
-- the IP itself — the address is used to derive a city and then dropped
-- inside the request that carried it. That keeps /privacy true.

alter table public.page_events add column if not exists country text;
alter table public.page_events add column if not exists city    text;
alter table public.page_events add column if not exists browser text;
alter table public.page_events add column if not exists os      text;

comment on column public.page_events.country is
  'ISO country code, derived at the edge from the request IP, which is never stored.';

-- "Where did the traffic come from" — the geo and referrer panels.
create index if not exists page_events_country_idx
  on public.page_events (country, created_at desc);

-- ─── Shared session shape ─────────────────────────────────
--
-- Several panels count sessions rather than events, and a session is a
-- visitor: the id lives in sessionStorage and dies with the tab, so the
-- two are the same thing by construction. This is the definition, in one
-- place, rather than the same aggregate pasted into six views.

create or replace view public.analytics_session_facts
with (security_invoker = on) as
select
  visitor,
  min(created_at)                                             as started_at,
  max(created_at)                                             as ended_at,
  extract(epoch from (max(created_at) - min(created_at)))::int as seconds,
  (min(created_at) at time zone 'Asia/Karachi')::date          as day,
  extract(dow  from min(created_at) at time zone 'Asia/Karachi')::int as dow,
  extract(hour from min(created_at) at time zone 'Asia/Karachi')::int as hour,
  (array_agg(path     order by created_at))[1]                as landing_path,
  (array_agg(referrer order by created_at))[1]                as referring_host,
  (array_agg(device   order by created_at))[1]                as device,
  (array_agg(country  order by created_at))[1]                as country,
  (array_agg(city     order by created_at))[1]                as city,
  (array_agg(browser  order by created_at))[1]                as browser,
  (array_agg(os       order by created_at))[1]                as os,
  count(*) filter (where name = 'pageview')                   as pageviews,
  max((props->>'percent')::int) filter (where name = 'scroll_depth') as max_scroll
from public.page_events
group by visitor;

comment on view public.analytics_session_facts is
  'One row per session. Dimensions are taken from the first event of the session, so a session is attributed to where it began rather than where it ended.';

-- ─── When ─────────────────────────────────────────────────
-- Day of week and hour of day come from the same view: they are the same
-- question at two resolutions, and splitting them would mean two scans
-- for one pair of panels.

create or replace view public.analytics_when
with (security_invoker = on) as
select day, dow, hour, count(*) as sessions, sum(pageviews) as pageviews
from public.analytics_session_facts
group by day, dow, hour;

-- ─── Where from ───────────────────────────────────────────

create or replace view public.analytics_referrers
with (security_invoker = on) as
select day, referring_host, count(*) as sessions, sum(pageviews) as pageviews
from public.analytics_session_facts
group by day, referring_host;

comment on view public.analytics_referrers is
  'A null referring_host is direct traffic, or a referrer the browser withheld. It is a category, not missing data.';

-- ─── What on ──────────────────────────────────────────────

create or replace view public.analytics_devices
with (security_invoker = on) as
select day, device, browser, os, count(*) as sessions
from public.analytics_session_facts
group by day, device, browser, os;

-- ─── Where ────────────────────────────────────────────────

create or replace view public.analytics_geo
with (security_invoker = on) as
select day, country, city, count(*) as sessions
from public.analytics_session_facts
group by day, country, city;

-- ─── Session quality ──────────────────────────────────────
--
-- Bounce is defined as one pageview that never passed half the page.
-- Time alone cannot define it here: a single-page session has no second
-- timestamp, so its duration is zero whether it was read or abandoned,
-- and scroll depth is the only evidence either way.

create or replace view public.analytics_quality
with (security_invoker = on) as
select
  day,
  count(*)                                                     as sessions,
  count(*) filter (where pageviews <= 1 and coalesce(max_scroll, 0) < 50) as bounced,
  round(avg(pageviews)::numeric, 2)                            as avg_pageviews,
  round(avg(seconds) filter (where seconds > 0)::numeric, 0)   as avg_seconds
from public.analytics_session_facts
group by day;

-- ─── Where they go next ───────────────────────────────────
-- The case-study source links and the credits rows are the interesting
-- case: work being clicked through to is a signal about the work.

create or replace view public.analytics_outbound
with (security_invoker = on) as
select
  (created_at at time zone 'Asia/Karachi')::date as day,
  props->>'host'                                 as host,
  count(*)                                       as clicks
from public.page_events
where name = 'outbound_click'
group by 1, 2;

-- ─── Right now ────────────────────────────────────────────
-- No day column and no range: this one is always the last half hour,
-- which is the only period the word "now" can mean.

create or replace view public.analytics_realtime
with (security_invoker = on) as
select path, count(distinct visitor) as visitors, max(created_at) as last_seen
from public.page_events
where created_at > now() - interval '30 minutes'
group by path
order by visitors desc;

-- ─── Pages, rebuilt with a day ────────────────────────────
-- Dropped rather than replaced: `create or replace view` cannot change
-- the column list, and `day` belongs at the front.

drop view if exists public.analytics_pages;

create view public.analytics_pages
with (security_invoker = on) as
select
  (created_at at time zone 'Asia/Karachi')::date            as day,
  path,
  count(*) filter (where name = 'pageview')                 as pageviews,
  count(distinct visitor) filter (where name = 'pageview')  as visitors,
  round(avg((props->>'percent')::numeric)
        filter (where name = 'scroll_depth'), 1)            as avg_scroll_percent,
  count(*) filter (where name = 'form_submit')              as form_submits
from public.page_events
group by 1, 2;

-- ─── Daily, in the same timezone as everything else ───────
-- It bucketed in UTC, which put a Karachi evening on the following day
-- and disagreed with every view above.

drop view if exists public.analytics_daily;

create view public.analytics_daily
with (security_invoker = on) as
select
  (created_at at time zone 'Asia/Karachi')::date            as day,
  count(*) filter (where name = 'pageview')                 as pageviews,
  count(distinct visitor) filter (where name = 'pageview')  as visitors,
  count(*) filter (where name = 'form_submit')              as form_submits,
  count(*) filter (where name = 'estimate_complete')        as estimates_completed
from public.page_events
group by 1;
