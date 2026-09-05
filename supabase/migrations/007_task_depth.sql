-- ============================================================
-- Xtenzium CRM — Task depth + time tracking
-- Run this in: Supabase Dashboard → SQL Editor → New query
--
-- Additive only, and safe to re-run.
--
-- Independent of 006 at the SQL level, though 006 should be run first:
-- linking team_members to auth accounts is what lets comments and time
-- entries be attributed to a person rather than to nobody.
--
-- The hard constraint here is that `tasks.status` is still read and
-- written by code this migration does not touch — TasksCalendar, the
-- dashboard's "pending" query, the recurrence helper, ProjectDetail.
-- So the pending/done column STAYS, stays correct, and a trigger keeps
-- it in lockstep with the new richer status. Both directions work:
-- old code writing 'done' lands in the Done column, and dragging to
-- Done on the new board still satisfies the old queries.
--
-- Nothing is dropped. Nothing is renamed. No existing row changes
-- meaning.
-- ============================================================


-- ─── 1. Statuses ──────────────────────────────────────────
-- A table rather than a CHECK constraint, because the whole point is
-- that you can add "Waiting on client" without a migration.
--
-- `kind` is what the rest of the system reasons about — there are only
-- ever three meaningful buckets, however many labels sit on top:
--   open   → not started
--   active → someone is on it (or blocked on it)
--   done   → finished, and therefore invisible by default

CREATE TABLE IF NOT EXISTS public.task_statuses (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key       text NOT NULL UNIQUE,
  label     text NOT NULL,
  kind      text NOT NULL CHECK (kind IN ('open', 'active', 'done')),
  tone      text NOT NULL DEFAULT 'neutral',
  position  integer NOT NULL DEFAULT 0
);

INSERT INTO public.task_statuses (key, label, kind, tone, position) VALUES
  ('todo',        'To Do',       'open',   'neutral', 1),
  ('in_progress', 'In Progress', 'active', 'info',    2),
  ('in_review',   'In Review',   'active', 'violet',  3),
  ('blocked',     'Blocked',     'active', 'danger',  4),
  ('done',        'Done',        'done',   'success', 5)
ON CONFLICT (key) DO NOTHING;


-- ─── 2. Task columns ──────────────────────────────────────

ALTER TABLE public.tasks
  -- 1 = Urgent, 2 = High, 3 = Normal, 4 = Low.
  -- Numeric so `ORDER BY priority` is already the right order; a text
  -- enum would sort High above Normal above Urgent, alphabetically.
  ADD COLUMN IF NOT EXISTS priority smallint NOT NULL DEFAULT 3
    CHECK (priority BETWEEN 1 AND 4),

  ADD COLUMN IF NOT EXISTS status_id uuid REFERENCES public.task_statuses(id),

  ADD COLUMN IF NOT EXISTS parent_task_id uuid REFERENCES public.tasks(id) ON DELETE CASCADE,

  -- Fractional, same reasoning as deals.rank: dropping a card between
  -- two others updates one row instead of renumbering the column.
  ADD COLUMN IF NOT EXISTS rank numeric NOT NULL DEFAULT 0,

  ADD COLUMN IF NOT EXISTS estimate_minutes integer
    CHECK (estimate_minutes IS NULL OR estimate_minutes > 0),

  ADD COLUMN IF NOT EXISTS started_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tasks_not_own_parent') THEN
    ALTER TABLE public.tasks ADD CONSTRAINT tasks_not_own_parent
      CHECK (parent_task_id IS NULL OR parent_task_id <> id);
  END IF;
END $$;


-- ─── 3. Backfill status_id from the existing pending/done ──
-- Every task that exists today keeps the meaning it already had.

UPDATE public.tasks t
SET status_id = s.id
FROM public.task_statuses s
WHERE t.status_id IS NULL
  AND s.key = CASE WHEN t.status = 'done' THEN 'done' ELSE 'todo' END;


-- ─── 4. Keep the two status columns honest ────────────────
-- A BEFORE trigger, so it rewrites the row on its way in rather than
-- issuing a second UPDATE — no recursion, no second write.

