-- 1. Rentals table
CREATE TYPE public.rental_status AS ENUM ('active', 'completed', 'cancelled');

CREATE TABLE public.rentals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  renter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  broker_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  status public.rental_status NOT NULL DEFAULT 'active',
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT renter_not_owner CHECK (renter_id <> owner_id),
  CONSTRAINT broker_not_party CHECK (broker_id IS NULL OR (broker_id <> owner_id AND broker_id <> renter_id))
);

CREATE INDEX idx_rentals_owner ON public.rentals(owner_id);
CREATE INDEX idx_rentals_renter ON public.rentals(renter_id);
CREATE INDEX idx_rentals_broker ON public.rentals(broker_id);
CREATE INDEX idx_rentals_listing ON public.rentals(listing_id);

ALTER TABLE public.rentals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Parties can view own rentals"
ON public.rentals FOR SELECT
USING (auth.uid() IN (owner_id, renter_id, broker_id));

CREATE POLICY "Admins can view all rentals"
ON public.rentals FOR SELECT
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','moderator')));

CREATE POLICY "Owner can create rental"
ON public.rentals FOR INSERT
WITH CHECK (
  auth.uid() = owner_id
  AND EXISTS (SELECT 1 FROM public.listings l WHERE l.id = listing_id AND l.owner_id = auth.uid())
);

CREATE POLICY "Owner can update own rental"
ON public.rentals FOR UPDATE
USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Admins can update any rental"
ON public.rentals FOR UPDATE
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','moderator')))
WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','moderator')));

CREATE TRIGGER update_rentals_updated_at
BEFORE UPDATE ON public.rentals
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-set completed_at when status becomes completed
CREATE OR REPLACE FUNCTION public.set_rental_completed_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed') THEN
    NEW.completed_at := now();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER rentals_set_completed_at
BEFORE UPDATE ON public.rentals
FOR EACH ROW EXECUTE FUNCTION public.set_rental_completed_at();

-- 2. Link ratings to rentals
ALTER TABLE public.user_ratings ADD COLUMN rental_id UUID REFERENCES public.rentals(id) ON DELETE CASCADE;

-- Drop the old unique pair constraint (one rating per pair) — replaced by per-rental
ALTER TABLE public.user_ratings DROP CONSTRAINT IF EXISTS unique_rater_per_user;

-- Note: existing rows would fail NOT NULL on rental_id, so we'll delete legacy ratings (testing-only data)
DELETE FROM public.user_ratings WHERE rental_id IS NULL;
ALTER TABLE public.user_ratings ALTER COLUMN rental_id SET NOT NULL;

-- One rating per rater per rental
ALTER TABLE public.user_ratings ADD CONSTRAINT unique_rating_per_rental UNIQUE (rater_id, rental_id);
CREATE INDEX idx_user_ratings_rental ON public.user_ratings(rental_id);

-- 3. Validation function: ensures rating is for a completed rental and the pair is allowed
CREATE OR REPLACE FUNCTION public.validate_user_rating()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r public.rentals%ROWTYPE;
BEGIN
  SELECT * INTO r FROM public.rentals WHERE id = NEW.rental_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'الإيجار غير موجود';
  END IF;
  IF r.status <> 'completed' THEN
    RAISE EXCEPTION 'لا يمكن التقييم إلا بعد اكتمال الإيجار';
  END IF;

  -- Allowed directions:
  --   renter -> owner, owner -> renter
  --   renter -> broker, broker -> renter
  IF NOT (
    (NEW.rater_id = r.renter_id AND NEW.rated_user_id = r.owner_id)
    OR (NEW.rater_id = r.owner_id  AND NEW.rated_user_id = r.renter_id)
    OR (r.broker_id IS NOT NULL AND NEW.rater_id = r.renter_id AND NEW.rated_user_id = r.broker_id)
    OR (r.broker_id IS NOT NULL AND NEW.rater_id = r.broker_id AND NEW.rated_user_id = r.renter_id)
  ) THEN
    RAISE EXCEPTION 'هذا النوع من التقييم غير مسموح';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER user_ratings_validate
BEFORE INSERT OR UPDATE ON public.user_ratings
FOR EACH ROW EXECUTE FUNCTION public.validate_user_rating();

-- 4. Helper: list completed rentals where current user can rate target user
CREATE OR REPLACE FUNCTION public.get_rateable_rentals(p_rater UUID, p_rated UUID)
RETURNS TABLE(
  rental_id UUID,
  listing_id UUID,
  listing_title TEXT,
  completed_at TIMESTAMPTZ,
  already_rated BOOLEAN
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
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
$$;