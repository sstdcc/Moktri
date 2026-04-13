
-- Add governorate and city_name to listings
ALTER TABLE public.listings ADD COLUMN governorate text;
ALTER TABLE public.listings ADD COLUMN city_name text;

-- Add governorate and city_name to housing_requests
ALTER TABLE public.housing_requests ADD COLUMN governorate text;
ALTER TABLE public.housing_requests ADD COLUMN city_name text;
