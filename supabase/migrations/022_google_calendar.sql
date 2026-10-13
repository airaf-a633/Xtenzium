-- ═══════════════════════════════════════════════════════════
-- 022 · Google Calendar
--
--   google_connection   the ONE connected Google account (refresh token).
--                       RLS is on and there are deliberately NO policies:
--                       the browser can never read it. Only the server
--                       functions in /api, using the service-role key,
--                       touch this table.
--   google_status()     "connected as x@gmail.com?" without the token
--   google_disconnect() admin: forget the connection
--   meetings            every meeting booked through the calendar
--   meeting_set_status  admin: held / no-show / cancelled, with the
--                       matching change to the lead
--   dialer_settings     + when the owner can take meetings
--
-- Idempotent: safe to run twice.
-- ═══════════════════════════════════════════════════════════

-- ─── The connection (server-only) ─────────────────────────

CREATE TABLE IF NOT EXISTS public.google_connection (
  id             boolean PRIMARY KEY DEFAULT true CHECK (id),
  google_email   text NOT NULL,
  refresh_token  text NOT NULL,
  calendar_id    text NOT NULL DEFAULT 'primary',
  status         text NOT NULL DEFAULT 'ok' CHECK (status IN ('ok', 'error')),
  last_error     text,
  connected_by   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  connected_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.google_connection ENABLE ROW LEVEL SECURITY;
-- No policy on purpose, and no grants either — belt and braces.
REVOKE ALL ON public.google_connection FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.google_status()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE c public.google_connection;
BEGIN
  IF NOT public.is_staff() THEN
    RAISE EXCEPTION 'Not allowed' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO c FROM public.google_connection LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('connected', false);
  END IF;
  RETURN jsonb_build_object(
    'connected', c.status = 'ok',
    'email', c.google_email,
    'status', c.status,
    'error', c.last_error,
    'connected_at', c.connected_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.google_disconnect()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admins only' USING ERRCODE = '42501';
  END IF;
  DELETE FROM public.google_connection;
END;
$$;

-- ─── When the owner can take meetings ─────────────────────
--
-- Hours are in the owner's own timezone. A window that wraps midnight
-- (18 → 2) is allowed: prospects are in the US, so the owner's
-- evenings are the prospect's business day.

ALTER TABLE public.dialer_settings
  ADD COLUMN IF NOT EXISTS meeting_owner_tz        text    NOT NULL DEFAULT 'Asia/Karachi',
  ADD COLUMN IF NOT EXISTS meeting_hours_from      integer NOT NULL DEFAULT 18,
  ADD COLUMN IF NOT EXISTS meeting_hours_to        integer NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS meeting_default_minutes integer NOT NULL DEFAULT 30;

ALTER TABLE public.dialer_settings DROP CONSTRAINT IF EXISTS dialer_settings_meeting_hours_check;
ALTER TABLE public.dialer_settings ADD CONSTRAINT dialer_settings_meeting_hours_check
  CHECK (meeting_hours_from BETWEEN 0 AND 23 AND meeting_hours_to BETWEEN 0 AND 24
         AND meeting_default_minutes IN (15, 20, 30, 45, 60));

-- ─── Meetings ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.meetings (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id         uuid NOT NULL REFERENCES public.call_leads(id) ON DELETE CASCADE,
  deal_id         uuid REFERENCES public.deals(id) ON DELETE SET NULL,
  google_event_id text,
  meet_link       text,
  calendar_link   text,
  starts_at       timestamptz NOT NULL,
  ends_at         timestamptz NOT NULL,
  attendee_name   text,
  attendee_email  text,
  rep_id          uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  rep_email       text,
  status          text NOT NULL DEFAULT 'scheduled'
                    CHECK (status IN ('scheduled', 'held', 'no_show', 'cancelled')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at)
);
CREATE INDEX IF NOT EXISTS meetings_status_idx ON public.meetings (status, starts_at);
CREATE INDEX IF NOT EXISTS meetings_lead_idx   ON public.meetings (lead_id);

ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "meetings_admin_all" ON public.meetings;
CREATE POLICY "meetings_admin_all" ON public.meetings FOR ALL TO authenticated
  USING ((SELECT public.is_admin())) WITH CHECK ((SELECT public.is_admin()));

-- The rep can see meetings (rows are created by the server on booking).
DROP POLICY IF EXISTS "meetings_staff_select" ON public.meetings;
CREATE POLICY "meetings_staff_select" ON public.meetings FOR SELECT TO authenticated
  USING ((SELECT public.is_staff()));

-- What happened to a meeting, and what that means for the lead.
CREATE OR REPLACE FUNCTION public.meeting_set_status(p_meeting_id uuid, p_status text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE m public.meetings;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admins only' USING ERRCODE = '42501';
  END IF;
  IF p_status NOT IN ('held', 'no_show', 'cancelled') THEN
    RAISE EXCEPTION 'Unknown meeting status %', p_status;
  END IF;

  SELECT * INTO m FROM public.meetings WHERE id = p_meeting_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Meeting not found'; END IF;

  UPDATE public.meetings SET status = p_status WHERE id = p_meeting_id;

  IF p_status = 'no_show' THEN
    -- Back to the rep's queue as a callback, right now.
    UPDATE public.call_leads SET status = 'callback', next_call_at = now() WHERE id = m.lead_id AND status = 'meeting';
  ELSE
    -- Held or cancelled: it is no longer an upcoming meeting.
    UPDATE public.call_leads SET status = 'followup', next_call_at = NULL WHERE id = m.lead_id AND status = 'meeting';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.google_status(), public.google_disconnect(), public.meeting_set_status(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.google_status(), public.google_disconnect(), public.meeting_set_status(uuid, text) TO authenticated;
