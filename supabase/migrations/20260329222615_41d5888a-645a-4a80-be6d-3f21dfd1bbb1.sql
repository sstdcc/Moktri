
-- Increment listing views
CREATE OR REPLACE FUNCTION public.increment_listing_views(p_listing_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE listings SET views_count = views_count + 1 WHERE id = p_listing_id;
$$;

-- Increment contact clicks
CREATE OR REPLACE FUNCTION public.increment_contact_clicks(p_listing_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE listings SET contact_clicks = contact_clicks + 1 WHERE id = p_listing_id;
$$;

-- Increment whatsapp clicks
CREATE OR REPLACE FUNCTION public.increment_whatsapp_clicks(p_listing_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE listings SET whatsapp_clicks = whatsapp_clicks + 1 WHERE id = p_listing_id;
$$;
