-- FCM Integration V2 Final: add UPDATE privilege + policy for device_tokens.
-- DeviceTokenService.register() uses .upsert(...), which PostgREST expands to
-- INSERT ... ON CONFLICT (user_id,token) DO UPDATE. That statement requires the
-- authenticated role to hold UPDATE on the table (INSERT/SELECT/DELETE alone
-- raise 42501), and a matching UPDATE RLS policy. Mirrors the existing
-- notification_preferences migration (grant UPDATE + an UPDATE policy).

GRANT UPDATE ON public.device_tokens TO authenticated;

CREATE POLICY "Users can update own tokens"
  ON public.device_tokens FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
