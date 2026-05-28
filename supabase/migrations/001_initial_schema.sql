-- ============================================================
-- Xtenzium Admin Portal — Initial Schema
-- Run this in: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- ─── Leads ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.leads (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  email       text NOT NULL,
  company     text,
  message     text NOT NULL,
  status      text NOT NULL DEFAULT 'new'
                CHECK (status IN ('new', 'contacted', 'qualified', 'closed')),
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- ─── Blogs ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.blogs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title         text NOT NULL,
  slug          text NOT NULL UNIQUE,
  excerpt       text,
  content       jsonb NOT NULL DEFAULT '{}',
  cover_image   text,
  category      text,
  tags          text[] NOT NULL DEFAULT '{}',
  status        text NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft', 'published')),
  published_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- ─── Auto-update updated_at ───────────────────────────────

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER leads_updated_at
  BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER blogs_updated_at
  BEFORE UPDATE ON public.blogs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ─── Enable RLS ───────────────────────────────────────────

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blogs ENABLE ROW LEVEL SECURITY;

-- ─── Leads policies ───────────────────────────────────────

-- Anyone (including anon) can submit a lead via the contact form
CREATE POLICY "leads_public_insert"
  ON public.leads FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Only authenticated users can read leads
CREATE POLICY "leads_auth_select"
  ON public.leads FOR SELECT
  TO authenticated
  USING (true);

-- Only authenticated users can update leads (status, notes)
CREATE POLICY "leads_auth_update"
  ON public.leads FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Only authenticated users can delete leads
CREATE POLICY "leads_auth_delete"
  ON public.leads FOR DELETE
  TO authenticated
  USING (true);

-- ─── Blogs policies ───────────────────────────────────────

-- Anyone can read published blogs
CREATE POLICY "blogs_public_select"
  ON public.blogs FOR SELECT
  TO anon, authenticated
  USING (status = 'published');

-- Authenticated users can read ALL blogs (including drafts)
CREATE POLICY "blogs_auth_select_all"
  ON public.blogs FOR SELECT
  TO authenticated
  USING (true);

-- Only authenticated users can create/edit/delete blogs
CREATE POLICY "blogs_auth_insert"
  ON public.blogs FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "blogs_auth_update"
  ON public.blogs FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "blogs_auth_delete"
  ON public.blogs FOR DELETE
  TO authenticated
  USING (true);

-- ─── Indexes ──────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS leads_status_idx ON public.leads (status);
CREATE INDEX IF NOT EXISTS leads_created_at_idx ON public.leads (created_at DESC);
CREATE INDEX IF NOT EXISTS blogs_slug_idx ON public.blogs (slug);
CREATE INDEX IF NOT EXISTS blogs_status_idx ON public.blogs (status);
CREATE INDEX IF NOT EXISTS blogs_published_at_idx ON public.blogs (published_at DESC);
