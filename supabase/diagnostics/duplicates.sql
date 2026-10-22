-- ═══════════════════════════════════════════════════════════
-- Dialer data health — read-only. Paste a block into the Supabase SQL
-- editor and run it. Nothing here changes data.
-- ═══════════════════════════════════════════════════════════

-- 1 · The same phone number on more than one lead.
--     Should return NO rows: phone_e164 is unique. If it returns rows, tell us.
SELECT phone_e164, count(*) AS leads, array_agg(company_name) AS companies
FROM public.call_leads
WHERE phone_e164 IS NOT NULL
GROUP BY phone_e164
HAVING count(*) > 1;

-- 2 · The same website domain on more than one lead. Also should be empty.
SELECT domain, count(*) AS leads, array_agg(company_name) AS companies
FROM public.call_leads
WHERE domain IS NOT NULL
GROUP BY domain
HAVING count(*) > 1;

-- 3 · Likely the SAME company under different numbers (name + state, ignoring
--     LLC / Inc / Digital / Agency and punctuation). These are the real "repeats".
WITH k AS (
  SELECT id, company_name, phone_e164, state, status, list_id,
         regexp_replace(
           regexp_replace(lower(company_name), '\m(llc|inc|ltd|co|corp|company|the|and|group|agency|studio|studios|digital|marketing|media)\M', '', 'g'),
           '[^a-z0-9]', '', 'g') || '|' || coalesce(lower(state), '') AS key
  FROM public.call_leads
)
SELECT key, count(*) AS leads,
       array_agg(company_name || ' · ' || coalesce(phone_e164, 'no phone') || ' · ' || status) AS rows
FROM k
WHERE length(split_part(key, '|', 1)) >= 3
GROUP BY key
HAVING count(*) > 1
ORDER BY count(*) DESC
LIMIT 100;

-- 4 · Leads whose "website" is a social / directory page (they would have been
--     treated as duplicates of each other before the importer was fixed).
SELECT website, count(*) AS leads
FROM public.call_leads
WHERE website ~* '(facebook|instagram|linkedin|twitter|x|youtube|tiktok|linktr|behance|dribbble|clutch|upwork|yelp)\.(com|ee|co|net)'
GROUP BY website
ORDER BY count(*) DESC
LIMIT 50;

-- 5 · A lead called more than once on the same day (by the rep's calendar day,
--     Pakistan time). After migration 028 the queue prevents this; older rows
--     show how often it used to happen.
SELECT l.company_name, (a.created_at AT TIME ZONE 'Asia/Karachi')::date AS day, count(*) AS calls,
       array_agg(a.outcome ORDER BY a.created_at) AS outcomes
FROM public.call_activities a
JOIN public.call_leads l ON l.id = a.lead_id
GROUP BY l.company_name, l.id, (a.created_at AT TIME ZONE 'Asia/Karachi')::date
HAVING count(*) > 1
ORDER BY calls DESC, day DESC
LIMIT 100;

-- 6 · How much of the dialling is repeats? Share of each day's calls that went
--     to a lead already called before (a retry), versus a first call.
WITH c AS (
  SELECT a.*, row_number() OVER (PARTITION BY lead_id ORDER BY created_at) AS nth
  FROM public.call_activities a
)
SELECT (created_at AT TIME ZONE 'Asia/Karachi')::date AS day,
       count(*) AS dials,
       count(*) FILTER (WHERE nth = 1) AS first_calls,
       count(*) FILTER (WHERE nth > 1) AS repeat_calls,
       round(100.0 * count(*) FILTER (WHERE nth > 1) / count(*), 1) AS repeat_pct
FROM c
GROUP BY 1
ORDER BY 1 DESC
LIMIT 30;

-- 7 · Leads stuck in retry: called 3+ times, still going.
SELECT company_name, phone_e164, attempt_count, status, last_called_at, next_call_at
FROM public.call_leads
WHERE status = 'retry' AND attempt_count >= 3
ORDER BY attempt_count DESC, last_called_at DESC
LIMIT 50;
