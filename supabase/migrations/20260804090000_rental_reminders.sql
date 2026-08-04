-- Weekly "has this property been rented yet?" rental reminder.
--
-- Goals:
--   1. Every 7 days, while a listing is still 'active', notify the owner and
--      let them act from inside the notification card:
--        - "تم التأجير"  -> reuses the existing Mark-as-Rented workflow
--        - "ما زال متاحًا" -> keeps the listing ACTIVE and defers the next
--                             reminder by 7 days (updates last_rental_reminder_at).
--   2. Reuse the existing notification system end-to-end: the row inserted here
--      is delivered in-app via Supabase realtime and as a push via the existing
--      AFTER INSERT trigger (trg_fcm_delivery) -> send-fcm. No new delivery code.
--
-- This is additive and non-breaking:
--   - Adds one nullable column to listings (no existing column touched).
--   - Adds one new notification_type enum value (same additive pattern already
--     used for new_message / private_offer_* / rental_pending_review).
--   - Adds a SECURITY DEFINER function + a pg_cron schedule (pg_cron is already
--     installed). All other notification types and behaviors are untouched.

-- 1) Dedup / acknowledgment clock on listings.
-- This column is the ONLY per-listing state the reminder needs:
--   - the cron job resets it to now() whenever it sends a reminder, and
--   - the "ما زال متاحًا" action resets it to now() to defer the next one,
-- so the next reminder is always at least 7 days away. It is NOT used as the
-- "first reminder" gate — that is derived from published_at / created_at below,
-- so its initial value can never delay or break the 7-days-after-publish schedule.
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS last_rental_reminder_at timestamptz DEFAULT now();

-- Seed the clock from the publish moment (or creation fallback). This makes the
-- first reminder land ~7 days after publish, never on the deployment date:
--   - listing published 3+ weeks ago  -> clock is old -> reminder fires soon.
--   - listing published 2 days ago    -> clock is recent -> waits for day 7.
UPDATE public.listings
   SET last_rental_reminder_at = COALESCE(published_at, created_at, now());

-- 2) Distinct, additive notification type (kept separate from 'system' so the
--    UI can show the two action buttons only on THIS reminder).
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'rental_reminder';

-- 3) Reminder generator. SECURITY DEFINER so it can read listings and write
--    notifications regardless of RLS (the owner is the row's user_id).
CREATE OR REPLACE FUNCTION public.send_rental_reminders()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
  _n integer := 0;
BEGIN
  -- Eligible: still ACTIVE, published/created at least 7 days ago (so the
  -- first reminder is never sent before ~7 days after publish, regardless of
  -- the last_rental_reminder_at seed), and not reminded in the last 7 days.
  -- SKIP LOCKED makes the job safe if it ever runs concurrently.
  FOR r IN
    SELECT l.id, l.owner_id, l.title
      FROM public.listings l
     WHERE l.status = 'active'
       AND COALESCE(l.published_at, l.created_at) < now() - interval '7 days'
       AND (l.last_rental_reminder_at IS NULL
            OR l.last_rental_reminder_at < now() - interval '7 days')
     ORDER BY l.id
     FOR UPDATE OF l SKIP LOCKED
  LOOP
    INSERT INTO public.notifications (user_id, type, title_ar, body_ar, link)
    VALUES (
      r.owner_id,
      'rental_reminder',
      'هل تم تأجير العقار؟',
      'مر أسبوع على إعلان "' || r.title ||
        '". إذا تم تأجيره اضغط "تم التأجير"، أو اضغط "ما زال متاحًا" لتأجيل التذكير.',
      '/listings/' || r.id
    );

    -- Acknowledge now so this row is picked again only after another 7 days.
    UPDATE public.listings
       SET last_rental_reminder_at = now()
     WHERE id = r.id;

    _n := _n + 1;
  END LOOP;

  RETURN _n;
END;
$$;

-- 4) Schedule it daily at 03:00. The 7-day cadence is enforced by the
--    last_rental_reminder_at filter, so running daily is safe and idempotent.
--
--    IMPORTANT (why this does not use pg_extension.extnamespace): on pg_cron
--    >= 1.5 (all modern Supabase projects) pg_cron reports its extnamespace as
--    'pg_catalog' even though its objects live in the 'cron' schema, so reading
--    extnamespace yields `pg_catalog.job` (does not exist). Instead we locate
--    the schema that ACTUALLY owns the pg_cron `job` table (cron by default,
--    'extensions' only for old relocatable installs) and use it explicitly.
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
    _cron_schema, _cron_schema, 'rental-reminder'
  );

  -- Create / recreate the daily job.
  EXECUTE format(
    'SELECT %I.schedule(%L, %L, %L)',
    _cron_schema, 'rental-reminder', '0 3 * * *', 'SELECT public.send_rental_reminders()'
  );
END;
$$;