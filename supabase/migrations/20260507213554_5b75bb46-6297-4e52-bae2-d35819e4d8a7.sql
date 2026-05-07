
-- 1. Update confirm_rental_deal to also insert a completed rental record when both confirm
CREATE OR REPLACE FUNCTION public.confirm_rental_deal(_listing_id uuid, _conversation_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  l public.listings%ROWTYPE;
  c public.listing_conversations%ROWTYPE;
  is_owner boolean;
  is_tenant boolean;
  tenant_id uuid;
  both_done boolean;
  hr_id uuid;
  matched_offer_id uuid;
  existing_rental_id uuid;
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

    -- Create or complete a rental record so rating eligibility works
    SELECT id INTO existing_rental_id
      FROM public.rentals
      WHERE listing_id = _listing_id AND owner_id = l.owner_id AND renter_id = tenant_id
      LIMIT 1;

    IF existing_rental_id IS NULL THEN
      INSERT INTO public.rentals (listing_id, owner_id, renter_id, status, started_at, completed_at)
      VALUES (_listing_id, l.owner_id, tenant_id, 'completed', now(), now());
    ELSE
      UPDATE public.rentals
        SET status = 'completed', completed_at = COALESCE(completed_at, now()), updated_at = now()
        WHERE id = existing_rental_id;
    END IF;

    INSERT INTO public.notifications (user_id, type, title_ar, body_ar, link) VALUES
      (l.owner_id, 'system', 'تم تأكيد الاتفاق', 'تم تأكيد الاتفاق على: ' || l.title, '/chat/' || _conversation_id),
      (tenant_id,  'system', 'تم تأكيد الاتفاق', 'تم تأكيد الاتفاق على: ' || l.title, '/chat/' || _conversation_id);
  END IF;

  RETURN jsonb_build_object('both_confirmed', both_done);
END;
$function$;

-- 2. Backfill: for any listing already 'rented' with both confirmations but no rental row, create one
DO $$
DECLARE
  rec RECORD;
  tenant uuid;
BEGIN
  FOR rec IN
    SELECT l.id AS listing_id, l.owner_id, l.tenant_confirmed_by
    FROM public.listings l
    WHERE l.status = 'rented'
      AND l.owner_confirmed_at IS NOT NULL
      AND l.tenant_confirmed_at IS NOT NULL
  LOOP
    tenant := rec.tenant_confirmed_by;
    IF tenant IS NULL THEN
      -- Fallback: derive from a conversation
      SELECT CASE WHEN c.owner_id = rec.owner_id THEN c.user_id ELSE c.owner_id END
        INTO tenant
      FROM public.listing_conversations c
      WHERE c.listing_id = rec.listing_id
      LIMIT 1;
    END IF;

    IF tenant IS NOT NULL AND tenant <> rec.owner_id THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.rentals
        WHERE listing_id = rec.listing_id AND owner_id = rec.owner_id AND renter_id = tenant
      ) THEN
        INSERT INTO public.rentals (listing_id, owner_id, renter_id, status, started_at, completed_at)
        VALUES (rec.listing_id, rec.owner_id, tenant, 'completed', now(), now());
      ELSE
        UPDATE public.rentals
          SET status = 'completed', completed_at = COALESCE(completed_at, now()), updated_at = now()
          WHERE listing_id = rec.listing_id AND owner_id = rec.owner_id AND renter_id = tenant
            AND status <> 'completed';
      END IF;
    END IF;
  END LOOP;
END $$;