CREATE OR REPLACE FUNCTION public.tasks_sync_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_kind text;
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status_id IS NULL THEN
    SELECT id INTO NEW.status_id FROM public.task_statuses
    WHERE key = CASE WHEN NEW.status = 'done' THEN 'done' ELSE 'todo' END;
  END IF;

  -- New board wrote status_id → derive the legacy column from it.
  IF TG_OP = 'INSERT' OR NEW.status_id IS DISTINCT FROM OLD.status_id THEN
    SELECT kind INTO new_kind FROM public.task_statuses WHERE id = NEW.status_id;
    NEW.status := CASE WHEN new_kind = 'done' THEN 'done' ELSE 'pending' END;

  -- Old code wrote status → move it to a sensible status_id. Coming
  -- back from done returns it to To Do rather than guessing which
  -- active column it was in.
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    SELECT id INTO NEW.status_id FROM public.task_statuses
    WHERE key = CASE WHEN NEW.status = 'done' THEN 'done' ELSE 'todo' END;
  END IF;

  -- Timestamps for cycle-time reporting in phase 06.
  IF NEW.status = 'done' AND (TG_OP = 'INSERT' OR OLD.status <> 'done') THEN
    NEW.completed_at := now();
  ELSIF NEW.status <> 'done' THEN
    NEW.completed_at := NULL;
  END IF;

  IF NEW.started_at IS NULL AND NEW.status_id IS NOT NULL THEN
    SELECT kind INTO new_kind FROM public.task_statuses WHERE id = NEW.status_id;
    IF new_kind IN ('active', 'done') THEN
      NEW.started_at := now();
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tasks_sync_status ON public.tasks;
CREATE TRIGGER tasks_sync_status
  BEFORE INSERT OR UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.tasks_sync_status();


-- ─── 5. One level of nesting, enforced ────────────────────
-- Subtasks of subtasks are how a task list turns into a filing system
-- nobody opens. Capping depth at one also makes cycles impossible
-- without a recursive check.

CREATE OR REPLACE FUNCTION public.tasks_limit_nesting()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.parent_task_id IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM public.tasks WHERE id = NEW.parent_task_id AND parent_task_id IS NOT NULL) THEN
      RAISE EXCEPTION 'A subtask cannot have subtasks of its own.';
    END IF;
    IF EXISTS (SELECT 1 FROM public.tasks WHERE parent_task_id = NEW.id) THEN
      RAISE EXCEPTION 'This task already has subtasks, so it cannot become one.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tasks_limit_nesting ON public.tasks;
CREATE TRIGGER tasks_limit_nesting
  BEFORE INSERT OR UPDATE OF parent_task_id ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.tasks_limit_nesting();


-- ─── 6. Checklists ────────────────────────────────────────
-- Lighter than a subtask: no assignee, no date, no board presence.
-- For "the six things that make this task done".

CREATE TABLE IF NOT EXISTS public.task_checklist_items (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id   uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  label     text NOT NULL,
  done      boolean NOT NULL DEFAULT false,
  position  integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);


-- ─── 7. Comments ──────────────────────────────────────────
-- `mentions` is a plain uuid[] of team_members. Phase 05's
-- notification triggers read this column; storing it separately from
-- the body means a rename never breaks a mention.

CREATE TABLE IF NOT EXISTS public.task_comments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id     uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  author_id   uuid REFERENCES public.team_members(id) ON DELETE SET NULL,
  body        text NOT NULL,
  mentions    uuid[] NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS task_comments_updated_at ON public.task_comments;
CREATE TRIGGER task_comments_updated_at
  BEFORE UPDATE ON public.task_comments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


-- ─── 8. Attachments ───────────────────────────────────────
-- The file lives in Storage; this table is the index. Deleting a task
-- cascades the rows — the objects themselves are cleaned up by the
-- app, because a DB cascade cannot reach into Storage.

CREATE TABLE IF NOT EXISTS public.task_attachments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id       uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  storage_path  text NOT NULL,
  file_name     text NOT NULL,
  mime_type     text,
  size_bytes    bigint,
  uploaded_by   uuid REFERENCES public.team_members(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Private bucket: attachments are client work, so they are never
-- world-readable. The app reads them through signed URLs.
--
-- Wrapped: on some projects the SQL editor's role cannot own policies
-- on storage.objects. If that happens, the rest of this migration
-- still applies and only file attachments are unavailable — which is
-- a far better outcome than the whole task schema rolling back.

DO $$
BEGIN
  INSERT INTO storage.buckets (id, name, public)
  VALUES ('task-attachments', 'task-attachments', false)
  ON CONFLICT (id) DO NOTHING;

  DROP POLICY IF EXISTS "task_attachments_auth_read" ON storage.objects;
  CREATE POLICY "task_attachments_auth_read"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (bucket_id = 'task-attachments');

  DROP POLICY IF EXISTS "task_attachments_auth_write" ON storage.objects;
  CREATE POLICY "task_attachments_auth_write"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'task-attachments');

  DROP POLICY IF EXISTS "task_attachments_auth_delete" ON storage.objects;
  CREATE POLICY "task_attachments_auth_delete"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (bucket_id = 'task-attachments');

EXCEPTION WHEN insufficient_privilege OR undefined_table THEN
  RAISE WARNING
    'Storage bucket/policies for task attachments were skipped (%). Everything else applied. Create the private bucket "task-attachments" from Storage in the dashboard to enable file attachments.', SQLERRM;
