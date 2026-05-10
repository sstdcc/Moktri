ALTER TABLE public.listing_requests REPLICA IDENTITY FULL;
ALTER TABLE public.request_messages REPLICA IDENTITY FULL;
ALTER TABLE public.request_conversations REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.listing_requests;