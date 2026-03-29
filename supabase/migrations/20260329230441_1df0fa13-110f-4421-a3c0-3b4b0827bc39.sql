
-- Fix handle_new_user to use phone from metadata or auth phone, and handle conflicts
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.phone, NEW.raw_user_meta_data->>'phone', '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Insert test auth users with proper phone numbers so the trigger creates profiles with phones
INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, phone, created_at, updated_at, confirmation_token, raw_app_meta_data, raw_user_meta_data)
VALUES 
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'test-owner@miftah.ye', crypt('testpassword123', gen_salt('bf')), now(), '+967712345678', now(), now(), '', '{"provider":"email","providers":["email"]}', '{"full_name":"أحمد محمد الحامد","phone":"+967712345678"}'),
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'test-broker@miftah.ye', crypt('testpassword123', gen_salt('bf')), now(), '+967733456789', now(), now(), '', '{"provider":"email","providers":["email"]}', '{"full_name":"خالد عبدالله السعدي","phone":"+967733456789"}')
ON CONFLICT (id) DO NOTHING;

-- Update the profiles with correct roles
UPDATE profiles SET role = 'owner', is_verified = true, verification_badge = 'verified', total_listings = 5, whatsapp_number = '+967712345678' WHERE id = '00000000-0000-0000-0000-000000000001';
UPDATE profiles SET role = 'broker', is_verified = true, verification_badge = 'verified', total_listings = 12, whatsapp_number = '+967733456789' WHERE id = '00000000-0000-0000-0000-000000000002';

-- Insert sample listings
INSERT INTO listings (owner_id, title, description, category, district_id, neighborhood, price, currency, billing_period, is_negotiable, bedrooms, bathrooms, kitchens, floor_number, property_size, furnishing, allowed_for, has_water, has_electricity, has_parking, has_internet, status, is_featured, is_urgent, views_count, favorites_count, published_at, expires_at, last_updated_at, quality_score)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'شقة ثلاث غرف مفروشة بالكامل في حي الأندلس', 'شقة واسعة ومريحة في موقع ممتاز، مفروشة بالكامل بأثاث حديث، قريبة من جميع الخدمات', 'apartment', 'f85af7ba-25db-4d7b-a1b0-e596a21c2477', 'حي الأندلس', 45000, 'YER', 'monthly', false, 3, 2, 1, 2, 120, 'furnished', 'family', true, true, false, true, 'active', true, false, 250, 5, now() - interval '2 days', now() + interval '60 days', now() - interval '1 day', 85),
  ('00000000-0000-0000-0000-000000000002', 'غرفة مستقلة للإيجار في حي الحوبان', 'غرفة نظيفة وهادئة مع حمام خاص، مناسبة للطلاب والموظفين', 'room', '254adcf0-19a8-4677-8e46-0372526f475e', 'حي الحوبان', 12000, 'YER', 'monthly', true, 1, 1, 0, 3, 25, 'furnished', 'students', true, true, false, true, 'active', false, false, 89, 2, now() - interval '5 days', now() + interval '60 days', now() - interval '3 days', 70),
  ('00000000-0000-0000-0000-000000000001', 'بيت كامل مناسب للعائلات في المدينة القديمة', 'بيت تقليدي واسع يتكون من طابقين، يناسب العائلات الكبيرة', 'house', '48a2f900-c06d-4f28-97e4-b19fea33c441', 'المدينة القديمة', 80000, 'YER', 'monthly', false, 5, 2, 2, 1, 200, 'unfurnished', 'family', true, true, true, false, 'active', false, false, 412, 8, now() - interval '10 days', now() + interval '60 days', now() - interval '5 days', 90),
  ('00000000-0000-0000-0000-000000000002', 'شقة غرفتين وصالة في الربوة', 'شقة حديثة في منطقة هادئة، مناسبة للعائلات الصغيرة', 'apartment', '1e564337-245d-4461-bd2b-bb440220e3ef', 'منطقة الربوة', 35000, 'YER', 'monthly', true, 2, 1, 1, 2, 95, 'semi_furnished', 'family', true, true, false, true, 'active', true, false, 178, 3, now() - interval '1 day', now() + interval '60 days', now(), 80),
  ('00000000-0000-0000-0000-000000000001', 'محل تجاري في حي الأندلس', 'محل واجهة زجاجية في شارع تجاري مزدحم', 'shop', 'f85af7ba-25db-4d7b-a1b0-e596a21c2477', 'حي الأندلس', 60000, 'YER', 'monthly', false, 0, 1, 0, 1, 45, 'unfurnished', 'all', true, true, true, false, 'active', false, false, 320, 6, now() - interval '15 days', now() + interval '60 days', now() - interval '10 days', 75),
  ('00000000-0000-0000-0000-000000000002', 'دور كامل في حي السعدة', 'دور سكني كامل يحتوي على 4 غرف، مدخل مستقل', 'floor', 'c76bc5e0-b70a-46b1-b270-167717ee923c', 'حي السعدة', 55000, 'YER', 'monthly', true, 4, 2, 1, 1, 150, 'unfurnished', 'family', true, true, false, true, 'active', false, false, 267, 4, now() - interval '7 days', now() + interval '60 days', now() - interval '4 days', 85),
  ('00000000-0000-0000-0000-000000000001', 'مكتب للإيجار في حي الروضة', 'مكتب احترافي بمساحة 60 متر في مبنى حديث', 'office', '0430e99d-7021-48a3-aff3-8189f047c731', 'حي الروضة', 40000, 'YER', 'monthly', false, 0, 1, 0, 2, 60, 'furnished', 'all', true, true, true, true, 'active', false, false, 145, 1, now() - interval '20 days', now() + interval '60 days', now() - interval '15 days', 80),
  ('00000000-0000-0000-0000-000000000002', 'شقة طلابية قريبة من الجامعة', 'شقة مناسبة للطلاب مفروشة بالأساسيات', 'apartment', '9d96881b-37d7-4663-a8dc-ee21a887169b', 'حي الحصب', 18000, 'YER', 'monthly', false, 2, 1, 1, 3, 50, 'furnished', 'students', true, true, false, true, 'active', false, true, 98, 2, now() - interval '1 day', now() + interval '60 days', now(), 75);

-- Insert images
INSERT INTO listing_images (listing_id, url, is_primary, sort_order)
SELECT l.id,
  CASE (row_number() OVER (ORDER BY l.created_at)) % 4
    WHEN 0 THEN 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800&q=80'
    WHEN 1 THEN 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&q=80'
    WHEN 2 THEN 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&q=80'
    ELSE 'https://images.unsplash.com/photo-1484154218962-a197022b5858?w=800&q=80'
  END,
  true, 0
FROM listings l
WHERE NOT EXISTS (SELECT 1 FROM listing_images li WHERE li.listing_id = l.id);

-- Update district listing counts
UPDATE districts d SET listing_count = (SELECT COUNT(*) FROM listings l WHERE l.district_id = d.id AND l.status = 'active');
