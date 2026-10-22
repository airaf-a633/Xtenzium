-- ═══════════════════════════════════════════════════════════
-- 030 · Fixes from the end-to-end pass
--
--   1. finish_import(): a rep's import saves its totals (call_lists is
--      admin-write only, so the old direct update silently did nothing).
--   2. The rep's WORKDAY. A rep in Pakistan working US hours spans Karachi
--      midnight, so "today" was splitting the shift: the dial counter reset
--      mid-shift and "skip until tomorrow" brought a lead back 35 minutes
--      later. profiles.workday_start_hour moves the boundary (12 = noon
--      local, set automatically for callers 3+ hours ahead of UTC).
--      dialer_workday_start() is the single definition; the queue, skip and
--      the screen's counters all use it.
--   3. "Ready now" / "in play" leave snoozed leads out.
--   4. Equal-score leads get a stable order (id as the last tie-break).
--
-- Idempotent: safe to run twice.
-- ═══════════════════════════════════════════════════════════

-- ─── 1 · finish_import ────────────────────────────────────

CREATE OR REPLACE FUNCTION public.finish_import(p_list_id uuid, p_imported integer, p_skipped integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_staff() THEN
    RAISE EXCEPTION 'Not allowed' USING ERRCODE = '42501';
  END IF;
  UPDATE public.call_lists
  SET row_count = GREATEST(COALESCE(p_imported, 0), 0), skipped_count = GREATEST(COALESCE(p_skipped, 0), 0)
  WHERE id = p_list_id AND (uploaded_by = auth.uid() OR public.is_admin());
END;
$$;

REVOKE ALL ON FUNCTION public.finish_import(uuid, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finish_import(uuid, integer, integer) TO authenticated;

-- ─── 2 · the workday ──────────────────────────────────────

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS workday_start_hour smallint NOT NULL DEFAULT 0;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_workday_start_hour_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_workday_start_hour_check CHECK (workday_start_hour BETWEEN 0 AND 23);

-- Callers whose clock is 3+ hours ahead of UTC call the US in their evening and night:
-- their working day starts at noon, not midnight.
DO $$
BEGIN
  UPDATE public.profiles p
  SET workday_start_hour = 12
  WHERE p.role = 'caller'
    AND p.workday_start_hour = 0
    AND EXISTS (SELECT 1 FROM pg_timezone_names z WHERE z.name = p.timezone)
    AND extract(epoch FROM ((now() AT TIME ZONE p.timezone) - (now() AT TIME ZONE 'UTC'))) / 3600 >= 3;
END $$;

-- When the current working day began, for the signed-in person.
CREATE OR REPLACE FUNCTION public.dialer_workday_start()
RETURNS timestamptz
LANGUAGE sql
STABLE
AS $$
  SELECT (
    date_trunc('day', (now() AT TIME ZONE x.tz) - make_interval(hours => x.h)) + make_interval(hours => x.h)
  ) AT TIME ZONE x.tz
  FROM (
    SELECT
      COALESCE((SELECT p.timezone FROM public.profiles p JOIN pg_timezone_names z ON z.name = p.timezone WHERE p.id = auth.uid()), 'Asia/Karachi') AS tz,
      COALESCE((SELECT p.workday_start_hour FROM public.profiles p WHERE p.id = auth.uid()), 0)::int AS h
  ) x;
$$;

REVOKE ALL ON FUNCTION public.dialer_workday_start() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dialer_workday_start() TO authenticated;

-- Skip: hidden until the NEXT working day starts (not the next calendar midnight).
CREATE OR REPLACE FUNCTION public.dialer_skip_lead(p_lead_id uuid)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  till timestamptz;
BEGIN
  IF NOT public.is_staff() THEN
    RAISE EXCEPTION 'Not allowed' USING ERRCODE = '42501';
  END IF;
  till := public.dialer_workday_start() + interval '1 day';
  UPDATE public.call_leads
  SET snoozed_until = till
  WHERE id = p_lead_id AND status IN ('new', 'retry', 'callback', 'nurture');
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That lead is not in the queue';
  END IF;
  RETURN till;
END;
$$;

-- ─── the queue: workday-based dial count, stable order ────

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
  done AS (
    SELECT count(*)::int AS c
    FROM public.call_activities a
    WHERE a.caller_id = auth.uid() AND a.created_at >= public.dialer_workday_start()
  ),
  turn AS (
    SELECT (cfg.n > 0 AND ((done.c + COALESCE(p_assume_dials, 0)) % cfg.n) = cfg.n - 1) AS retry_turn
    FROM cfg, done
  )
  SELECT l.*
  FROM public.call_leads l, turn
  WHERE l.phone_e164 IS NOT NULL
    AND l.phone_is_us IS TRUE
    AND l.status IN ('new', 'retry', 'callback', 'nurture')
    AND (p_list_id IS NULL OR l.list_id = p_list_id)
    AND (
      (p_tiers IS NULL AND (l.tier IS DISTINCT FROM 'D' OR l.status = 'callback'))
      OR (p_tiers IS NOT NULL AND COALESCE(l.tier, '-') = ANY (p_tiers))
    )
    AND l.id <> ALL (COALESCE(p_skip, '{}'))
    AND (l.snoozed_until IS NULL OR l.snoozed_until <= now())
    AND (l.status = 'new' OR l.next_call_at <= now())
    AND (
      l.status = 'callback' OR l.last_called_at IS NULL
      OR (l.last_called_at AT TIME ZONE COALESCE(l.timezone, 'America/New_York'))::date
         < (now() AT TIME ZONE COALESCE(l.timezone, 'America/New_York'))::date
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.dnc_list d
      WHERE d.phone_e164 = l.phone_e164 OR (d.domain IS NOT NULL AND d.domain = l.domain)
    )
    AND (
      (l.status = 'callback' AND l.next_call_at > now() - interval '1 day')
      OR (p_ignore_hours AND public.is_admin())
      OR public.dialer_in_window(l.timezone)
    )
  ORDER BY
    CASE
      WHEN l.status = 'callback' THEN 0
      WHEN l.status IN ('retry', 'nurture') THEN CASE WHEN turn.retry_turn THEN 1 ELSE 2 END
      ELSE CASE WHEN turn.retry_turn THEN 2 ELSE 1 END
    END,
    CASE WHEN l.status = 'callback' THEN l.next_call_at END,
    l.tier NULLS LAST,
    l.score DESC NULLS LAST,
    l.next_call_at NULLS FIRST,
    l.created_at,
    l.id
  LIMIT 1;
$$;

-- ─── 3 · queue counts leave snoozed leads out ─────────────

CREATE OR REPLACE FUNCTION public.dialer_list_summary()
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(jsonb_agg(x ORDER BY (x->>'created_at') DESC), '[]'::jsonb)
  FROM (
    SELECT jsonb_build_object(
      'id', cl.id,
      'name', cl.name,
      'created_at', cl.created_at,
      'in_play', count(l.id) FILTER (
        WHERE l.status IN ('new', 'retry', 'callback') AND l.phone_is_us IS TRUE AND l.phone_e164 IS NOT NULL
          AND l.tier IS DISTINCT FROM 'D' AND (l.snoozed_until IS NULL OR l.snoozed_until <= now())),
      'callable_now', count(l.id) FILTER (
        WHERE l.status IN ('new', 'retry', 'callback') AND l.phone_is_us IS TRUE AND l.phone_e164 IS NOT NULL
          AND l.tier IS DISTINCT FROM 'D'
          AND (l.snoozed_until IS NULL OR l.snoozed_until <= now())
          AND (l.status = 'new' OR l.next_call_at <= now())
          AND (l.status = 'callback' OR public.dialer_in_window(l.timezone))),
      'parked', count(l.id) FILTER (WHERE l.tier = 'D' AND l.status IN ('new', 'retry', 'callback'))
    ) AS x
    FROM public.call_lists cl
    LEFT JOIN public.call_leads l ON l.list_id = cl.id
    GROUP BY cl.id
  ) s;
$$;
