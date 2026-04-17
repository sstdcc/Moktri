-- 1) Extend listing_status enum with two new values
ALTER TYPE public.listing_status ADD VALUE IF NOT EXISTS 'private_offer';
ALTER TYPE public.listing_status ADD VALUE IF NOT EXISTS 'reserved';

-- 2) Extend notification_type with new types for the private offer flow
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'private_offer_request';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'private_offer_created';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'private_offer_accepted';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'private_offer_rejected';