-- ═══════════════════════════════════════════════════════════
-- 028 · Parked tier, segments, inbound calls, no repeats
--
--   1. Tier D = parked. Kept in the CRM, never dialled unless the rep
--      ticks the D chip. Leaves the "queued" counts.
--   2. segment (agency / dev_shop) on leads and, optionally, on scripts.
--      Set per import; shown on the call screen; broken out in reports.
--   3. The queue never serves the same lead twice in one day, except a
--      callback someone promised.
--   4. dialer_create_lead(): someone rings back from a number we hadn't
--      dialled (or a lead that isn't in the system) — create it, or find
--      the existing one, so the rep can log the call.
--
-- Idempotent: safe to run twice.
-- ═══════════════════════════════════════════════════════════

-- ─── 1 · tier D ───────────────────────────────────────────

ALTER TABLE public.call_leads DROP CONSTRAINT IF EXISTS call_leads_tier_check;
ALTER TABLE public.call_leads ADD CONSTRAINT call_leads_tier_check CHECK (tier IN ('A', 'B', 'C', 'D'));

-- ─── 2 · segment ──────────────────────────────────────────

ALTER TABLE public.call_leads   ADD COLUMN IF NOT EXISTS segment text;
ALTER TABLE public.call_scripts ADD COLUMN IF NOT EXISTS segment text;
ALTER TABLE public.call_leads   DROP CONSTRAINT IF EXISTS call_leads_segment_check;
ALTER TABLE public.call_leads   ADD CONSTRAINT call_leads_segment_check CHECK (segment IS NULL OR segment IN ('agency', 'dev_shop'));
ALTER TABLE public.call_scripts DROP CONSTRAINT IF EXISTS call_scripts_segment_check;
ALTER TABLE public.call_scripts ADD CONSTRAINT call_scripts_segment_check CHECK (segment IS NULL OR segment IN ('agency', 'dev_shop'));

-- The import function, now carrying segment (and the D tier through the check above).
CREATE OR REPLACE FUNCTION public.import_call_leads(p_list_id uuid, p_rows jsonb)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE inserted integer;
BEGIN
  WITH ins AS (
    INSERT INTO public.call_leads (
      list_id, company_name, phone_raw, phone_e164, phone_is_us, email, website, domain,
      contact_url, profile_url, hq, state, timezone, team_size, hourly_rate_usd, services,
      works_count, tier, score, why, source, extra, status, segment
    )
    SELECT
      p_list_id, r.company_name, r.phone_raw, r.phone_e164, r.phone_is_us, r.email, r.website, r.domain,
      r.contact_url, r.profile_url, r.hq, r.state, r.timezone, r.team_size, r.hourly_rate_usd, r.services,
      r.works_count, r.tier, r.score, r.why, r.source, COALESCE(r.extra, '{}'::jsonb),
      COALESCE(r.status, 'new'), r.segment
    FROM jsonb_to_recordset(p_rows) AS r(
      company_name text, phone_raw text, phone_e164 text, phone_is_us boolean, email text,
      website text, domain text, contact_url text, profile_url text, hq text, state text,
      timezone text, team_size text, hourly_rate_usd numeric, services text, works_count integer,
      tier text, score integer, why text, source text, extra jsonb, status text, segment text
    )
    ON CONFLICT DO NOTHING
    RETURNING 1
  )
  SELECT count(*) INTO inserted FROM ins;
  RETURN inserted;
END;
$$;

-- ─── 1+3 · the queue ──────────────────────────────────────

CREATE OR REPLACE FUNCTION public.dialer_next_lead(
  p_skip          uuid[]  DEFAULT '{}',
  p_ignore_hours  boolean DEFAULT false,
  p_list_id       uuid    DEFAULT NULL,
  p_tiers         text[]  DEFAULT NULL,
  p_assume_dials  integer DEFAULT 0
)
RETURNS SETOF public.call_leads
LANGUAGE sql
STABLE
AS $$
  WITH cfg AS (
    SELECT COALESCE((SELECT retry_every FROM public.dialer_settings LIMIT 1), 3) AS n
  ),
  me AS (
    SELECT tz, (date_trunc('day', now() AT TIME ZONE tz) AT TIME ZONE tz) AS day_start
    FROM (SELECT COALESCE(
      (SELECT p.timezone FROM public.profiles p JOIN pg_timezone_names z ON z.name = p.timezone WHERE p.id = auth.uid()),
      'Asia/Karachi') AS tz) t
  ),
  done AS (
    SELECT count(*)::int AS c
    FROM public.call_activities a, me
    WHERE a.caller_id = auth.uid() AND a.created_at >= me.day_start
  ),
  turn AS (
    SELECT (cfg.n > 0 AND ((done.c + COALESCE(p_assume_dials, 0)) % cfg.n) = cfg.n - 1) AS retry_turn
    FROM cfg, done
  )
  SELECT l.*
  FROM public.call_leads l, turn, me
  WHERE l.phone_e164 IS NOT NULL
    AND l.phone_is_us IS TRUE
    AND l.status IN ('new', 'retry', 'callback', 'nurture')
    AND (p_list_id IS NULL OR l.list_id = p_list_id)
    -- Parked (D) leads are dialled only when D is asked for by name.
    AND (
      (p_tiers IS NULL AND (l.tier IS DISTINCT FROM 'D' OR l.status = 'callback'))
      OR (p_tiers IS NOT NULL AND COALESCE(l.tier, '-') = ANY (p_tiers))
    )
    AND l.id <> ALL (COALESCE(p_skip, '{}'))
    AND (l.snoozed_until IS NULL OR l.snoozed_until <= now())
    AND (l.status = 'new' OR l.next_call_at <= now())
    -- Never the same lead twice in one of ITS days (the prospect's local date, so the
    -- rep's after-midnight calls don't push a due retry out by a day) — except a promised callback.
    AND (
      l.status = 'callback' OR l.last_called_at IS NULL
      OR (l.last_called_at AT TIME ZONE COALESCE(l.timezone, 'America/New_York'))::date
         < (now() AT TIME ZONE COALESCE(l.timezone, 'America/New_York'))::date
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.dnc_list d
      WHERE d.phone_e164 = l.phone_e164 OR (d.domain IS NOT NULL AND d.domain = l.domain)
    )
    AND (
      (l.status = 'callback' AND l.next_call_at > now() - interval '1 day')
      OR (p_ignore_hours AND public.is_admin())
      OR public.dialer_in_window(l.timezone)
    )
  ORDER BY
    CASE
      WHEN l.status = 'callback' THEN 0
      WHEN l.status IN ('retry', 'nurture') THEN CASE WHEN turn.retry_turn THEN 1 ELSE 2 END
      ELSE CASE WHEN turn.retry_turn THEN 2 ELSE 1 END
    END,
    CASE WHEN l.status = 'callback' THEN l.next_call_at END,
    l.tier NULLS LAST,
    l.score DESC NULLS LAST,
    l.next_call_at NULLS FIRST,
    l.created_at
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.dialer_tier_counts(p_list_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  SELECT jsonb_build_object(
    'A',    count(*) FILTER (WHERE tier = 'A'),
    'B',    count(*) FILTER (WHERE tier = 'B'),
    'C',    count(*) FILTER (WHERE tier = 'C'),
    'D',    count(*) FILTER (WHERE tier = 'D'),
    'none', count(*) FILTER (WHERE tier IS NULL)
  )
  FROM public.call_leads l
  WHERE (l.status IN ('new', 'retry', 'callback') OR (l.status = 'nurture' AND l.next_call_at <= now()))
    AND l.phone_is_us IS TRUE AND l.phone_e164 IS NOT NULL
    AND (l.snoozed_until IS NULL OR l.snoozed_until <= now())
    AND NOT EXISTS (SELECT 1 FROM public.dnc_list d WHERE d.phone_e164 = l.phone_e164 OR (d.domain IS NOT NULL AND d.domain = l.domain))
    AND (p_list_id IS NULL OR l.list_id = p_list_id);
$$;

-- "Queued" and "callable now" leave parked leads out; 'parked' counts them.
CREATE OR REPLACE FUNCTION public.dialer_list_summary()
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(jsonb_agg(x ORDER BY (x->>'created_at') DESC), '[]'::jsonb)
  FROM (
    SELECT jsonb_build_object(
      'id', cl.id,
      'name', cl.name,
      'created_at', cl.created_at,
      'in_play', count(l.id) FILTER (
        WHERE l.status IN ('new', 'retry', 'callback') AND l.phone_is_us IS TRUE AND l.phone_e164 IS NOT NULL
          AND l.tier IS DISTINCT FROM 'D'),
      'callable_now', count(l.id) FILTER (
        WHERE l.status IN ('new', 'retry', 'callback') AND l.phone_is_us IS TRUE AND l.phone_e164 IS NOT NULL
          AND l.tier IS DISTINCT FROM 'D'
          AND (l.status = 'new' OR l.next_call_at <= now())
          AND (l.status = 'callback' OR public.dialer_in_window(l.timezone))),
      'parked', count(l.id) FILTER (WHERE l.tier = 'D' AND l.status IN ('new', 'retry', 'callback'))
    ) AS x
    FROM public.call_lists cl
    LEFT JOIN public.call_leads l ON l.list_id = cl.id
    GROUP BY cl.id
  ) s;
$$;

-- Bulk re-tier now knows D.
CREATE OR REPLACE FUNCTION public.retier_leads(p_list_id uuid, p_from text, p_to text)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE n integer;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admins only' USING ERRCODE = '42501';
  END IF;
  IF p_from NOT IN ('A', 'B', 'C', 'D', '-', '*') OR p_to NOT IN ('A', 'B', 'C', 'D', '-') THEN
    RAISE EXCEPTION 'Tiers are A, B, C, D or - (none)';
  END IF;
  UPDATE public.call_leads SET tier = NULLIF(p_to, '-')
  WHERE list_id = p_list_id AND (p_from = '*' OR COALESCE(tier, '-') = p_from);
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

-- ─── 4 · an inbound / hand-entered lead ───────────────────
-- Returns {lead: <row>, existing: bool}. The same phone number or website
-- as a lead we already have returns THAT lead, so a call-back is logged
-- against its history instead of creating a twin.

CREATE OR REPLACE FUNCTION public.dialer_create_lead(
  p_company        text,
  p_phone_raw      text,
  p_e164           text,
  p_is_us          boolean,
  p_contact_name   text DEFAULT NULL,
  p_contact_title  text DEFAULT NULL,
  p_email          text DEFAULT NULL,
  p_website        text DEFAULT NULL,
  p_domain         text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  l       public.call_leads;
  list_id uuid;
  company text := btrim(COALESCE(p_company, ''));
BEGIN
  IF NOT public.is_staff() THEN
    RAISE EXCEPTION 'Not allowed' USING ERRCODE = '42501';
  END IF;
  IF company = '' THEN
    RAISE EXCEPTION 'A company name is needed';
  END IF;
  IF p_e164 IS NOT NULL AND p_e164 !~ '^\+[1-9][0-9]{7,14}$' THEN
    RAISE EXCEPTION 'That doesn’t look like a phone number';
  END IF;
  IF p_e164 IS NULL AND NULLIF(btrim(COALESCE(p_email, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Give a phone number or an email';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.dnc_list d
    WHERE (p_e164 IS NOT NULL AND d.phone_e164 = p_e164) OR (p_domain IS NOT NULL AND d.domain = p_domain)
  ) THEN
    RAISE EXCEPTION 'That number or website is on the do-not-call list';
  END IF;

  SELECT * INTO l FROM public.call_leads
  WHERE (p_e164 IS NOT NULL AND phone_e164 = p_e164) OR (p_domain IS NOT NULL AND domain = p_domain)
  ORDER BY (phone_e164 = p_e164) DESC NULLS LAST
  LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object('lead', to_jsonb(l), 'existing', true);
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('dialer_inbound_list'));
  SELECT id INTO list_id FROM public.call_lists WHERE name = 'Inbound & hand-entered' ORDER BY created_at LIMIT 1;
  IF list_id IS NULL THEN
    INSERT INTO public.call_lists (name) VALUES ('Inbound & hand-entered') RETURNING id INTO list_id;
  END IF;

  INSERT INTO public.call_leads (
    list_id, company_name, phone_raw, phone_e164, phone_is_us, email, website, domain,
    contact_name, contact_title, source, status
  ) VALUES (
    list_id, company, NULLIF(btrim(COALESCE(p_phone_raw, '')), ''), p_e164, CASE WHEN p_e164 IS NULL THEN NULL ELSE COALESCE(p_is_us, false) END,
    lower(NULLIF(btrim(COALESCE(p_email, '')), '')), NULLIF(btrim(COALESCE(p_website, '')), ''), p_domain,
    NULLIF(btrim(COALESCE(p_contact_name, '')), ''), NULLIF(btrim(COALESCE(p_contact_title, '')), ''),
    'inbound', CASE WHEN p_e164 IS NULL THEN 'no_phone' ELSE 'new' END
  ) RETURNING * INTO l;

  IF l.id IS NULL THEN
    RAISE EXCEPTION 'That number or website is not allowed (do-not-call, or already taken)';
  END IF;
  RETURN jsonb_build_object('lead', to_jsonb(l), 'existing', false);
EXCEPTION WHEN unique_violation THEN
  SELECT * INTO l FROM public.call_leads
  WHERE (p_e164 IS NOT NULL AND phone_e164 = p_e164) OR (p_domain IS NOT NULL AND domain = p_domain)
  LIMIT 1;
  IF l.id IS NULL THEN RAISE; END IF;
  RETURN jsonb_build_object('lead', to_jsonb(l), 'existing', true);
END;
$$;

REVOKE ALL ON FUNCTION public.dialer_create_lead(text, text, text, boolean, text, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dialer_create_lead(text, text, text, boolean, text, text, text, text, text) TO authenticated;

-- ─── 2 · reports by segment ───────────────────────────────

CREATE OR REPLACE FUNCTION public.dialer_report_segments(p_from timestamptz, p_to timestamptz)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admins only' USING ERRCODE = '42501';
  END IF;
  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object('segment', COALESCE(segment, 'unset'), 'dials', dials, 'conversations', convos, 'meetings', meets) ORDER BY dials DESC)
    FROM (
      SELECT l.segment,
             count(*) AS dials,
             count(*) FILTER (WHERE ca.outcome NOT IN ('no_answer', 'voicemail', 'gatekeeper_name', 'gatekeeper_blocked', 'wrong_number')) AS convos,
             count(*) FILTER (WHERE ca.outcome = 'meeting_booked') AS meets
      FROM public.call_activities ca
      JOIN public.call_leads l ON l.id = ca.lead_id
      WHERE ca.created_at >= p_from AND ca.created_at < p_to
      GROUP BY l.segment
    ) s
  ), '[]'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.dialer_report_segments(timestamptz, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dialer_report_segments(timestamptz, timestamptz) TO authenticated;

-- ─── Fixes from the second sweep ──────────────────────────

-- Re-tiering by score must not un-park D leads.
CREATE OR REPLACE FUNCTION public.retier_by_score(p_list_id uuid, p_a integer, p_b integer)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE n integer;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admins only' USING ERRCODE = '42501';
  END IF;
  IF p_a IS NULL OR p_b IS NULL OR p_a < p_b THEN
    RAISE EXCEPTION 'The A threshold must be at least the B threshold';
  END IF;
  UPDATE public.call_leads
  SET tier = CASE WHEN score >= p_a THEN 'A' WHEN score >= p_b THEN 'B' ELSE 'C' END
  WHERE list_id = p_list_id AND score IS NOT NULL AND tier IS DISTINCT FROM 'D';
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

-- A due nurture lead can be skipped like any other.
CREATE OR REPLACE FUNCTION public.dialer_skip_lead(p_lead_id uuid)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tz   text;
  till timestamptz;
BEGIN
  IF NOT public.is_staff() THEN
    RAISE EXCEPTION 'Not allowed' USING ERRCODE = '42501';
  END IF;
  tz := COALESCE((SELECT p.timezone FROM public.profiles p JOIN pg_timezone_names z ON z.name = p.timezone WHERE p.id = auth.uid()), 'Asia/Karachi');
  till := (date_trunc('day', now() AT TIME ZONE tz) + interval '1 day') AT TIME ZONE tz;
  UPDATE public.call_leads
  SET snoozed_until = till
  WHERE id = p_lead_id AND status IN ('new', 'retry', 'callback', 'nurture');
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That lead is not in the queue';
  END IF;
  RETURN till;
END;
$$;

-- log_call: the duplicate check now comes BEFORE the do-not-call refusal, so a
-- retry of a DNC log whose response was lost returns the first result.
CREATE OR REPLACE FUNCTION public.log_call(
  p_lead_id        uuid,
  p_outcome        text,
  p_tags           text[]       DEFAULT '{}',
  p_note           text         DEFAULT NULL,
  p_flagged        boolean      DEFAULT false,
  p_at             timestamptz  DEFAULT NULL,
  p_contact_name   text         DEFAULT NULL,
  p_contact_title  text         DEFAULT NULL,
  p_contact_email  text         DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  l    public.call_leads;
  prev public.call_activities;
  win  integer := COALESCE(NULLIF(current_setting('dialer.dedupe_seconds', true), '')::integer, 20);
BEGIN
  IF NOT public.is_staff() THEN
    RAISE EXCEPTION 'Not allowed' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO l FROM public.call_leads WHERE id = p_lead_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That lead no longer exists';
  END IF;

  IF win > 0 THEN
    SELECT * INTO prev
    FROM public.call_activities
    WHERE lead_id = p_lead_id AND caller_id = auth.uid() AND outcome = p_outcome
      AND created_at > now() - make_interval(secs => win)
    ORDER BY created_at DESC
    LIMIT 1;
  END IF;
  IF prev.id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'status', l.status, 'next_call_at', l.next_call_at, 'followup', NULL,
      'deal_id', l.deal_id, 'attempts', l.attempt_count, 'mentioned', 0,
      'activity_id', prev.id, 'duplicate', true
    );
  END IF;

  IF l.status = 'dnc' THEN
    RAISE EXCEPTION 'This number is on the do-not-call list';
  END IF;

  RETURN public.log_call_core(p_lead_id, p_outcome, p_tags, p_note, p_flagged, p_at,
                              p_contact_name, p_contact_title, p_contact_email);
END;
$$;

-- The email worklist leaves parked (D) leads out unless D is asked for by name.
CREATE OR REPLACE FUNCTION public.outreach_list(
  p_tab     text,
  p_limit   integer DEFAULT 50,
  p_offset  integer DEFAULT 0,
  p_tiers   text[]  DEFAULT NULL,
  p_search  text    DEFAULT NULL
)
RETURNS SETOF public.call_leads
LANGUAGE sql
STABLE
AS $$
  SELECT l.*
  FROM public.call_leads l
  WHERE public.outreach_in_play(l.status)
    AND ((p_tiers IS NULL AND l.tier IS DISTINCT FROM 'D') OR (p_tiers IS NOT NULL AND COALESCE(l.tier, '-') = ANY (p_tiers)))
    AND (p_search IS NULL OR p_search = ''
         OR l.company_name ILIKE '%' || p_search || '%' OR l.domain ILIKE '%' || p_search || '%')
    AND CASE p_tab
      WHEN 'to_email' THEN
        l.outreach_touches = 0 AND l.email IS NOT NULL
        AND (l.phone_e164 IS NULL OR l.phone_is_us IS NOT TRUE) AND l.status IN ('no_phone', 'new', 'retry')
      WHEN 'find_email' THEN
        l.outreach_touches = 0 AND l.email IS NULL
        AND (
          ((l.phone_e164 IS NULL OR l.phone_is_us IS NOT TRUE) AND l.status IN ('no_phone', 'new', 'retry'))
          OR (l.status = 'retry' AND l.phone_is_us IS TRUE AND public.email_after_attempts() > 0
              AND l.attempt_count >= public.email_after_attempts())
        )
      WHEN 'due' THEN
        l.outreach_touches > 0 AND l.outreach_due IS NOT NULL AND l.outreach_due <= now()
      WHEN 'waiting' THEN
        l.outreach_touches > 0 AND l.outreach_due IS NOT NULL AND l.outreach_due > now()
      WHEN 'after_call' THEN
        l.status = 'retry' AND l.outreach_touches = 0 AND l.email IS NOT NULL
        AND l.phone_e164 IS NOT NULL AND l.phone_is_us IS TRUE
        AND public.email_after_attempts() > 0 AND l.attempt_count >= public.email_after_attempts()
      ELSE false
    END
  ORDER BY
    CASE WHEN p_tab = 'due' THEN l.outreach_due END ASC NULLS LAST,
    l.tier NULLS LAST,
    l.score DESC NULLS LAST,
    l.created_at
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 50), 1), 200)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0);
$$;

