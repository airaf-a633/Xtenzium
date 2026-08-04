-- ============================================================
-- Xtenzium CRM — Team members, app settings, task assignment
-- Run this in: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- ─── Team members ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.team_members (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text NOT NULL,
  designation  text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "team_members_auth_all"
  ON public.team_members FOR ALL
  TO authenticated
  USING (true) WITH CHECK (true);

-- ─── App settings (key/value, e.g. exchange rate) ──────────

CREATE TABLE IF NOT EXISTS public.app_settings (
  key         text PRIMARY KEY,
  value       text NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "app_settings_auth_all"
  ON public.app_settings FOR ALL
  TO authenticated
  USING (true) WITH CHECK (true);

CREATE TRIGGER app_settings_updated_at
  BEFORE UPDATE ON public.app_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

INSERT INTO public.app_settings (key, value)
VALUES ('usd_to_pkr', '280')
ON CONFLICT (key) DO NOTHING;

-- ─── Tasks: reassign to team members instead of free text ──

ALTER TABLE public.tasks DROP COLUMN IF EXISTS assigned_to;
ALTER TABLE public.tasks ADD COLUMN assigned_to uuid REFERENCES public.team_members(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS tasks_assigned_to_idx ON public.tasks (assigned_to);
