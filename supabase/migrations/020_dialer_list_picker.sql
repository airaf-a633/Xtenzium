-- ═══════════════════════════════════════════════════════════
-- 020 · Dialer — calling from a chosen list
--
-- dialer_next_lead() gains p_list_id: NULL means every list (as before),
-- a uuid means "only leads from this upload". dialer_list_summary()
-- feeds the picker with how many leads in each list are ready.
--
-- Idempotent: safe to run twice.
-- ═══════════════════════════════════════════════════════════

-- Replace, don't overload: two functions with the same name and
-- overlapping defaults make a named-argument call ambiguous.
DROP FUNCTION IF EXISTS public.dialer_next_lead(uuid[], boolean);

CREATE OR REPLACE FUNCTION public.dialer_next_lead(
  p_skip          uuid[]  DEFAULT '{}',
  p_ignore_hours  boolean DEFAULT false,
  p_list_id       uuid    DEFAULT NULL
)
RETURNS SETOF public.call_leads
LANGUAGE sql
STABLE
AS $$
  SELECT l.*
  FROM public.call_leads l
  WHERE l.phone_e164 IS NOT NULL
    AND l.phone_is_us IS TRUE
    AND l.status IN ('new', 'retry', 'callback')
    AND (p_list_id IS NULL OR l.list_id = p_list_id)
    AND l.id <> ALL (COALESCE(p_skip, '{}'))
    AND (l.status = 'new' OR l.next_call_at <= now())
    -- A callback has an agreed time, so it is served whatever the clock says.
    AND (
      l.status = 'callback'
      OR (p_ignore_hours AND public.is_admin())
      OR public.dialer_in_window(l.timezone)
    )
  ORDER BY
    CASE l.status WHEN 'callback' THEN 0 WHEN 'new' THEN 1 ELSE 2 END,
    l.tier NULLS LAST,
    l.score DESC NULLS LAST,
    l.next_call_at NULLS FIRST,
    l.created_at
  LIMIT 1;
$$;

-- One row per list: how many leads could be dialled (US number, still
-- in play) and how many of those are callable right now. Newest first.
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
        WHERE l.status IN ('new', 'retry', 'callback') AND l.phone_is_us IS TRUE AND l.phone_e164 IS NOT NULL),
      'callable_now', count(l.id) FILTER (
        WHERE l.status IN ('new', 'retry', 'callback') AND l.phone_is_us IS TRUE AND l.phone_e164 IS NOT NULL
          AND (l.status = 'new' OR l.next_call_at <= now())
          AND (l.status = 'callback' OR public.dialer_in_window(l.timezone)))
    ) AS x
    FROM public.call_lists cl
    LEFT JOIN public.call_leads l ON l.list_id = cl.id
    GROUP BY cl.id
  ) s;
$$;

REVOKE ALL ON FUNCTION public.dialer_next_lead(uuid[], boolean, uuid), public.dialer_list_summary() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dialer_next_lead(uuid[], boolean, uuid), public.dialer_list_summary() TO authenticated;
