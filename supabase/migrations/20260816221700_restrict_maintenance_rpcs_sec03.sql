-- Security remediation: restrict write-capable maintenance RPCs to service_role only.
--
-- BUG-SEC-03: the following SECURITY DEFINER functions were executable by
--   anon/authenticated via the default PUBLIC EXECUTE grant (POST-only RPC
--   surfaces). They perform real writes (INSERT INTO notifications /
--   UPDATE listings / UPDATE housing_requests):
--
--   * public.send_rental_reminders()   -- inserts weekly rental reminder notifications
--   * public.send_request_reminders()  -- inserts weekly housing-request reminder notifications
--   * public.expire_stale_records()    -- marks expired listings/requests as 'expired'
--
--   These are periodic background jobs meant to run as service_role (cron /
--   scheduler). Anonymous publics execution is never needed and allows an
--   unauthenticated caller to trigger real database writes.
--
-- Fix: revoke the implicit PUBLIC default-execute grant and restrict EXECUTE
-- to service_role (same convention as 20260424204855, 20260725120000,
-- 20260816151613). Function bodies are NOT modified.

REVOKE ALL ON FUNCTION public.send_rental_reminders() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.send_request_reminders() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.expire_stale_records() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.send_rental_reminders() TO service_role;
GRANT EXECUTE ON FUNCTION public.send_request_reminders() TO service_role;
GRANT EXECUTE ON FUNCTION public.expire_stale_records() TO service_role;