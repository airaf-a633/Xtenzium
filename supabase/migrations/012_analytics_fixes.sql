-- ============================================================
-- Xtenzium — Analytics corrections
-- Run this in: Supabase Dashboard → SQL Editor → New query
--
-- Run this after 011. It fixes two faults in that migration, one of
-- which is a data exposure and should not wait.
-- ============================================================

-- ─── 1. The views were readable by anon ───────────────────
--
-- A Postgres view runs as its owner, not as the caller, unless it is
-- created with security_invoker. That means RLS on the underlying table
-- is bypassed by anything selecting through the view — so `page_events`
-- was correctly locked (an anon select returns no rows) while
-- `analytics_pages` handed the same data straight back.
--
-- Confirmed rather than assumed: inserting a probe row as anon and then
-- reading it back returned [] from the table and the row from the view.
--
-- The anon key ships in the client bundle, so it is public by design.
-- What leaked is aggregate rather than personal — traffic per page,
-- scroll depth, enquiry counts, referring hosts — but that is the
-- business's own numbers, readable by anyone who opened devtools.
--
-- security_invoker makes the view evaluate RLS as the caller. The
-- dashboard is unaffected: it queries as an authenticated user, and
-- page_events_auth_select already grants that.

alter view public.analytics_daily set (security_invoker = on);
alter view public.analytics_pages set (security_invoker = on);

-- ─── 2. The attribution view was wrong, and was the one applied ───
--
-- The first draft joined leads to events by day, crediting every landing
-- path with every lead created that day — multiplication rather than
-- attribution, and it would have read as a wildly successful site. It
-- was corrected in the repo before anybody looked at a dashboard, but
-- the original had already been applied, so the broken view is live
-- under its old name and the corrected one does not exist.

drop view if exists public.analytics_lead_sources;

-- Real attribution needs a shared key. `leads.payload` is jsonb and is
-- already written by both forms, so the beacon puts its visitor id there
-- and nothing about the leads table has to change — which matters,
-- because that table belongs to the CRM.
create or replace view public.analytics_attribution
with (security_invoker = on) as
with sessions as (
  select
    visitor,
    min(created_at)                              as started_at,
    (array_agg(path order by created_at))[1]     as landing_path,
    (array_agg(referrer order by created_at))[1] as referring_host,
    count(*) filter (where name = 'pageview')    as pageviews
  from public.page_events
  group by visitor
)
select
  s.referring_host,
  s.landing_path,
  count(*)                                                        as sessions,
  count(l.id)                                                     as leads,
  round(count(l.id)::numeric / nullif(count(*), 0) * 100, 1)      as conversion_percent
from sessions s
left join public.leads l
  on l.payload->>'visitor' = s.visitor
group by 1, 2
order by leads desc, sessions desc;

comment on view public.analytics_attribution is
  'Sessions joined to the enquiries they produced, keyed on the visitor id the forms carry in leads.payload. A lead with no visitor in its payload — anything submitted before the beacon shipped, or with JS blocked — simply does not appear here.';

-- ─── 3. Remove the probe row ──────────────────────────────
--
-- Written deliberately to prove the exposure above, since there was no
-- way to establish it by reading. The anon role has no delete policy, so
-- it could not be cleaned up from the client that made it.

delete from public.page_events where visitor = 'rls-probe-delete-me';
