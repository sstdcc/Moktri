-- Security remediation: restrict SECURITY DEFINER RPCs to service_role only.
--
-- BUG-SEC-01: public.get_user_email_by_phone(p_phone) was executable by
--   anon/authenticated (default PUBLIC EXECUTE on a SECURITY DEFINER PL/pgSQL
--   function), allowing phone -> email lookups via REST RPC.
-- BUG-SEC-02: public.check_email_exists(p_email) was executable by
--   anon/authenticated, enabling registered-email enumeration via REST RPC.
--
-- Both functions are only consumed server-side by edge functions running with
-- the service_role key (send-otp / verify-otp call check_email_exists; the
-- phone lookup is a secure-login helper). They are SECURITY DEFINER because
-- they must read auth.users. Anonymous/public execution is never needed.
--
-- Fix: revoke the implicit PUBLIC default-execute grant and restrict EXECUTE
-- to service_role (project convention, see 20260424204855, 20260725120000).

REVOKE ALL ON FUNCTION public.check_email_exists(p_email TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_user_email_by_phone(p_phone TEXT) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.check_email_exists(p_email TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_user_email_by_phone(p_phone TEXT) TO service_role;