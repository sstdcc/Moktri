
-- Enums
CREATE TYPE public.user_role AS ENUM ('renter', 'owner', 'broker', 'admin', 'moderator');
CREATE TYPE public.verification_badge_status AS ENUM ('none', 'pending', 'verified', 'rejected');
CREATE TYPE public.listing_category AS ENUM ('room', 'apartment', 'house', 'floor', 'shop', 'office', 'shared', 'family', 'student');
CREATE TYPE public.billing_period AS ENUM ('monthly', 'yearly', 'daily');
CREATE TYPE public.furnishing_type AS ENUM ('furnished', 'semi_furnished', 'unfurnished');
CREATE TYPE public.allowed_for_type AS ENUM ('family', 'bachelors', 'students', 'all');
CREATE TYPE public.listing_status AS ENUM ('draft', 'pending_review', 'active', 'paused', 'rented', 'expired', 'rejected');
CREATE TYPE public.request_status AS ENUM ('active', 'fulfilled', 'expired', 'cancelled');
CREATE TYPE public.furnishing_preference AS ENUM ('any', 'furnished', 'unfurnished');
CREATE TYPE public.for_whom_type AS ENUM ('family', 'bachelors', 'students');
CREATE TYPE public.report_target_type AS ENUM ('listing', 'user', 'request');
CREATE TYPE public.report_reason AS ENUM ('fake', 'duplicate', 'inappropriate', 'spam', 'wrong_price', 'already_rented', 'other');
CREATE TYPE public.report_status AS ENUM ('pending', 'reviewed', 'resolved', 'dismissed');
CREATE TYPE public.notification_type AS ENUM ('new_response', 'listing_expiring', 'listing_approved', 'listing_rejected', 'verification_update', 'new_report', 'system');
CREATE TYPE public.verification_app_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE public.verification_role AS ENUM ('owner', 'broker');

-- profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT UNIQUE NOT NULL,
  avatar_url TEXT,
  role user_role NOT NULL DEFAULT 'renter',
  is_verified BOOLEAN DEFAULT FALSE,
  verification_badge verification_badge_status DEFAULT 'none',
  whatsapp_number TEXT,
  bio TEXT,
  total_listings INT DEFAULT 0,
  total_responses INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- districts
CREATE TABLE public.districts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_ar TEXT NOT NULL,
  name_en TEXT,
  city TEXT DEFAULT 'تعز',
  is_active BOOLEAN DEFAULT TRUE,
  listing_count INT DEFAULT 0
);
ALTER TABLE public.districts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read districts" ON public.districts FOR SELECT USING (true);

-- listings
CREATE TABLE public.listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  category listing_category NOT NULL,
  district_id UUID REFERENCES public.districts(id),
  neighborhood TEXT,
  price NUMERIC NOT NULL,
  currency TEXT DEFAULT 'YER',
  billing_period billing_period DEFAULT 'monthly',
  is_negotiable BOOLEAN DEFAULT FALSE,
  bedrooms INT,
  bathrooms INT,
  kitchens INT,
  floor_number INT,
  property_size NUMERIC,
  furnishing furnishing_type,
  allowed_for allowed_for_type DEFAULT 'all',
  has_water BOOLEAN DEFAULT FALSE,
  has_electricity BOOLEAN DEFAULT FALSE,
  has_parking BOOLEAN DEFAULT FALSE,
  has_internet BOOLEAN DEFAULT FALSE,
  status listing_status DEFAULT 'draft',
  is_featured BOOLEAN DEFAULT FALSE,
  is_urgent BOOLEAN DEFAULT FALSE,
  views_count INT DEFAULT 0,
  favorites_count INT DEFAULT 0,
  contact_clicks INT DEFAULT 0,
  whatsapp_clicks INT DEFAULT 0,
  quality_score INT DEFAULT 0,
  published_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  last_updated_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  moderation_note TEXT
);
ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read active listings" ON public.listings FOR SELECT USING (status = 'active' OR owner_id = auth.uid());
CREATE POLICY "Owners can insert listings" ON public.listings FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Owners can update own listings" ON public.listings FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "Owners can delete own listings" ON public.listings FOR DELETE USING (auth.uid() = owner_id);

