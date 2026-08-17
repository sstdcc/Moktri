-- =============================================================
-- PHASE 8 FINDINGS REMEDIATION
-- Scope (5 findings, strictly):
--   P7-FIND-02  orphaned request_conversations/request_messages
--               + missing FK constraints on request_conversations
--   OBS-01      anon/UNN needed EXECUTE on conversation membership helpers
--   OBS-02      unnecessary anon EXECUTE on RPCs that self-guard
--
-- Not in this file (separate changes):
--   P7-FIND-01  verify-otp verify_jwt=false  -> supabase/config.toml + deploy
--   OBS-03      malformed JSON -> 400         -> edge function sources + deploy
--
-- Decisions (user-confirmed):
--   * 6 orphaned conversations + their 17 messages are deleted because every
--     one references a housing_request that no longer exists (housing_requests
--     is EMPTY) or a deleted requester profile; no row can ever be valid.
--   * FKs mirror listing_conversations convention (ON DELETE CASCADE).
-- =============================================================

-- ---------------------------------------------------------------
-- P7-FIND-02: remove orphaned request conversations
-- (request_messages cascade via request_messages_conversation_id_fkey)
-- ---------------------------------------------------------------
DELETE FROM public.request_conversations
WHERE request_id NOT IN (SELECT id FROM public.housing_requests)
   OR requester_id NOT IN (SELECT id FROM public.profiles)
   OR responder_id NOT IN (SELECT id FROM public.profiles);

-- ---------------------------------------------------------------
-- P7-FIND-02: add missing FK constraints on request_conversations
-- ---------------------------------------------------------------
ALTER TABLE public.request_conversations
  ADD CONSTRAINT request_conversations_request_id_fkey
  FOREIGN KEY (request_id) REFERENCES public.housing_requests(id) ON DELETE CASCADE;

ALTER TABLE public.request_conversations
  ADD CONSTRAINT request_conversations_requester_id_fkey
  FOREIGN KEY (requester_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.request_conversations
  ADD CONSTRAINT request_conversations_responder_id_fkey
  FOREIGN KEY (responder_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- ---------------------------------------------------------------
-- OBS-01: revoke PUBLIC EXECUTE on conversation membership helpers
-- Used by RLS policies on listing_messages / request_messages.
-- authenticated must keep EXECUTE (RLS evaluates as the querying role);
-- anon has no table SELECT grants on those tables, so revoking the
-- default PUBLIC grant closes the membership oracle without side effects.
-- ---------------------------------------------------------------
REVOKE ALL ON FUNCTION public.is_conversation_member(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_request_conversation_member(uuid, uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.is_conversation_member(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_request_conversation_member(uuid, uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------
-- OBS-02: revoke unnecessary anon/PUBLIC EXECUTE on RPCs that
-- already self-guard against unauthenticated callers
-- (auth.uid() IS NULL -> RAISE 'غير مسجل'; admin_ban_user also checks role).
-- anon can never complete these; the default PUBLIC grant is pointless
-- attack surface. authenticated + service_role keep EXECUTE.
-- ---------------------------------------------------------------
REVOKE ALL ON FUNCTION public.admin_ban_user(uuid, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.complete_housing_request_offer(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.confirm_rental_deal(uuid, uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.admin_ban_user(uuid, boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.complete_housing_request_offer(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.confirm_rental_deal(uuid, uuid) TO authenticated, service_role;