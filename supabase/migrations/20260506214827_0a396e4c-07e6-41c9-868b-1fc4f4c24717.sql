
ALTER TABLE public.housing_request_offers
  ADD CONSTRAINT housing_request_offers_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES public.listings(id) ON DELETE CASCADE,
  ADD CONSTRAINT housing_request_offers_housing_request_id_fkey FOREIGN KEY (housing_request_id) REFERENCES public.housing_requests(id) ON DELETE CASCADE,
  ADD CONSTRAINT housing_request_offers_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.profiles(id) ON DELETE CASCADE,
  ADD CONSTRAINT housing_request_offers_requester_id_fkey FOREIGN KEY (requester_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
