-- ═══════════════════════════════════════════════════════════
-- 033 · The rep can see where a deal stands
--
-- Reps can't read the deals table (values, owners and contact details are
-- the owners' business). This gives them the one thing they need when a
-- prospect rings back: the STAGE and the next action. Nothing else —
-- no amounts, no probability, no owner. Idempotent.
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.lead_deal_view(p_lead_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN NOT public.is_staff() THEN NULL
    ELSE (
      SELECT jsonb_build_object('stage', d.stage, 'next_action', d.next_action)
      FROM public.call_leads l
      JOIN public.deals d ON d.id = l.deal_id
      WHERE l.id = p_lead_id
    )
  END;
$$;

REVOKE ALL ON FUNCTION public.lead_deal_view(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.lead_deal_view(uuid) TO authenticated;
