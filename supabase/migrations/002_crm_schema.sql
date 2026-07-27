-- ============================================================
-- Xtenzium CRM — Clients, Projects, Activities, Tasks
-- Run this in: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- ─── Clients ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.clients (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  company     text,
  email       text,
  phone       text,
  notes       text,
  lead_id     uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- ─── Projects ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.projects (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id     uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  name          text NOT NULL,
  description   text,
  status        text NOT NULL DEFAULT 'proposal'
                  CHECK (status IN ('proposal', 'active', 'on_hold', 'completed', 'cancelled')),
  total_value   numeric(12, 2) NOT NULL DEFAULT 0,
  amount_paid   numeric(12, 2) NOT NULL DEFAULT 0,
  currency      text NOT NULL DEFAULT 'PKR',
  start_date    date,
  end_date      date,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CHECK (amount_paid <= total_value)
);

-- ─── Activities (notes / timeline) ──────────────────────────

CREATE TABLE IF NOT EXISTS public.activities (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  type        text NOT NULL DEFAULT 'note'
                CHECK (type IN ('note', 'call', 'meeting', 'email', 'status_change')),
  content     text NOT NULL,
  created_by  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ─── Tasks ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.tasks (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  title         text NOT NULL,
  description   text,
  due_date      date,
  status        text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'done')),
  assigned_to   text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- ─── Auto-update updated_at ───────────────────────────────

CREATE TRIGGER clients_updated_at
  BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ─── Enable RLS ───────────────────────────────────────────

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- Any authenticated user has full access (matches leads/blogs pattern —
-- no roles yet, every CRM user sees and edits everything).

CREATE POLICY "clients_auth_all"
  ON public.clients FOR ALL
  TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "projects_auth_all"
  ON public.projects FOR ALL
  TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "activities_auth_all"
  ON public.activities FOR ALL
  TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "tasks_auth_all"
  ON public.tasks FOR ALL
  TO authenticated
  USING (true) WITH CHECK (true);

-- ─── Indexes ──────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS clients_lead_id_idx ON public.clients (lead_id);
CREATE INDEX IF NOT EXISTS projects_client_id_idx ON public.projects (client_id);
CREATE INDEX IF NOT EXISTS projects_status_idx ON public.projects (status);
CREATE INDEX IF NOT EXISTS activities_project_id_idx ON public.activities (project_id);
CREATE INDEX IF NOT EXISTS activities_created_at_idx ON public.activities (created_at DESC);
CREATE INDEX IF NOT EXISTS tasks_project_id_idx ON public.tasks (project_id);
CREATE INDEX IF NOT EXISTS tasks_status_idx ON public.tasks (status);
CREATE INDEX IF NOT EXISTS tasks_due_date_idx ON public.tasks (due_date);
