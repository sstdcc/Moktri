
-- Status enum for housing request offers
CREATE TYPE public.housing_request_offer_status AS ENUM ('pending','accepted','rejected');

CREATE TABLE public.housing_request_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  housing_request_id uuid NOT NULL,
  listing_id uuid NOT NULL,
  owner_id uuid NOT NULL,
  requester_id uuid NOT NULL,
  proposed_price numeric,
  message text,
  status public.housing_request_offer_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uniq_pending_offer_per_owner_request
  ON public.housing_request_offers (housing_request_id, owner_id)
  WHERE status = 'pending';

CREATE INDEX idx_hro_request ON public.housing_request_offers(housing_request_id);
CREATE INDEX idx_hro_owner ON public.housing_request_offers(owner_id);
CREATE INDEX idx_hro_requester ON public.housing_request_offers(requester_id);

ALTER TABLE public.housing_request_offers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner can insert own offers"
  ON public.housing_request_offers FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = owner_id
    AND EXISTS (SELECT 1 FROM public.listings l WHERE l.id = listing_id AND l.owner_id = auth.uid())
    AND EXISTS (SELECT 1 FROM public.housing_requests hr WHERE hr.id = housing_request_id AND hr.requester_id = housing_request_offers.requester_id)
  );

CREATE POLICY "Parties can view offers"
  ON public.housing_request_offers FOR SELECT TO authenticated
  USING (auth.uid() = owner_id OR auth.uid() = requester_id);

CREATE POLICY "Owner can update own offers"
  ON public.housing_request_offers FOR UPDATE TO authenticated
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

CREATE TRIGGER trg_hro_updated_at
  BEFORE UPDATE ON public.housing_request_offers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Notification RLS: allow owner to notify requester about a created offer
CREATE POLICY "Owner can notify requester of new housing offer"
  ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (
    type = 'private_offer_created'
    AND user_id <> auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.housing_request_offers o
      WHERE o.requester_id = notifications.user_id
        AND o.owner_id = auth.uid()
    )
  );

-- Notification RLS: allow requester to notify owner of accept/reject of a housing offer
CREATE POLICY "Requester can notify owner of housing offer decision"
  ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (
    type IN ('private_offer_accepted','private_offer_rejected')
    AND user_id <> auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.housing_request_offers o
      WHERE o.owner_id = notifications.user_id
        AND o.requester_id = auth.uid()
    )
  );

-- Accept function (requester only): sets accepted, rejects siblings, sets listing negotiating
CREATE OR REPLACE FUNCTION public.accept_housing_request_offer(_offer_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  o public.housing_request_offers%ROWTYPE;
BEGIN
  SELECT * INTO o FROM public.housing_request_offers WHERE id = _offer_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'العرض غير موجود'; END IF;
  IF auth.uid() <> o.requester_id THEN RAISE EXCEPTION 'غير مسموح'; END IF;
  IF o.status <> 'pending' THEN RAISE EXCEPTION 'لا يمكن قبول عرض غير معلّق'; END IF;

  UPDATE public.housing_request_offers
    SET status = 'accepted', updated_at = now()
    WHERE id = _offer_id;

  UPDATE public.housing_request_offers
    SET status = 'rejected', updated_at = now()
    WHERE housing_request_id = o.housing_request_id
      AND id <> _offer_id
      AND status = 'pending';

  UPDATE public.listings
    SET status = 'negotiating'
    WHERE id = o.listing_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_housing_request_offer(_offer_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  o public.housing_request_offers%ROWTYPE;
BEGIN
  SELECT * INTO o FROM public.housing_request_offers WHERE id = _offer_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'العرض غير موجود'; END IF;
  IF auth.uid() <> o.requester_id THEN RAISE EXCEPTION 'غير مسموح'; END IF;
  IF o.status <> 'pending' THEN RAISE EXCEPTION 'لا يمكن رفض عرض غير معلّق'; END IF;

  UPDATE public.housing_request_offers
    SET status = 'rejected', updated_at = now()
    WHERE id = _offer_id;
END;
$$;
