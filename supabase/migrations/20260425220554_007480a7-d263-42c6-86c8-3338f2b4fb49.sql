-- Production hardening fix: lock down profiles.phone and profiles.whatsapp_number
-- at the table privilege level for the `authenticated` role. The earlier column
-- REVOKE was overridden by an existing table-level GRANT SELECT.
-- Approach: revoke table-level SELECT, then re-grant SELECT only on the safe columns.

REVOKE SELECT ON public.profiles FROM authenticated;

GRANT SELECT (
  id, full_name, avatar_url, role, bio,
  is_verified, verification_badge, is_active,
  total_listings, total_responses,
  created_at, updated_at
) ON public.profiles TO authenticated;

-- anon already lacks SELECT; keep it that way.
REVOKE SELECT ON public.profiles FROM anon;
GRANT SELECT (
  id, full_name, avatar_url, role, bio,
  is_verified, verification_badge,
  total_listings, total_responses, created_at
) ON public.profiles TO anon;