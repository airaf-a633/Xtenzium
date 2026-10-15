-- ═══════════════════════════════════════════════════════════
-- 025 · Calls and email working together, and the daily summary
--
--   1. After N missed calls (default 2), a lead we have an email for
--      moves onto the outreach worklist's "After a call" tab; one we
--      have NO email for appears under "Find an email" — so the second
--      channel opens at the point the first one has stalled.
--      (dialer_settings.email_after_attempts, 0 = off)
--   2. dialer_summary(): everything the owner wants to know about a
--      period — what the rep did, what's waiting on the owner — as one
--      JSON document. The cron job emails it; the Summary page shows it.
--
-- Idempotent: safe to run twice.
-- ═══════════════════════════════════════════════════════════

ALTER TABLE public.dialer_settings
  ADD COLUMN IF NOT EXISTS email_after_attempts integer NOT NULL DEFAULT 2 CHECK (email_after_attempts BETWEEN 0 AND 10);

CREATE OR REPLACE FUNCTION public.email_after_attempts()
RETURNS integer
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE((SELECT email_after_attempts FROM public.dialer_settings LIMIT 1), 2);
$$;

-- ─── Worklist: the second channel opens after N missed calls ──

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
    AND (p_tiers IS NULL OR COALESCE(l.tier, '-') = ANY (p_tiers));
$$;

-- ─── The daily summary ────────────────────────────────────
--
-- dialer_summary_data(): the document itself, no permission check —
-- callable only by the server (service role), which is how the cron job
-- gets it. dialer_summary(): the same for a signed-in admin.

CREATE OR REPLACE FUNCTION public.dialer_summary_data(p_from timestamptz, p_to timestamptz)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH a AS (
    SELECT ca.*, l.company_name
    FROM public.call_activities ca
    JOIN public.call_leads l ON l.id = ca.lead_id
    WHERE ca.created_at >= p_from AND ca.created_at < p_to
  )
  SELECT jsonb_build_object(
    'from', p_from,
    'to',   p_to,

    'calls', (SELECT jsonb_build_object(
        'dials', count(*),
        'conversations', count(*) FILTER (WHERE outcome NOT IN ('no_answer', 'voicemail', 'gatekeeper_name', 'gatekeeper_blocked', 'wrong_number')),
        'interested', count(*) FILTER (WHERE outcome IN ('interested_info', 'interested_proposal', 'interested_call', 'meeting_booked')),
        'meetings', count(*) FILTER (WHERE outcome = 'meeting_booked')
      ) FROM a),

    'by_outcome', COALESCE((SELECT jsonb_agg(jsonb_build_object('outcome', outcome, 'n', n) ORDER BY n DESC)
        FROM (SELECT outcome, count(*) AS n FROM a GROUP BY outcome) x), '[]'),

    'outreach', (SELECT jsonb_build_object(
        'sent',       count(*) FILTER (WHERE action IN ('emailed', 'followed_up', 'form_sent')),
        'replies',    count(*) FILTER (WHERE action = 'replied'),
        'opted_out',  count(*) FILTER (WHERE action = 'opted_out')
      ) FROM public.outreach_activities oa WHERE oa.created_at >= p_from AND oa.created_at < p_to),

    -- The conversations worth reading about, newest first.
    'hot', COALESCE((SELECT jsonb_agg(jsonb_build_object('company', company_name, 'outcome', outcome, 'note', note) ORDER BY created_at DESC)
        FROM (SELECT * FROM a WHERE outcome IN ('interested_info', 'interested_proposal', 'interested_call', 'meeting_booked')
              ORDER BY created_at DESC LIMIT 10) h), '[]'),

    'needs_you', jsonb_build_object(
      'followups', COALESCE((SELECT jsonb_agg(jsonb_build_object(
            'company', l.company_name, 'type', f.type, 'assignee', t.name, 'note', f.note,
            'age_hours', round(extract(epoch FROM (p_to - f.created_at)) / 3600)) ORDER BY f.created_at)
          FROM public.followup_queue f
          JOIN public.call_leads l ON l.id = f.lead_id
          LEFT JOIN public.team_members t ON t.id = f.assignee_id
          WHERE f.status = 'queued'), '[]'),
      'flagged', COALESCE((SELECT jsonb_agg(jsonb_build_object('company', l.company_name, 'outcome', ca.outcome, 'note', ca.note) ORDER BY ca.created_at)
          FROM public.call_activities ca JOIN public.call_leads l ON l.id = ca.lead_id
          WHERE ca.flagged AND ca.flag_resolved_at IS NULL), '[]'),
      'meetings', COALESCE((SELECT jsonb_agg(jsonb_build_object('company', l.company_name, 'at', l.next_call_at, 'contact', l.contact_name, 'email', l.email) ORDER BY l.next_call_at)
          FROM public.call_leads l
          WHERE l.status = 'meeting' AND l.next_call_at >= p_to - interval '1 day' AND l.next_call_at < p_to + interval '3 days'), '[]'),
      'callbacks_due', (SELECT count(*) FROM public.call_leads WHERE status = 'callback' AND next_call_at <= p_to),
      'retries_due',   (SELECT count(*) FROM public.call_leads WHERE status = 'retry' AND next_call_at <= p_to),
      'outreach_due',  (SELECT count(*) FROM public.call_leads
                        WHERE outreach_touches > 0 AND outreach_due IS NOT NULL AND outreach_due <= p_to
                          AND status IN ('new', 'retry', 'callback', 'no_phone'))
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.dialer_summary(p_from timestamptz, p_to timestamptz)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admins only' USING ERRCODE = '42501';
  END IF;
  RETURN public.dialer_summary_data(p_from, p_to);
END;
$$;

REVOKE ALL ON FUNCTION public.email_after_attempts(), public.dialer_summary(timestamptz, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.email_after_attempts(), public.dialer_summary(timestamptz, timestamptz) TO authenticated;

-- The unchecked version is for the server alone.
REVOKE ALL ON FUNCTION public.dialer_summary_data(timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION public.dialer_summary_data(timestamptz, timestamptz) TO service_role;
  END IF;
END $$;

REVOKE ALL ON FUNCTION public.outreach_list(text, integer, integer, text[], text), public.outreach_counts(text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.outreach_list(text, integer, integer, text[], text), public.outreach_counts(text[]) TO authenticated;
