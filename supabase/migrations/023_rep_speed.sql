-- ═══════════════════════════════════════════════════════════
-- 023 · Rep speed
--
--   1. Retries are mixed in. The queue used to serve every fresh lead
--      before any retry, so a voicemail lead could wait two weeks. Now
--      every Nth dial (dialer_settings.retry_every, default 3) is a due
--      retry, when one exists. 0 restores the old "fresh first" order.
--   2. Tier filter: dialer_next_lead(p_tiers) plus dialer_tier_counts().
--   3. Undo: log_call() now records exactly what a call changed, and
--      undo_last_call() reverses it (own calls, last 30 minutes, nothing
--      logged on that lead since).
--   4. Bulk re-tier for admins, by value or by score.
--   5. p_assume_dials lets the screen pre-load the next lead as if the
--      current one were already logged.
--   6. A new opening script and follow-up email.
--
-- Idempotent: safe to run twice.
-- ═══════════════════════════════════════════════════════════

ALTER TABLE public.dialer_settings
  ADD COLUMN IF NOT EXISTS retry_every integer NOT NULL DEFAULT 3 CHECK (retry_every BETWEEN 0 AND 20);

ALTER TABLE public.call_activities ADD COLUMN IF NOT EXISTS undo jsonb;

-- ─── The queue ────────────────────────────────────────────

DROP FUNCTION IF EXISTS public.dialer_next_lead(uuid[], boolean, uuid);

CREATE OR REPLACE FUNCTION public.dialer_next_lead(
  p_skip          uuid[]  DEFAULT '{}',
  p_ignore_hours  boolean DEFAULT false,
  p_list_id       uuid    DEFAULT NULL,
  p_tiers         text[]  DEFAULT NULL,   -- 'A' 'B' 'C' and '-' for untiered; NULL = any
  p_assume_dials  integer DEFAULT 0       -- pretend this many more calls were already logged
)
RETURNS SETOF public.call_leads
LANGUAGE sql
STABLE
AS $$
  WITH cfg AS (
    SELECT COALESCE((SELECT retry_every FROM public.dialer_settings LIMIT 1), 3) AS n
  ),
  me AS (
    SELECT COALESCE((SELECT timezone FROM public.profiles WHERE id = auth.uid()), 'Asia/Karachi') AS tz
  ),
  done AS (
    SELECT count(*)::int AS c
    FROM public.call_activities a, me
    WHERE a.caller_id = auth.uid()
      AND a.created_at >= (date_trunc('day', now() AT TIME ZONE me.tz) AT TIME ZONE me.tz)
  ),
  turn AS (
    -- Every Nth dial of the day is a retry's turn.
    SELECT (cfg.n > 0 AND ((done.c + COALESCE(p_assume_dials, 0)) % cfg.n) = cfg.n - 1) AS retry_turn
    FROM cfg, done
  )
  SELECT l.*
  FROM public.call_leads l, turn
  WHERE l.phone_e164 IS NOT NULL
    AND l.phone_is_us IS TRUE
    AND l.status IN ('new', 'retry', 'callback')
    AND (p_list_id IS NULL OR l.list_id = p_list_id)
    AND (p_tiers IS NULL OR COALESCE(l.tier, '-') = ANY (p_tiers))
    AND l.id <> ALL (COALESCE(p_skip, '{}'))
    AND (l.status = 'new' OR l.next_call_at <= now())
    -- A callback has an agreed time, so it is served whatever the clock says.
    AND (
      l.status = 'callback'
      OR (p_ignore_hours AND public.is_admin())
      OR public.dialer_in_window(l.timezone)
    )
  ORDER BY
    CASE l.status
      WHEN 'callback' THEN 0
      WHEN 'retry'    THEN CASE WHEN turn.retry_turn THEN 1 ELSE 2 END
      ELSE                 CASE WHEN turn.retry_turn THEN 2 ELSE 1 END
    END,
    l.tier NULLS LAST,
    l.score DESC NULLS LAST,
    l.next_call_at NULLS FIRST,
    l.created_at
  LIMIT 1;
$$;

