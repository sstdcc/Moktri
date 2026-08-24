-- =========================================================
-- EXTERNAL TENANT ON RENTALS ("تم التأجير من خارج مكتري")
-- Stores tenant name/phone as rental data ONLY.
-- Does NOT create profiles or auth.users rows; the phone
-- remains free for a future Moktari signup with no conflict.
-- =========================================================

ALTER TABLE public.rentals ALTER COLUMN renter_id DROP NOT NULL;

ALTER TABLE public.rentals
  ADD COLUMN IF NOT EXISTS external_tenant_name TEXT,
  ADD COLUMN IF NOT EXISTS external_tenant_phone TEXT;

COMMENT ON COLUMN public.rentals.external_tenant_name IS 'Tenant full name when rented outside Moktari — rental data only, NOT a user account';
COMMENT ON COLUMN public.rentals.external_tenant_phone IS 'Tenant phone when rented outside Moktari — NOT linked to auth.users or profiles';

-- Exactly one representation: registered renter XOR external tenant (name+phone)
ALTER TABLE public.rentals
  DROP CONSTRAINT IF EXISTS rentals_external_or_registered_tenant;

ALTER TABLE public.rentals
  ADD CONSTRAINT rentals_external_or_registered_tenant CHECK (
    (renter_id IS NOT NULL AND external_tenant_name IS NULL AND external_tenant_phone IS NULL)
    OR
    (renter_id IS NULL AND external_tenant_name IS NOT NULL AND external_tenant_phone IS NOT NULL)
  );

-- Notes:
-- - validate_rental_owner() trigger is NULL-safe (NULL <> comparison passes).
-- - broker_not_party / renter_not_owner CHECKs are NULL-safe.
-- - Rating functions/RPCs compare against renter_id; NULL simply never matches,
--   so external rentals never produce rating pairs (correct: no account exists).
-- - RLS INSERT policy "Owner can create rental" checks owner/listing ownership only.
