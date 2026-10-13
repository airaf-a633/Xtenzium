-- ═══════════════════════════════════════════════════════════
-- 016 · Roles — admin vs caller
--
-- Until now every policy in this database was
--   TO authenticated USING (true)
-- which means "anyone who can log in can read and write everything".
-- That was fine with a team of owners. It stops being fine the moment
-- a sales rep gets a login: they could read every deal, client, price
-- and analytics row straight from the REST API, whatever the UI hides.
--
-- This migration:
--   1. adds public.profiles (one row per login, with a role)
--   2. adds public.is_admin()
--   3. rewrites every "any logged-in user" policy to require admin
--   4. fails loudly if any such policy is left over
--
-- The marketing site's public paths (lead form, published blog posts,
-- published testimonials, the analytics beacon) are untouched — those
-- are anon policies, not authenticated ones.
--
-- Idempotent: safe to run twice.
-- ═══════════════════════════════════════════════════════════

-- ─── 1. Profiles ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.profiles (
  id                 uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name          text,
  email              text,
  role               text NOT NULL DEFAULT 'caller' CHECK (role IN ('admin', 'caller')),
  timezone           text NOT NULL DEFAULT 'Asia/Karachi',
  /* Per-person, editable by any admin. 80 is the starting point. */
  daily_dial_target  integer NOT NULL DEFAULT 80 CHECK (daily_dial_target BETWEEN 1 AND 1000),
  /* Off = the login still exists but the database treats it as having
     no role. Takes effect on the next request, unlike a Supabase ban,
     which leaves an already-issued token working until it expires. */
  active             boolean NOT NULL DEFAULT true,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

-- CREATE TABLE IF NOT EXISTS won't add this to a table that already exists.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;

DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles;
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Everyone who can log in today is an owner. They become admins so
-- nothing changes for them. (Check this list after running — see the
-- query at the bottom of this file.)
INSERT INTO public.profiles (id, email, full_name, role)
SELECT u.id, u.email, COALESCE(u.raw_user_meta_data ->> 'full_name', split_part(u.email, '@', 1)), 'admin'
FROM auth.users u
ON CONFLICT (id) DO NOTHING;

-- Anyone created from now on gets the LEAST privilege: caller. Promoting
-- someone to admin is an explicit act (Team page, or UPDATE profiles).
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', split_part(NEW.email, '@', 1)),
    'caller'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─── 2. is_admin() ────────────────────────────────────────
--
-- SECURITY DEFINER so it can read profiles without recursing into the
-- profiles policies (which themselves call it).

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin' AND active
  );
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- Never let the last active admin be demoted, deactivated or deleted — that would lock
-- everyone out of the CRM with no way back except raw SQL.
CREATE OR REPLACE FUNCTION public.guard_last_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.role = 'admin'
     AND OLD.active
     AND (TG_OP = 'DELETE' OR NEW.role <> 'admin' OR NOT NEW.active)
     AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE role = 'admin' AND active AND id <> OLD.id)
  THEN
    RAISE EXCEPTION 'Cannot remove, demote or deactivate the last admin';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

DROP TRIGGER IF EXISTS profiles_guard_last_admin ON public.profiles;
CREATE TRIGGER profiles_guard_last_admin
  BEFORE UPDATE OR DELETE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_last_admin();

-- ─── 3. Profiles policies ─────────────────────────────────

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- You can read your own row (that is how the app learns your role);
-- admins can read everyone's.
DROP POLICY IF EXISTS "profiles_read" ON public.profiles;
CREATE POLICY "profiles_read"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid() OR (SELECT public.is_admin()));

-- Only admins write. A caller cannot change their own role or target.
DROP POLICY IF EXISTS "profiles_admin_write" ON public.profiles;
CREATE POLICY "profiles_admin_write"
  ON public.profiles FOR ALL
  TO authenticated
  USING ((SELECT public.is_admin()))
  WITH CHECK ((SELECT public.is_admin()));

-- ─── 4. Rewrite the "any logged-in user" policies ─────────

-- 4a. Plain FOR ALL tables: drop <t>_auth_all, add <t>_admin_all.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'clients', 'projects', 'activities', 'tasks',
    'team_members', 'app_settings',
    'deals', 'deal_activities',
    'task_statuses', 'task_checklist_items', 'task_comments',
    'task_attachments', 'task_dependencies', 'task_time_entries', 'task_active_timers',
    'saved_views', 'testimonials'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_auth_all', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_admin_all', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated '
      'USING ((SELECT public.is_admin())) WITH CHECK ((SELECT public.is_admin()))',
      t || '_admin_all', t);
  END LOOP;
END $$;

-- 4b. leads — the public contact form keeps inserting (leads_public_insert
--     is untouched); reading and changing them is admin-only.
DROP POLICY IF EXISTS "leads_auth_select" ON public.leads;
DROP POLICY IF EXISTS "leads_auth_update" ON public.leads;
DROP POLICY IF EXISTS "leads_auth_delete" ON public.leads;
DROP POLICY IF EXISTS "leads_admin_select" ON public.leads;
DROP POLICY IF EXISTS "leads_admin_update" ON public.leads;
DROP POLICY IF EXISTS "leads_admin_delete" ON public.leads;
CREATE POLICY "leads_admin_select" ON public.leads FOR SELECT TO authenticated
  USING ((SELECT public.is_admin()));
