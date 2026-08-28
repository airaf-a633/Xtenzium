-- ============================================================
-- Xtenzium CRM — Saved views
-- Run this in: Supabase Dashboard → SQL Editor → New query
--
-- Additive, and safe to re-run.
--
-- One table, because a view is one thing: a named combination of
-- group-by, filters, sort and search, scoped to an entity.
--
-- `config` is jsonb rather than a column per knob. The set of filter
-- fields changes every time an entity gains one — priority arrived in
-- 007, and stage in 006 — and a schema migration per new filter is
-- exactly the friction that stops views from being used. The shape is
-- validated in the client, where the field registry lives.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.saved_views (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  name        text NOT NULL,

  -- Which board this view belongs to. Constrained so a typo can't
  -- create a view that never appears anywhere.
  entity      text NOT NULL
                CHECK (entity IN ('tasks', 'deals', 'projects', 'clients')),

  -- { groupBy, filters[], sort[], search }
  config      jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- Null owner = a view nobody personally owns, which only happens for
  -- shared views created before identity was linked. Ownership decides
  -- who sees it, not who may edit it — four people, one trust level.
  owner_id    uuid REFERENCES public.team_members(id) ON DELETE SET NULL,

  -- Private by default. Sharing a view is a deliberate act; a team of
  -- four does not need everyone's half-finished filters in their list.
  shared      boolean NOT NULL DEFAULT false,

  position    integer NOT NULL DEFAULT 0,

  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS saved_views_updated_at ON public.saved_views;
CREATE TRIGGER saved_views_updated_at
  BEFORE UPDATE ON public.saved_views
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Two views with the same name on the same board are indistinguishable
-- in a dropdown, which is the only place they appear.
CREATE UNIQUE INDEX IF NOT EXISTS saved_views_name_per_entity_owner
  ON public.saved_views (entity, owner_id, lower(name))
  WHERE owner_id IS NOT NULL;

ALTER TABLE public.saved_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "saved_views_auth_all" ON public.saved_views;
CREATE POLICY "saved_views_auth_all"
  ON public.saved_views FOR ALL
  TO authenticated
  USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS saved_views_entity_idx ON public.saved_views (entity, position);
CREATE INDEX IF NOT EXISTS saved_views_owner_idx  ON public.saved_views (owner_id);
