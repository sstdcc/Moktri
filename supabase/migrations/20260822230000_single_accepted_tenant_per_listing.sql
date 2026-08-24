-- =========================================================
-- SINGLE ACCEPTED TENANT PER LISTING (listing_requests)
-- 1) Partial UNIQUE index: at most ONE accepted request per
--    listing, enforced by PostgreSQL even under concurrency.
-- 2) Atomic RPC accept_listing_request(): owner-only, row-lock
--    serialized, accepts the chosen pending request and rejects
--    all other pending requests of the SAME listing in one
--    transaction. Fails safely if another tenant is already
--    accepted. Mirrors the existing confirm_rental_deal pattern.
-- No deletes, no data rewrites, no RLS/auth/realtime changes.
-- =========================================================

-- Backstop: hard DB guarantee against double acceptance
CREATE UNIQUE INDEX IF NOT EXISTS idx_listing_requests_one_accepted_per_listing
  ON public.listing_requests(listing_id)
  WHERE status = 'accepted';

CREATE OR REPLACE FUNCTION public.accept_listing_request(_request_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  req public.listing_requests%ROWTYPE;
  v_rejected_others int := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'المستخدم غير مسجل';
  END IF;

  SELECT * INTO req FROM public.listing_requests
    WHERE id = _request_id
    FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'الطلب غير موجود';
  END IF;
  IF req.owner_id <> auth.uid() THEN
    RAISE EXCEPTION 'غير مصرح بقبول هذا الطلب';
  END IF;

  -- Idempotent: accepting the already-accepted request is a safe no-op
  IF req.status = 'accepted' THEN
    RETURN jsonb_build_object('ok', true, 'already_accepted', true, 'rejected_others', 0);
  END IF;
  IF req.status <> 'pending' THEN
    RAISE EXCEPTION 'لا يمكن قبول طلب حالته "%"', req.status;
  END IF;

  -- Serialize concurrent accepts deterministically (avoid deadlocks):
  -- lock all other active requests of the same listing before deciding.
  PERFORM 1 FROM public.listing_requests lr
    WHERE lr.listing_id = req.listing_id
      AND lr.id <> req.id
      AND lr.status IN ('pending', 'accepted')
    ORDER BY lr.id
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

  RETURN jsonb_build_object('ok', true, 'already_accepted', false, 'rejected_others', v_rejected_others);
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_listing_request(uuid) TO authenticated;
