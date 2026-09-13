-- Fix P0: Make accept_listing_request atomic — move listings.status → negotiating into the RPC
-- Previously the frontend did: rpc accept_listing_request() + separate UPDATE listings SET status='negotiating'
-- That left a window where listing_requests was accepted but listings stayed active (pending+accepted inconsistency)
-- This migration makes the status change atomic inside the transaction.

CREATE OR REPLACE FUNCTION public.accept_listing_request(_request_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  req public.listing_requests%ROWTYPE;
  v_listing public.listings%ROWTYPE;
  v_rejected_others int := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'المستخدم غير مسجل';
  END IF;

  SELECT * INTO req FROM public.listing_requests
    WHERE id = _request_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'الطلب غير موجود';
  END IF;
  IF req.owner_id <> auth.uid() THEN
    RAISE EXCEPTION 'غير مصرح بقبول هذا الطلب';
  END IF;

  IF req.status = 'accepted' THEN
    RETURN jsonb_build_object('ok', true, 'already_accepted', true, 'rejected_others', 0);
  END IF;
  IF req.status <> 'pending' THEN
    RAISE EXCEPTION 'لا يمكن قبول طلب حالته "%"', req.status;
  END IF;

  -- Lock listing first in fixed order (prevents deadlock)
  SELECT * INTO v_listing FROM public.listings
    WHERE id = req.listing_id
    FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'العقار غير موجود';
  END IF;
  IF v_listing.status <> 'active' THEN
    RAISE EXCEPTION 'لا يمكن قبول الطلب لأن العقار ليس متاحًا حاليًا';
  END IF;

  -- Lock all listing_requests for same listing in deterministic order (including current)
  PERFORM 1 FROM public.listing_requests
    WHERE listing_id = req.listing_id
    ORDER BY id
    FOR UPDATE;

  IF EXISTS (
    SELECT 1 FROM public.listing_requests lr2
    WHERE lr2.listing_id = req.listing_id
      AND lr2.status = 'accepted'
  ) THEN
    RAISE EXCEPTION 'يوجد مستأجر مقبول بالفعل لهذا العقار';
  END IF;

  UPDATE public.listing_requests
    SET status = 'accepted', updated_at = now()
    WHERE id = req.id;

  UPDATE public.listing_requests
    SET status = 'rejected', updated_at = now()
    WHERE listing_id = req.listing_id
      AND id <> req.id
      AND status = 'pending';
  GET DIAGNOSTICS v_rejected_others = ROW_COUNT;

  -- Atomic: also move listing to negotiating inside same transaction
  UPDATE public.listings
    SET status = 'negotiating', last_updated_at = now()
    WHERE id = req.listing_id
      AND status = 'active';

  RETURN jsonb_build_object('ok', true, 'already_accepted', false, 'rejected_others', v_rejected_others);
END;
$$;

REVOKE ALL ON FUNCTION public.accept_listing_request(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_listing_request(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_listing_request(uuid) TO service_role;
