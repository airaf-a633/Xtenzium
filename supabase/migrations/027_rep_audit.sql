-- ═══════════════════════════════════════════════════════════
-- 027 · Rep audit fixes
--
--   1. "Call again in 60/90 days" now happens: due nurture leads join
--      the queue (served with the retries).
--   2. log_call is safe to repeat: the same outcome on the same lead
--      by the same caller within 20 s returns the first result instead
--      of logging twice (lost response + retry, double key press, two
--      tabs). A do-not-call lead can't be logged back into the queue.
--   3. The queue never serves a number that is on the do-not-call list,
--      and an import can't re-create one.
--   4. Callbacks: most overdue first; one more than a day overdue waits
--      for the prospect's business hours like any other call.
--   5. A rep can't rewrite a lead directly (status, phone, counts...);
--      only tier / contact details / email. Admins and the RPCs are unaffected.
--   6. A wrong or changed phone number can be corrected (dialer_fix_phone).
--   7. A bad profile timezone can't break the queue.
--
-- Idempotent: safe to run twice.
-- ═══════════════════════════════════════════════════════════

-- ─── 2 · log_call wrapper ─────────────────────────────────
-- The existing function becomes log_call_core, untouched; the new log_call
-- guards and then calls it.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'log_call_core' AND pronamespace = 'public'::regnamespace) THEN
    ALTER FUNCTION public.log_call(uuid, text, text[], text, boolean, timestamptz, text, text, text)
      RENAME TO log_call_core;
  END IF;
END $$;

REVOKE ALL ON FUNCTION public.log_call_core(uuid, text, text[], text, boolean, timestamptz, text, text, text) FROM PUBLIC, anon, authenticated;

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
  -- 20 s unless a session says otherwise (the test suites set it to 0).
  win  integer := COALESCE(NULLIF(current_setting('dialer.dedupe_seconds', true), '')::integer, 20);
BEGIN
  IF NOT public.is_staff() THEN
    RAISE EXCEPTION 'Not allowed' USING ERRCODE = '42501';
  END IF;

  -- Serialises two tabs / devices working the same lead.
  SELECT * INTO l FROM public.call_leads WHERE id = p_lead_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That lead no longer exists';
  END IF;
  IF l.status = 'dnc' THEN
    RAISE EXCEPTION 'This number is on the do-not-call list';
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

  RETURN public.log_call_core(p_lead_id, p_outcome, p_tags, p_note, p_flagged, p_at,
                              p_contact_name, p_contact_title, p_contact_email);
END;
$$;

REVOKE ALL ON FUNCTION public.log_call(uuid, text, text[], text, boolean, timestamptz, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_call(uuid, text, text[], text, boolean, timestamptz, text, text, text) TO authenticated;

-- ─── 1, 3, 4, 7 · the queue ───────────────────────────────

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
    SELECT COALESCE(
      (SELECT p.timezone FROM public.profiles p JOIN pg_timezone_names z ON z.name = p.timezone WHERE p.id = auth.uid()),
      'Asia/Karachi') AS tz
  ),
  done AS (
    SELECT count(*)::int AS c
    FROM public.call_activities a, me
    WHERE a.caller_id = auth.uid()
      AND a.created_at >= (date_trunc('day', now() AT TIME ZONE me.tz) AT TIME ZONE me.tz)
  ),
  turn AS (
    SELECT (cfg.n > 0 AND ((done.c + COALESCE(p_assume_dials, 0)) % cfg.n) = cfg.n - 1) AS retry_turn
    FROM cfg, done
  )
  SELECT l.*
  FROM public.call_leads l, turn
  WHERE l.phone_e164 IS NOT NULL
    AND l.phone_is_us IS TRUE
    AND l.status IN ('new', 'retry', 'callback', 'nurture')
    AND (p_list_id IS NULL OR l.list_id = p_list_id)
    AND (p_tiers IS NULL OR COALESCE(l.tier, '-') = ANY (p_tiers))
    AND l.id <> ALL (COALESCE(p_skip, '{}'))
    AND (l.snoozed_until IS NULL OR l.snoozed_until <= now())
    AND (l.status = 'new' OR l.next_call_at <= now())
    AND NOT EXISTS (
      SELECT 1 FROM public.dnc_list d
      WHERE d.phone_e164 = l.phone_e164 OR (d.domain IS NOT NULL AND d.domain = l.domain)
    )
    AND (
      -- A callback has an agreed time, so it is served whatever the clock
      -- says — unless it is more than a day overdue, when the promise is stale.
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
    'none', count(*) FILTER (WHERE tier IS NULL)
  )
  FROM public.call_leads l
  WHERE (l.status IN ('new', 'retry', 'callback') OR (l.status = 'nurture' AND l.next_call_at <= now()))
    AND l.phone_is_us IS TRUE AND l.phone_e164 IS NOT NULL
    AND (l.snoozed_until IS NULL OR l.snoozed_until <= now())
    AND NOT EXISTS (SELECT 1 FROM public.dnc_list d WHERE d.phone_e164 = l.phone_e164 OR (d.domain IS NOT NULL AND d.domain = l.domain))
    AND (p_list_id IS NULL OR l.list_id = p_list_id);
