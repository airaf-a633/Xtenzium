-- ============================================================
-- Xtenzium CRM — Per-user preferences
-- Run this in: Supabase Dashboard → SQL Editor → New query
--
-- Additive, safe to re-run. Requires 006 (team_members.user_id).
--
-- A note on what is NOT here.
--
-- The plan called for reporting views — pipeline_by_stage, win_rate,
-- receivables_aging, team_load — so the dashboard would be one round
-- trip instead of eight. Writing it, that turned out to be the wrong
-- trade at this size. The dashboard already fetches deals, projects
-- and tasks for other reasons; aggregating those rows in the client is
-- THREE round trips rather than eight, every figure becomes a pure
-- function that can be pinned down by a check, and adding a metric
-- stops needing a migration.
--
-- Views win when the row count is large enough that shipping it to the
-- browser hurts. At 65 projects and a few hundred deals and tasks, it
-- is not close. Revisit at roughly 10k rows per table.
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'team_members' AND column_name = 'user_id'
  ) THEN
    RAISE EXCEPTION 'Run 006_identity_and_deals.sql first — preferences are keyed to a team member.';
  END IF;
END $$;


CREATE TABLE IF NOT EXISTS public.user_preferences (
  member_id     uuid PRIMARY KEY REFERENCES public.team_members(id) ON DELETE CASCADE,

  -- Where this person lands when they open the CRM. Four people with
  -- four jobs: the CEO wants the pipeline, whoever is delivering wants
  -- their own work.
  landing_view  text NOT NULL DEFAULT 'dashboard'
                  CHECK (landing_view IN ('dashboard', 'my_work', 'pipeline', 'tasks')),

  -- Mirrors what the theme toggle already stores in localStorage, so
  -- the choice follows you to another machine rather than being a
  -- property of the browser you happened to use.
  theme         text NOT NULL DEFAULT 'dark'
                  CHECK (theme IN ('dark', 'light')),

  updated_at    timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS user_preferences_updated_at ON public.user_preferences;
CREATE TRIGGER user_preferences_updated_at
  BEFORE UPDATE ON public.user_preferences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

-- Readable by everyone (harmless, and it keeps the team page simple),
-- writable only by the person it belongs to.
DROP POLICY IF EXISTS "user_preferences_read" ON public.user_preferences;
CREATE POLICY "user_preferences_read"
  ON public.user_preferences FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "user_preferences_write" ON public.user_preferences;
CREATE POLICY "user_preferences_write"
  ON public.user_preferences FOR ALL
  TO authenticated
  USING (member_id = public.current_member_id())
  WITH CHECK (member_id = public.current_member_id());
