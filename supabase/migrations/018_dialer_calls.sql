-- ═══════════════════════════════════════════════════════════
-- 018 · Dialer — the call queue and outcome rules
--
-- Two functions carry the whole calling workflow, so the rules live in
-- one place and cannot drift between screens:
--
--   dialer_next_lead()  who to call next (order + business hours)
--   log_call()          what happens when an outcome is logged
--                       (status, retry date, follow-up task, deal, DNC)
--
-- Idempotent: safe to run twice.
-- ═══════════════════════════════════════════════════════════

-- ─── Business hours ───────────────────────────────────────
--
-- 9:00–17:00 local, Monday–Friday. A lead with no known timezone (HQ
-- was just "United States") is only offered in the window where every
-- mainland US zone is inside business hours: 12:00–17:00 Eastern,
-- which is 9:00–14:00 Pacific.

CREATE OR REPLACE FUNCTION public.dialer_in_window(p_tz text, p_at timestamptz DEFAULT now())
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT
    extract(isodow FROM (p_at AT TIME ZONE COALESCE(p_tz, 'America/New_York'))) BETWEEN 1 AND 5
    AND extract(hour FROM (p_at AT TIME ZONE COALESCE(p_tz, 'America/New_York')))
        BETWEEN (CASE WHEN p_tz IS NULL THEN 12 ELSE 9 END) AND 16;
$$;

-- Local calendar date after adding N business days (weekends skipped).
CREATE OR REPLACE FUNCTION public.dialer_add_business_days(p_from timestamptz, p_n integer, p_tz text)
RETURNS date
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  d date := (p_from AT TIME ZONE p_tz)::date;
  added integer := 0;
BEGIN
  WHILE added < p_n LOOP
    d := d + 1;
    IF extract(isodow FROM d) < 6 THEN added := added + 1; END IF;
  END LOOP;
  RETURN d;
END;
$$;

-- When a retry becomes due: N business days out, at a time of day that
-- changes with each attempt so a lead is not always caught at the same
-- hour (the point of calling again is to catch them at a different one).
CREATE OR REPLACE FUNCTION public.dialer_retry_at(p_tz text, p_days integer, p_attempt integer, p_has_tz boolean)
RETURNS timestamptz
LANGUAGE sql
STABLE
AS $$
  SELECT (
    (public.dialer_add_business_days(now(), p_days, p_tz))::timestamp
    + make_interval(hours => CASE
        WHEN p_has_tz THEN (ARRAY[10, 14, 11])[1 + (p_attempt % 3)]
        ELSE               (ARRAY[13, 15, 12])[1 + (p_attempt % 3)]
      END)
  ) AT TIME ZONE p_tz;
$$;

-- Calendar-day delay (nurture), rolled forward off a weekend, 10:00 local.
CREATE OR REPLACE FUNCTION public.dialer_nurture_at(p_tz text, p_days integer)
RETURNS timestamptz
LANGUAGE plpgsql
STABLE
AS $$
DECLARE d date := ((now() AT TIME ZONE p_tz)::date) + p_days;
BEGIN
  WHILE extract(isodow FROM d) > 5 LOOP d := d + 1; END LOOP;
  RETURN (d::timestamp + interval '10 hours') AT TIME ZONE p_tz;
END;
$$;

-- ─── Who to call next ─────────────────────────────────────
--
-- Order: callbacks that are due → fresh leads (tier A first, then
-- score) → retries that are due. Only US numbers are offered. Admins
-- can pass p_ignore_hours to test outside business hours; for anyone
-- else the flag is ignored — the rule is the rule.
-- SECURITY INVOKER: runs under the caller's own RLS.

CREATE OR REPLACE FUNCTION public.dialer_next_lead(
  p_skip uuid[] DEFAULT '{}',
  p_ignore_hours boolean DEFAULT false
)
RETURNS SETOF public.call_leads
LANGUAGE sql
STABLE
AS $$
  SELECT l.*
  FROM public.call_leads l
  WHERE l.phone_e164 IS NOT NULL
    AND l.phone_is_us IS TRUE
    AND l.status IN ('new', 'retry', 'callback')
    AND l.id <> ALL (COALESCE(p_skip, '{}'))
    AND (l.status = 'new' OR l.next_call_at <= now())
    -- A callback has an agreed time, so it is served whatever the clock says.
    AND (
      l.status = 'callback'
      OR (p_ignore_hours AND public.is_admin())
      OR public.dialer_in_window(l.timezone)
    )
  ORDER BY
    CASE l.status WHEN 'callback' THEN 0 WHEN 'new' THEN 1 ELSE 2 END,
    l.tier NULLS LAST,
    l.score DESC NULLS LAST,
    l.next_call_at NULLS FIRST,
    l.created_at
  LIMIT 1;
