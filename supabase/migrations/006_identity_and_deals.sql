-- ============================================================
-- Xtenzium CRM — Identity + Pipeline
-- Run this in: Supabase Dashboard → SQL Editor → New query
--
-- Additive only. Nothing existing is renamed, dropped or rewritten.
-- Safe to re-run: every trigger and policy is dropped first, tables use
-- IF NOT EXISTS, and the backfill skips leads that already have a deal.
--
-- Requires 005_lead_sources.sql. Checked up front, not assumed.
--
-- Two things land here:
--
--   1. Identity becomes real. `team_members` rows have never been
--      connected to the accounts people actually sign in with, which
--      is why "my tasks" could not exist. A nullable `user_id` fixes
--      that without invalidating a single existing row.
--
--   2. Deals. A deal is deliberately NOT a project. Most deals never
--      become one, and folding the two together is exactly what makes
--      agency pipelines lie — every lost pitch either pollutes the
--      delivery board or quietly disappears. Separate tables, one
--      explicit conversion step, and `projects` is left untouched.
-- ============================================================


-- ─── 0. Preconditions ─────────────────────────────────────
-- 005 adds `leads.source`, which the lead→deal trigger and the
-- backfill below both read. Fail here, before anything is created,
-- rather than half-way through — a partially applied migration that
-- leaves a trigger referencing a missing column takes the website's
-- contact form down with it.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'leads' AND column_name = 'source'
  ) THEN
    RAISE EXCEPTION
      'Run 005_lead_sources.sql first — this migration needs leads.source, and creating its trigger without that column would break lead submissions.';
  END IF;
END $$;


-- ─── 1. Identity ──────────────────────────────────────────

ALTER TABLE public.team_members
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- One auth account maps to at most one team member. Two rows claiming
-- the same login would make "assigned to me" ambiguous forever.
CREATE UNIQUE INDEX IF NOT EXISTS team_members_user_id_key
  ON public.team_members (user_id)
  WHERE user_id IS NOT NULL;


-- ─── 2. Deals ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.deals (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  title              text NOT NULL,

  -- Where it came from. `lead_id` keeps the original website
  -- submission — including the estimator's jsonb payload — attached,
  -- so nothing is duplicated and the /admin inbox stays authoritative
  -- for the raw enquiry.
  lead_id            uuid REFERENCES public.leads(id) ON DELETE SET NULL,

  -- A deal may already be with a known client (repeat business) or
  -- with nobody yet (cold enquiry), so contact details live on the
  -- deal until conversion promotes them into `clients`.
  client_id          uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  contact_name       text,
  contact_email      text,
  contact_phone      text,
  company            text,

  stage              text NOT NULL DEFAULT 'new'
                       CHECK (stage IN ('new','contacted','qualified','proposal_sent','negotiation','won','lost')),

  -- Money mirrors `projects` exactly — same precision, same currency
  -- convention — so a deal's value carries into the project it
  -- becomes without a conversion or a rounding surprise.
  value              numeric(12, 2) NOT NULL DEFAULT 0,
  currency           text NOT NULL DEFAULT 'PKR',

  probability        integer NOT NULL DEFAULT 10
                       CHECK (probability >= 0 AND probability <= 100),
  expected_close     date,

  owner_id           uuid REFERENCES public.team_members(id) ON DELETE SET NULL,

  source             text NOT NULL DEFAULT 'manual'
                       CHECK (source IN ('contact','estimate','referral','outbound','repeat','manual')),

  -- The single most important pair of columns in this table. A deal
  -- with no agreed next step is a deal nobody is working. Phase 05's
  -- stale-deal nudges read exactly these.
  next_action        text,
  next_action_date   date,

  -- Required by a trigger below whenever stage becomes 'lost', so
  -- lost-reason analysis is possible later rather than aspirational.
  lost_reason        text,

  -- Set on conversion. Also the flag that stops a deal being converted
  -- twice into two duplicate projects.
  project_id         uuid REFERENCES public.projects(id) ON DELETE SET NULL,

  -- Manual ordering within a column. Numeric rather than integer so a
  -- card can always be dropped between two others without renumbering
  -- the whole column.
  rank               numeric NOT NULL DEFAULT 0,

  -- Distinct from updated_at: editing a note should not make a deal
  -- look freshly worked. Only a stage move resets this.
  stage_changed_at   timestamptz NOT NULL DEFAULT now(),
  closed_at          timestamptz,

  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT deals_lost_needs_reason
    CHECK (stage <> 'lost' OR lost_reason IS NOT NULL)
);

DROP TRIGGER IF EXISTS deals_updated_at ON public.deals;
CREATE TRIGGER deals_updated_at
  BEFORE UPDATE ON public.deals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


