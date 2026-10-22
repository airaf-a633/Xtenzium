-- ═══════════════════════════════════════════════════════════
-- 031 · After the call: the follow-up email, and what happens next
--
--   1. dialer_settings.booking_link / portfolio_link — the Zoho calendar
--      link and the portfolio, used by the follow-up templates as
--      {{booking_link}} and {{portfolio_link}}.
--   2. Templates in the owners' wording: email_info, email_proposal and a
--      reply-nudge (followup_nudge). Written once; editable in Settings.
--   3. A reply nudge schedule. When a follow-up email is marked SENT the
--      lead gets a nudge due in 3 business days, then another 4 business
--      days later, then it stops. It disappears the moment the lead moves
--      on (a meeting is booked, they decline, DNC ...).
--
-- Idempotent: safe to run twice. (Existing email_info / email_proposal
-- templates are replaced by the new wording; edit them in Settings after.)
-- ═══════════════════════════════════════════════════════════

-- ─── 1 · the two links ────────────────────────────────────

ALTER TABLE public.dialer_settings ADD COLUMN IF NOT EXISTS booking_link text;
ALTER TABLE public.dialer_settings ADD COLUMN IF NOT EXISTS portfolio_link text;
ALTER TABLE public.dialer_settings DROP CONSTRAINT IF EXISTS dialer_settings_links_check;
ALTER TABLE public.dialer_settings ADD CONSTRAINT dialer_settings_links_check
  CHECK ((booking_link IS NULL OR booking_link ~* '^https?://[^[:space:]]+$')
     AND (portfolio_link IS NULL OR portfolio_link ~* '^https?://[^[:space:]]+$'));

-- ─── 2 · templates ────────────────────────────────────────

ALTER TABLE public.email_templates DROP CONSTRAINT IF EXISTS email_templates_type_check;
ALTER TABLE public.email_templates ADD CONSTRAINT email_templates_type_check
  CHECK (type IN ('email_info', 'email_proposal', 'linkedin', 'admin_call', 'outreach_first', 'outreach_followup', 'followup_nudge'));

INSERT INTO public.email_templates (type, subject, body) VALUES
('email_info', 'Following up on our call, {{contact_first}}',
E'Hi {{contact_first}},\n\nThanks for taking a few minutes today. As promised, a short overview.\n\nXtenzium works as an extension of agencies like {{company_name}}. For what you’d pay to hire one person, you get an entire team — design, development, AI, engineering and QA — working on your projects. And you only ever deal with one person.\n\nI’d like to walk you through how we could work on this in more detail. You can pick a time that suits you here:\n[Select a time]({{booking_link}})\n\nIf it’s useful beforehand, here’s a short look at our recent work: [Portfolio]({{portfolio_link}})\n\nLooking forward to speaking again.\n\nBest regards,\nSharab K.\nXtenzium | xtenzium.com\nsharab@xtenzium.com'),
('email_proposal', 'A proposal for {{company_name}}, following our call',
E'Hi {{contact_first}},\n\nThanks for your time today. As promised, a short overview, and a quick way to get you a proper proposal.\n\nXtenzium works as an extension of agencies like {{company_name}}. For what you’d pay to hire one person, you get an entire team — design, development, AI, engineering and QA — working on your projects. And you only ever deal with one person.\n\nTo price this accurately I’d like to understand the work you take on. You can pick a time that suits you here:\n[Select a time]({{booking_link}})\n\nIf it’s useful beforehand, here’s a short look at our recent work: [Portfolio]({{portfolio_link}})\n\nLooking forward to speaking again.\n\nBest regards,\nSharab K.\nXtenzium | xtenzium.com\nsharab@xtenzium.com'),
('followup_nudge', 'Re: Following up on our call, {{contact_first}}',
E'Hi {{contact_first}},\n\nA quick note in case my last email got buried. I’d still like to walk you through how an extension team could work for {{company_name}}. It takes about 20 minutes, and you can pick whichever time suits you:\n[Select a time]({{booking_link}})\n\nIf the timing isn’t right, just tell me and I’ll check back later.\n\nBest regards,\nSharab K.\nXtenzium | xtenzium.com\nsharab@xtenzium.com')
ON CONFLICT (type) DO UPDATE SET subject = EXCLUDED.subject, body = EXCLUDED.body;

-- ─── 3 · the nudge schedule ───────────────────────────────

