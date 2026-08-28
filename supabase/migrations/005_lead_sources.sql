-- Lead sources
--
-- The marketing site now submits from two places: the contact form and the
-- project estimator. Both land in `leads` so they arrive in the same inbox
-- the admin already reads, rather than in a second table nobody checks.
--
-- `source`  distinguishes them.
-- `payload` carries whatever structured data that source collected — the
--           estimator's answers and range, for instance — without needing a
--           column per question.
--
-- Existing rows default to 'contact', which is what they were.

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'contact';

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS payload jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Constrain to known sources so a typo in client code is a rejected insert
-- rather than a lead quietly filed under a name nobody filters on.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'leads_source_check'
  ) THEN
    ALTER TABLE public.leads
      ADD CONSTRAINT leads_source_check
      CHECK (source IN ('contact', 'estimate'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS leads_source_idx ON public.leads (source);
CREATE INDEX IF NOT EXISTS leads_created_at_idx ON public.leads (created_at DESC);

-- Note on RLS: 001 already grants anon INSERT and restricts SELECT/UPDATE/
-- DELETE to authenticated. That is exactly what a public form needs — the
-- anon key can write a lead but cannot read anybody else's. No policy
-- changes here, deliberately.
