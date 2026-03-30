
-- Performance indexes for production readiness
-- Idempotent: CREATE INDEX IF NOT EXISTS

CREATE INDEX IF NOT EXISTS idx_listings_status ON public.listings (status);
CREATE INDEX IF NOT EXISTS idx_listings_district_id ON public.listings (district_id);
CREATE INDEX IF NOT EXISTS idx_listings_owner_id ON public.listings (owner_id);
CREATE INDEX IF NOT EXISTS idx_listings_category ON public.listings (category);
CREATE INDEX IF NOT EXISTS idx_listings_created_at ON public.listings (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_listings_status_district ON public.listings (status, district_id);

CREATE INDEX IF NOT EXISTS idx_favorites_user_id ON public.favorites (user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_listing_id ON public.favorites (listing_id);

CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON public.notifications (user_id, is_read);

CREATE INDEX IF NOT EXISTS idx_housing_requests_status ON public.housing_requests (status);
CREATE INDEX IF NOT EXISTS idx_housing_requests_district ON public.housing_requests (district_id);

CREATE INDEX IF NOT EXISTS idx_request_responses_request ON public.request_responses (request_id);
CREATE INDEX IF NOT EXISTS idx_request_responses_responder ON public.request_responses (responder_id);

CREATE INDEX IF NOT EXISTS idx_reports_status ON public.reports (status);

CREATE INDEX IF NOT EXISTS idx_verification_apps_status ON public.verification_applications (status);
CREATE INDEX IF NOT EXISTS idx_verification_apps_applicant ON public.verification_applications (applicant_id);

CREATE INDEX IF NOT EXISTS idx_listing_images_listing ON public.listing_images (listing_id);

CREATE INDEX IF NOT EXISTS idx_otp_codes_phone ON public.otp_codes (phone, verified, expires_at);
