-- ═══════════════════════════════════════════════════════════
-- 017 · Dialer — lists, leads, call log, DNC, follow-up queue
--
-- Access model (see 016): admins can do everything; a caller can work
-- the dialer tables and nothing else. Callers can read and update
-- leads, append to the call log, add to the DNC list and queue
-- follow-ups — but cannot delete or rewrite history.
--
-- Idempotent: safe to run twice.
-- ═══════════════════════════════════════════════════════════

-- ─── is_staff(): admin OR caller, and active ──────────────

CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin', 'caller') AND active
  );
$$;

REVOKE ALL ON FUNCTION public.is_staff() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_staff() TO authenticated;

-- ─── Lists (one per CSV upload) ───────────────────────────

CREATE TABLE IF NOT EXISTS public.call_lists (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name             text NOT NULL,
  source_filename  text,
  row_count        integer NOT NULL DEFAULT 0,
  skipped_count    integer NOT NULL DEFAULT 0,
  uploaded_by      uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- ─── Leads ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.call_leads (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id          uuid NOT NULL REFERENCES public.call_lists(id) ON DELETE CASCADE,

  company_name     text NOT NULL,
  phone_raw        text,
  /* Dedupe key. Null for email-only leads. */
  phone_e164       text,
  phone_is_us      boolean,
  email            text,
  website          text,
  /* Lower-cased host without "www." — the second dedupe key. */
  domain           text,
  contact_url      text,
  profile_url      text,

  hq               text,
  state            text,
  /* IANA zone derived from the HQ state. Null when unknown (e.g. HQ is
     just "United States"); the queue treats null as "only call in the
     window every US zone shares". */
  timezone         text,

  team_size        text,
  hourly_rate_usd  numeric,
  services         text,
  works_count      integer,
  tier             text CHECK (tier IN ('A', 'B', 'C')),
  score            integer,
  /* Talking points / why this lead matters. Shown on the call screen. */
  why              text,
  source           text,
  /* Any CSV column that didn't map to a field above. */
  extra            jsonb NOT NULL DEFAULT '{}',

  /* Filled in by the rep during calls. */
  contact_name     text,
  contact_title    text,

  status           text NOT NULL DEFAULT 'new' CHECK (status IN (
                     'new', 'retry', 'callback', 'followup', 'meeting',
                     'nurture', 'lost', 'disqualified', 'bad_data', 'dnc',
                     'exhausted', 'no_phone'
                   )),
  attempt_count    integer NOT NULL DEFAULT 0,
  last_called_at   timestamptz,
  next_call_at     timestamptz,
  assigned_to      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  deal_id          uuid REFERENCES public.deals(id) ON DELETE SET NULL,

  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS call_leads_updated_at ON public.call_leads;
CREATE TRIGGER call_leads_updated_at
  BEFORE UPDATE ON public.call_leads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE UNIQUE INDEX IF NOT EXISTS call_leads_phone_uidx
  ON public.call_leads (phone_e164) WHERE phone_e164 IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS call_leads_domain_uidx
  ON public.call_leads (domain) WHERE domain IS NOT NULL;
CREATE INDEX IF NOT EXISTS call_leads_list_idx   ON public.call_leads (list_id);
CREATE INDEX IF NOT EXISTS call_leads_queue_idx  ON public.call_leads (status, next_call_at);
CREATE INDEX IF NOT EXISTS call_leads_tier_idx   ON public.call_leads (tier, score DESC);

-- ─── Call log (append-only) ───────────────────────────────

CREATE TABLE IF NOT EXISTS public.call_activities (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id      uuid NOT NULL REFERENCES public.call_leads(id) ON DELETE CASCADE,
  caller_id    uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  outcome      text NOT NULL,
  reason_tags  text[] NOT NULL DEFAULT '{}',
  note         text,
  /* The rep can flag a call for the owner's attention. */
  flagged      boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS call_activities_lead_idx ON public.call_activities (lead_id, created_at DESC);
CREATE INDEX IF NOT EXISTS call_activities_day_idx  ON public.call_activities (created_at DESC);

-- ─── Do-not-call ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.dnc_list (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_e164  text,
  domain      text,
  reason      text,
  added_by    uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  added_at    timestamptz NOT NULL DEFAULT now(),
  CHECK (phone_e164 IS NOT NULL OR domain IS NOT NULL)
);
CREATE UNIQUE INDEX IF NOT EXISTS dnc_phone_uidx  ON public.dnc_list (phone_e164) WHERE phone_e164 IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS dnc_domain_uidx ON public.dnc_list (domain)     WHERE domain IS NOT NULL;

-- ─── Follow-up queue (the owner's "send an email" inbox) ──

CREATE TABLE IF NOT EXISTS public.followup_queue (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id       uuid NOT NULL REFERENCES public.call_leads(id) ON DELETE CASCADE,
  type          text NOT NULL CHECK (type IN ('email_info', 'email_proposal', 'linkedin', 'admin_call')),
  note          text,
  status        text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sent', 'done', 'cancelled')),
  requested_by  uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  handled_by    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  handled_at    timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS followup_queue_status_idx ON public.followup_queue (status, created_at);

-- ─── RLS ──────────────────────────────────────────────────

ALTER TABLE public.call_lists      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_leads      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dnc_list        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.followup_queue  ENABLE ROW LEVEL SECURITY;

-- Admins: everything, on every dialer table.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['call_lists', 'call_leads', 'call_activities', 'dnc_list', 'followup_queue']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_admin_all', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated '
      'USING ((SELECT public.is_admin())) WITH CHECK ((SELECT public.is_admin()))',
      t || '_admin_all', t);
  END LOOP;
END $$;

-- Staff (admin or caller): read the dialer data; add to it.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['call_lists', 'call_leads', 'call_activities', 'dnc_list', 'followup_queue']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_staff_select', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_staff_insert', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING ((SELECT public.is_staff()))',
      t || '_staff_select', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK ((SELECT public.is_staff()))',
      t || '_staff_insert', t);
  END LOOP;
END $$;

-- The call log can only be written AS yourself.
DROP POLICY IF EXISTS "call_activities_staff_insert" ON public.call_activities;
CREATE POLICY "call_activities_staff_insert" ON public.call_activities FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.is_staff()) AND caller_id = (SELECT auth.uid()));

-- Working a lead means changing it. (No staff DELETE anywhere: only
-- admins remove data.)
DROP POLICY IF EXISTS "call_leads_staff_update" ON public.call_leads;
CREATE POLICY "call_leads_staff_update" ON public.call_leads FOR UPDATE TO authenticated
  USING ((SELECT public.is_staff())) WITH CHECK ((SELECT public.is_staff()));

-- ─── Import helpers ───────────────────────────────────────
--
-- Both are SECURITY INVOKER on purpose: they run under the caller's
-- own RLS, so a login that can't see/insert leads can't use them to.

-- Everything already known, so the browser can show "N duplicates"
-- before anything is written. One round trip, no 1000-row page limit.
CREATE OR REPLACE FUNCTION public.dialer_known_keys()
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  SELECT jsonb_build_object(
    'phones',      COALESCE((SELECT jsonb_agg(phone_e164) FROM public.call_leads WHERE phone_e164 IS NOT NULL), '[]'),
    'domains',     COALESCE((SELECT jsonb_agg(domain)     FROM public.call_leads WHERE domain     IS NOT NULL), '[]'),
    'dnc_phones',  COALESCE((SELECT jsonb_agg(phone_e164) FROM public.dnc_list   WHERE phone_e164 IS NOT NULL), '[]'),
    'dnc_domains', COALESCE((SELECT jsonb_agg(domain)     FROM public.dnc_list   WHERE domain     IS NOT NULL), '[]')
  );
$$;

-- Insert a batch. ON CONFLICT DO NOTHING (no target) swallows a clash on
-- either unique index, so a race with another upload skips the row
-- instead of failing the whole batch. Returns how many went in.
CREATE OR REPLACE FUNCTION public.import_call_leads(p_list_id uuid, p_rows jsonb)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE inserted integer;
BEGIN
  WITH ins AS (
    INSERT INTO public.call_leads (
      list_id, company_name, phone_raw, phone_e164, phone_is_us, email, website, domain,
      contact_url, profile_url, hq, state, timezone, team_size, hourly_rate_usd, services,
      works_count, tier, score, why, source, extra, status
    )
    SELECT
      p_list_id, r.company_name, r.phone_raw, r.phone_e164, r.phone_is_us, r.email, r.website, r.domain,
      r.contact_url, r.profile_url, r.hq, r.state, r.timezone, r.team_size, r.hourly_rate_usd, r.services,
      r.works_count, r.tier, r.score, r.why, r.source, COALESCE(r.extra, '{}'::jsonb),
      COALESCE(r.status, 'new')
    FROM jsonb_to_recordset(p_rows) AS r(
      company_name text, phone_raw text, phone_e164 text, phone_is_us boolean, email text,
      website text, domain text, contact_url text, profile_url text, hq text, state text,
      timezone text, team_size text, hourly_rate_usd numeric, services text, works_count integer,
      tier text, score integer, why text, source text, extra jsonb, status text
    )
    ON CONFLICT DO NOTHING
    RETURNING 1
  )
  SELECT count(*) INTO inserted FROM ins;
  RETURN inserted;
END;
$$;

REVOKE ALL ON FUNCTION public.dialer_known_keys(), public.import_call_leads(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dialer_known_keys(), public.import_call_leads(uuid, jsonb) TO authenticated;