$$;

-- ─── 3 · an import can't re-create a do-not-call lead ─────

CREATE OR REPLACE FUNCTION public.call_leads_block_dnc()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.dnc_list d
    WHERE (NEW.phone_e164 IS NOT NULL AND d.phone_e164 = NEW.phone_e164)
       OR (NEW.domain IS NOT NULL AND d.domain = NEW.domain)
  ) THEN
    RETURN NULL;     -- the row is silently skipped, like any other duplicate
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS call_leads_block_dnc ON public.call_leads;
CREATE TRIGGER call_leads_block_dnc
  BEFORE INSERT ON public.call_leads
  FOR EACH ROW EXECUTE FUNCTION public.call_leads_block_dnc();

-- ─── 5 · a rep can't rewrite a lead directly ──────────────
-- current_user is 'authenticated' for a request straight from the browser
-- and the function owner inside SECURITY DEFINER functions, so the RPCs
-- (log_call, undo, skip...) keep working.

CREATE OR REPLACE FUNCTION public.call_leads_guard_columns()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_user = 'authenticated' AND NOT public.is_admin() THEN
    IF (NEW.status, NEW.attempt_count, NEW.next_call_at, NEW.last_called_at, NEW.phone_raw, NEW.phone_e164,
        NEW.phone_is_us, NEW.domain, NEW.list_id, NEW.deal_id, NEW.assigned_to, NEW.snoozed_until,
        NEW.outreach_touches, NEW.outreach_due, NEW.outreach_last_at, NEW.timezone, NEW.score, NEW.company_name)
       IS DISTINCT FROM
       (OLD.status, OLD.attempt_count, OLD.next_call_at, OLD.last_called_at, OLD.phone_raw, OLD.phone_e164,
        OLD.phone_is_us, OLD.domain, OLD.list_id, OLD.deal_id, OLD.assigned_to, OLD.snoozed_until,
        OLD.outreach_touches, OLD.outreach_due, OLD.outreach_last_at, OLD.timezone, OLD.score, OLD.company_name) THEN
      RAISE EXCEPTION 'Leads can only be changed by logging a call' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS call_leads_guard_columns ON public.call_leads;
CREATE TRIGGER call_leads_guard_columns
  BEFORE UPDATE ON public.call_leads
  FOR EACH ROW EXECUTE FUNCTION public.call_leads_guard_columns();

-- ─── 6 · correcting a phone number ────────────────────────
-- The browser normalises (it already has the rules); the server checks.

CREATE OR REPLACE FUNCTION public.dialer_fix_phone(p_lead_id uuid, p_raw text, p_e164 text, p_is_us boolean)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE l public.call_leads;
BEGIN
  IF NOT public.is_staff() THEN
    RAISE EXCEPTION 'Not allowed' USING ERRCODE = '42501';
  END IF;
  IF p_e164 IS NULL OR p_e164 !~ '^\+[1-9][0-9]{7,14}$' THEN
    RAISE EXCEPTION 'That doesn’t look like a phone number';
  END IF;
  SELECT * INTO l FROM public.call_leads WHERE id = p_lead_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'That lead no longer exists'; END IF;
  IF EXISTS (SELECT 1 FROM public.dnc_list WHERE phone_e164 = p_e164) THEN
    RAISE EXCEPTION 'That number is on the do-not-call list';
  END IF;
  IF EXISTS (SELECT 1 FROM public.call_leads WHERE phone_e164 = p_e164 AND id <> p_lead_id) THEN
    RAISE EXCEPTION 'Another lead already has that number';
  END IF;

  UPDATE public.call_leads
  SET phone_raw = p_raw,
      phone_e164 = p_e164,
      phone_is_us = COALESCE(p_is_us, false),
      -- A lead parked as "unreadable number" is callable again once it has a good one.
      status = CASE WHEN status IN ('bad_data', 'no_phone') AND COALESCE(p_is_us, false) THEN 'new' ELSE status END
  WHERE id = p_lead_id;
  RETURN (SELECT status FROM public.call_leads WHERE id = p_lead_id);
END;
$$;

REVOKE ALL ON FUNCTION public.dialer_fix_phone(uuid, text, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dialer_fix_phone(uuid, text, text, boolean) TO authenticated;
