-- FCM Integration V2 Final — notification_preferences table.
-- Stores per-user push delivery preferences as JSONB. Read by the FCM Edge
-- Function to decide whether a given notification type should be delivered
-- as a push. The Settings page upserts this table; NotificationService keeps
-- its existing localStorage store for in-app toggle rendering (unchanged).
-- See FCM_Integration_V2_Final.md §3.2.

CREATE TABLE public.notification_preferences (
  user_id    UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  prefs      JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Table-level grants: RLS policies alone do not grant access; explicit
-- GRANTs are required for the authenticated role (project convention,
-- see migration 20260724150000). The Edge Function uses the service_role
-- key which bypasses both grants and RLS.

GRANT SELECT, INSERT, UPDATE ON public.notification_preferences TO authenticated;

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

-- Users own a single preference row (PK = user_id).
-- Upsert requires both INSERT and UPDATE privileges, so both policies exist.

CREATE POLICY "Users can upsert own preferences"
  ON public.notification_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own preferences"
  ON public.notification_preferences FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read own preferences"
  ON public.notification_preferences FOR SELECT
  USING (auth.uid() = user_id);
