
-- Realtime for offers + listings so both parties see updates instantly
ALTER PUBLICATION supabase_realtime ADD TABLE public.housing_request_offers;
ALTER PUBLICATION supabase_realtime ADD TABLE public.listings;

-- Complete a rental from an accepted housing request offer.
-- Owner-only. Reuses the same finalize actions as confirm_rental_deal:
--   listing -> rented, insert rentals row, housing_request -> fulfilled,
--   reject sibling pending offers, notify both parties.
CREATE OR REPLACE FUNCTION public.complete_housing_request_offer(_offer_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  o public.housing_request_offers%ROWTYPE;
  l public.listings%ROWTYPE;
  existing_rental_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'غير مسجل'; END IF;

  SELECT * INTO o FROM public.housing_request_offers WHERE id = _offer_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'العرض غير موجود'; END IF;
  IF auth.uid() <> o.owner_id THEN RAISE EXCEPTION 'غير مسموح'; END IF;
  IF o.status <> 'accepted' THEN RAISE EXCEPTION 'يجب أن يقبل المستأجر العرض أولاً'; END IF;

  SELECT * INTO l FROM public.listings WHERE id = o.listing_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'الإعلان غير موجود'; END IF;
  IF l.status::text = 'rented' THEN RAISE EXCEPTION 'تم التأجير بالفعل'; END IF;

  UPDATE public.listings
    SET status = 'rented',
        owner_confirmed_at = COALESCE(owner_confirmed_at, now()),
        tenant_confirmed_at = COALESCE(tenant_confirmed_at, now()),
        tenant_confirmed_by = COALESCE(tenant_confirmed_by, o.requester_id),
        last_updated_at = now()
    WHERE id = o.listing_id;

  -- Reject sibling pending offers on the same housing request
  UPDATE public.housing_request_offers
    SET status = 'rejected', updated_at = now()
    WHERE housing_request_id = o.housing_request_id
      AND id <> _offer_id
      AND status = 'pending';

  -- Fulfill housing request
  UPDATE public.housing_requests
    SET status = 'fulfilled'
    WHERE id = o.housing_request_id;

  -- Create or complete rental record
  SELECT id INTO existing_rental_id
    FROM public.rentals
    WHERE listing_id = o.listing_id AND owner_id = o.owner_id AND renter_id = o.requester_id
    LIMIT 1;

  IF existing_rental_id IS NULL THEN
    INSERT INTO public.rentals (listing_id, owner_id, renter_id, status, started_at, completed_at)
    VALUES (o.listing_id, o.owner_id, o.requester_id, 'completed', now(), now());
  ELSE
    UPDATE public.rentals
      SET status = 'completed', completed_at = COALESCE(completed_at, now()), updated_at = now()
      WHERE id = existing_rental_id;
  END IF;

  INSERT INTO public.notifications (user_id, type, title_ar, body_ar, link) VALUES
    (o.owner_id,     'system', 'تم إتمام التأجير', 'تم تأجير الإعلان: ' || l.title, '/listings/' || o.listing_id),
    (o.requester_id, 'system', 'تم إتمام التأجير', 'تم تأجير الإعلان: ' || l.title, '/listings/' || o.listing_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_housing_request_offer(uuid) TO authenticated;