-- How many dialable leads sit in each tier (for the filter chips).
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
  FROM public.call_leads
  WHERE status IN ('new', 'retry', 'callback')
    AND phone_is_us IS TRUE AND phone_e164 IS NOT NULL
    AND (p_list_id IS NULL OR list_id = p_list_id);
$$;

-- ─── Bulk re-tier (admin) ─────────────────────────────────

-- Move leads from one tier to another within a list. p_from: A, B, C,
-- '-' (untiered) or '*' (any). p_to: A, B, C or '-' (clear).
CREATE OR REPLACE FUNCTION public.retier_leads(p_list_id uuid, p_from text, p_to text)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE n integer;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admins only' USING ERRCODE = '42501';
  END IF;
  IF p_from NOT IN ('A', 'B', 'C', '-', '*') OR p_to NOT IN ('A', 'B', 'C', '-') THEN
    RAISE EXCEPTION 'Tiers are A, B, C or - (none)';
  END IF;
  UPDATE public.call_leads SET tier = NULLIF(p_to, '-')
  WHERE list_id = p_list_id AND (p_from = '*' OR COALESCE(tier, '-') = p_from);
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

-- Tier from score: A at or above p_a, B at or above p_b, otherwise C.
-- Leads with no score are left as they are.
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
  WHERE list_id = p_list_id AND score IS NOT NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

-- ─── log_call, now recording what it changed ──────────────

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
  snap         jsonb;
  act_id       uuid;
  fu_id        uuid;
  deal_made    uuid;
  deal_prev    jsonb;
  new_id       uuid;
  dnc_ids      uuid[] := '{}';
  da_ids       uuid[] := '{}';
  notif_ids    uuid[] := '{}';
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

  -- ── Remember how the lead was, so the call can be undone ──
  snap := jsonb_build_object(
    'status', l.status, 'attempt_count', l.attempt_count, 'last_called_at', l.last_called_at,
    'next_call_at', l.next_call_at, 'contact_name', l.contact_name, 'contact_title', l.contact_title,
    'email', l.email, 'deal_id', l.deal_id);

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
  VALUES (l.id, auth.uid(), p_outcome, COALESCE(p_tags, '{}'), NULLIF(btrim(p_note), ''), flag)
  RETURNING id INTO act_id;

  -- ── Follow-up task for the owner (never queue the same one twice) ──
  IF followup IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM public.followup_queue
       WHERE lead_id = l.id AND type = followup AND status = 'queued'
     )
  THEN
    INSERT INTO public.followup_queue (lead_id, type, note, requested_by)
    VALUES (l.id, followup, COALESCE(fu_note, NULLIF(btrim(p_note), '')), auth.uid())
    RETURNING id INTO fu_id;
  END IF;

  -- Whoever was @mentioned takes the task (including one already queued).
  IF followup IS NOT NULL AND assignee IS NOT NULL THEN
    UPDATE public.followup_queue SET assignee_id = assignee
    WHERE lead_id = l.id AND type = followup AND status = 'queued' AND assignee_id IS NULL;
  END IF;

  -- ── Do not call: permanent, by phone and by website ──
  IF new_status = 'dnc' THEN
    IF l.phone_e164 IS NOT NULL THEN
      INSERT INTO public.dnc_list (phone_e164, reason) VALUES (l.phone_e164, p_note) ON CONFLICT DO NOTHING
      RETURNING id INTO new_id;
      IF new_id IS NOT NULL THEN dnc_ids := dnc_ids || new_id; new_id := NULL; END IF;
    END IF;
    IF l.domain IS NOT NULL THEN
      INSERT INTO public.dnc_list (domain, reason) VALUES (l.domain, p_note) ON CONFLICT DO NOTHING
      RETURNING id INTO new_id;
      IF new_id IS NOT NULL THEN dnc_ids := dnc_ids || new_id; new_id := NULL; END IF;
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
      deal_made := deal.id;

      UPDATE public.call_leads SET deal_id = deal.id WHERE id = l.id;
      INSERT INTO public.deal_activities (deal_id, type, content, created_by)
      VALUES (deal.id, 'created', 'Created from a cold call', me_name)
      RETURNING id INTO new_id;
      da_ids := da_ids || new_id; new_id := NULL;
    ELSE
      SELECT * INTO deal FROM public.deals WHERE id = l.deal_id;
      deal_prev := jsonb_build_object('id', deal.id, 'stage', deal.stage, 'owner_id', deal.owner_id);
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
    )
    RETURNING id INTO new_id;
    da_ids := da_ids || new_id; new_id := NULL;
  END IF;

  -- ── Tell everyone who was @mentioned (the bell lights up live) ──
  FOREACH m IN ARRAY mentioned LOOP
    INSERT INTO public.notifications (recipient_id, actor_id, type, entity_type, entity_id, title, body)
    VALUES (m, actor, 'mention', 'lead', l.id, l.company_name, left(COALESCE(p_note, ''), 280))
    RETURNING id INTO new_id;
    notif_ids := notif_ids || new_id; new_id := NULL;
  END LOOP;

  -- ── Everything needed to reverse this call ──
  UPDATE public.call_activities SET undo = jsonb_build_object(
    'lead', snap,
    'followup_id', fu_id,
    'deal_created', deal_made,
    'deal_prev', deal_prev,
    'deal_activity_ids', to_jsonb(da_ids),
    'dnc_ids', to_jsonb(dnc_ids),
    'notification_ids', to_jsonb(notif_ids)
  ) WHERE id = act_id;

  RETURN jsonb_build_object(
    'status', new_status,
    'next_call_at', due,
    'followup', followup,
    'deal_id', COALESCE(deal.id, l.deal_id),
    'attempts', attempts,
    'mentioned', COALESCE(array_length(mentioned, 1), 0),
    'activity_id', act_id
  );
