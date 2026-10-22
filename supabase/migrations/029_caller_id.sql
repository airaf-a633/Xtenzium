-- ═══════════════════════════════════════════════════════════
-- 029 · The number the rep calls from
--
-- The Google Voice number prospects see. Shown on the call screen so
-- the rep checks Google Voice is using it, and available to the pitch
-- as {{caller_id}} ("call me back on …"). Editable by an admin in
-- Dialer settings. Idempotent.
-- ═══════════════════════════════════════════════════════════

ALTER TABLE public.dialer_settings ADD COLUMN IF NOT EXISTS caller_id_number text;
ALTER TABLE public.dialer_settings DROP CONSTRAINT IF EXISTS dialer_settings_caller_id_check;
ALTER TABLE public.dialer_settings ADD CONSTRAINT dialer_settings_caller_id_check
  CHECK (caller_id_number IS NULL OR caller_id_number ~ '^\+1[2-9][0-9]{9}$');

UPDATE public.dialer_settings SET caller_id_number = '+14072438456' WHERE caller_id_number IS NULL;
