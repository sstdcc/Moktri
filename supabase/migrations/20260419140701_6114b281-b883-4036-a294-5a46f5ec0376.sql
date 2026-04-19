-- 1) Extend rental_status enum
ALTER TYPE public.rental_status ADD VALUE IF NOT EXISTS 'pending_review';

-- 2) Extend notification_type enum
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'rental_pending_review';