END;
$$;

-- ─── Undo ─────────────────────────────────────────────────
--
-- Puts a lead back exactly as it was before a call, and removes what
-- the call created: the follow-up task, a deal it opened (or the stage
-- it moved), do-not-call entries, and the bell notifications. Only
-- your own latest call on that lead, within 30 minutes. The log row is
-- removed rather than flagged, so day counts and reports are right.

CREATE OR REPLACE FUNCTION public.undo_last_call(p_activity_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  a    public.call_activities;
  snap jsonb;
  prev jsonb;
BEGIN
  IF NOT public.is_staff() THEN
    RAISE EXCEPTION 'Not allowed' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO a FROM public.call_activities WHERE id = p_activity_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'That call was already undone'; END IF;
  IF a.caller_id IS DISTINCT FROM auth.uid() AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'You can only undo your own calls' USING ERRCODE = '42501';
  END IF;
  IF a.undo IS NULL THEN RAISE EXCEPTION 'This call can’t be undone'; END IF;
  IF a.created_at < now() - interval '30 minutes' THEN
    RAISE EXCEPTION 'Too late to undo — that call was more than 30 minutes ago';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.call_activities
    WHERE lead_id = a.lead_id AND id <> a.id AND created_at > a.created_at
  ) THEN
    RAISE EXCEPTION 'That lead has been called again since';
  END IF;

  snap := a.undo -> 'lead';

  UPDATE public.call_leads SET
    status         = snap ->> 'status',
    attempt_count  = (snap ->> 'attempt_count')::integer,
    last_called_at = (snap ->> 'last_called_at')::timestamptz,
    next_call_at   = (snap ->> 'next_call_at')::timestamptz,
    contact_name   = snap ->> 'contact_name',
    contact_title  = snap ->> 'contact_title',
    email          = snap ->> 'email',
    deal_id        = (snap ->> 'deal_id')::uuid
  WHERE id = a.lead_id;

  IF (a.undo ->> 'followup_id') IS NOT NULL THEN
    DELETE FROM public.followup_queue WHERE id = (a.undo ->> 'followup_id')::uuid AND status = 'queued';
  END IF;

  DELETE FROM public.deal_activities
  WHERE id IN (SELECT jsonb_array_elements_text(a.undo -> 'deal_activity_ids')::uuid);

  IF (a.undo ->> 'deal_created') IS NOT NULL THEN
    DELETE FROM public.deals WHERE id = (a.undo ->> 'deal_created')::uuid;
  END IF;

  prev := a.undo -> 'deal_prev';
  IF prev IS NOT NULL AND jsonb_typeof(prev) = 'object' THEN
    UPDATE public.deals SET stage = prev ->> 'stage', owner_id = (prev ->> 'owner_id')::uuid
    WHERE id = (prev ->> 'id')::uuid;
  END IF;

  -- A deal trigger tells the new owner "you own this deal" / "stage moved"
  -- in the same transaction as the call; withdraw those too.
  DELETE FROM public.notifications
  WHERE entity_type = 'deal'
    AND created_at >= a.created_at
    AND entity_id IN (
      SELECT x::uuid FROM unnest(ARRAY[a.undo ->> 'deal_created', prev ->> 'id']) AS x WHERE x IS NOT NULL
    );

  DELETE FROM public.dnc_list WHERE id IN (SELECT jsonb_array_elements_text(a.undo -> 'dnc_ids')::uuid);
  DELETE FROM public.notifications WHERE id IN (SELECT jsonb_array_elements_text(a.undo -> 'notification_ids')::uuid);
  DELETE FROM public.call_activities WHERE id = a.id;

  RETURN jsonb_build_object('lead_id', a.lead_id, 'status', snap ->> 'status');
