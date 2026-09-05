-- ============================================================
-- Xtenzium CRM — Notifications + Realtime
-- Run this in: Supabase Dashboard → SQL Editor → New query
--
-- Additive, and safe to re-run.
--
-- Requires 006 (team_members.user_id, deals) and 007 (task_comments).
-- Checked up front rather than assumed.
--
-- Notifications are written by database triggers, not by the client.
-- That matters: a mention should notify whether it came from the task
-- panel, the command palette, or a row someone edited straight in the
-- Supabase dashboard. Client-side notification writing is how half a
-- team ends up never hearing about anything.
-- ============================================================


-- ─── 0. Preconditions ─────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'team_members' AND column_name = 'user_id'
  ) THEN
    RAISE EXCEPTION 'Run 006_identity_and_deals.sql first — notifications are addressed to team members by their linked account.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'task_comments'
  ) THEN
    RAISE EXCEPTION 'Run 007_task_depth.sql first — mention notifications read task_comments.';
  END IF;
END $$;


-- ─── 1. The table ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.notifications (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  recipient_id  uuid NOT NULL REFERENCES public.team_members(id) ON DELETE CASCADE,
  -- Who caused it. Null when the cause was the system rather than a
  -- person — a due date arriving, for instance.
  actor_id      uuid REFERENCES public.team_members(id) ON DELETE SET NULL,

  type          text NOT NULL
                  CHECK (type IN ('mention', 'assignment', 'deal_stage', 'deal_owner', 'comment')),

  -- Kept loose on purpose: the entity may be deleted, and a
  -- notification about a deleted thing is still a true record of what
  -- happened. No foreign key, so nothing cascades a history away.
  entity_type   text NOT NULL CHECK (entity_type IN ('task', 'deal', 'project')),
  entity_id     uuid NOT NULL,

  -- Denormalised so the inbox renders in one query and still reads
  -- correctly after the underlying record is renamed or removed.
  title         text NOT NULL,
  body          text,

  read_at       timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);


-- ─── 2. Who is acting ─────────────────────────────────────
-- auth.uid() is available inside a trigger, and 006 linked it to a
-- team member. Null when the actor has no linked row — which is fine,
-- the notification simply has no "by whom".

CREATE OR REPLACE FUNCTION public.current_member_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.team_members WHERE user_id = auth.uid() LIMIT 1;
$$;


-- ─── 3. Mentions ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.notify_task_mentions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor       uuid := public.current_member_id();
  task_title  text;
  mentioned   uuid;
