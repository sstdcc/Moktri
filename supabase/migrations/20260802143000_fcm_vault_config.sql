-- FCM Integration V2 Final — Vault-backed trigger configuration.
-- Hosted Supabase does not permit ALTER DATABASE ... SET app.settings.* for
-- custom GUCs (the postgres role is not superuser; 42501 permission denied).
-- Per the approved decision, the FCM trigger reads its Edge Function URL and
-- shared secret from Supabase Vault instead of current_setting(...). The
-- trigger design (pg_net, fire-and-forget, SECURITY DEFINER, error swallow,
-- X-FCM-Secret header) is unchanged. See FCM_Integration_V2_Final.md §3.3.

-- 1. Ensure the Vault extension is available (already installed by default).
CREATE EXTENSION IF NOT EXISTS supabase_vault;

-- 2. Store the FCM trigger configuration as Vault secrets (idempotent).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'fcm_edge_function_url') THEN
    PERFORM vault.create_secret(
      'https://mplctfygsizzchwewqbh.functions.supabase.co/send-fcm',
      'fcm_edge_function_url'
    );
  END IF;

  -- fcm_function_secret is intentionally NOT created here to keep the shared
  -- secret out of the repository. Create it manually at deploy time via
  -- SELECT vault.create_secret('<value>', 'fcm_function_secret'); so that it
  -- matches FCM_FUNCTION_SECRET in Supabase Secrets.
END;
$$;

-- 3. Rewrite the trigger function to read configuration from Vault.
--    CREATE OR REPLACE keeps the existing trg_fcm_delivery trigger attached.
CREATE OR REPLACE FUNCTION public.trigger_fcm_delivery()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _function_url TEXT;
  _secret       TEXT;
BEGIN
  SELECT decrypted_secret INTO _function_url
    FROM vault.decrypted_secrets
   WHERE name = 'fcm_edge_function_url';

  SELECT decrypted_secret INTO _secret
    FROM vault.decrypted_secrets
   WHERE name = 'fcm_function_secret';

  -- Skip silently if the configuration is not present yet (deployment window).
  IF _function_url IS NULL OR _secret IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url     := _function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-FCM-Secret', _secret
    ),
    body    := jsonb_build_object(
      'notification_id', NEW.id,
      'user_id',         NEW.user_id,
      'type',            NEW.type,
      'title_ar',        NEW.title_ar,
      'body_ar',         NEW.body_ar,
      'link',            NEW.link
    )
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log and swallow: a push-delivery failure must never block the
    -- notification INSERT or break the in-app notification flow.
    RAISE WARNING 'trigger_fcm_delivery: failed for notification % — %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;