END;
$$;

REVOKE ALL ON FUNCTION
  public.dialer_next_lead(uuid[], boolean, uuid, text[], integer),
  public.dialer_tier_counts(uuid),
  public.retier_leads(uuid, text, text),
  public.retier_by_score(uuid, integer, integer),
  public.undo_last_call(uuid),
  public.log_call(uuid, text, text[], text, boolean, timestamptz, text, text, text)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION
  public.dialer_next_lead(uuid[], boolean, uuid, text[], integer),
  public.dialer_tier_counts(uuid),
  public.retier_leads(uuid, text, text),
  public.retier_by_score(uuid, integer, integer),
  public.undo_last_call(uuid),
  public.log_call(uuid, text, text[], text, boolean, timestamptz, text, text, text)
TO authenticated;

-- ─── The pitch ────────────────────────────────────────────
--
-- Replaces the original starter script — but only the sections nobody
-- has edited (matched by a phrase unique to the old text). Anything an
-- admin rewrote is left alone. Placeholders filled in on the call
-- screen: {{who}} (the contact, or "someone at the company"), {{company}}, {{rep}}.

DELETE FROM public.call_scripts WHERE
     (title = 'Opener'                AND body LIKE '%did I catch you at a bad time%')
  OR (title = 'The pitch'             AND body LIKE '%We plug into your agency as your own build team%')
  OR (title = 'Close for the meeting' AND body LIKE '%Our founder, Airaf, can walk you through%')
  OR (title = 'Objections'            AND body LIKE '%We have in-house devs%');