-- listing_images
CREATE TABLE public.listing_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  is_primary BOOLEAN DEFAULT FALSE,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.listing_images ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read listing images" ON public.listing_images FOR SELECT USING (true);
CREATE POLICY "Owners can manage listing images" ON public.listing_images FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.listings WHERE id = listing_id AND owner_id = auth.uid())
);
CREATE POLICY "Owners can update listing images" ON public.listing_images FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.listings WHERE id = listing_id AND owner_id = auth.uid())
);
CREATE POLICY "Owners can delete listing images" ON public.listing_images FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.listings WHERE id = listing_id AND owner_id = auth.uid())
);

-- housing_requests
CREATE TABLE public.housing_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  category listing_category NOT NULL,
  district_id UUID REFERENCES public.districts(id),
  neighborhood TEXT,
  min_price NUMERIC,
  max_price NUMERIC,
  currency TEXT DEFAULT 'YER',
  bedrooms_needed INT,
  furnishing_preference furnishing_preference DEFAULT 'any',
  for_whom for_whom_type,
  move_in_date DATE,
  notes TEXT,
  status request_status DEFAULT 'active',
  responses_count INT DEFAULT 0,
  views_count INT DEFAULT 0,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.housing_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read active requests" ON public.housing_requests FOR SELECT USING (status = 'active' OR requester_id = auth.uid());
CREATE POLICY "Users can insert own requests" ON public.housing_requests FOR INSERT WITH CHECK (auth.uid() = requester_id);
CREATE POLICY "Users can update own requests" ON public.housing_requests FOR UPDATE USING (auth.uid() = requester_id);
CREATE POLICY "Users can delete own requests" ON public.housing_requests FOR DELETE USING (auth.uid() = requester_id);

-- request_responses
CREATE TABLE public.request_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.housing_requests(id) ON DELETE CASCADE,
  responder_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  listing_id UUID REFERENCES public.listings(id),
  message TEXT NOT NULL,
  contact_phone TEXT,
  contact_whatsapp TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.request_responses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Responders and requesters can read responses" ON public.request_responses FOR SELECT USING (
  responder_id = auth.uid() OR EXISTS (SELECT 1 FROM public.housing_requests WHERE id = request_id AND requester_id = auth.uid())
);
CREATE POLICY "Auth users can insert responses" ON public.request_responses FOR INSERT WITH CHECK (auth.uid() = responder_id);

-- favorites
CREATE TABLE public.favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, listing_id)
);
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own favorites" ON public.favorites FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own favorites" ON public.favorites FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own favorites" ON public.favorites FOR DELETE USING (auth.uid() = user_id);

-- reports
CREATE TABLE public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_type report_target_type NOT NULL,
  target_id UUID NOT NULL,
  reason report_reason NOT NULL,
  notes TEXT,
  status report_status DEFAULT 'pending',
  resolved_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users can insert reports" ON public.reports FOR INSERT WITH CHECK (auth.uid() = reporter_id);
CREATE POLICY "Admins can read all reports" ON public.reports FOR SELECT USING (
  auth.uid() = reporter_id OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- notifications
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type notification_type NOT NULL,
  title_ar TEXT,
  body_ar TEXT,
  link TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own notifications" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);

-- verification_applications
CREATE TABLE public.verification_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role verification_role NOT NULL,
  id_document_url TEXT,
  business_document_url TEXT,
  notes TEXT,
  status verification_app_status DEFAULT 'pending',
  reviewed_by UUID REFERENCES public.profiles(id),
  review_note TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.verification_applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own applications" ON public.verification_applications FOR SELECT USING (
  applicant_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Users can insert own applications" ON public.verification_applications FOR INSERT WITH CHECK (auth.uid() = applicant_id);

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), COALESCE(NEW.phone, ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
