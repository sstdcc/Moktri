-- =========================================================
-- SYNC listing_requests WHEN A HOUSING REQUEST OFFER IS DECIDED
--
-- Root cause: accepting/rejecting an offer inside the housing
-- request conversation (/request-chat) updated only
-- housing_request_offers (+ listings.status), so the matching
-- listing_requests row kept status='pending' forever and stayed
-- visible under «قيد الانتظار» in «الطلبات الواردة».
--
-- Fix (bridge only): after the offer decision succeeds, resolve
-- the linked pending listing_requests row for the same
-- (listing_id, requester_id).
--   accept -> 'accepted' (guarded by the single-accepted-per-
--             listing partial UNIQUE index: skipped if another
--             requester's request is already accepted)
--   reject -> 'rejected'
-- No changes to chat, notifications, FCM, SW, device_tokens,
-- auth, UI, or any other accept/reject logic.
-- =========================================================

CREATE OR REPLACE FUNCTION public.accept_housing_request_offer(_offer_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  o public.housing_request_offers%ROWTYPE;
BEGIN
  SELECT * INTO o FROM public.housing_request_offers WHERE id = _offer_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'العرض غير موجود'; END IF;
  IF auth.uid() IS NULL OR auth.uid() <> o.requester_id THEN RAISE EXCEPTION 'غير مسموح'; END IF;
  IF o.status <> 'pending' THEN RAISE EXCEPTION 'لا يمكن قبول عرض غير معلّق'; END IF;

  UPDATE public.housing_request_offers
    SET status = 'accepted', updated_at = now()
    WHERE id = _offer_id;

  UPDATE public.housing_request_offers
    SET status = 'rejected', updated_at = now()
    WHERE housing_request_id = o.housing_request_id
      AND id <> _offer_id
      AND status = 'pending';

  UPDATE public.listings
    SET status = 'negotiating'
    WHERE id = o.listing_id;

  -- Bridge: resolve the renter's pending listing request for the same
  -- listing. Guarded so the single-accepted-per-listing guarantee
  -- (idx_listing_requests_one_accepted_per_listing) can never fail this RPC.
  UPDATE public.listing_requests lr
    SET status = 'accepted', updated_at = now()
    WHERE lr.listing_id = o.listing_id
      AND lr.requester_id = o.requester_id
      AND lr.status = 'pending'
      AND NOT EXISTS (
        SELECT 1 FROM public.listing_requests x
        WHERE x.listing_id = lr.listing_id
          AND x.status = 'accepted'
      );
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_housing_request_offer(_offer_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  o public.housing_request_offers%ROWTYPE;
BEGIN
  SELECT * INTO o FROM public.housing_request_offers WHERE id = _offer_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'العرض غير موجود'; END IF;
  IF auth.uid() IS NULL OR auth.uid() <> o.requester_id THEN RAISE EXCEPTION 'غير مسموح'; END IF;
  IF o.status <> 'pending' THEN RAISE EXCEPTION 'لا يمكن رفض عرض غير معلّق'; END IF;

  UPDATE public.housing_request_offers
    SET status = 'rejected', updated_at = now()
    WHERE id = _offer_id;

  -- Bridge: resolve the renter's pending listing request for the same listing.
  UPDATE public.listing_requests lr
    SET status = 'rejected', updated_at = now()
    WHERE lr.listing_id = o.listing_id
      AND lr.requester_id = o.requester_id
      AND lr.status = 'pending';
END;
$$;

REVOKE ALL ON FUNCTION public.accept_housing_request_offer(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reject_housing_request_offer(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.accept_housing_request_offer(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_housing_request_offer(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_housing_request_offer(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.reject_housing_request_offer(uuid) TO service_role;
