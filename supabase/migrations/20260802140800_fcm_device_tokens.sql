-- FCM Integration V2 Final — device_tokens table.
-- Stores one row per (user, device) that has registered for push delivery.
-- Referenced by the FCM Edge Function (via service_role, bypasses RLS) to
-- determine which devices receive a push for a newly created notification.
-- See FCM_Integration_V2_Final.md §3.1.

CREATE TABLE public.device_tokens (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  token      TEXT NOT NULL,
  platform   TEXT NOT NULL CHECK (platform IN ('web', 'android', 'ios')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- A user cannot register the same token twice.
CREATE UNIQUE INDEX idx_device_tokens_unique
  ON public.device_tokens (user_id, token);

-- Primary lookup path: all tokens for a user (Edge Function delivery).
CREATE INDEX idx_device_tokens_user
  ON public.device_tokens (user_id);

-- Table-level grants: RLS policies alone do not grant access; explicit
-- GRANTs are required for the authenticated role (project convention,
-- see migration 20260724150000). The Edge Function uses the service_role
-- key which bypasses both grants and RLS.

GRANT SELECT, INSERT, DELETE ON public.device_tokens TO authenticated;

ALTER TABLE public.device_tokens ENABLE ROW LEVEL SECURITY;

-- RLS: separate policies (not FOR ALL) so each operation's intent is explicit.
-- The Edge Function reads/deletes tokens via the service_role key, which
-- bypasses RLS entirely — no special policies are needed for delivery.

CREATE POLICY "Users can register own tokens"
  ON public.device_tokens FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own tokens"
  ON public.device_tokens FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own tokens"
  ON public.device_tokens FOR DELETE
  USING (auth.uid() = user_id);
