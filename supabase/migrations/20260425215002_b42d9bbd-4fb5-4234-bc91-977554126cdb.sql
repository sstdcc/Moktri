-- =========================================================
-- FOREIGN KEYS
-- =========================================================

-- profiles.id -> auth.users.id (cascade): already managed via handle_new_user; add FK for integrity
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_id_fkey,
  ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- listings
ALTER TABLE public.listings
  DROP CONSTRAINT IF EXISTS listings_owner_id_fkey,
  ADD CONSTRAINT listings_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.listings
  DROP CONSTRAINT IF EXISTS listings_district_id_fkey,
  ADD CONSTRAINT listings_district_id_fkey FOREIGN KEY (district_id) REFERENCES public.districts(id) ON DELETE SET NULL;
ALTER TABLE public.listings
  DROP CONSTRAINT IF EXISTS listings_reserved_for_user_id_fkey,
  ADD CONSTRAINT listings_reserved_for_user_id_fkey FOREIGN KEY (reserved_for_user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.listings
  DROP CONSTRAINT IF EXISTS listings_source_request_id_fkey,
  ADD CONSTRAINT listings_source_request_id_fkey FOREIGN KEY (source_request_id) REFERENCES public.housing_requests(id) ON DELETE SET NULL;

-- listing_images
ALTER TABLE public.listing_images
  DROP CONSTRAINT IF EXISTS listing_images_listing_id_fkey,
  ADD CONSTRAINT listing_images_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES public.listings(id) ON DELETE CASCADE;

-- favorites
ALTER TABLE public.favorites
  DROP CONSTRAINT IF EXISTS favorites_user_id_fkey,
  ADD CONSTRAINT favorites_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.favorites
  DROP CONSTRAINT IF EXISTS favorites_listing_id_fkey,
  ADD CONSTRAINT favorites_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES public.listings(id) ON DELETE CASCADE;

-- housing_requests
ALTER TABLE public.housing_requests
  DROP CONSTRAINT IF EXISTS housing_requests_requester_id_fkey,
  ADD CONSTRAINT housing_requests_requester_id_fkey FOREIGN KEY (requester_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.housing_requests
  DROP CONSTRAINT IF EXISTS housing_requests_district_id_fkey,
  ADD CONSTRAINT housing_requests_district_id_fkey FOREIGN KEY (district_id) REFERENCES public.districts(id) ON DELETE SET NULL;

-- listing_conversations
ALTER TABLE public.listing_conversations
  DROP CONSTRAINT IF EXISTS listing_conversations_listing_id_fkey,
  ADD CONSTRAINT listing_conversations_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES public.listings(id) ON DELETE CASCADE;
ALTER TABLE public.listing_conversations
  DROP CONSTRAINT IF EXISTS listing_conversations_owner_id_fkey,
  ADD CONSTRAINT listing_conversations_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.listing_conversations
  DROP CONSTRAINT IF EXISTS listing_conversations_user_id_fkey,
  ADD CONSTRAINT listing_conversations_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- listing_messages
ALTER TABLE public.listing_messages
  DROP CONSTRAINT IF EXISTS listing_messages_conversation_id_fkey,
  ADD CONSTRAINT listing_messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.listing_conversations(id) ON DELETE CASCADE;
ALTER TABLE public.listing_messages
  DROP CONSTRAINT IF EXISTS listing_messages_sender_id_fkey,
  ADD CONSTRAINT listing_messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- notifications
ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_user_id_fkey,
  ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- rentals
ALTER TABLE public.rentals
  DROP CONSTRAINT IF EXISTS rentals_listing_id_fkey,
  ADD CONSTRAINT rentals_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES public.listings(id) ON DELETE RESTRICT;
ALTER TABLE public.rentals
  DROP CONSTRAINT IF EXISTS rentals_owner_id_fkey,
  ADD CONSTRAINT rentals_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.profiles(id) ON DELETE RESTRICT;
ALTER TABLE public.rentals
  DROP CONSTRAINT IF EXISTS rentals_renter_id_fkey,
  ADD CONSTRAINT rentals_renter_id_fkey FOREIGN KEY (renter_id) REFERENCES public.profiles(id) ON DELETE RESTRICT;
ALTER TABLE public.rentals
  DROP CONSTRAINT IF EXISTS rentals_broker_id_fkey,
  ADD CONSTRAINT rentals_broker_id_fkey FOREIGN KEY (broker_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- reports
ALTER TABLE public.reports
  DROP CONSTRAINT IF EXISTS reports_reporter_id_fkey,
  ADD CONSTRAINT reports_reporter_id_fkey FOREIGN KEY (reporter_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.reports
  DROP CONSTRAINT IF EXISTS reports_resolved_by_fkey,
  ADD CONSTRAINT reports_resolved_by_fkey FOREIGN KEY (resolved_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- request_responses
ALTER TABLE public.request_responses
  DROP CONSTRAINT IF EXISTS request_responses_request_id_fkey,
  ADD CONSTRAINT request_responses_request_id_fkey FOREIGN KEY (request_id) REFERENCES public.housing_requests(id) ON DELETE CASCADE;
ALTER TABLE public.request_responses
  DROP CONSTRAINT IF EXISTS request_responses_responder_id_fkey,
  ADD CONSTRAINT request_responses_responder_id_fkey FOREIGN KEY (responder_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.request_responses
  DROP CONSTRAINT IF EXISTS request_responses_listing_id_fkey,
  ADD CONSTRAINT request_responses_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES public.listings(id) ON DELETE SET NULL;

-- user_ratings
ALTER TABLE public.user_ratings
  DROP CONSTRAINT IF EXISTS user_ratings_rental_id_fkey,
  ADD CONSTRAINT user_ratings_rental_id_fkey FOREIGN KEY (rental_id) REFERENCES public.rentals(id) ON DELETE CASCADE;
ALTER TABLE public.user_ratings
  DROP CONSTRAINT IF EXISTS user_ratings_rater_id_fkey,
  ADD CONSTRAINT user_ratings_rater_id_fkey FOREIGN KEY (rater_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.user_ratings
  DROP CONSTRAINT IF EXISTS user_ratings_rated_user_id_fkey,
  ADD CONSTRAINT user_ratings_rated_user_id_fkey FOREIGN KEY (rated_user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- verification_applications
ALTER TABLE public.verification_applications
  DROP CONSTRAINT IF EXISTS verification_applications_applicant_id_fkey,
  ADD CONSTRAINT verification_applications_applicant_id_fkey FOREIGN KEY (applicant_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.verification_applications
  DROP CONSTRAINT IF EXISTS verification_applications_reviewed_by_fkey,
  ADD CONSTRAINT verification_applications_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- =========================================================
-- RENTAL INTEGRITY: owner_id must match listing.owner_id
-- =========================================================
CREATE OR REPLACE FUNCTION public.validate_rental_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  listing_owner uuid;
BEGIN
  SELECT owner_id INTO listing_owner FROM public.listings WHERE id = NEW.listing_id;
  IF listing_owner IS NULL THEN
    RAISE EXCEPTION 'الإعلان غير موجود';
  END IF;
  IF NEW.owner_id <> listing_owner THEN
    RAISE EXCEPTION 'مالك الإيجار لا يطابق مالك الإعلان';
  END IF;
  IF NEW.renter_id = NEW.owner_id THEN
    RAISE EXCEPTION 'لا يمكن أن يكون المستأجر هو المالك نفسه';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_rental_owner ON public.rentals;
CREATE TRIGGER trg_validate_rental_owner
BEFORE INSERT OR UPDATE OF listing_id, owner_id, renter_id ON public.rentals
FOR EACH ROW EXECUTE FUNCTION public.validate_rental_owner();

-- =========================================================
-- REALTIME: ensure full row data for chat tables
-- =========================================================
ALTER TABLE public.listing_messages REPLICA IDENTITY FULL;
ALTER TABLE public.listing_conversations REPLICA IDENTITY FULL;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;

-- (tables are already in supabase_realtime publication)

-- =========================================================
-- EXPIRATION LOGIC
-- =========================================================
CREATE OR REPLACE FUNCTION public.expire_stale_records()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.listings
     SET status = 'expired'
   WHERE expires_at IS NOT NULL
     AND expires_at < now()
     AND status = 'active';

  UPDATE public.housing_requests
     SET status = 'expired'
   WHERE expires_at IS NOT NULL
     AND expires_at < now()
     AND status = 'active';
END;
$$;

-- Enable scheduling extensions
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;