INSERT INTO public.call_scripts (title, body, sort_order)
SELECT v.title, v.body, v.sort_order
FROM (VALUES
  ('1 · Open',
   E'“Hi, how are you doing? Am I speaking with {{who}}?”\n(Pause. Let them answer.)\n“Great. I’ll be upfront with you — this is a cold call. I’m {{rep}}, and I have a business proposition for you and your team.”\n“If you can spare a couple of minutes, I’ll walk you through it. If it’s a bad time, just say so and I’ll let you get back to your day — no hard feelings. Fair enough?”', 10),
  ('2 · Are they the right person?',
   E'If they say yes to a couple of minutes:\n“Thank you, I appreciate that. Quick question first — are you the person who makes decisions about bringing in outside design or development help for {{company}}, or is there someone else I should be speaking to?”\nDecision-maker → go to the hook.\nSomeone else → “No problem — who would that be, and what’s the best way to reach them?” Log it as “Gatekeeper — got a name”.\nShared decision → “That’s fine, I’ll keep it short and you can pass it on.”\nIf they say no or it’s a bad time: “Understood, thanks for your time. Is there a better time to call?” → log a Callback. Otherwise end politely.', 20),
  ('3 · The hook',
   E'“Here’s the proposition in one sentence: for what you’d pay to hire one person, you get an entire team.”\n“Most agencies hire one developer or one designer, and that one person has to cover everything. We flip that: for the same money you’d pay that single hire, you get designers, developers and QA working together on your projects.”\n“And you don’t have to manage any of them. You deal with one person — a project manager who gets you, learns how you work, and handles the rest. One point of contact, always.”\n(Then stop talking. Let them react.)', 30),
  ('4 · Questions that keep them talking',
   E'“When you win a project that’s bigger than your bench, what do you do today?”\n“Do you ever turn work down, or delay it, because you’re short on design or development capacity?”\n“How are you covering development right now — in-house, freelancers, another agency?”\n“If you could add a full team without hiring, what would that change for you?”\n(Listen for the pain — capacity, hiring cost, unreliable freelancers, too many people to manage — and note it.)', 40),
  ('5 · The ask',
   E'Match the ask to how warm they are.\nWarm: “Would it make sense to speak with our founder for 20 minutes? He can show you exactly how it works for an agency like yours.” → Meeting agreed, or Wants a call with us.\nCurious: “Can I send you a short overview — who we are and how the team model works — and follow up in a few days?” → Send info. Get the best email and spell it back.\nWants numbers: “It depends on the size of team you need; the founder can give you a straight answer on a quick call.” → Wants proposal.\nAlways confirm their name, best email, and for any meeting the day, time and time zone.', 50),
  ('Objections',
   E'“We have in-house developers.” → “That makes sense — most agencies we speak with do. This isn’t a replacement; it’s for the overflow and the skills you don’t keep on payroll. When you’re at capacity, what happens to the extra work?”\n“We already outsource.” → “Good — then you know how hard reliability is. What’s the biggest headache with how you do it now? With us, if one person is out the rest of the team keeps going, and you still talk to only one person.”\n“Just send me an email.” → “Happy to. So it’s useful and not just noise — what would you most like to see: the team model, pricing, or examples of work?” Then get the email and spell it back.\n“How much is it?” → “It depends on the team you need, but the principle is simple: roughly what you’d pay one person. The founder can put an exact number on it in a few minutes — worth a quick call?”\n“Who are you? What company is this?” → “Fair question — we’re Xtenzium, a design and development team that works as an extension of agencies. Happy to explain how if you have a couple of minutes.”\n“Not interested.” → “No problem at all. So I know whether to ever call back — is it timing, or do you already have this covered?” Log the reason and thank them.\n“Take me off your list.” → “Absolutely, I’ll remove you right now. Sorry for the interruption.” Log Do not call.', 60),
  ('If it goes to voicemail',
   E'Keep it under 20 seconds:\n“Hi {{who}}, it’s {{rep}}. This is a cold call, sorry for the interruption — I’ll be quick. We help agencies get an entire design and development team for what they’d normally pay one hire, with a single project manager as your only point of contact. If that’s interesting, I’ll try you again — or you can reply to the email I’ll send. Thanks, and have a good one.”\nDon’t pitch more than that. Log “Left voicemail”.', 70),
  ('If they ask for proof',
   E'“We’ve delivered over 65 projects, and the way we keep it simple is the one project manager. I’d rather show you than tell you — that’s what the founder’s call is for.”\n(Only say what you can back up. Add a specific example here once you have one.)', 80)
) AS v(title, body, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM public.call_scripts s WHERE s.title = v.title);

-- The follow-up email now says the same thing the call does — unless someone already rewrote it.
UPDATE public.email_templates SET
  body = E'Hi {{contact_name}},\n\nThanks for taking a few minutes today. As promised, a short overview.\n\nXtenzium works as an extension of agencies like {{company_name}}. For what you’d pay to hire one person, you get an entire team — design, development and QA — working on your projects. And you only ever deal with one person: a project manager who learns how you work and handles the rest.\n\n{{rep_note}}\n\nIf it’s useful, I’d be glad to walk you through how it works for an agency like yours. Would a 20-minute call this week suit you?\n\nBest,\nAiraf Adil\nCEO, Xtenzium\ncontact@xtenzium.com'
WHERE type = 'email_info' AND body LIKE '%roughly what one in-house hire costs%';