CREATE POLICY "leads_admin_update" ON public.leads FOR UPDATE TO authenticated
  USING ((SELECT public.is_admin())) WITH CHECK ((SELECT public.is_admin()));
CREATE POLICY "leads_admin_delete" ON public.leads FOR DELETE TO authenticated
  USING ((SELECT public.is_admin()));

-- 4c. blogs — published posts stay public (blogs_public_select);
--     drafts and every write are admin-only.
DROP POLICY IF EXISTS "blogs_auth_select_all" ON public.blogs;
DROP POLICY IF EXISTS "blogs_auth_insert" ON public.blogs;
DROP POLICY IF EXISTS "blogs_auth_update" ON public.blogs;
DROP POLICY IF EXISTS "blogs_auth_delete" ON public.blogs;
DROP POLICY IF EXISTS "blogs_admin_all" ON public.blogs;
CREATE POLICY "blogs_admin_all" ON public.blogs FOR ALL TO authenticated
  USING ((SELECT public.is_admin())) WITH CHECK ((SELECT public.is_admin()));

-- 4d. Analytics — the beacon (page_events_public_insert) is untouched.
DROP POLICY IF EXISTS "page_events_auth_select" ON public.page_events;
DROP POLICY IF EXISTS "page_events_auth_delete" ON public.page_events;
DROP POLICY IF EXISTS "page_events_admin_select" ON public.page_events;
DROP POLICY IF EXISTS "page_events_admin_delete" ON public.page_events;
CREATE POLICY "page_events_admin_select" ON public.page_events FOR SELECT TO authenticated
  USING ((SELECT public.is_admin()));
CREATE POLICY "page_events_admin_delete" ON public.page_events FOR DELETE TO authenticated
  USING ((SELECT public.is_admin()));

DROP POLICY IF EXISTS "search_queries_auth_select" ON public.search_queries;
DROP POLICY IF EXISTS "search_queries_admin_select" ON public.search_queries;
CREATE POLICY "search_queries_admin_select" ON public.search_queries FOR SELECT TO authenticated
  USING ((SELECT public.is_admin()));

-- 4e. user_preferences — was readable by every login. Writes stay
--     "own row only" (and a caller has no team_members row, so they
--     match nothing).
DROP POLICY IF EXISTS "user_preferences_read" ON public.user_preferences;
DROP POLICY IF EXISTS "user_preferences_admin_read" ON public.user_preferences;
CREATE POLICY "user_preferences_admin_read" ON public.user_preferences FOR SELECT TO authenticated
  USING ((SELECT public.is_admin()));

-- 4f. Task-attachment files. Same guard as 007: skipped with a warning
--     where the SQL role can't touch storage.
DO $$
BEGIN
  DROP POLICY IF EXISTS "task_attachments_auth_read"   ON storage.objects;
  DROP POLICY IF EXISTS "task_attachments_auth_write"  ON storage.objects;
  DROP POLICY IF EXISTS "task_attachments_auth_delete" ON storage.objects;
  DROP POLICY IF EXISTS "task_attachments_admin_read"   ON storage.objects;
  DROP POLICY IF EXISTS "task_attachments_admin_write"  ON storage.objects;
  DROP POLICY IF EXISTS "task_attachments_admin_delete" ON storage.objects;

  CREATE POLICY "task_attachments_admin_read" ON storage.objects FOR SELECT TO authenticated
    USING (bucket_id = 'task-attachments' AND (SELECT public.is_admin()));
  CREATE POLICY "task_attachments_admin_write" ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'task-attachments' AND (SELECT public.is_admin()));
  CREATE POLICY "task_attachments_admin_delete" ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id = 'task-attachments' AND (SELECT public.is_admin()));
EXCEPTION WHEN insufficient_privilege OR undefined_table THEN
  RAISE WARNING
    'Task-attachment storage policies were not updated (%). Edit them in the dashboard so they also require public.is_admin().', SQLERRM;
END $$;

-- ─── 5. Safety net ────────────────────────────────────────
--
-- Fail the whole migration if any non-INSERT policy still lets every
-- logged-in user through. A table added by hand in the dashboard (and
-- so absent from these files) would show up here instead of silently
-- staying open to the rep.

DO $$
DECLARE offenders text;
BEGIN
  SELECT string_agg(format('%I.%I → %I (%s)', schemaname, tablename, policyname, cmd), E'\n  ')
  INTO offenders
  FROM pg_policies
  WHERE schemaname = 'public'
    AND cmd <> 'INSERT'
    AND (roles && ARRAY['authenticated', 'public']::name[])
    AND replace(replace(coalesce(qual, ''), '(', ''), ')', '') = 'true';

  IF offenders IS NOT NULL THEN
    RAISE EXCEPTION E'Policies still open to every logged-in user:\n  %\nRewrite each to use (SELECT public.is_admin()) and re-run.', offenders;
  END IF;
END $$;

-- ─── After running ────────────────────────────────────────
-- 1. Confirm the right people are admins:
--      SELECT email, role FROM public.profiles ORDER BY role, email;
-- 2. Make sure public sign-ups are OFF:
--      Dashboard → Authentication → Sign In / Providers → "Allow new users to sign up" = off.
--    (A caller has almost no access, but there is no reason to let strangers in.)
