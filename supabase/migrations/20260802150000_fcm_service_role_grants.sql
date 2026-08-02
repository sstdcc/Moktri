-- FCM Integration V2 Final — service_role grants for the FCM tables.
-- The send-fcm Edge Function authenticates with the service_role key. Its
-- DB queries (read preferences, read/delete device tokens) were failing with
-- "permission denied for table ... TO service_role" because the Phase 1
-- migrations only granted the authenticated role. BYPASSRLS skips RLS
-- *policies* but not table-level GRANTs, so service_role needs explicit
-- grants (project convention — see 20260724150000, 20260612014033).
-- Only the minimum privileges the Edge Function uses are granted.
-- See FCM_Integration_V2_Final.md §3.1, §3.2, §12.

GRANT SELECT, DELETE ON public.device_tokens TO service_role;

GRANT SELECT ON public.notification_preferences TO service_role;
