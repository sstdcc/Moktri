-- Weekly "have you found housing yet?" request reminder.
--
-- Mirrors the rental-listing reminder (20260804090000_rental_reminders.sql)
-- 1:1 in architecture and behavior:
--   - Every 7 days, while a housing request is still 'active', notify the
--     renter and let them act from inside the notification card:
--       - "وجدت السكن"    -> reuses the existing fulfilled workflow
--                            (housing_requests.status = 'fulfilled')
--       - "ما زلت أبحث"   -> keeps the request ACTIVE and defers the next
--                             reminder by 7 days (last_request_reminder_at).
--   - First reminder ~7 days after the request is created (no published_at
--     exists on housing_requests, so created_at is the anchor).
--   - Delivery reuses the existing system end-to-end: the inserted row shows
--     in-app via realtime and is pushed via the existing AFTER INSERT trigger
--     (trg_fcm_delivery) -> send-fcm. No new delivery code.
--
-- Additive and non-breaking:
--   - Adds one column to housing_requests.
--   - Adds one notification_type enum value (same additive pattern as
--     new_message / private_offer_* / rental_pending_review / rental_reminder).
--   - Adds a SECURITY DEFINER function + a pg_cron job. All other notification
--     types and request workflows are untouched.

-- 1) Dedup / acknowledgment clock on housing_requests.
-- The cron resets it to now() when it sends a reminder, and the "ما زلت أبحث"
-- action resets it to now() to defer the next one. Its initial value is NOT
-- the "first reminder" gate — that comes from created_at below — so it can
-- never delay or break the 7-days-after-creation schedule.
ALTER TABLE public.housing_requests
  ADD COLUMN IF NOT EXISTS last_request_reminder_at timestamptz DEFAULT now();

-- Seed the clock from the creation moment so the first reminder lands ~7 days
-- after the request is created, never on the deployment date.
UPDATE public.housing_requests
   SET last_request_reminder_at = COALESCE(created_at, now());

-- 2) Distinct, additive notification type (kept separate from 'system' so the
--    UI can show the two action buttons only on THIS reminder).
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'request_reminder';

-- 3) Reminder generator. SECURITY DEFINER so it can read housing_requests and
--    write notifications regardless of RLS (the requester is the row's user_id).
CREATE OR REPLACE FUNCTION public.send_request_reminders()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
  _n integer := 0;
BEGIN
  -- Eligible: still ACTIVE, created at least 7 days ago (so the first reminder
  -- is never sent before ~7 days after creation), and not reminded in the last
  -- 7 days. SKIP LOCKED makes the job safe if it ever runs concurrently.
  FOR r IN
    SELECT h.id, h.requester_id
      FROM public.housing_requests h
     WHERE h.status = 'active'
       AND COALESCE(h.created_at, now()) < now() - interval '7 days'
       AND (h.last_request_reminder_at IS NULL
            OR h.last_request_reminder_at < now() - interval '7 days')
     ORDER BY h.id
     FOR UPDATE OF h SKIP LOCKED
  LOOP
    INSERT INTO public.notifications (user_id, type, title_ar, body_ar, link)
    VALUES (
      r.requester_id,
      'request_reminder',
      'هل وجدت سكناً؟',
      'مر أسبوع على طلبك للسكن. إذا وجدت سكناً اضغط "وجدت السكن"، أو اضغط "ما زلت أبحث" لتأجيل التذكير.',
      '/requests/' || r.id
    );

    -- Acknowledge now so this row is picked again only after another 7 days.
    UPDATE public.housing_requests
       SET last_request_reminder_at = now()
     WHERE id = r.id;

    _n := _n + 1;
  END LOOP;

  RETURN _n;
END;
$$;

-- 4) Schedule it daily at 03:00. The 7-day cadence is enforced by the
--    last_request_reminder_at filter, so running daily is safe and idempotent.
--    Same pg_cron schema-resolution approach as the rental-reminder migration
--    (extnamespace is unreliable on pg_cron >= 1.5; locate the real `job` table).
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
DECLARE
  _cron_schema text := COALESCE(
    (SELECT n.nspname
       FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relname = 'job'
        AND c.relkind = 'r'
        AND n.nspname IN ('cron', 'extensions')
      ORDER BY (n.nspname = 'cron') DESC
      LIMIT 1),
    'cron'
  );
BEGIN
  -- Remove any previously-created job under this name (idempotent re-run).
  EXECUTE format(
    'SELECT %I.unschedule(jobid) FROM %I.job WHERE jobname = %L',
    _cron_schema, _cron_schema, 'request-reminder'
  );

  -- Create / recreate the daily job.
  EXECUTE format(
    'SELECT %I.schedule(%L, %L, %L)',
    _cron_schema, 'request-reminder', '0 3 * * *', 'SELECT public.send_request_reminders()'
  );
END;
$$;