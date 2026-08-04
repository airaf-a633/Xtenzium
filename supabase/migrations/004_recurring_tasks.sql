-- ============================================================
-- Xtenzium CRM — Recurring tasks
-- Run this in: Supabase Dashboard → SQL Editor → New query
-- ============================================================

ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS recurrence_days integer;

ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_recurrence_days_positive CHECK (recurrence_days IS NULL OR recurrence_days > 0);