BEGIN
  IF array_length(NEW.mentions, 1) IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT title INTO task_title FROM public.tasks WHERE id = NEW.task_id;

  FOREACH mentioned IN ARRAY NEW.mentions
  LOOP
    -- Mentioning yourself is a note to self, not a notification.
    CONTINUE WHEN actor IS NOT NULL AND mentioned = actor;

    INSERT INTO public.notifications (recipient_id, actor_id, type, entity_type, entity_id, title, body)
    VALUES (
      mentioned, actor, 'mention', 'task', NEW.task_id,
      COALESCE(task_title, 'a task'),
      left(NEW.body, 280)
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_task_mentions ON public.task_comments;
CREATE TRIGGER notify_task_mentions
  AFTER INSERT ON public.task_comments
  FOR EACH ROW EXECUTE FUNCTION public.notify_task_mentions();


-- ─── 4. Assignment ────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.notify_task_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor uuid := public.current_member_id();
BEGIN
  IF NEW.assigned_to IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.assigned_to IS NOT DISTINCT FROM OLD.assigned_to THEN
    RETURN NEW;
  END IF;

  -- Assigning something to yourself is not news.
  IF actor IS NOT NULL AND NEW.assigned_to = actor THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (recipient_id, actor_id, type, entity_type, entity_id, title, body)
  VALUES (NEW.assigned_to, actor, 'assignment', 'task', NEW.id, NEW.title,
          CASE WHEN NEW.due_date IS NULL THEN NULL ELSE 'Due ' || to_char(NEW.due_date, 'Mon DD') END);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_task_assignment ON public.tasks;
CREATE TRIGGER notify_task_assignment
  AFTER INSERT OR UPDATE OF assigned_to ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.notify_task_assignment();


-- ─── 5. Deal movement ─────────────────────────────────────
-- The owner hears when someone else moves their deal, or hands them
-- one. Both are things you would want to know without being told.

CREATE OR REPLACE FUNCTION public.notify_deal_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor uuid := public.current_member_id();
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.stage IS DISTINCT FROM OLD.stage
     AND NEW.owner_id IS NOT NULL
     AND (actor IS NULL OR NEW.owner_id <> actor)
  THEN
    INSERT INTO public.notifications (recipient_id, actor_id, type, entity_type, entity_id, title, body)
    VALUES (NEW.owner_id, actor, 'deal_stage', 'deal', NEW.id, NEW.title,
            OLD.stage || ' → ' || NEW.stage);
  END IF;

  IF NEW.owner_id IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.owner_id IS DISTINCT FROM OLD.owner_id)
     AND (actor IS NULL OR NEW.owner_id <> actor)
  THEN
    INSERT INTO public.notifications (recipient_id, actor_id, type, entity_type, entity_id, title, body)
    VALUES (NEW.owner_id, actor, 'deal_owner', 'deal', NEW.id, NEW.title, 'You now own this deal');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_deal_changes ON public.deals;
CREATE TRIGGER notify_deal_changes
  AFTER INSERT OR UPDATE ON public.deals
  FOR EACH ROW EXECUTE FUNCTION public.notify_deal_changes();


-- ─── 6. RLS ───────────────────────────────────────────────
-- Everyone can read everything elsewhere in this CRM, but an inbox is
-- the one place where that would be actively wrong: a bell showing
-- someone else's mentions is worse than no bell.

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications_own_read" ON public.notifications;
CREATE POLICY "notifications_own_read"
  ON public.notifications FOR SELECT
  TO authenticated
  USING (recipient_id = public.current_member_id());

DROP POLICY IF EXISTS "notifications_own_update" ON public.notifications;
CREATE POLICY "notifications_own_update"
  ON public.notifications FOR UPDATE
  TO authenticated
  USING (recipient_id = public.current_member_id())
  WITH CHECK (recipient_id = public.current_member_id());

DROP POLICY IF EXISTS "notifications_own_delete" ON public.notifications;
CREATE POLICY "notifications_own_delete"
  ON public.notifications FOR DELETE
  TO authenticated
  USING (recipient_id = public.current_member_id());

-- No INSERT policy: rows come from SECURITY DEFINER triggers only.
-- The client cannot write itself a notification, which is what keeps
-- the inbox trustworthy.


-- ─── 7. Realtime ──────────────────────────────────────────
-- Wrapped: adding to a publication needs ownership, and on some
-- projects the SQL editor's role doesn't have it. If this is skipped
-- everything else still works — the boards simply won't live-update
-- until the tables are toggled on under Database → Replication.

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['tasks', 'deals', 'task_comments', 'notifications']
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING
    'Realtime publication was skipped (%). Everything else applied. Enable replication for tasks, deals, task_comments and notifications under Database → Replication.', SQLERRM;
END $$;

-- UPDATE and DELETE events only carry the changed columns unless the
-- table replicates its full row. Without this a card that moves would
-- arrive with almost nothing in it.
ALTER TABLE public.tasks         REPLICA IDENTITY FULL;
ALTER TABLE public.deals         REPLICA IDENTITY FULL;
ALTER TABLE public.task_comments REPLICA IDENTITY FULL;


-- ─── 8. Indexes ───────────────────────────────────────────

CREATE INDEX IF NOT EXISTS notifications_inbox_idx
  ON public.notifications (recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_unread_idx
  ON public.notifications (recipient_id)
  WHERE read_at IS NULL;
