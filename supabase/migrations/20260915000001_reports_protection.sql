-- Reports protection: prevent duplicate reports + ensure listing target validity
-- Requirements:
-- 1) Clean existing duplicate reports (keep the OLDEST report per (reporter_id, target_type, target_id))
-- 2) UNIQUE (reporter_id, target_type, target_id) blocks any future duplicates
-- 3) Trigger protection for target_type='listing': exists, active, not owner

-- 1) Remove existing duplicate reports, keeping the oldest report per unique key.
--    Only rows beyond the first (ordered by created_at ascending, then id) are deleted;
--    non-duplicate reports are never touched.
DO $$
DECLARE
  v_deleted INTEGER;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'reports_unique_reporter_target'
      AND conrelid = 'public.reports'::regclass
  ) THEN
    WITH ranked AS (
      SELECT id,
             ROW_NUMBER() OVER (
               PARTITION BY reporter_id, target_type, target_id
               ORDER BY created_at ASC NULLS LAST, id ASC
             ) AS rn
      FROM public.reports
    )
    DELETE FROM public.reports r
    USING ranked
    WHERE ranked.id = r.id
      AND ranked.rn > 1;

    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RAISE NOTICE 'reports_protection: removed % duplicate report(s)', v_deleted;

    -- 2) Add UNIQUE constraint (creates unique index implicitly)
    ALTER TABLE public.reports
      ADD CONSTRAINT reports_unique_reporter_target
      UNIQUE (reporter_id, target_type, target_id);
  END IF;
END $$;

-- 3) Protection trigger for listing reports
CREATE OR REPLACE FUNCTION public.check_reports_listing_protection()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id uuid;
  v_status public.listing_status;
BEGIN
  -- Only enforce for listing targets; keep support for user/request unchanged
  IF NEW.target_type = 'listing' THEN
    SELECT owner_id, status INTO v_owner_id, v_status
    FROM public.listings
    WHERE id = NEW.target_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'listing_not_found: target listing does not exist %', NEW.target_id
        USING ERRCODE = 'P0001';
    END IF;

    IF v_status <> 'active' THEN
      RAISE EXCEPTION 'listing_not_active: can only report active listings (status=%)', v_status
        USING ERRCODE = 'P0001';
    END IF;

    IF v_owner_id = NEW.reporter_id THEN
      RAISE EXCEPTION 'self_report_not_allowed: cannot report own listing'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reports_listing_protection ON public.reports;
CREATE TRIGGER trg_reports_listing_protection
  BEFORE INSERT ON public.reports
  FOR EACH ROW
  EXECUTE FUNCTION public.check_reports_listing_protection();