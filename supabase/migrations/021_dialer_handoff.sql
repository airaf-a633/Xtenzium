-- ═══════════════════════════════════════════════════════════
-- 021 · Dialer — handing work to the team
--
-- Three things:
--
--   1. A new outcome, "interested_call": the prospect wants a call with
--      us. It queues an owner-call task (follow-up type admin_call) and
--      creates a deal, like the email outcomes do.
--
--   2. @mentions. A rep writes "@Airaf ..." (or @Sharab, @Umar) in a
--      call note. log_call() finds the team members named, then:
--        · notifies each of them (the bell, live),
--        · assigns the follow-up task and the deal to the first one,
--        · flags the call so it shows in the Inbox's Flagged tab.
--
--   3. dialer_mentionables() lets the rep's note box suggest names
--      without giving the rep read access to team_members, and
--      dialer_assign_followup() lets an admin hand a task to someone.
--
-- Everything else in log_call() and dialer_report() is carried over
-- unchanged. Idempotent: safe to run twice.
-- ═══════════════════════════════════════════════════════════

-- ─── Notifications can be about a lead / a follow-up ──────

ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_entity_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_entity_type_check
  CHECK (entity_type IN ('task', 'deal', 'project', 'lead'));

ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('mention', 'assignment', 'deal_stage', 'deal_owner', 'comment', 'followup'));

-- ─── Who is handling a follow-up ──────────────────────────

