-- P6-SEC-01: Housing Request Offer accept/reject authorization.
--
-- Root cause: public.accept_housing_request_offer / public.reject_housing_request_offer
-- were created SECURITY DEFINER without any REVOKE, so the implicit PUBLIC
-- default-execute grant applied (executable by anon and authenticated via REST).
-- Worse, the only guard `IF auth.uid() <> o.requester_id THEN RAISE` is
-- NULL-unsafe: for an anonymous caller auth.uid() is NULL, `NULL <> o.requester_id`
-- evaluates to NULL (not TRUE), the guard is skipped, and the caller reaches the
-- offer-update logic of another user's offer.
--
-- Fix:
--   1. NULL-safe authorization check inside both functions (reject anonymous and
--      any caller that is not the offer requester).
--   2. Revoke the implicit PUBLIC (anon) EXECUTE grant and restrict EXECUTE to
--      authenticated (the app caller) and service_role (project convention used
--      in the prior BUG-SEC-01/02/03 remediations).

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
END;
$$;

REVOKE ALL ON FUNCTION public.accept_housing_request_offer(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reject_housing_request_offer(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.accept_housing_request_offer(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_housing_request_offer(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_housing_request_offer(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.reject_housing_request_offer(uuid) TO service_role;