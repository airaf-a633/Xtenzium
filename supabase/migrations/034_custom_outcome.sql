-- ═══════════════════════════════════════════════════════════
-- 034 · A call outcome the list doesn't have
--
-- The rep can log "something else": they write what happened, and pick
-- what should happen to the lead next from four effects. Underneath, the
-- effect runs through the SAME tested rules as the standard outcomes, so
-- retries, callbacks, follow-ups and undo behave exactly as usual:
--
--   retry     Try again tomorrow            = counts as an attempt, back in the queue
--   callback  Call back at a set time       = callback at the time given
--   team      Needs the team                = a task for the owners (and a deal), flagged
--   closed    Don't call again              = disqualified
--
-- The activity is stored with outcome 'other'; the rep's words travel with it
-- ("Custom: <what happened>") into the history, the follow-up task and the Inbox.
-- Idempotent: safe to run twice.
-- ═══════════════════════════════════════════════════════════

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
  l      public.call_leads;
  prev   public.call_activities;
  win    integer := COALESCE(NULLIF(current_setting('dialer.dedupe_seconds', true), '')::integer, 20);
  eff    text;
  lbl    text;
  base   text;
  rest   text[];
  result jsonb;
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

  -- ── Something else ──
  IF p_outcome = 'other' THEN
    SELECT substring(t FROM 8) INTO eff FROM unnest(COALESCE(p_tags, '{}')) t WHERE t LIKE 'effect:%' LIMIT 1;
    SELECT btrim(substring(t FROM 7)) INTO lbl FROM unnest(COALESCE(p_tags, '{}')) t WHERE t LIKE 'label:%' LIMIT 1;
    base := CASE eff WHEN 'retry' THEN 'no_answer' WHEN 'callback' THEN 'callback'
                     WHEN 'team' THEN 'interested_call' WHEN 'closed' THEN 'not_fit' END;
    IF base IS NULL THEN
      RAISE EXCEPTION 'Pick what should happen to this lead next';
    END IF;
    IF lbl IS NULL OR lbl = '' THEN
      RAISE EXCEPTION 'Write what happened on the call';
    END IF;
    IF length(lbl) > 120 THEN
      RAISE EXCEPTION 'Keep “what happened” under 120 characters; put the rest in the note';
    END IF;
    SELECT COALESCE(array_agg(t), '{}') INTO rest
    FROM unnest(COALESCE(p_tags, '{}')) t WHERE t NOT LIKE 'effect:%' AND t NOT LIKE 'label:%';

    result := public.log_call_core(p_lead_id, base, ARRAY['Custom: ' || lbl] || rest, p_note, p_flagged, p_at,
                                   p_contact_name, p_contact_title, p_contact_email);
    UPDATE public.call_activities SET outcome = 'other' WHERE id = (result ->> 'activity_id')::uuid;
    RETURN result;
  END IF;

  RETURN public.log_call_core(p_lead_id, p_outcome, p_tags, p_note, p_flagged, p_at,
                              p_contact_name, p_contact_title, p_contact_email);
END;
$$;

REVOKE ALL ON FUNCTION public.log_call(uuid, text, text[], text, boolean, timestamptz, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_call(uuid, text, text[], text, boolean, timestamptz, text, text, text) TO authenticated;
