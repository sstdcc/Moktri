ALTER PUBLICATION supabase_realtime ADD TABLE public.housing_requests;
ALTER TABLE public.housing_request_offers REPLICA IDENTITY FULL;
ALTER TABLE public.housing_requests REPLICA IDENTITY FULL;
ALTER TABLE public.listings REPLICA IDENTITY FULL;
ALTER TABLE public.request_messages REPLICA IDENTITY FULL;