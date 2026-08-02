-- FCM Integration V2 Final — database trigger that fires after each INSERT
-- into the notifications table and asynchronously calls the send-fcm Edge
-- Function via pg_net. This is the ONLY integration point between the
-- existing notification system and the FCM delivery layer. It is fire-and-
-- forget: if the Edge Function is unreachable, the notification INSERT still
-- succeeds and the in-app notification flow is unaffected.
-- See FCM_Integration_V2_Final.md §3.3.

CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS supabase_vault;

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
  -- Edge Function URL and shared secret are stored as Supabase Vault secrets
  -- (see migration 20260802143000_fcm_vault_config.sql):
  --   SELECT vault.create_secret('https://<project-ref>.functions.supabase.co/send-fcm', 'fcm_edge_function_url');
  --   SELECT vault.create_secret('<random-secret>', 'fcm_function_secret');
  -- Hosted Supabase does not permit ALTER DATABASE ... SET for custom
  -- app.settings.* GUCs (the postgres role is not superuser), so the trigger
  -- reads its configuration from Vault instead of current_setting(...).
  SELECT decrypted_secret INTO _function_url
    FROM vault.decrypted_secrets
   WHERE name = 'fcm_edge_function_url';

  SELECT decrypted_secret INTO _secret
    FROM vault.decrypted_secrets
   WHERE name = 'fcm_function_secret';

  -- Skip silently if the configuration is not present yet (pre-deploy window).
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

CREATE TRIGGER trg_fcm_delivery
  AFTER INSERT ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_fcm_delivery();
