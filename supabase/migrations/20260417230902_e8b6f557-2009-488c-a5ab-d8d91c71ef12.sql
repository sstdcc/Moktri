-- Dedupe: keep the most recent rating per (rater_id, rated_user_id)
DELETE FROM public.user_ratings ur
USING public.user_ratings ur2
WHERE ur.rater_id = ur2.rater_id
  AND ur.rated_user_id = ur2.rated_user_id
  AND ur.id <> ur2.id
  AND (ur.updated_at, ur.created_at, ur.id) < (ur2.updated_at, ur2.created_at, ur2.id);

-- Now enforce uniqueness per pair
CREATE UNIQUE INDEX IF NOT EXISTS user_ratings_unique_pair
  ON public.user_ratings (rater_id, rated_user_id);