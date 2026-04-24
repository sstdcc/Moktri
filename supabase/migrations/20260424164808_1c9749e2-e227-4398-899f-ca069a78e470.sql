
-- 1. RATINGS: enforce one rating per (rater, rated_user) pair
ALTER TABLE public.user_ratings
  ADD CONSTRAINT unique_rating_per_pair UNIQUE (rater_id, rated_user_id);

-- 2. PROFILES PRIVACY: restrict phone/whatsapp_number to authenticated users only.
-- Keep public SELECT policy, but use column-level privileges so anon cannot read PII columns.
REVOKE SELECT ON public.profiles FROM anon;
GRANT SELECT (
  id, full_name, avatar_url, role, bio,
  is_verified, verification_badge, is_active,
  total_listings, total_responses,
  created_at, updated_at
) ON public.profiles TO anon;

-- Authenticated users keep full SELECT (needed for chat/contact flows)
GRANT SELECT ON public.profiles TO authenticated;

-- 3. REPORTS: align SELECT policy with UPDATE policy (admin + moderator)
DROP POLICY IF EXISTS "Admins can read all reports" ON public.reports;
CREATE POLICY "Admins and moderators can read all reports"
ON public.reports
FOR SELECT
USING (
  auth.uid() = reporter_id
  OR EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin'::user_role, 'moderator'::user_role)
  )
);
