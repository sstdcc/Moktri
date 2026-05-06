
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS owner_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS tenant_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS tenant_confirmed_by uuid;

CREATE OR REPLACE FUNCTION public.confirm_rental_deal(_listing_id uuid, _conversation_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  l public.listings%ROWTYPE;
  c public.listing_conversations%ROWTYPE;
  is_owner boolean;
  is_tenant boolean;
  tenant_id uuid;
  both_done boolean;
  hr_id uuid;
  matched_offer_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'غير مسجل'; END IF;

  SELECT * INTO l FROM public.listings WHERE id = _listing_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'الإعلان غير موجود'; END IF;

  SELECT * INTO c FROM public.listing_conversations WHERE id = _conversation_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'المحادثة غير موجودة'; END IF;
  IF c.listing_id <> _listing_id THEN RAISE EXCEPTION 'محادثة غير مطابقة'; END IF;

  is_owner := (auth.uid() = l.owner_id);
  tenant_id := CASE WHEN c.owner_id = l.owner_id THEN c.user_id ELSE c.owner_id END;
  is_tenant := (auth.uid() = tenant_id);

  IF NOT (is_owner OR is_tenant) THEN RAISE EXCEPTION 'غير مسموح'; END IF;
  IF l.status::text = 'rented' THEN RAISE EXCEPTION 'تم التأجير بالفعل'; END IF;
  IF l.status::text <> 'negotiating' THEN RAISE EXCEPTION 'الإعلان ليس في طور التفاوض'; END IF;

  IF is_owner THEN
    IF l.owner_confirmed_at IS NOT NULL THEN RAISE EXCEPTION 'سبق تأكيدك'; END IF;
    UPDATE public.listings SET owner_confirmed_at = now() WHERE id = _listing_id;
  ELSE
    IF l.tenant_confirmed_at IS NOT NULL THEN RAISE EXCEPTION 'سبق تأكيدك'; END IF;
    UPDATE public.listings SET tenant_confirmed_at = now(), tenant_confirmed_by = auth.uid() WHERE id = _listing_id;
  END IF;

  SELECT (owner_confirmed_at IS NOT NULL AND tenant_confirmed_at IS NOT NULL) INTO both_done
    FROM public.listings WHERE id = _listing_id;

  IF both_done THEN
    UPDATE public.listings
      SET status = 'rented', last_updated_at = now()
      WHERE id = _listing_id;

    UPDATE public.listing_requests
      SET status = 'accepted', updated_at = now()
      WHERE listing_id = _listing_id AND requester_id = tenant_id AND status IN ('pending','accepted');
    UPDATE public.listing_requests
      SET status = 'rejected', updated_at = now()
      WHERE listing_id = _listing_id AND status = 'pending' AND requester_id <> tenant_id;

    SELECT id, housing_request_id INTO matched_offer_id, hr_id
      FROM public.housing_request_offers
      WHERE listing_id = _listing_id AND requester_id = tenant_id
      ORDER BY created_at DESC LIMIT 1;

    IF matched_offer_id IS NOT NULL THEN
      UPDATE public.housing_request_offers
        SET status = 'accepted', updated_at = now()
        WHERE id = matched_offer_id;
      UPDATE public.housing_request_offers
        SET status = 'rejected', updated_at = now()
        WHERE housing_request_id = hr_id AND id <> matched_offer_id AND status = 'pending';
      UPDATE public.housing_requests
        SET status = 'fulfilled'
        WHERE id = hr_id;
    END IF;

    INSERT INTO public.notifications (user_id, type, title_ar, body_ar, link) VALUES
      (l.owner_id, 'system', 'تم تأكيد الاتفاق', 'تم تأكيد الاتفاق على: ' || l.title, '/chat/' || _conversation_id),
      (tenant_id,  'system', 'تم تأكيد الاتفاق', 'تم تأكيد الاتفاق على: ' || l.title, '/chat/' || _conversation_id);
  END IF;

  RETURN jsonb_build_object('both_confirmed', both_done);
END;
$$;
