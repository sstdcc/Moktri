-- P6-SEC-02: Rental Rating relationship authorization.
--
-- Root cause: public.get_rateable_rentals(p_rater, p_rated) was SECURITY DEFINER
-- and PUBLIC-executable (implicit default grant), and it never verified that the
-- caller IS p_rater. Any anonymous or authenticated caller could pass arbitrary
-- UUID pairs and learn whether a completed rental relationship exists between
-- any two users (relationship/participant oracle).
--
-- Fix:
--   1. Rewrite as PL/pgSQL with a NULL-safe authorization guard: only the
--      authenticated user matching p_rater may call it. Behavior for the
--      authorized rater (valid completed-rental lookup, ordering, already_rated)
--      is preserved unchanged.
--   2. Revoke the implicit PUBLIC EXECUTE and grant to authenticated + service_role.

CREATE OR REPLACE FUNCTION public.get_rateable_rentals(p_rater UUID, p_rated UUID)
RETURNS TABLE(
  rental_id UUID,
  listing_id UUID,
  listing_title TEXT,
  completed_at TIMESTAMPTZ,
  already_rated BOOLEAN
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_rater THEN
    RAISE EXCEPTION 'غير مسموح';
  END IF;

  RETURN QUERY
    SELECT
      r.id AS rental_id,
      r.listing_id,
      l.title AS listing_title,
      r.completed_at,
      EXISTS(SELECT 1 FROM public.user_ratings ur WHERE ur.rental_id = r.id AND ur.rater_id = p_rater) AS already_rated
    FROM public.rentals r
    JOIN public.listings l ON l.id = r.listing_id
    WHERE r.status = 'completed'
      AND (
        (p_rater = r.renter_id AND p_rated = r.owner_id)
        OR (p_rater = r.owner_id  AND p_rated = r.renter_id)
        OR (r.broker_id IS NOT NULL AND p_rater = r.renter_id AND p_rated = r.broker_id)
        OR (r.broker_id IS NOT NULL AND p_rater = r.broker_id AND p_rated = r.renter_id)
      )
    ORDER BY r.completed_at DESC NULLS LAST;
END;
$$;

REVOKE ALL ON FUNCTION public.get_rateable_rentals(uuid, uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_rateable_rentals(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_rateable_rentals(uuid, uuid) TO service_role;