END $$;


-- ─── 9. Dependencies ──────────────────────────────────────
-- "blocker must finish before blocked can start." Stored one way only;
-- the reverse direction is a query, not a second row.

CREATE TABLE IF NOT EXISTS public.task_dependencies (
  blocker_id  uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  blocked_id  uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id),
  CONSTRAINT task_dependencies_no_self CHECK (blocker_id <> blocked_id)
);

-- Blocks A→B→A. Deeper cycles are possible in theory; with a 4-person
-- team and one level of nesting they are not worth a recursive CTE on
-- every insert.
CREATE OR REPLACE FUNCTION public.task_dependencies_no_mutual()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.task_dependencies
    WHERE blocker_id = NEW.blocked_id AND blocked_id = NEW.blocker_id
  ) THEN
    RAISE EXCEPTION 'Those two tasks would block each other.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS task_dependencies_no_mutual ON public.task_dependencies;
CREATE TRIGGER task_dependencies_no_mutual
  BEFORE INSERT ON public.task_dependencies
  FOR EACH ROW EXECUTE FUNCTION public.task_dependencies_no_mutual();


-- ─── 10. Time tracking ────────────────────────────────────
-- Minutes are the unit of record. A running timer is a convenience on
-- top: stopping one writes an ordinary entry, so every logged minute
-- looks the same regardless of how it got there — and nothing is lost
-- if someone forgets to press stop and types it in later instead.

CREATE TABLE IF NOT EXISTS public.task_time_entries (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id    uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  member_id  uuid REFERENCES public.team_members(id) ON DELETE SET NULL,
  minutes    integer NOT NULL CHECK (minutes > 0),
  spent_on   date NOT NULL DEFAULT CURRENT_DATE,
  note       text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- One running timer per person, enforced by the primary key. Starting
-- a second timer replaces the first rather than silently double-billing.
CREATE TABLE IF NOT EXISTS public.task_active_timers (
  member_id   uuid PRIMARY KEY REFERENCES public.team_members(id) ON DELETE CASCADE,
  task_id     uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  started_at  timestamptz NOT NULL DEFAULT now()
);

-- Logged minutes per task, and the same rolled up to the project.
-- A view rather than a denormalised column: time entries are appended
-- far more often than these totals are read.
CREATE OR REPLACE VIEW public.task_time_totals AS
  SELECT task_id, SUM(minutes)::integer AS logged_minutes
  FROM public.task_time_entries
  GROUP BY task_id;

CREATE OR REPLACE VIEW public.project_time_totals AS
  SELECT t.project_id,
         SUM(e.minutes)::integer          AS logged_minutes,
         SUM(t.estimate_minutes)::integer AS estimated_minutes
  FROM public.tasks t
  LEFT JOIN public.task_time_entries e ON e.task_id = t.id
  WHERE t.project_id IS NOT NULL
  GROUP BY t.project_id;


-- ─── 11. RLS ──────────────────────────────────────────────

ALTER TABLE public.task_statuses        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_comments        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_attachments     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_dependencies    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_time_entries    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_active_timers   ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'task_statuses','task_checklist_items','task_comments',
    'task_attachments','task_dependencies','task_time_entries','task_active_timers'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_auth_all', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)',
      t || '_auth_all', t);
  END LOOP;
END $$;


-- ─── 12. Indexes ──────────────────────────────────────────

CREATE INDEX IF NOT EXISTS tasks_status_id_idx        ON public.tasks (status_id);
CREATE INDEX IF NOT EXISTS tasks_parent_idx           ON public.tasks (parent_task_id);
CREATE INDEX IF NOT EXISTS tasks_priority_idx         ON public.tasks (priority);
CREATE INDEX IF NOT EXISTS tasks_board_idx            ON public.tasks (status_id, rank);
CREATE INDEX IF NOT EXISTS task_checklist_task_idx    ON public.task_checklist_items (task_id, position);
CREATE INDEX IF NOT EXISTS task_comments_task_idx     ON public.task_comments (task_id, created_at DESC);
CREATE INDEX IF NOT EXISTS task_comments_mentions_idx ON public.task_comments USING gin (mentions);
CREATE INDEX IF NOT EXISTS task_attachments_task_idx  ON public.task_attachments (task_id);
CREATE INDEX IF NOT EXISTS task_dependencies_blocked  ON public.task_dependencies (blocked_id);
CREATE INDEX IF NOT EXISTS task_time_task_idx         ON public.task_time_entries (task_id);
CREATE INDEX IF NOT EXISTS task_time_member_date_idx  ON public.task_time_entries (member_id, spent_on DESC);