CREATE OR REPLACE FUNCTION public.outreach_counts(p_tiers text[] DEFAULT NULL)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  SELECT jsonb_build_object(
    'to_email',   count(*) FILTER (WHERE l.outreach_touches = 0 AND l.email IS NOT NULL
                    AND (l.phone_e164 IS NULL OR l.phone_is_us IS NOT TRUE) AND l.status IN ('no_phone', 'new', 'retry')),
    'find_email', count(*) FILTER (WHERE l.outreach_touches = 0 AND l.email IS NULL AND (
                    ((l.phone_e164 IS NULL OR l.phone_is_us IS NOT TRUE) AND l.status IN ('no_phone', 'new', 'retry'))
                    OR (l.status = 'retry' AND l.phone_is_us IS TRUE AND public.email_after_attempts() > 0
                        AND l.attempt_count >= public.email_after_attempts()))),
    'due',        count(*) FILTER (WHERE l.outreach_touches > 0 AND l.outreach_due IS NOT NULL AND l.outreach_due <= now()),
    'waiting',    count(*) FILTER (WHERE l.outreach_touches > 0 AND l.outreach_due IS NOT NULL AND l.outreach_due > now()),
    'after_call', count(*) FILTER (WHERE l.status = 'retry' AND l.outreach_touches = 0 AND l.email IS NOT NULL
                    AND l.phone_e164 IS NOT NULL AND l.phone_is_us IS TRUE
                    AND public.email_after_attempts() > 0 AND l.attempt_count >= public.email_after_attempts()),
    'sent_today', (SELECT count(*) FROM public.outreach_activities a
                   WHERE a.action IN ('emailed', 'followed_up', 'form_sent')
                     AND a.created_at >= date_trunc('day', now() AT TIME ZONE 'Asia/Karachi') AT TIME ZONE 'Asia/Karachi')
  )
  FROM public.call_leads l
  WHERE public.outreach_in_play(l.status)
    AND ((p_tiers IS NULL AND l.tier IS DISTINCT FROM 'D') OR (p_tiers IS NOT NULL AND COALESCE(l.tier, '-') = ANY (p_tiers)));
