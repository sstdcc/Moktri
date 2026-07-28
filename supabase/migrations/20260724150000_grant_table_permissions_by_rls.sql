-- Grant table-level permissions based on existing RLS policies.
-- Each table receives only the operations (SELECT/INSERT/UPDATE/DELETE)
-- that its policies allow, for the roles (anon/authenticated) specified.
-- Tables with service_role-only policies (otp_codes, login_attempts) excluded.

-- ============================================================
-- TABLES WITH anon + authenticated POLICIES
-- ============================================================

-- profiles: "Anyone can read" → anon SELECT
--           "Users can update/insert own" → authenticated INSERT, UPDATE
-- Column-level grants match migration 20260425220554 to protect PII (phone, etc.)
REVOKE ALL ON public.profiles FROM anon;
GRANT SELECT (id, full_name, avatar_url, role, bio,
  is_verified, verification_badge,
  total_listings, total_responses, created_at) ON public.profiles TO anon;

REVOKE ALL ON public.profiles FROM authenticated;
GRANT SELECT (id, full_name, avatar_url, role, bio,
  is_verified, verification_badge, is_active,
  total_listings, total_responses,
  created_at, updated_at) ON public.profiles TO authenticated;
GRANT INSERT, UPDATE ON public.profiles TO authenticated;

-- districts: "Anyone can read" → anon SELECT
--            "Authenticated can insert/update" → authenticated INSERT, UPDATE
GRANT SELECT ON public.districts TO anon;
GRANT SELECT, INSERT, UPDATE ON public.districts TO authenticated;

-- listings: "Anyone can read active" → anon SELECT
--           "Owners can insert/update/delete" → authenticated INSERT, UPDATE, DELETE
GRANT SELECT ON public.listings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.listings TO authenticated;

-- listing_images: "Anyone can read" → anon SELECT
--                 "Owners can manage" → authenticated INSERT, UPDATE, DELETE
GRANT SELECT ON public.listing_images TO anon;
GRANT SELECT ON public.listing_images TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.listing_images TO authenticated;

-- housing_requests: "Anyone can read active" → anon SELECT
--                   "Users can insert/update/delete own" → authenticated INSERT, UPDATE, DELETE
GRANT SELECT ON public.housing_requests TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.housing_requests TO authenticated;

-- user_ratings: "Anyone can read" → anon SELECT
--               "Users can insert/update/delete own" → authenticated INSERT, UPDATE, DELETE
GRANT SELECT ON public.user_ratings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_ratings TO authenticated;

-- ============================================================
-- TABLES WITH authenticated-only POLICIES
-- ============================================================

-- request_responses: "Responders/requesters can read" → authenticated SELECT
--                    "Auth users can insert" → authenticated INSERT
GRANT SELECT, INSERT ON public.request_responses TO authenticated;

-- favorites: "Users can read/insert/delete own" → authenticated SELECT, INSERT, DELETE
GRANT SELECT, INSERT, DELETE ON public.favorites TO authenticated;

-- reports: "Auth users can insert" → authenticated INSERT
--          "Admins/moderators can read" → authenticated SELECT
GRANT SELECT, INSERT, UPDATE ON public.reports TO authenticated;

-- notifications: "Users can read/update own" → authenticated SELECT, UPDATE
--                Multiple INSERT policies → authenticated INSERT
GRANT SELECT, INSERT, UPDATE ON public.notifications TO authenticated;

-- verification_applications: "Users can read/insert/update own" → authenticated SELECT, INSERT, UPDATE
GRANT SELECT, INSERT, UPDATE ON public.verification_applications TO authenticated;

-- listing_conversations: "Users can view/create own" → authenticated SELECT, INSERT
GRANT SELECT, INSERT ON public.listing_conversations TO authenticated;

-- listing_messages: "Users can view/send/mark read" → authenticated SELECT, INSERT, UPDATE
GRANT SELECT, INSERT, UPDATE ON public.listing_messages TO authenticated;

-- rentals: "Parties can view own" + "Admins can view all" → authenticated SELECT
--          "Owner can create/update" → authenticated INSERT, UPDATE
GRANT SELECT, INSERT, UPDATE ON public.rentals TO authenticated;

-- listing_requests: "Parties can view/list/update" → authenticated SELECT, INSERT, UPDATE
GRANT SELECT, INSERT, UPDATE ON public.listing_requests TO authenticated;

-- housing_request_offers: "Parties can view/insert/update" → authenticated SELECT, INSERT, UPDATE
GRANT SELECT, INSERT, UPDATE ON public.housing_request_offers TO authenticated;

-- request_conversations: "Parties can view/create" → authenticated SELECT, INSERT
GRANT SELECT, INSERT ON public.request_conversations TO authenticated;

-- request_messages: "Members can view/send/mark read" → authenticated SELECT, INSERT, UPDATE
GRANT SELECT, INSERT, UPDATE ON public.request_messages TO authenticated;

-- admin_audit_logs: "Admins can read/insert" → authenticated SELECT, INSERT
--                   (RLS policy restricts to admin/moderator role)
GRANT SELECT, INSERT ON public.admin_audit_logs TO authenticated;

-- ============================================================
-- TABLES EXCLUDED (service_role only, no anon/authenticated policies)
-- ============================================================
-- otp_codes:  "Service role only" policy — no anon/authenticated access.
-- login_attempts: No RLS policies — only service_role via GRANT ALL.
-- No GRANTs needed for these two tables.
