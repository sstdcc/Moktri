-- Create user_ratings table
CREATE TABLE public.user_ratings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rater_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rated_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT no_self_rating CHECK (rater_id <> rated_user_id),
  CONSTRAINT unique_rater_per_user UNIQUE (rater_id, rated_user_id)
);

CREATE INDEX idx_user_ratings_rated_user ON public.user_ratings(rated_user_id);
CREATE INDEX idx_user_ratings_created_at ON public.user_ratings(created_at DESC);

-- Enable RLS
ALTER TABLE public.user_ratings ENABLE ROW LEVEL SECURITY;

-- Anyone can read ratings (public profile feature)
CREATE POLICY "Anyone can read ratings"
ON public.user_ratings FOR SELECT
USING (true);

-- Authenticated users can rate others (not themselves)
CREATE POLICY "Users can insert own ratings"
ON public.user_ratings FOR INSERT
WITH CHECK (auth.uid() = rater_id AND auth.uid() <> rated_user_id);

-- Users can update their own ratings
CREATE POLICY "Users can update own ratings"
ON public.user_ratings FOR UPDATE
USING (auth.uid() = rater_id)
WITH CHECK (auth.uid() = rater_id);

-- Users can delete their own ratings
CREATE POLICY "Users can delete own ratings"
ON public.user_ratings FOR DELETE
USING (auth.uid() = rater_id);

-- Admins can manage all ratings
CREATE POLICY "Admins can update any rating"
ON public.user_ratings FOR UPDATE
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','moderator')));

CREATE POLICY "Admins can delete any rating"
ON public.user_ratings FOR DELETE
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','moderator')));

-- Updated_at trigger
CREATE TRIGGER update_user_ratings_updated_at
BEFORE UPDATE ON public.user_ratings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Aggregate stats function
CREATE OR REPLACE FUNCTION public.get_user_rating_stats(p_user_id UUID)
RETURNS TABLE(average_rating NUMERIC, total_reviews BIGINT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT 
    COALESCE(ROUND(AVG(rating)::numeric, 2), 0) AS average_rating,
    COUNT(*)::bigint AS total_reviews
  FROM public.user_ratings
  WHERE rated_user_id = p_user_id;
$$;