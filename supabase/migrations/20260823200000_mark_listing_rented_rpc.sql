-- =========================================================
-- ATOMIC MARK-AS-RENTED RPC ("تم التأجير" / "تم التأجير من خارج مكتري")
-- =========================================================
-- Fixes audited issues in the Mark-as-Rented flow:
--
--   FIX 2 (ATOMICITY): the client used to run two independent calls
--     (1) INSERT INTO rentals   (2) UPDATE listings SET status='rented'
--     A failure between them left a completed rental on an ACTIVE listing.
--     This function performs both writes inside ONE transaction; any
--     validation failure ROLLs BACK everything.
--
--   FIX 9 (RACE CONDITIONS): concurrent attempts (double click, two tabs,
--     two devices) serialize on a per-listing row lock
--     (SELECT ... FOR UPDATE). The loser observes status='rented' and is
--     rejected. Result: at most ONE current rental per listing.
--
--   LIFECYCLE PRESERVED (mandatory):
--     ACTIVE -> RENTED -> (lease ends) -> owner re-lists -> ACTIVE -> RENTED ...
--     * NO unique constraint on listings(listing_id) is added here.
--     * Historical rental rows are NEVER deleted or rewritten by this fn.
--     * Only the CURRENT state ('rented') blocks a new rental. Once the
--       listing returns to any non-rented status (e.g. renew -> 'active'),
--       marking rented becomes possible again with a fresh rental row.
--
--   SECURITY (defense in depth): SECURITY INVOKER on purpose — every
--   statement runs under the caller's own RLS policies:
--     - SELECT ... FOR UPDATE visibility follows the UPDATE policy
--       ("Owners can update own listings": auth.uid() = owner_id), so a
--       non-owner cannot even lock/see the row to act on it.
--     - INSERT into rentals passes "Owner can create rental" (owner-only).
--     - UPDATE passes "Owners can update own listings" (+ WITH CHECK).
--     - trg_listing_authorization still applies (status='rented' is allowed
--       for owners; no protected field is touched).
--   auth.uid() and ownership are ALSO checked explicitly below so failures
--   produce clear Arabic errors instead of silent zero-row updates.
--   No new privileges are granted beyond EXECUTE to authenticated.
--
--   XOR tenant representation (external vs registered) mirrors the existing
--   CHECK constraint rentals_external_or_registered_tenant:
--     external  : renter_id NULL + external_tenant_name/phone present
--     registered: renter_id set + external_* NULL
--
--   PRIVATE OFFERS unchanged: when the listing is reserved for a registered
--   renter (private_offer/reserved), external mode stays BLOCKED and the
--   internal mode creates status='pending_review' WITHOUT changing the
--   listing status (admin review workflow in RentalsReview owns the rest).
--
-- NOT changed here (out of scope): pg_cron / send_rental_reminders() keeps
-- targeting ONLY status='active' listings, so a 'rented' listing naturally
-- stops receiving weekly reminders until it is re-listed.
-- =========================================================

