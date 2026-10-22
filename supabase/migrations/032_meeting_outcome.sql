-- ═══════════════════════════════════════════════════════════
-- 032 · After the meeting
--
--   meeting_outcome(lead, 'held' | 'no_show' | 'cancelled') is one click that
--   does everything that used to be manual:
--
--     held      → lead to follow-up; the deal gets a "meeting held" entry and a
--                 next action; a "thank you & next steps" email is queued for
--                 whoever clicked.
--     no_show / → lead to follow-up (NOT straight back to the rep's cold queue);
--     cancelled   the deal notes it; a "sorry we missed each other — pick a new
--                 time" email is queued.
--
--   Sending either email starts the nudge clock (3, then 4 business days).
--   Marking a thank-you "sent — proposal attached" moves the deal to Proposal sent.
--
-- Idempotent: safe to run twice.
-- ═══════════════════════════════════════════════════════════

-- ─── new follow-up kinds and their templates ──────────────

ALTER TABLE public.followup_queue DROP CONSTRAINT IF EXISTS followup_queue_type_check;
ALTER TABLE public.followup_queue ADD CONSTRAINT followup_queue_type_check
  CHECK (type IN ('email_info', 'email_proposal', 'linkedin', 'admin_call', 'email_after_meeting', 'email_noshow'));

ALTER TABLE public.email_templates DROP CONSTRAINT IF EXISTS email_templates_type_check;
ALTER TABLE public.email_templates ADD CONSTRAINT email_templates_type_check
  CHECK (type IN ('email_info', 'email_proposal', 'linkedin', 'admin_call', 'outreach_first', 'outreach_followup',
                  'followup_nudge', 'email_after_meeting', 'email_noshow'));

INSERT INTO public.email_templates (type, subject, body) VALUES
('email_after_meeting', 'Thank you for your time, {{contact_first}}',
E'Hi {{contact_first}},\n\nThank you for your time today. It was great to walk you through how Xtenzium can work as an extension of {{company_name}}.\n\nAs discussed, the next steps:\n[Add the next steps you agreed]\n\nIf you’d like to go over anything in more detail, you can pick another time here:\n[Select a time]({{booking_link}})\n\nAnd here is a short look at our recent work again: [Portfolio]({{portfolio_link}})\n\nLooking forward to working together.\n\nBest regards,\nSharab K.\nXtenzium | xtenzium.com\nsharab@xtenzium.com'),
('email_noshow', 'Sorry we missed each other, {{contact_first}}',
E'Hi {{contact_first}},\n\nI’m sorry we missed each other. These things happen, and I’d still like to walk you through how Xtenzium could work as an extension of {{company_name}}.\n\nYou can pick a new time that suits you here:\n[Select a time]({{booking_link}})\n\nIf the timing isn’t right at the moment, just tell me and I’ll check back later.\n\nBest regards,\nSharab K.\nXtenzium | xtenzium.com\nsharab@xtenzium.com')
ON CONFLICT (type) DO NOTHING;

-- ─── the one-click outcome ────────────────────────────────

CREATE OR REPLACE FUNCTION public.meeting_outcome(p_lead_id uuid, p_outcome text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  l        public.call_leads;
  me_name  text := COALESCE((SELECT full_name FROM public.profiles WHERE id = auth.uid()), 'Owner');
  actor    uuid := public.current_member_id();
  kind     text;
  note     text;
  task_id  uuid;
  met      text;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admins only' USING ERRCODE = '42501';
  END IF;
  IF p_outcome NOT IN ('held', 'no_show', 'cancelled') THEN
    RAISE EXCEPTION 'Unknown meeting outcome %', p_outcome;
  END IF;

  SELECT * INTO l FROM public.call_leads WHERE id = p_lead_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'That lead no longer exists'; END IF;
  IF l.status <> 'meeting' THEN
    RAISE EXCEPTION 'This lead has no meeting waiting';
  END IF;

  met := to_char(l.next_call_at AT TIME ZONE COALESCE(l.timezone, 'America/New_York'), 'FMDy FMMon FMDD');

  -- A calendar record (when one exists) follows the same outcome.
  UPDATE public.meetings
  SET status = CASE p_outcome WHEN 'held' THEN 'held' WHEN 'no_show' THEN 'no_show' ELSE 'cancelled' END
  WHERE lead_id = l.id AND status = 'scheduled';

  UPDATE public.call_leads SET status = 'followup', next_call_at = NULL WHERE id = l.id;

  IF p_outcome = 'held' THEN
    kind := 'email_after_meeting';
    note := 'Meeting held ' || met || '. Send the thank-you and the agreed next steps.';
  ELSE
    kind := 'email_noshow';
    note := CASE p_outcome WHEN 'no_show' THEN 'No-show for the ' || met || ' meeting. Send a reschedule email.'
                           ELSE 'The ' || met || ' meeting was cancelled. Offer a new time.' END;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.followup_queue WHERE lead_id = l.id AND type = kind AND status = 'queued') THEN
    INSERT INTO public.followup_queue (lead_id, type, note, requested_by, assignee_id)
    VALUES (l.id, kind, note, auth.uid(), actor)
    RETURNING id INTO task_id;
  END IF;

  IF l.deal_id IS NOT NULL THEN
    INSERT INTO public.deal_activities (deal_id, type, content, created_by)
    VALUES (l.deal_id, 'meeting',
            CASE p_outcome WHEN 'held' THEN 'Meeting held ' || met ELSE initcap(replace(p_outcome, '_', '-')) || ' — ' || met END,
            me_name);
    UPDATE public.deals
    SET next_action = CASE p_outcome WHEN 'held' THEN 'Send the thank-you and next steps' ELSE 'Reschedule the meeting' END,
        next_action_date = current_date + 1
    WHERE id = l.deal_id;
  END IF;

  RETURN jsonb_build_object('status', 'followup', 'task_id', task_id, 'task_type', kind);
END;
$$;

REVOKE ALL ON FUNCTION public.meeting_outcome(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.meeting_outcome(uuid, text) TO authenticated;

-- ─── sending the email: start the nudges; a proposal moves the deal ──

DROP FUNCTION IF EXISTS public.followup_mark_sent(uuid);

CREATE OR REPLACE FUNCTION public.followup_mark_sent(p_id uuid, p_proposal boolean DEFAULT false)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  f       public.followup_queue;
  due     timestamptz;
  l       public.call_leads;
BEGIN
  IF NOT public.is_staff() THEN
    RAISE EXCEPTION 'Not allowed' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO f FROM public.followup_queue WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'That follow-up no longer exists'; END IF;

  UPDATE public.followup_queue SET status = 'sent', handled_by = auth.uid(), handled_at = now() WHERE id = p_id;

  IF f.type IN ('email_info', 'email_proposal', 'email_after_meeting', 'email_noshow') THEN
    UPDATE public.call_leads
    SET nudge_count = 0,
        nudge_due_at = public.followup_nudge_at(timezone, 3)
    WHERE id = f.lead_id AND status = 'followup'
    RETURNING nudge_due_at INTO due;
  END IF;

  -- "Sent — proposal attached": the deal moves forward (never backward).
  IF p_proposal THEN
    SELECT * INTO l FROM public.call_leads WHERE id = f.lead_id;
    IF l.deal_id IS NOT NULL THEN
      UPDATE public.deals
      SET stage = 'proposal_sent', probability = GREATEST(COALESCE(probability, 0), 40),
          next_action = 'Follow up on the proposal', next_action_date = current_date + 3
      WHERE id = l.deal_id AND stage IN ('new', 'contacted', 'qualified');
      -- (the deals table records the stage change itself)
    END IF;
  END IF;
  RETURN due;
END;
$$;

REVOKE ALL ON FUNCTION public.followup_mark_sent(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.followup_mark_sent(uuid, boolean) TO authenticated;
