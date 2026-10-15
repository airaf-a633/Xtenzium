-- ═══════════════════════════════════════════════════════════
-- 026 · Skip is remembered
--
--   Skip used to live only in the browser, so a reload, a filter change
--   or a new session served the same lead again. Now a skip snoozes the
--   lead in the database until the rep's next morning.
--
--   1. call_leads.snoozed_until + dialer_next_lead / dialer_tier_counts
--      leave snoozed leads out.
--   2. dialer_skip_lead / dialer_unskip_lead (staff).
--   3. Any real change to a lead (a logged call, an undo) clears the snooze.
--   4. dialer_known_keys also returns company names, so the import can
--      warn about "same company, different phone".
--
-- Idempotent: safe to run twice.
-- ═══════════════════════════════════════════════════════════

ALTER TABLE public.call_leads ADD COLUMN IF NOT EXISTS snoozed_until timestamptz;

-- A logged call (or its undo) moves the lead on; a leftover snooze must not hide it.
CREATE OR REPLACE FUNCTION public.call_leads_clear_snooze()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.snoozed_until IS NOT DISTINCT FROM OLD.snoozed_until
     AND (NEW.status, NEW.attempt_count, NEW.next_call_at) IS DISTINCT FROM (OLD.status, OLD.attempt_count, OLD.next_call_at) THEN
    NEW.snoozed_until := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS call_leads_clear_snooze ON public.call_leads;
CREATE TRIGGER call_leads_clear_snooze
  BEFORE UPDATE ON public.call_leads
  FOR EACH ROW EXECUTE FUNCTION public.call_leads_clear_snooze();

-- ─── The queue, minus snoozed leads ───────────────────────

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
    SELECT COALESCE((SELECT timezone FROM public.profiles WHERE id = auth.uid()), 'Asia/Karachi') AS tz
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
    AND l.status IN ('new', 'retry', 'callback')
    AND (p_list_id IS NULL OR l.list_id = p_list_id)
    AND (p_tiers IS NULL OR COALESCE(l.tier, '-') = ANY (p_tiers))
    AND l.id <> ALL (COALESCE(p_skip, '{}'))
    AND (l.snoozed_until IS NULL OR l.snoozed_until <= now())
    AND (l.status = 'new' OR l.next_call_at <= now())
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
    AND (snoozed_until IS NULL OR snoozed_until <= now())
    AND (p_list_id IS NULL OR list_id = p_list_id);
$$;

-- ─── Skip / un-skip ───────────────────────────────────────

-- Snooze until the start of the rep's next day. Returns when it comes back.
CREATE OR REPLACE FUNCTION public.dialer_skip_lead(p_lead_id uuid)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tz   text;
  till timestamptz;
BEGIN
  IF NOT public.is_staff() THEN
    RAISE EXCEPTION 'Not allowed' USING ERRCODE = '42501';
  END IF;
  tz := COALESCE((SELECT timezone FROM public.profiles WHERE id = auth.uid()), 'Asia/Karachi');
  till := (date_trunc('day', now() AT TIME ZONE tz) + interval '1 day') AT TIME ZONE tz;
  UPDATE public.call_leads
  SET snoozed_until = till
  WHERE id = p_lead_id AND status IN ('new', 'retry', 'callback');
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That lead is not in the queue';
  END IF;
  RETURN till;
END;
$$;

CREATE OR REPLACE FUNCTION public.dialer_unskip_lead(p_lead_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_staff() THEN
    RAISE EXCEPTION 'Not allowed' USING ERRCODE = '42501';
  END IF;
  UPDATE public.call_leads SET snoozed_until = NULL WHERE id = p_lead_id;
END;
$$;

REVOKE ALL ON FUNCTION public.dialer_skip_lead(uuid), public.dialer_unskip_lead(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dialer_skip_lead(uuid), public.dialer_unskip_lead(uuid) TO authenticated;

-- ─── Company names, for "possible duplicate" warnings ─────

CREATE OR REPLACE FUNCTION public.dialer_known_keys()
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  SELECT jsonb_build_object(
    'phones',      COALESCE((SELECT jsonb_agg(phone_e164) FROM public.call_leads WHERE phone_e164 IS NOT NULL), '[]'),
    'domains',     COALESCE((SELECT jsonb_agg(domain)     FROM public.call_leads WHERE domain     IS NOT NULL), '[]'),
    'dnc_phones',  COALESCE((SELECT jsonb_agg(phone_e164) FROM public.dnc_list   WHERE phone_e164 IS NOT NULL), '[]'),
    'dnc_domains', COALESCE((SELECT jsonb_agg(domain)     FROM public.dnc_list   WHERE domain     IS NOT NULL), '[]'),
    'companies',   COALESCE((SELECT jsonb_agg(jsonb_build_object('n', company_name, 's', state)) FROM public.call_leads), '[]')
  );
$$;
