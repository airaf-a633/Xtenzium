-- ═══════════════════════════════════════════════════════════
-- 024 · Email outreach worklist
--
-- Leads with no phone number (and non-US numbers the dialer won't
-- offer) used to sit untouched. This gives them a worklist of their own:
-- email them, follow up on a widening schedule, and record what came
-- of it — without ever counting as a phone dial.
--
-- Outreach is a SEPARATE dimension from the call status. Emailing a
-- lead who is also being phoned never changes its call status; only a
-- real outcome (they replied, said no, asked to stop, bad address) does.
--
-- Cadence: first email, then follow-ups 4, 7 and 10 business days
-- apart (touches widen as the goal shifts from reinforcement to
-- coverage), four touches in all, then the sequence ends.
--
-- Idempotent: safe to run twice.
-- ═══════════════════════════════════════════════════════════

ALTER TABLE public.call_leads
  ADD COLUMN IF NOT EXISTS outreach_touches integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS outreach_due     timestamptz,
  ADD COLUMN IF NOT EXISTS outreach_last_at timestamptz;

CREATE INDEX IF NOT EXISTS call_leads_outreach_idx ON public.call_leads (outreach_due) WHERE outreach_due IS NOT NULL;

-- ─── What was done, per lead ──────────────────────────────

CREATE TABLE IF NOT EXISTS public.outreach_activities (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id     uuid NOT NULL REFERENCES public.call_leads(id) ON DELETE CASCADE,
  actor_id    uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  action      text NOT NULL CHECK (action IN (
                'emailed', 'followed_up', 'form_sent', 'email_found',
                'replied', 'not_interested', 'bad_contact', 'opted_out', 'note')),
  note        text,
  touch       integer,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS outreach_activities_lead_idx ON public.outreach_activities (lead_id, created_at DESC);
CREATE INDEX IF NOT EXISTS outreach_activities_day_idx  ON public.outreach_activities (created_at DESC);

ALTER TABLE public.outreach_activities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "outreach_activities_admin_all" ON public.outreach_activities;
CREATE POLICY "outreach_activities_admin_all" ON public.outreach_activities FOR ALL TO authenticated
  USING ((SELECT public.is_admin())) WITH CHECK ((SELECT public.is_admin()));
DROP POLICY IF EXISTS "outreach_activities_staff_select" ON public.outreach_activities;
CREATE POLICY "outreach_activities_staff_select" ON public.outreach_activities FOR SELECT TO authenticated
  USING ((SELECT public.is_staff()));
-- Writes go through log_outreach() only: there is no staff INSERT policy.

-- ─── Email templates for outreach ─────────────────────────

ALTER TABLE public.email_templates DROP CONSTRAINT IF EXISTS email_templates_type_check;
ALTER TABLE public.email_templates ADD CONSTRAINT email_templates_type_check
  CHECK (type IN ('email_info', 'email_proposal', 'linkedin', 'admin_call', 'outreach_first', 'outreach_followup'));

-- Merge fields: {{company_name}} {{contact_name}} {{sender_name}}.
-- Every cold email needs an honest sender, a postal address and a way
-- to opt out (CAN-SPAM covers B2B email). Put your real address where
-- the brackets are — in Dialer settings, once.
INSERT INTO public.email_templates (type, subject, body) VALUES
('outreach_first', 'Design and development capacity for {{company_name}}',
E'Hi {{contact_name}},\n\nI’ll keep this short. We help agencies like {{company_name}} take on more work without hiring: for what you’d pay to bring on one person, you get an entire design and development team — and you only ever deal with one project manager.\n\nWould a 15-minute call be worth it, to see if it fits how you work?\n\n{{sender_name}}\nXtenzium · contact@xtenzium.com\n[Your business postal address]\n\nIf you’d rather not hear from us, just reply “no thanks” and I won’t contact you again.'),
('outreach_followup', 'Re: design and development capacity for {{company_name}}',
E'Hi {{contact_name}},\n\nA quick follow-up in case my last note got buried. The short version: an entire team for the price of one hire, with a single project manager as your only point of contact.\n\nIf it’s not relevant, no problem — and if it’s a question of timing, tell me when to check back.\n\n{{sender_name}}\nXtenzium · contact@xtenzium.com\n[Your business postal address]\n\nIf you’d rather not hear from us, just reply “no thanks” and I won’t contact you again.')
ON CONFLICT (type) DO NOTHING;

-- Whoever sends outreach needs the outreach templates. The follow-up
-- emails (info / proposal) stay readable by admins only.
DROP POLICY IF EXISTS "email_templates_staff_outreach_select" ON public.email_templates;
CREATE POLICY "email_templates_staff_outreach_select" ON public.email_templates FOR SELECT TO authenticated
  USING ((SELECT public.is_staff()) AND type LIKE 'outreach\_%');

-- ─── The worklist ─────────────────────────────────────────
--
-- Statuses where a lead is still in play for outreach.
-- (Not lost / disqualified / bad data / do-not-call / exhausted / in a meeting / being handled.)

CREATE OR REPLACE FUNCTION public.outreach_in_play(p_status text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT p_status IN ('new', 'retry', 'callback', 'no_phone');
$$;

-- tab: to_email · find_email · due · after_call · waiting
--   to_email    nobody has emailed them, we have an address, and a phone call isn't an option
--   find_email  same, but we still need an address (website / contact form are on the card)
--   due         in the sequence and the next touch is due
--   after_call  we phoned and didn't reach them, we have their email, and we haven't emailed
--   waiting     in the sequence, next touch not due yet
-- "A phone call isn't an option" = no phone number, or a non-US number the dialer never offers.
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
    AND (p_tiers IS NULL OR COALESCE(l.tier, '-') = ANY (p_tiers))
    AND (p_search IS NULL OR p_search = ''
         OR l.company_name ILIKE '%' || p_search || '%' OR l.domain ILIKE '%' || p_search || '%')
    AND CASE p_tab
      WHEN 'to_email' THEN
        l.outreach_touches = 0 AND l.email IS NOT NULL
        AND (l.phone_e164 IS NULL OR l.phone_is_us IS NOT TRUE) AND l.status IN ('no_phone', 'new', 'retry')
      WHEN 'find_email' THEN
        l.outreach_touches = 0 AND l.email IS NULL
        AND (l.phone_e164 IS NULL OR l.phone_is_us IS NOT TRUE) AND l.status IN ('no_phone', 'new', 'retry')
      WHEN 'due' THEN
        l.outreach_touches > 0 AND l.outreach_due IS NOT NULL AND l.outreach_due <= now()
      WHEN 'waiting' THEN
        l.outreach_touches > 0 AND l.outreach_due IS NOT NULL AND l.outreach_due > now()
      WHEN 'after_call' THEN
        l.status = 'retry' AND l.outreach_touches = 0 AND l.email IS NOT NULL
        AND l.phone_e164 IS NOT NULL AND l.phone_is_us IS TRUE
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

-- Tab sizes in one round trip, plus today's sends.
CREATE OR REPLACE FUNCTION public.outreach_counts(p_tiers text[] DEFAULT NULL)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  SELECT jsonb_build_object(
    'to_email',   count(*) FILTER (WHERE l.outreach_touches = 0 AND l.email IS NOT NULL
                    AND (l.phone_e164 IS NULL OR l.phone_is_us IS NOT TRUE) AND l.status IN ('no_phone', 'new', 'retry')),
    'find_email', count(*) FILTER (WHERE l.outreach_touches = 0 AND l.email IS NULL
                    AND (l.phone_e164 IS NULL OR l.phone_is_us IS NOT TRUE) AND l.status IN ('no_phone', 'new', 'retry')),
    'due',        count(*) FILTER (WHERE l.outreach_touches > 0 AND l.outreach_due IS NOT NULL AND l.outreach_due <= now()),
    'waiting',    count(*) FILTER (WHERE l.outreach_touches > 0 AND l.outreach_due IS NOT NULL AND l.outreach_due > now()),
    'after_call', count(*) FILTER (WHERE l.status = 'retry' AND l.outreach_touches = 0 AND l.email IS NOT NULL
                    AND l.phone_e164 IS NOT NULL AND l.phone_is_us IS TRUE),
    'sent_today', (SELECT count(*) FROM public.outreach_activities a
                   WHERE a.action IN ('emailed', 'followed_up', 'form_sent')
                     AND a.created_at >= date_trunc('day', now() AT TIME ZONE 'Asia/Karachi') AT TIME ZONE 'Asia/Karachi')
  )
  FROM public.call_leads l
  WHERE public.outreach_in_play(l.status)
    AND (p_tiers IS NULL OR COALESCE(l.tier, '-') = ANY (p_tiers));
$$;

-- ─── Recording what was done ──────────────────────────────
--
-- emailed / followed_up / form_sent   a touch: the sequence moves on
-- email_found                         saves an address, nothing else
-- replied                             a real conversation: task for the team + a deal
-- not_interested / bad_contact        closes the lead
-- opted_out                           do-not-call, by website and phone
-- note                                just a note
--
-- Never touches the call status except for the outcomes that really
-- change it (replied, not_interested, bad_contact, opted_out).

CREATE OR REPLACE FUNCTION public.log_outreach(
  p_lead_id uuid,
  p_action  text,
  p_note    text DEFAULT NULL,
  p_email   text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  l          public.call_leads;
  touches    integer;
  due        timestamptz;
  gaps       integer[] := ARRAY[4, 7, 10];
  max_touch  integer := 4;
  tz         text;
  email_in   text := NULLIF(lower(btrim(p_email)), '');
  new_status text;
  me_name    text;
  deal       public.deals;
BEGIN
  IF NOT public.is_staff() THEN
    RAISE EXCEPTION 'Not allowed' USING ERRCODE = '42501';
  END IF;
  IF p_action NOT IN ('emailed', 'followed_up', 'form_sent', 'email_found', 'replied', 'not_interested', 'bad_contact', 'opted_out', 'note') THEN
    RAISE EXCEPTION 'Unknown action %', p_action;
  END IF;

  SELECT * INTO l FROM public.call_leads WHERE id = p_lead_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Lead not found'; END IF;

  tz         := COALESCE(l.timezone, 'America/New_York');
  touches    := l.outreach_touches;
  due        := l.outreach_due;
  new_status := l.status;
  SELECT full_name INTO me_name FROM public.profiles WHERE id = auth.uid();

  IF email_in IS NOT NULL THEN
    IF email_in !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' THEN
      RAISE EXCEPTION 'That doesn’t look like an email address';
    END IF;
    UPDATE public.call_leads SET email = email_in WHERE id = l.id;
  END IF;
  IF p_action = 'email_found' AND email_in IS NULL THEN
    RAISE EXCEPTION 'Enter the email address';
  END IF;

  CASE p_action
    WHEN 'emailed', 'followed_up', 'form_sent' THEN
      touches := touches + 1;
      IF touches >= max_touch THEN
        due := NULL;                                           -- the sequence has run its course
      ELSE
        due := public.dialer_retry_at(tz, gaps[LEAST(touches, array_length(gaps, 1))], touches, l.timezone IS NOT NULL);
      END IF;
      UPDATE public.call_leads SET outreach_touches = touches, outreach_due = due, outreach_last_at = now() WHERE id = l.id;

    WHEN 'replied' THEN
      new_status := 'followup';
      due := NULL;
      UPDATE public.call_leads SET status = 'followup', outreach_due = NULL, next_call_at = NULL WHERE id = l.id;
      INSERT INTO public.followup_queue (lead_id, type, note, requested_by)
      SELECT l.id, 'email_info', 'Replied to our email. ' || COALESCE(NULLIF(btrim(p_note), ''), ''), auth.uid()
      WHERE NOT EXISTS (SELECT 1 FROM public.followup_queue WHERE lead_id = l.id AND type = 'email_info' AND status = 'queued');
      IF l.deal_id IS NULL THEN
        INSERT INTO public.deals (title, company, contact_name, contact_email, contact_phone, stage, probability, source, next_action, next_action_date)
        VALUES (l.company_name, l.company_name, l.contact_name, COALESCE(email_in, l.email), l.phone_raw,
                'contacted', 10, 'outbound', 'Reply to their email', current_date + 1)
        RETURNING * INTO deal;
        UPDATE public.call_leads SET deal_id = deal.id WHERE id = l.id;
        INSERT INTO public.deal_activities (deal_id, type, content, created_by)
        VALUES (deal.id, 'created', 'Replied to cold email', me_name);
      END IF;

    WHEN 'not_interested' THEN
      new_status := 'lost';
      UPDATE public.call_leads SET status = 'lost', outreach_due = NULL, next_call_at = NULL WHERE id = l.id;

    WHEN 'bad_contact' THEN
      new_status := 'bad_data';
      UPDATE public.call_leads SET status = 'bad_data', outreach_due = NULL, next_call_at = NULL WHERE id = l.id;

    WHEN 'opted_out' THEN
      new_status := 'dnc';
      UPDATE public.call_leads SET status = 'dnc', outreach_due = NULL, next_call_at = NULL WHERE id = l.id;
      IF l.phone_e164 IS NOT NULL THEN
        INSERT INTO public.dnc_list (phone_e164, reason) VALUES (l.phone_e164, 'Asked to stop (email outreach)') ON CONFLICT DO NOTHING;
      END IF;
      IF l.domain IS NOT NULL THEN
        INSERT INTO public.dnc_list (domain, reason) VALUES (l.domain, 'Asked to stop (email outreach)') ON CONFLICT DO NOTHING;
      END IF;

    ELSE
      NULL;  -- email_found, note: recorded below, nothing else changes
  END CASE;

  INSERT INTO public.outreach_activities (lead_id, actor_id, action, note, touch)
  VALUES (l.id, auth.uid(), p_action, NULLIF(btrim(p_note), ''),
          CASE WHEN p_action IN ('emailed', 'followed_up', 'form_sent') THEN touches END);

  RETURN jsonb_build_object(
    'status', new_status,
    'touches', touches,
    'next_touch_at', due,
    'sequence_done', (p_action IN ('emailed', 'followed_up', 'form_sent') AND touches >= max_touch)
  );
END;
$$;

REVOKE ALL ON FUNCTION
  public.outreach_in_play(text),
  public.outreach_list(text, integer, integer, text[], text),
  public.outreach_counts(text[]),
  public.log_outreach(uuid, text, text, text)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION
  public.outreach_in_play(text),
  public.outreach_list(text, integer, integer, text[], text),
  public.outreach_counts(text[]),
  public.log_outreach(uuid, text, text, text)
TO authenticated;
