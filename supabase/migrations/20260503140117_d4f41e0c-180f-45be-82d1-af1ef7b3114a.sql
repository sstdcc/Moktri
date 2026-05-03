
CREATE TYPE public.listing_request_type AS ENUM ('request', 'negotiate');
CREATE TYPE public.listing_request_status AS ENUM ('pending', 'accepted', 'rejected', 'cancelled');

CREATE TABLE public.listing_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL,
  owner_id uuid NOT NULL,
  requester_id uuid NOT NULL,
  conversation_id uuid,
  type public.listing_request_type NOT NULL DEFAULT 'request',
  message text,
  offered_price numeric,
  status public.listing_request_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT listing_requests_no_self CHECK (owner_id <> requester_id)
);

CREATE INDEX idx_listing_requests_listing ON public.listing_requests(listing_id);
CREATE INDEX idx_listing_requests_owner ON public.listing_requests(owner_id);
CREATE INDEX idx_listing_requests_requester ON public.listing_requests(requester_id);
CREATE UNIQUE INDEX idx_listing_requests_unique_pending
  ON public.listing_requests(listing_id, requester_id)
  WHERE status = 'pending';

ALTER TABLE public.listing_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Requesters can insert own listing requests"
  ON public.listing_requests FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = requester_id
    AND EXISTS (
      SELECT 1 FROM public.listings l
      WHERE l.id = listing_id AND l.owner_id = listing_requests.owner_id
    )
  );

CREATE POLICY "Parties can view own listing requests"
  ON public.listing_requests FOR SELECT
  TO authenticated
  USING (auth.uid() = requester_id OR auth.uid() = owner_id);

CREATE POLICY "Owner can update status"
  ON public.listing_requests FOR UPDATE
  TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Requester can cancel own request"
  ON public.listing_requests FOR UPDATE
  TO authenticated
  USING (auth.uid() = requester_id)
  WITH CHECK (auth.uid() = requester_id);

CREATE POLICY "Admins can read all listing requests"
  ON public.listing_requests FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role IN ('admin','moderator')
  ));

CREATE TRIGGER update_listing_requests_updated_at
  BEFORE UPDATE ON public.listing_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