ALTER TABLE public.followup_queue
  ADD COLUMN IF NOT EXISTS assignee_id uuid REFERENCES public.team_members(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS followup_queue_assignee_idx
  ON public.followup_queue (assignee_id) WHERE status = 'queued';

-- ─── Helpers ──────────────────────────────────────────────

-- Escape a string for use inside a regular expression.
CREATE OR REPLACE FUNCTION public.dialer_re_escape(p text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT regexp_replace(p, '([.^$*+?(){}|\[\]\\])', '\\\1', 'g');
$$;

-- Names the rep can @mention. SECURITY DEFINER because team_members is
-- admin-only; this exposes names and ids, nothing else.
CREATE OR REPLACE FUNCTION public.dialer_mentionables()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_staff() THEN
    RAISE EXCEPTION 'Not allowed' USING ERRCODE = '42501';
  END IF;
  RETURN COALESCE(
    (SELECT jsonb_agg(jsonb_build_object('id', id, 'name', name) ORDER BY name) FROM public.team_members),
    '[]'::jsonb
  );
END;
$$;

-- Hand a queued follow-up to someone, and tell them. Admin only.
CREATE OR REPLACE FUNCTION public.dialer_assign_followup(p_id uuid, p_member uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item  public.followup_queue;
  co    text;
  actor uuid := public.current_member_id();
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admins only' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO item FROM public.followup_queue WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Follow-up not found'; END IF;

  UPDATE public.followup_queue SET assignee_id = p_member WHERE id = p_id;

  IF p_member IS NOT NULL AND (actor IS NULL OR actor <> p_member) THEN
    SELECT company_name INTO co FROM public.call_leads WHERE id = item.lead_id;
    INSERT INTO public.notifications (recipient_id, actor_id, type, entity_type, entity_id, title, body)
    VALUES (p_member, actor, 'followup', 'lead', item.lead_id, COALESCE(co, 'a lead'),
            CASE item.type
              WHEN 'email_info' THEN 'Send them our info'
              WHEN 'email_proposal' THEN 'Send them a proposal'
              WHEN 'admin_call' THEN 'Call them'
              ELSE 'Follow up'
            END || COALESCE(' — ' || left(item.note, 200), ''));
  END IF;
END;
$$;

-- ─── log_call: new outcome, @mentions, assignment ─────────

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
  cfg          public.dialer_settings;
  mentioned    uuid[];
  assignee     uuid;
  actor        uuid := public.current_member_id();
  m            uuid;
  asked        text;
BEGIN
  IF NOT public.is_staff() THEN
    RAISE EXCEPTION 'Not allowed' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO l FROM public.call_leads WHERE id = p_lead_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Lead not found'; END IF;

  SELECT * INTO cfg FROM public.dialer_settings LIMIT 1;
  has_tz   := l.timezone IS NOT NULL;
  tz       := COALESCE(l.timezone, 'America/New_York');
  attempts := l.attempt_count + 1;
  SELECT full_name INTO me_name FROM public.profiles WHERE id = auth.uid();

  -- ── @mentions in the note ──
  -- "@Airaf" or "@Airaf Adil", not inside an email address. A bare first name
  -- only counts while it is unique on the team (two Umars must be written in
  -- full). The first person named takes the follow-up and the deal; everyone
  -- named is notified.
  SELECT COALESCE(array_agg(t.id ORDER BY t.name), '{}') INTO mentioned
  FROM public.team_members t
  WHERE p_note IS NOT NULL
    AND (actor IS NULL OR t.id <> actor)
    AND p_note ~* ('(^|[^[:alnum:]._-])@(' || public.dialer_re_escape(t.name)
                   || CASE WHEN EXISTS (
                        SELECT 1 FROM public.team_members o
                        WHERE o.id <> t.id
                          AND lower(split_part(o.name, ' ', 1)) = lower(split_part(t.name, ' ', 1)))
                      THEN ''
                      ELSE '|' || public.dialer_re_escape(split_part(t.name, ' ', 1))
                      END
                   || ')\y');
  IF array_length(mentioned, 1) IS NOT NULL THEN
    flag := true;
    assignee := mentioned[1];
  END IF;

  -- ── The outcome rules ──
  CASE p_outcome
    WHEN 'no_answer' THEN
      new_status := 'retry';  due := public.dialer_retry_at(tz, cfg.no_answer_days, attempts, has_tz);
    WHEN 'voicemail' THEN
      new_status := 'retry';  due := public.dialer_retry_at(tz, cfg.voicemail_days, attempts, has_tz);
    WHEN 'gatekeeper_name' THEN
      new_status := 'retry';  due := public.dialer_retry_at(tz, cfg.gatekeeper_name_days, attempts, has_tz);
    WHEN 'gatekeeper_blocked' THEN
      new_status := 'retry';  due := public.dialer_retry_at(tz, cfg.gatekeeper_blocked_days, attempts, has_tz);
    WHEN 'callback' THEN
      IF p_at IS NULL THEN RAISE EXCEPTION 'Pick a callback time'; END IF;
      new_status := 'callback'; due := p_at;
    WHEN 'interested_info' THEN
      new_status := 'followup'; followup := 'email_info'; deal_stage := 'contacted';
    WHEN 'interested_proposal' THEN
      new_status := 'followup'; followup := 'email_proposal'; deal_stage := 'qualified'; flag := true;
    WHEN 'interested_call' THEN
      new_status := 'followup'; followup := 'admin_call'; deal_stage := 'qualified'; flag := true;
    WHEN 'meeting_booked' THEN
      IF p_at IS NULL THEN RAISE EXCEPTION 'Enter the meeting time'; END IF;
      new_status := 'meeting'; due := p_at; deal_stage := 'qualified'; flag := true;
    WHEN 'not_interested_inhouse' THEN
      new_status := 'lost';
    WHEN 'not_interested_outsources' THEN
      new_status := 'nurture'; due := public.dialer_nurture_at(tz, cfg.nurture_outsources_days);
    WHEN 'not_interested_timing' THEN
      new_status := 'nurture'; due := public.dialer_nurture_at(tz, cfg.nurture_timing_days);
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
  IF new_status = 'retry' AND attempts >= cfg.max_attempts THEN
    new_status := 'exhausted'; due := NULL; followup := 'email_info';
    fu_note := 'Last touch — no conversation after ' || attempts || ' call attempts.';
  END IF;

  -- The chips the rep ticked travel with the task.
  IF followup IS NOT NULL AND fu_note IS NULL THEN
    asked := array_to_string(COALESCE(p_tags, '{}'), ', ');
    fu_note := NULLIF(concat_ws(E'\n',
      CASE WHEN asked <> '' THEN 'Tags: ' || asked END,
      NULLIF(btrim(p_note), '')), '');
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

  -- Whoever was @mentioned takes the task (including one already queued).
  IF followup IS NOT NULL AND assignee IS NOT NULL THEN
    UPDATE public.followup_queue SET assignee_id = assignee
    WHERE lead_id = l.id AND type = followup AND status = 'queued' AND assignee_id IS NULL;
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
        stage, probability, source, next_action, next_action_date, owner_id
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
          WHEN 'interested_call'     THEN 'Call them'
          ELSE 'Hold the meeting'
        END,
        CASE WHEN due IS NOT NULL THEN (due AT TIME ZONE 'UTC')::date ELSE current_date + 1 END,
        assignee
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
      IF assignee IS NOT NULL THEN
        UPDATE public.deals SET owner_id = assignee WHERE id = deal.id AND owner_id IS NULL;
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

  -- ── Tell everyone who was @mentioned (the bell lights up live) ──
  FOREACH m IN ARRAY mentioned LOOP
    INSERT INTO public.notifications (recipient_id, actor_id, type, entity_type, entity_id, title, body)
    VALUES (m, actor, 'mention', 'lead', l.id, l.company_name, left(COALESCE(p_note, ''), 280));
  END LOOP;

  RETURN jsonb_build_object(
    'status', new_status,
    'next_call_at', due,
    'followup', followup,
    'deal_id', COALESCE(deal.id, l.deal_id),
    'attempts', attempts,
    'mentioned', COALESCE(array_length(mentioned, 1), 0)
  );
END;
$$;

-- ─── dialer_report: "interested" now includes call requests ──

CREATE OR REPLACE FUNCTION public.dialer_report(
  p_from timestamptz,
  p_to   timestamptz,
  p_tz   text DEFAULT 'Asia/Karachi'
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
DECLARE result jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admins only' USING ERRCODE = '42501';
  END IF;

  WITH a AS (
    SELECT
      ca.*,
      l.tier, l.list_id, l.deal_id,
      COALESCE(l.timezone, 'America/New_York') AS ltz,
      (ca.outcome NOT IN ('no_answer', 'voicemail', 'gatekeeper_name', 'gatekeeper_blocked', 'wrong_number')) AS convo
    FROM public.call_activities ca
    JOIN public.call_leads l ON l.id = ca.lead_id
    WHERE ca.created_at >= p_from AND ca.created_at < p_to
  )
  SELECT jsonb_build_object(
    'totals', (SELECT jsonb_build_object(
        'dials', count(*),
        'conversations', count(*) FILTER (WHERE convo),
        'interested', count(*) FILTER (WHERE outcome IN ('interested_info', 'interested_proposal', 'interested_call', 'meeting_booked')),
        'meetings', count(*) FILTER (WHERE outcome = 'meeting_booked')
      ) FROM a),
    'by_day', COALESCE((SELECT jsonb_agg(x ORDER BY x->>'day') FROM (
        SELECT jsonb_build_object('day', to_char((created_at AT TIME ZONE p_tz)::date, 'YYYY-MM-DD'),
                 'dials', count(*), 'conversations', count(*) FILTER (WHERE convo),
                 'meetings', count(*) FILTER (WHERE outcome = 'meeting_booked')) AS x
        FROM a GROUP BY (created_at AT TIME ZONE p_tz)::date) d), '[]'),
    'by_outcome', COALESCE((SELECT jsonb_agg(jsonb_build_object('outcome', outcome, 'n', n) ORDER BY n DESC)
        FROM (SELECT outcome, count(*) AS n FROM a GROUP BY outcome) o), '[]'),
    'by_tier', COALESCE((SELECT jsonb_agg(jsonb_build_object('tier', COALESCE(tier, '–'), 'dials', dials,
                 'conversations', convos, 'meetings', meets) ORDER BY tier)
        FROM (SELECT tier, count(*) AS dials, count(*) FILTER (WHERE convo) AS convos,
                     count(*) FILTER (WHERE outcome = 'meeting_booked') AS meets FROM a GROUP BY tier) t), '[]'),
    'by_list', COALESCE((SELECT jsonb_agg(jsonb_build_object('list', name, 'dials', dials,
                 'conversations', convos, 'meetings', meets) ORDER BY dials DESC)
        FROM (SELECT cl.name, count(*) AS dials, count(*) FILTER (WHERE a.convo) AS convos,
                     count(*) FILTER (WHERE a.outcome = 'meeting_booked') AS meets
              FROM a JOIN public.call_lists cl ON cl.id = a.list_id GROUP BY cl.name) b), '[]'),
    -- Best hours to call: the PROSPECT's local hour, which is what decides whether they pick up.
    'by_hour', COALESCE((SELECT jsonb_agg(jsonb_build_object('hour', h, 'dials', dials, 'conversations', convos) ORDER BY h)
        FROM (SELECT extract(hour FROM (created_at AT TIME ZONE ltz))::int AS h, count(*) AS dials,
                     count(*) FILTER (WHERE convo) AS convos FROM a GROUP BY 1) hh), '[]'),
    'funnel', (SELECT jsonb_build_object(
        'leads_called', count(DISTINCT lead_id),
        'conversations', count(DISTINCT lead_id) FILTER (WHERE convo),
        'interested', count(DISTINCT lead_id) FILTER (WHERE outcome IN ('interested_info', 'interested_proposal', 'interested_call', 'meeting_booked')),
        'meetings', count(DISTINCT lead_id) FILTER (WHERE outcome = 'meeting_booked'),
        'deals', count(DISTINCT lead_id) FILTER (WHERE deal_id IS NOT NULL),
        'won', count(DISTINCT lead_id) FILTER (WHERE deal_id IN (SELECT id FROM public.deals WHERE stage = 'won'))
      ) FROM a)
  ) INTO result;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION
  public.dialer_re_escape(text),
  public.dialer_mentionables(),
  public.dialer_assign_followup(uuid, uuid)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION
  public.dialer_re_escape(text),
  public.dialer_mentionables(),
  public.dialer_assign_followup(uuid, uuid)
TO authenticated;

REVOKE ALL ON FUNCTION public.log_call(uuid, text, text[], text, boolean, timestamptz, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_call(uuid, text, text[], text, boolean, timestamptz, text, text, text) TO authenticated;
REVOKE ALL ON FUNCTION public.dialer_report(timestamptz, timestamptz, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dialer_report(timestamptz, timestamptz, text) TO authenticated;