CREATE OR REPLACE FUNCTION public.mark_listing_rented(
  p_listing_id uuid,
  p_renter_id uuid DEFAULT NULL,
  p_broker_id uuid DEFAULT NULL,
  p_external_tenant_name text DEFAULT NULL,
  p_external_tenant_phone text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_listing public.listings%ROWTYPE;
  v_is_private_offer boolean;
  v_rental_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'المستخدم غير مسجل';
  END IF;

  -- ---- Tenant representation validation (XOR) --------------------------
  IF p_renter_id IS NULL THEN
    -- External tenant path: name AND phone are mandatory, stored as rental
    -- data only (never an account).
    IF COALESCE(btrim(p_external_tenant_name), '') = ''
       OR COALESCE(btrim(p_external_tenant_phone), '') = '' THEN
      RAISE EXCEPTION 'أدخل اسم المستأجر ورقم جوال صحيح';
    END IF;
  ELSE
    -- Registered renter path: external fields must be absent.
    IF p_external_tenant_name IS NOT NULL OR p_external_tenant_phone IS NOT NULL THEN
      RAISE EXCEPTION 'لا يمكن الجمع بين مستأجر مسجل ومستأجر خارجي';
    END IF;
    IF p_renter_id = v_uid THEN
      RAISE EXCEPTION 'لا يمكن تعيين نفسك كمستأجر';
    END IF;
  END IF;

  IF p_broker_id IS NOT NULL AND p_broker_id = v_uid THEN
    RAISE EXCEPTION 'لا يمكن تعيين نفسك وسيطاً';
  END IF;
  IF p_broker_id IS NOT NULL AND p_broker_id = p_renter_id THEN
    RAISE EXCEPTION 'الوسيط لا يمكن أن يكون هو المستأجر';
  END IF;

  -- ---- Serialize concurrent attempts on the SAME listing ---------------
  -- Row lock held until transaction end. Under RLS (UPDATE policy), rows of
  -- other owners are invisible here, so a non-owner simply gets NOT FOUND.
  SELECT * INTO v_listing
    FROM public.listings
   WHERE id = p_listing_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'الإعلان غير موجود أو غير مصرح لك به';
  END IF;

  IF v_listing.owner_id <> v_uid THEN
    RAISE EXCEPTION 'غير مصرح لك بتعديل هذا الإعلان';
  END IF;

  v_is_private_offer := v_listing.reserved_for_user_id IS NOT NULL
                        AND v_listing.status IN ('private_offer', 'reserved');

  -- ---- Private offer branch (unchanged workflow) -----------------------
  IF v_is_private_offer THEN
    IF p_renter_id IS NULL THEN
      RAISE EXCEPTION 'غير متاح للعروض الخاصة';
    END IF;

    INSERT INTO public.rentals (listing_id, owner_id, renter_id, broker_id, status)
    VALUES (p_listing_id, v_uid, p_renter_id, p_broker_id, 'pending_review')
    RETURNING id INTO v_rental_id;

    -- Listing intentionally KEEPS its reserved status until admin review.
    RETURN jsonb_build_object(
      'ok', true,
      'rental_id', v_rental_id,
      'rental_status', 'pending_review',
      'listing_status', v_listing.status::text
    );
  END IF;

  -- ---- Core guard: one CURRENT rental at a time ------------------------
  -- Blocks only the rented state. paused/expired/negotiating/draft remain
  -- markable (pre-existing behavior), and re-listing re-enables renting.
  IF v_listing.status = 'rented' THEN
    RAISE EXCEPTION 'الإعلان مؤجر بالفعل';
  END IF;

  -- ---- Atomic completion: insert rental + flip listing -----------------
  INSERT INTO public.rentals
    (listing_id, owner_id, renter_id, broker_id,
     external_tenant_name, external_tenant_phone, status)
  VALUES (
    p_listing_id,
    v_uid,
    p_renter_id,
    p_broker_id,
    CASE WHEN p_renter_id IS NULL THEN btrim(p_external_tenant_name) END,
    CASE WHEN p_renter_id IS NULL THEN btrim(p_external_tenant_phone) END,
    'completed'
  )
  RETURNING id INTO v_rental_id;

  UPDATE public.listings
     SET status = 'rented',
         last_updated_at = now()
   WHERE id = p_listing_id;

  -- Pre-existing client behavior preserved verbatim: completing a normal
  -- rental also targets the housing request this listing originated from.
  -- NOTE: under SECURITY INVOKER this respects housing_requests UPDATE RLS
  -- ("Users can update own requests": requester_id = auth.uid()), exactly
  -- like the previous client-side call did. Private offers intentionally
  -- wait for admin review before any request completion.
  IF v_listing.source_request_id IS NOT NULL THEN
    UPDATE public.housing_requests
       SET status = 'completed'
     WHERE id = v_listing.source_request_id;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'rental_id', v_rental_id,
    'rental_status', 'completed',
    'listing_status', 'rented'
  );
END;
$$;

-- Execute permission follows the project convention for RPCs:
-- authenticated users only, nothing exposed to PUBLIC/anon.
REVOKE ALL ON FUNCTION public.mark_listing_rented(uuid, uuid, uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_listing_rented(uuid, uuid, uuid, text, text) TO authenticated;