ALTER TABLE public.call_leads ADD COLUMN IF NOT EXISTS nudge_due_at timestamptz;
ALTER TABLE public.call_leads ADD COLUMN IF NOT EXISTS nudge_count smallint NOT NULL DEFAULT 0;

-- 10:00 in the prospect's own time, N business days out.
CREATE OR REPLACE FUNCTION public.followup_nudge_at(p_tz text, p_days integer)
RETURNS timestamptz
LANGUAGE sql
STABLE
AS $$
  SELECT ((public.dialer_add_business_days(now(), p_days, COALESCE(p_tz, 'America/New_York')))::timestamp + interval '10 hours')
         AT TIME ZONE COALESCE(p_tz, 'America/New_York');
$$;

-- The owner marks a follow-up email SENT: record it, and start the nudge clock.
CREATE OR REPLACE FUNCTION public.followup_mark_sent(p_id uuid)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  f   public.followup_queue;
  due timestamptz;
BEGIN
  IF NOT public.is_staff() THEN
    RAISE EXCEPTION 'Not allowed' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO f FROM public.followup_queue WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'That follow-up no longer exists'; END IF;

  UPDATE public.followup_queue SET status = 'sent', handled_by = auth.uid(), handled_at = now() WHERE id = p_id;

  IF f.type IN ('email_info', 'email_proposal') THEN
    UPDATE public.call_leads
    SET nudge_count = 0,
        nudge_due_at = public.followup_nudge_at(timezone, 3)
    WHERE id = f.lead_id AND status = 'followup'
    RETURNING nudge_due_at INTO due;
  END IF;
  RETURN due;
END;
$$;

-- A nudge was sent: schedule the last one, then stop.
CREATE OR REPLACE FUNCTION public.followup_nudge_sent(p_lead_id uuid)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  l   public.call_leads;
  due timestamptz;
BEGIN
  IF NOT public.is_staff() THEN
    RAISE EXCEPTION 'Not allowed' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO l FROM public.call_leads WHERE id = p_lead_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'That lead no longer exists'; END IF;

  due := CASE WHEN l.nudge_count + 1 < 2 THEN public.followup_nudge_at(l.timezone, 4) ELSE NULL END;
  UPDATE public.call_leads SET nudge_count = nudge_count + 1, nudge_due_at = due WHERE id = p_lead_id;
  RETURN due;
END;
$$;

-- When a lead moves on, its nudges stop.
CREATE OR REPLACE FUNCTION public.call_leads_stop_nudges()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM 'followup' AND NEW.nudge_due_at IS NOT NULL THEN
    NEW.nudge_due_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS call_leads_stop_nudges ON public.call_leads;
CREATE TRIGGER call_leads_stop_nudges
  BEFORE UPDATE ON public.call_leads
  FOR EACH ROW EXECUTE FUNCTION public.call_leads_stop_nudges();

REVOKE ALL ON FUNCTION public.followup_mark_sent(uuid), public.followup_nudge_sent(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.followup_mark_sent(uuid), public.followup_nudge_sent(uuid) TO authenticated;

-- A rep can't schedule nudges by hand (they are the owners' business).
CREATE OR REPLACE FUNCTION public.call_leads_guard_columns()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_user = 'authenticated' AND NOT public.is_admin() THEN
    IF (NEW.status, NEW.attempt_count, NEW.next_call_at, NEW.last_called_at, NEW.phone_raw, NEW.phone_e164,
        NEW.phone_is_us, NEW.domain, NEW.list_id, NEW.deal_id, NEW.assigned_to, NEW.snoozed_until,
        NEW.outreach_touches, NEW.outreach_due, NEW.outreach_last_at, NEW.timezone, NEW.score, NEW.company_name,
        NEW.segment, NEW.extra, NEW.source, NEW.state, NEW.nudge_due_at, NEW.nudge_count)
       IS DISTINCT FROM
       (OLD.status, OLD.attempt_count, OLD.next_call_at, OLD.last_called_at, OLD.phone_raw, OLD.phone_e164,
        OLD.phone_is_us, OLD.domain, OLD.list_id, OLD.deal_id, OLD.assigned_to, OLD.snoozed_until,
        OLD.outreach_touches, OLD.outreach_due, OLD.outreach_last_at, OLD.timezone, OLD.score, OLD.company_name,
        OLD.segment, OLD.extra, OLD.source, OLD.state, OLD.nudge_due_at, OLD.nudge_count) THEN
      RAISE EXCEPTION 'Leads can only be changed by logging a call' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
