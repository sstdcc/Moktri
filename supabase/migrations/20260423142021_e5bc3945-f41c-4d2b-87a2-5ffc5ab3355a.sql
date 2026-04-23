ALTER TABLE public.listing_messages REPLICA IDENTITY FULL;
ALTER TABLE public.listing_conversations REPLICA IDENTITY FULL;
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.listing_messages;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.listing_conversations;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;