-- ─── 3. Deal activity timeline ────────────────────────────
-- Mirrors `activities` on projects rather than reusing it: activities
-- has a NOT NULL project_id, and loosening that would weaken a
-- constraint that is currently doing useful work.

CREATE TABLE IF NOT EXISTS public.deal_activities (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id     uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  type        text NOT NULL DEFAULT 'note'
                CHECK (type IN ('note','call','meeting','email','stage_change','created')),
  content     text NOT NULL,
  created_by  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);


-- ─── 4. Stage moves write their own history ───────────────

CREATE OR REPLACE FUNCTION public.deals_track_stage_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.stage IS DISTINCT FROM OLD.stage THEN
    NEW.stage_changed_at := now();

    IF NEW.stage IN ('won', 'lost') THEN
      NEW.closed_at := now();
    ELSE
      -- Reopening a closed deal clears the close stamp, so "closed
      -- this month" counts never include something later revived.
      NEW.closed_at := NULL;
    END IF;

    INSERT INTO public.deal_activities (deal_id, type, content)
    VALUES (NEW.id, 'stage_change', OLD.stage || ' → ' || NEW.stage);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS deals_stage_change ON public.deals;
CREATE TRIGGER deals_stage_change
  BEFORE UPDATE ON public.deals
  FOR EACH ROW EXECUTE FUNCTION public.deals_track_stage_change();


-- ─── 5. Website leads open a deal automatically ───────────
-- The /admin leads portal is deliberately left alone — it stays the
-- inbox for the raw enquiry. This just means an enquiry also shows up
-- where the selling happens, without anybody re-typing it.

CREATE OR REPLACE FUNCTION public.leads_open_deal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_deal_id uuid;
BEGIN
  INSERT INTO public.deals (title, lead_id, contact_name, contact_email, company, source, stage)
  VALUES (
    COALESCE(NULLIF(TRIM(NEW.company), ''), NEW.name) || ' enquiry',
    NEW.id,
    NEW.name,
    NEW.email,
    NEW.company,
    -- `leads.source` is constrained to contact/estimate, both of which
    -- are valid deal sources, so this passes straight through.
    NEW.source,
    'new'
  )
  RETURNING id INTO new_deal_id;

  INSERT INTO public.deal_activities (deal_id, type, content)
  VALUES (new_deal_id, 'created', 'Opened from a ' || NEW.source || ' submission on the website.');

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS leads_open_deal ON public.leads;
CREATE TRIGGER leads_open_deal
  AFTER INSERT ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.leads_open_deal();


-- ─── 6. Backfill the leads already sitting in the inbox ───
-- Only leads that are still live. A lead marked 'closed' is history,
-- and importing it as an open deal would inflate the pipeline on day
-- one — which is the one thing a new pipeline must not do.

INSERT INTO public.deals (title, lead_id, contact_name, contact_email, company, source, stage, created_at)
SELECT
  COALESCE(NULLIF(TRIM(l.company), ''), l.name) || ' enquiry',
  l.id,
  l.name,
  l.email,
  l.company,
  l.source,
  l.status,          -- new / contacted / qualified map across as-is
  l.created_at
FROM public.leads l
WHERE l.status IN ('new', 'contacted', 'qualified')
  AND NOT EXISTS (SELECT 1 FROM public.deals d WHERE d.lead_id = l.id);


-- ─── 7. RLS — matches the existing tables exactly ─────────
-- Four people who all see everything. Identity is now real, so
-- tightening this later is a policy change, not a rebuild.

ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deal_activities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "deals_auth_all" ON public.deals;
CREATE POLICY "deals_auth_all"
  ON public.deals FOR ALL
  TO authenticated
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "deal_activities_auth_all" ON public.deal_activities;
CREATE POLICY "deal_activities_auth_all"
  ON public.deal_activities FOR ALL
  TO authenticated
  USING (true) WITH CHECK (true);


-- ─── 8. Indexes ───────────────────────────────────────────

CREATE INDEX IF NOT EXISTS deals_stage_idx            ON public.deals (stage);
CREATE INDEX IF NOT EXISTS deals_owner_idx            ON public.deals (owner_id);
CREATE INDEX IF NOT EXISTS deals_client_idx           ON public.deals (client_id);
CREATE INDEX IF NOT EXISTS deals_lead_idx             ON public.deals (lead_id);
CREATE INDEX IF NOT EXISTS deals_expected_close_idx   ON public.deals (expected_close);
CREATE INDEX IF NOT EXISTS deals_next_action_date_idx ON public.deals (next_action_date);
-- The board's own query: open deals, column order, card order.
CREATE INDEX IF NOT EXISTS deals_board_idx            ON public.deals (stage, rank)
  WHERE stage NOT IN ('won', 'lost');
CREATE INDEX IF NOT EXISTS deal_activities_deal_idx   ON public.deal_activities (deal_id, created_at DESC);
