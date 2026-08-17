-- P6-DATA-01: published_at / created_at consistency.
--
-- Root cause: published_at was supplied by the client (client device clock) at
-- insert time while created_at is the database server clock, so a client clock
-- skew could set published_at earlier than created_at (observed on a live entry,
-- e.g. ec332ff2: published_at 2026-07-27 < created_at 2026-08-03). Draft records
-- could also carry a published_at. No database constraint/trigger guarded this.
--
-- Fix (server-side source fix; no historical rows are modified):
--   BEFORE INSERT OR UPDATE trigger public.sync_listing_published_at() ensures:
--     * publishable statuses always receive a server-side publish timestamp that
--       can never precede created_at (client-supplied published_at is ignored)
--     * non-publishable statuses (draft/rejected) never hold a published_at
--   created_at remains the database default (record creation time).
--   Previously-published states (paused/expired/reserved/negotiating/rented)
--   keep their existing published_at when it is already valid.

CREATE OR REPLACE FUNCTION public.sync_listing_published_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status::text IN ('active','pending_review','private_offer','reserved','negotiating','rented','paused','expired') THEN
    IF TG_OP = 'INSERT' OR NEW.published_at IS NULL OR NEW.published_at < NEW.created_at THEN
      NEW.published_at := now();
    END IF;
  ELSE
    NEW.published_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_listing_published_at_sync
  BEFORE INSERT OR UPDATE ON public.listings
  FOR EACH ROW EXECUTE FUNCTION public.sync_listing_published_at();