$$;

-- ─── Logging an outcome ───────────────────────────────────
--
-- SECURITY DEFINER because a call can create a deal, and deals are
-- admin-only. The guard on the first line is what keeps that safe:
-- only an active admin or caller can reach anything below it.

CREATE OR REPLACE FUNCTION public.log_call(
  p_lead_id        uuid,
  p_outcome        text,
  p_tags           text[]       DEFAULT '{}',
  p_note           text         DEFAULT NULL,
  p_flagged        boolean      DEFAULT false,
  p_at             timestamptz  DEFAULT NULL,   -- callback / meeting time
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
  l            public.call_leads;
  tz           text;
  has_tz       boolean;
  attempts     integer;
  new_status   text;
  due          timestamptz;
  followup     text;
  deal_stage   text;
  flag         boolean := COALESCE(p_flagged, false);
  me_name      text;
  fu_note      text;
  deal         public.deals;
  cur_rank     integer;
  new_rank     integer;
  stages       text[] := ARRAY['new', 'contacted', 'qualified', 'proposal_sent', 'negotiation', 'won'];
BEGIN
  IF NOT public.is_staff() THEN
    RAISE EXCEPTION 'Not allowed' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO l FROM public.call_leads WHERE id = p_lead_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Lead not found'; END IF;

  has_tz   := l.timezone IS NOT NULL;
  tz       := COALESCE(l.timezone, 'America/New_York');
  attempts := l.attempt_count + 1;
  SELECT full_name INTO me_name FROM public.profiles WHERE id = auth.uid();

  -- ── The outcome rules ──
  CASE p_outcome
    WHEN 'no_answer' THEN
      new_status := 'retry';  due := public.dialer_retry_at(tz, 1, attempts, has_tz);
    WHEN 'voicemail' THEN
      new_status := 'retry';  due := public.dialer_retry_at(tz, 2, attempts, has_tz);
    WHEN 'gatekeeper_name' THEN
      new_status := 'retry';  due := public.dialer_retry_at(tz, 1, attempts, has_tz);
    WHEN 'gatekeeper_blocked' THEN
      new_status := 'retry';  due := public.dialer_retry_at(tz, 3, attempts, has_tz);
    WHEN 'callback' THEN
      IF p_at IS NULL THEN RAISE EXCEPTION 'Pick a callback time'; END IF;
      new_status := 'callback'; due := p_at;
    WHEN 'interested_info' THEN
      new_status := 'followup'; followup := 'email_info'; deal_stage := 'contacted';
    WHEN 'interested_proposal' THEN
      new_status := 'followup'; followup := 'email_proposal'; deal_stage := 'qualified'; flag := true;
    WHEN 'meeting_booked' THEN
      IF p_at IS NULL THEN RAISE EXCEPTION 'Enter the meeting time'; END IF;
      new_status := 'meeting'; due := p_at; deal_stage := 'qualified'; flag := true;
    WHEN 'not_interested_inhouse' THEN
      new_status := 'lost';
    WHEN 'not_interested_outsources' THEN
      new_status := 'nurture'; due := public.dialer_nurture_at(tz, 90);
    WHEN 'not_interested_timing' THEN
      new_status := 'nurture'; due := public.dialer_nurture_at(tz, 60);
    WHEN 'not_fit' THEN
      new_status := 'disqualified';
    WHEN 'wrong_number' THEN
      new_status := 'bad_data';
    WHEN 'dnc' THEN
      new_status := 'dnc';
    ELSE
      RAISE EXCEPTION 'Unknown outcome %', p_outcome;
  END CASE;

  -- Six attempts and still no conversation: stop dialling, send one
  -- last email instead.
  IF new_status = 'retry' AND attempts >= 6 THEN
    new_status := 'exhausted'; due := NULL; followup := 'email_info';
    fu_note := 'Last touch — no conversation after ' || attempts || ' call attempts.';
  END IF;

  -- ── The lead ──
  UPDATE public.call_leads SET
    status         = new_status,
    attempt_count  = attempts,
    last_called_at = now(),
    next_call_at   = due,
    contact_name   = COALESCE(NULLIF(btrim(p_contact_name), ''), contact_name),
    contact_title  = COALESCE(NULLIF(btrim(p_contact_title), ''), contact_title),
    email          = COALESCE(NULLIF(lower(btrim(p_contact_email)), ''), email)
  WHERE id = l.id;

  -- ── The call log (append-only) ──
  INSERT INTO public.call_activities (lead_id, caller_id, outcome, reason_tags, note, flagged)
  VALUES (l.id, auth.uid(), p_outcome, COALESCE(p_tags, '{}'), NULLIF(btrim(p_note), ''), flag);

  -- ── Follow-up task for the owner (never queue the same one twice) ──
  IF followup IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM public.followup_queue
       WHERE lead_id = l.id AND type = followup AND status = 'queued'
     )
  THEN
    INSERT INTO public.followup_queue (lead_id, type, note, requested_by)
    VALUES (l.id, followup, COALESCE(fu_note, NULLIF(btrim(p_note), '')), auth.uid());
  END IF;

  -- ── Do not call: permanent, by phone and by website ──
  IF new_status = 'dnc' THEN
    IF l.phone_e164 IS NOT NULL THEN
      INSERT INTO public.dnc_list (phone_e164, reason) VALUES (l.phone_e164, p_note) ON CONFLICT DO NOTHING;
    END IF;
    IF l.domain IS NOT NULL THEN
      INSERT INTO public.dnc_list (domain, reason) VALUES (l.domain, p_note) ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  -- ── Pipeline: interest becomes a deal, and a deal only moves forward ──
  IF deal_stage IS NOT NULL THEN
    IF l.deal_id IS NULL THEN
      INSERT INTO public.deals (
        title, company, contact_name, contact_email, contact_phone,
        stage, probability, source, next_action, next_action_date
      ) VALUES (
        l.company_name, l.company_name,
        COALESCE(NULLIF(btrim(p_contact_name), ''), l.contact_name),
        COALESCE(NULLIF(lower(btrim(p_contact_email)), ''), l.email),
        l.phone_raw,
        deal_stage,
        CASE deal_stage WHEN 'qualified' THEN 25 ELSE 10 END,
        'outbound',
        CASE p_outcome
          WHEN 'interested_info'     THEN 'Send info email'
          WHEN 'interested_proposal' THEN 'Send proposal'
          ELSE 'Hold the meeting'
        END,
        CASE WHEN due IS NOT NULL THEN (due AT TIME ZONE 'UTC')::date ELSE current_date + 1 END
      )
      RETURNING * INTO deal;

      UPDATE public.call_leads SET deal_id = deal.id WHERE id = l.id;
      INSERT INTO public.deal_activities (deal_id, type, content, created_by)
      VALUES (deal.id, 'created', 'Created from a cold call', me_name);
    ELSE
      SELECT * INTO deal FROM public.deals WHERE id = l.deal_id;
      cur_rank := array_position(stages, deal.stage);
      new_rank := array_position(stages, deal_stage);
      IF cur_rank IS NOT NULL AND new_rank > cur_rank THEN
        UPDATE public.deals SET stage = deal_stage WHERE id = deal.id;
      END IF;
    END IF;

    INSERT INTO public.deal_activities (deal_id, type, content, created_by)
    VALUES (
      deal.id,
      CASE WHEN p_outcome = 'meeting_booked' THEN 'meeting' ELSE 'call' END,
      initcap(replace(p_outcome, '_', ' ')) || COALESCE(' — ' || NULLIF(btrim(p_note), ''), ''),
      me_name
    );
  END IF;

  RETURN jsonb_build_object(
    'status', new_status,
    'next_call_at', due,
    'followup', followup,
    'deal_id', COALESCE(deal.id, l.deal_id),
    'attempts', attempts
  );
END;
$$;

REVOKE ALL ON FUNCTION
  public.dialer_in_window(text, timestamptz),
  public.dialer_add_business_days(timestamptz, integer, text),
  public.dialer_retry_at(text, integer, integer, boolean),
  public.dialer_nurture_at(text, integer),
  public.dialer_next_lead(uuid[], boolean),
  public.log_call(uuid, text, text[], text, boolean, timestamptz, text, text, text)
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION
  public.dialer_in_window(text, timestamptz),
  public.dialer_add_business_days(timestamptz, integer, text),
  public.dialer_retry_at(text, integer, integer, boolean),
  public.dialer_nurture_at(text, integer),
  public.dialer_next_lead(uuid[], boolean),
  public.log_call(uuid, text, text[], text, boolean, timestamptz, text, text, text)
TO authenticated;
