-- ═══════════════════════════════════════════════════════════
-- 019 · Dialer — admin side
--
--   dialer_settings   the retry rules, editable (log_call now reads them)
--   email_templates   what the owner's follow-up emails start from
--   call_scripts      the pitch shown on the call screen
--   flags             a rep's "flag for owner" can be resolved
--   realtime          the live feed
--   dialer_report()   numbers for the reports page
--   dialer_board_counts()
--
-- Defaults reproduce the rules exactly as 018 shipped them, so nothing
-- changes until an admin edits a value.
-- Idempotent: safe to run twice.
-- ═══════════════════════════════════════════════════════════

-- ─── Settings (a single row) ──────────────────────────────

CREATE TABLE IF NOT EXISTS public.dialer_settings (
  id                         boolean PRIMARY KEY DEFAULT true CHECK (id),
  no_answer_days             integer NOT NULL DEFAULT 1  CHECK (no_answer_days BETWEEN 1 AND 30),
  voicemail_days             integer NOT NULL DEFAULT 2  CHECK (voicemail_days BETWEEN 1 AND 30),
  gatekeeper_name_days       integer NOT NULL DEFAULT 1  CHECK (gatekeeper_name_days BETWEEN 1 AND 30),
  gatekeeper_blocked_days    integer NOT NULL DEFAULT 3  CHECK (gatekeeper_blocked_days BETWEEN 1 AND 30),
  nurture_outsources_days    integer NOT NULL DEFAULT 90 CHECK (nurture_outsources_days BETWEEN 7 AND 730),
  nurture_timing_days        integer NOT NULL DEFAULT 60 CHECK (nurture_timing_days BETWEEN 7 AND 730),
  max_attempts               integer NOT NULL DEFAULT 6  CHECK (max_attempts BETWEEN 2 AND 20),
  updated_at                 timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.dialer_settings (id) VALUES (true) ON CONFLICT DO NOTHING;

DROP TRIGGER IF EXISTS dialer_settings_updated_at ON public.dialer_settings;
CREATE TRIGGER dialer_settings_updated_at
  BEFORE UPDATE ON public.dialer_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ─── Email templates ──────────────────────────────────────
--
-- One per follow-up type. Merge fields: {{company_name}} {{contact_name}}
-- {{website}} {{rep_note}} — filled in by the Inbox when you open one.

CREATE TABLE IF NOT EXISTS public.email_templates (
  type        text PRIMARY KEY CHECK (type IN ('email_info', 'email_proposal', 'linkedin', 'admin_call')),
  subject     text NOT NULL DEFAULT '',
  body        text NOT NULL DEFAULT '',
  updated_by  uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.email_templates (type, subject, body) VALUES
('email_info', 'Following up on our call — Xtenzium for {{company_name}}',
E'Hi {{contact_name}},\n\nThanks for taking my colleague''s call today. As promised, a quick overview of how Xtenzium works with agencies like {{company_name}}.\n\nWe act as your extension: a full design and development team (web, mobile, and custom hardware/IoT when a project needs it) working under your brand, for roughly what one in-house hire costs. You keep the client and the margin; we deliver.\n\n{{rep_note}}\n\nIf it''s useful, I''m happy to walk you through a couple of recent agency builds. Would a short call this week work?\n\nBest,\nAiraf Adil\nCEO, Xtenzium\ncontact@xtenzium.com'),
('email_proposal', 'A proposal for {{company_name}} — Xtenzium',
E'Hi {{contact_name}},\n\nGreat speaking with you. Here is what we discussed for {{company_name}}.\n\n{{rep_note}}\n\nI will put together a tailored proposal with scope, team, and monthly pricing. To make it accurate, could you tell me the kinds of projects you most often turn away or outsource today?\n\nBest,\nAiraf Adil\nCEO, Xtenzium\ncontact@xtenzium.com')
ON CONFLICT (type) DO NOTHING;

-- ─── Call scripts ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.call_scripts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text NOT NULL,
  body        text NOT NULL DEFAULT '',
  sort_order  integer NOT NULL DEFAULT 0,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.call_scripts (title, body, sort_order)
SELECT * FROM (VALUES
  ('Opener',
   E'“Hi, is this {{contact or the owner}}? This is {{your name}} from Xtenzium — I’ll be quick, did I catch you at a bad time?”\n“We’re a development and design team that works as an extension of agencies like yours — I wanted to see if it’s relevant before I take any more of your time.”', 1),
  ('The pitch',
   E'We plug into your agency as your own build team — design, web, mobile, even hardware/IoT — so you can say yes to projects without hiring.\nInstead of paying for one developer, you get a whole team (design, front-end, back-end, QA) for roughly the same monthly cost.\nYou keep the client relationship and the margin; we work under your brand.\nAsk: “When you win a project bigger than your bench, what do you do today?”', 2),
  ('Close for the meeting',
   E'“Our founder, Airaf, can walk you through how it works and show a couple of agency builds. Do you have 20 minutes this week?”\nGet a day, a time and the zone, plus the best email for the invite. Log it as “Meeting agreed”.', 3),
  ('Objections',
   E'“We have in-house devs” → “Makes sense — most of our agencies do. We cover the overflow and the skills you don’t keep on payroll. When do you hit capacity?”\n“We already outsource” → “Good, then you know the pain of reliability. We’re a team, not a freelancer — if someone’s out, the work doesn’t stop. Worth a comparison?”\n“Send me an email” → “Happy to. What’s the best address, and what should I focus it on — web, app, or design?”\n“Not now / no budget” → “Understood. Can I check back in a couple of months? Who should I ask for?”', 4)
) AS v(title, body, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM public.call_scripts);

DROP TRIGGER IF EXISTS email_templates_updated_at ON public.email_templates;
CREATE TRIGGER email_templates_updated_at
  BEFORE UPDATE ON public.email_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS call_scripts_updated_at ON public.call_scripts;
CREATE TRIGGER call_scripts_updated_at
  BEFORE UPDATE ON public.call_scripts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ─── Flags can be resolved ────────────────────────────────

ALTER TABLE public.call_activities ADD COLUMN IF NOT EXISTS flag_resolved_at timestamptz;
ALTER TABLE public.call_activities ADD COLUMN IF NOT EXISTS flag_resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS call_activities_open_flags_idx
  ON public.call_activities (created_at DESC) WHERE flagged AND flag_resolved_at IS NULL;

-- ─── RLS ──────────────────────────────────────────────────

ALTER TABLE public.dialer_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_scripts    ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['dialer_settings', 'email_templates', 'call_scripts']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_admin_all', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated '
      'USING ((SELECT public.is_admin())) WITH CHECK ((SELECT public.is_admin()))',
      t || '_admin_all', t);
  END LOOP;
END $$;

-- The call screen shows the script to the rep.
DROP POLICY IF EXISTS "call_scripts_staff_select" ON public.call_scripts;
CREATE POLICY "call_scripts_staff_select" ON public.call_scripts FOR SELECT TO authenticated
  USING ((SELECT public.is_staff()));
DROP POLICY IF EXISTS "dialer_settings_staff_select" ON public.dialer_settings;
CREATE POLICY "dialer_settings_staff_select" ON public.dialer_settings FOR SELECT TO authenticated
  USING ((SELECT public.is_staff()));

-- ─── Realtime (the live feed) ─────────────────────────────

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (
       SELECT 1 FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'call_activities'
     )
  THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.call_activities;
  END IF;
EXCEPTION WHEN insufficient_privilege THEN
  RAISE WARNING 'Could not add call_activities to the realtime publication; the feed will fall back to polling.';
END $$;

-- ─── log_call, now reading the retry rules from dialer_settings ──

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

-- ─── Reports ──────────────────────────────────────────────
--
-- One round trip, aggregated in SQL. Admin only. "Conversation" means
-- someone substantive picked up (everything except no-answer,
-- voicemail, gatekeepers and wrong numbers).

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
        'interested', count(*) FILTER (WHERE outcome IN ('interested_info', 'interested_proposal', 'meeting_booked')),
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
        'interested', count(DISTINCT lead_id) FILTER (WHERE outcome IN ('interested_info', 'interested_proposal', 'meeting_booked')),
        'meetings', count(DISTINCT lead_id) FILTER (WHERE outcome = 'meeting_booked'),
        'deals', count(DISTINCT lead_id) FILTER (WHERE deal_id IS NOT NULL),
        'won', count(DISTINCT lead_id) FILTER (WHERE deal_id IN (SELECT id FROM public.deals WHERE stage = 'won'))
      ) FROM a)
  ) INTO result;

  RETURN result;
END;
$$;

-- How many leads sit in each status — the board's column headers.
CREATE OR REPLACE FUNCTION public.dialer_board_counts()
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(jsonb_object_agg(status, n), '{}'::jsonb)
  FROM (SELECT status, count(*) AS n FROM public.call_leads GROUP BY status) s;
$$;

REVOKE ALL ON FUNCTION
  public.log_call(uuid, text, text[], text, boolean, timestamptz, text, text, text),
  public.dialer_report(timestamptz, timestamptz, text),
  public.dialer_board_counts()
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION
  public.log_call(uuid, text, text[], text, boolean, timestamptz, text, text, text),
  public.dialer_report(timestamptz, timestamptz, text),
  public.dialer_board_counts()
TO authenticated;
