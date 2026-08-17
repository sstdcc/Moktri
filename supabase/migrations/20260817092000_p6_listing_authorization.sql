-- P6-BL-01 + P6-BL-02: Listing moderation status bypass and protected fields.
--
-- Root cause:
--   * INSERT policy "Owners can insert listings" only enforced `auth.uid() = owner_id`.
--     No status restriction, so an unverified user could insert status='active'
--     (already published) and bypass moderation entirely.
--   * UPDATE policy "Owners can update own listings" had USING but no WITH CHECK,
--     so an owner could flip 'pending_review' -> 'active' (moderation bypass) and
--     could mutate protected/ownership fields (owner_id, is_featured, counters,
--     quality_score, moderation_note, created_at) via the direct REST API.
--
-- Fix (server-side, minimal):
--   1. BEFORE INSERT OR UPDATE trigger public.enforce_listing_authorization():
--        - exempts privileged/internal execution (SECURITY DEFINER RPCs such as
--          confirm_rental_deal / complete_housing_request_offer / accept or reject
--          offer, counter increments and favorites sync all run as 'postgres'),
--          service_role contexts (current_user 'postgres'/'supabase_admin'/
--          'service_role'), and admin/moderator profiles (moderation path preserved)
--        - blocks INSERT of status='active' by an unverified owner
--        - blocks promotion draft|pending_review|rejected -> active by an
--          unverified owner
--        - blocks mutation of protected fields by non-privileged callers
--   2. Owner UPDATE policy gains WITH CHECK (auth.uid() = owner_id) so ownership
--      cannot be reassigned at the RLS layer either.
--
-- Legitimate paths preserved:
--   * verified owner publishes directly (active on insert)        -> allowed
--   * unverified owner gets pending_review (moderation)            -> allowed
--   * owner pause/resume/renew (active<->paused, expired->active)  -> allowed
--   * owner marks own listing rented / private offer / reserved    -> allowed
--   * renter/owner accept/complete flows set negotiating/rented via
--     SECURITY DEFINER functions                                   -> exempt
--   * admin/moderator approve/reject (set active / rejected)       -> allowed

DROP TRIGGER IF EXISTS trg_listing_authorization ON public.listings;

CREATE OR REPLACE FUNCTION public.enforce_listing_authorization()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_is_moderator boolean;
  v_is_verified_owner boolean;
BEGIN
  -- Privileged/internal execution is exempt (RLS still governs row access).
  -- Only the REST-facing RLS roles are subject to these business rules.
  IF current_user NOT IN ('anon', 'authenticated') THEN
    RETURN NEW;
  END IF;

  v_is_moderator := EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin','moderator')
  );
  IF v_is_moderator THEN
    RETURN NEW;
  END IF;

  v_is_verified_owner := EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND is_verified = true
  );

  IF TG_OP = 'INSERT' THEN
    -- P6-BL-01: a non-moderator, unverified owner cannot publish directly.
    IF NEW.status::text = 'active' AND NOT v_is_verified_owner THEN
      RAISE EXCEPTION 'لا يمكن نشر الإعلان قبل موافقة المشرف';
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    -- P6-BL-01: a non-moderator, unverified owner cannot promote a non-public
    -- listing to active (moderation bypass). pause/resume/renew are preserved.
    IF NEW.status::text = 'active'
       AND OLD.status::text IN ('draft','pending_review','rejected')
       AND NOT v_is_verified_owner THEN
      RAISE EXCEPTION 'لا يمكن نشر الإعلان قبل موافقة المشرف';
    END IF;

    -- P6-BL-02: protected fields cannot be mutated by a non-privileged caller.
    IF NEW.owner_id IS DISTINCT FROM OLD.owner_id THEN
      RAISE EXCEPTION 'لا يمكن تغيير مالك الإعلان';
    END IF;
    IF NEW.is_featured IS DISTINCT FROM OLD.is_featured THEN
      RAISE EXCEPTION 'لا يمكن تعديل خاصية الإعلان المميز';
    END IF;
    IF NEW.views_count IS DISTINCT FROM OLD.views_count
       OR NEW.favorites_count IS DISTINCT FROM OLD.favorites_count
       OR NEW.contact_clicks IS DISTINCT FROM OLD.contact_clicks
       OR NEW.whatsapp_clicks IS DISTINCT FROM OLD.whatsapp_clicks THEN
      RAISE EXCEPTION 'لا يمكن تعديل عدادات الإعلان';
    END IF;
    IF NEW.quality_score IS DISTINCT FROM OLD.quality_score THEN
      RAISE EXCEPTION 'لا يمكن تعديل جودة الإعلان';
    END IF;
    IF NEW.moderation_note IS DISTINCT FROM OLD.moderation_note THEN
      RAISE EXCEPTION 'لا يمكن تعديل ملاحظة المراجعة';
    END IF;
    IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'لا يمكن تعديل تاريخ إنشاء الإعلان';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_listing_authorization
  BEFORE INSERT OR UPDATE ON public.listings
  FOR EACH ROW EXECUTE FUNCTION public.enforce_listing_authorization();

-- RLS layer: an owner cannot reassign ownership (new row must still be owned by
-- the caller). Admin/moderator updates use their own separate policy.
DROP POLICY IF EXISTS "Owners can update own listings" ON public.listings;
CREATE POLICY "Owners can update own listings"
  ON public.listings FOR UPDATE
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);