$$;

-- A rep can't re-segment leads or rewrite what the file carried.
CREATE OR REPLACE FUNCTION public.call_leads_guard_columns()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_user = 'authenticated' AND NOT public.is_admin() THEN
    IF (NEW.status, NEW.attempt_count, NEW.next_call_at, NEW.last_called_at, NEW.phone_raw, NEW.phone_e164,
        NEW.phone_is_us, NEW.domain, NEW.list_id, NEW.deal_id, NEW.assigned_to, NEW.snoozed_until,
        NEW.outreach_touches, NEW.outreach_due, NEW.outreach_last_at, NEW.timezone, NEW.score, NEW.company_name,
        NEW.segment, NEW.extra, NEW.source, NEW.state)
       IS DISTINCT FROM
       (OLD.status, OLD.attempt_count, OLD.next_call_at, OLD.last_called_at, OLD.phone_raw, OLD.phone_e164,
        OLD.phone_is_us, OLD.domain, OLD.list_id, OLD.deal_id, OLD.assigned_to, OLD.snoozed_until,
        OLD.outreach_touches, OLD.outreach_due, OLD.outreach_last_at, OLD.timezone, OLD.score, OLD.company_name,
        OLD.segment, OLD.extra, OLD.source, OLD.state) THEN
      RAISE EXCEPTION 'Leads can only be changed by logging a call' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
