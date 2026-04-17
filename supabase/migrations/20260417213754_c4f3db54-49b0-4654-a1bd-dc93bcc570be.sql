-- Add private offer columns to listings
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS reserved_for_user_id uuid,
  ADD COLUMN IF NOT EXISTS source_request_id uuid,
  ADD COLUMN IF NOT EXISTS offered_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_listings_reserved_for ON public.listings(reserved_for_user_id);
CREATE INDEX IF NOT EXISTS idx_listings_source_request ON public.listings(source_request_id);

-- Replace the public SELECT policy so private_offer/reserved listings are restricted
DROP POLICY IF EXISTS "Anyone can read active listings" ON public.listings;

CREATE POLICY "Public can read active listings"
  ON public.listings FOR SELECT
  USING (
    status = 'active'::listing_status
    OR owner_id = auth.uid()
    OR (
      status IN ('private_offer'::listing_status, 'reserved'::listing_status)
      AND reserved_for_user_id = auth.uid()
    )
  );